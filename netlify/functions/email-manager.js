/**
 * Email Manager — K manages user email on demand
 * For ALL users (Pro, Family, Business)
 * Actions: connect_email, list_inbox, read_email, compose_email, send_email, search_emails
 * Uses Gmail API + OAuth2
 */

const { createClient } = require('@supabase/supabase-js');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = (process.env.URL || 'https://kelionai.app') + '/.netlify/functions/email-manager?action=oauth_callback';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// Exchange code for tokens
async function exchangeCodeForTokens(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });
    return response.json();
}

// Refresh access token
async function refreshAccessToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token'
        })
    });
    return response.json();
}

// Get valid access token for user
async function getAccessToken(supabase, userEmail) {
    const { data: tokenData } = await supabase
        .from('user_email_tokens')
        .select('*')
        .eq('email', userEmail)
        .single();

    if (!tokenData) return null;

    // Check if token is expired
    const now = new Date();
    const expiry = new Date(tokenData.token_expiry);

    if (now >= expiry) {
        // Refresh
        const refreshed = await refreshAccessToken(tokenData.refresh_token);
        if (refreshed.error) return null;

        const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000);
        await supabase.from('user_email_tokens').update({
            access_token: refreshed.access_token,
            token_expiry: newExpiry.toISOString(),
            updated_at: new Date().toISOString()
        }).eq('email', userEmail);

        return refreshed.access_token;
    }

    return tokenData.access_token;
}

// Gmail API helper
async function gmailAPI(accessToken, endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, options);
    return response.json();
}

// Decode base64url
function decodeBase64Url(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64').toString('utf-8');
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // Handle OAuth callback (GET request)
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};

        if (params.action === 'oauth_callback' && params.code) {
            if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
                return { statusCode: 503, headers: { 'Content-Type': 'text/html' }, body: '<h1>Google OAuth not configured</h1>' };
            }

            const tokens = await exchangeCodeForTokens(params.code);

            if (tokens.error) {
                return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: `<h1>Error: ${tokens.error_description}</h1>` };
            }

            // Get user email from token
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            }).then(r => r.json());

            const supabase = getSupabase();
            if (supabase) {
                const expiry = new Date(Date.now() + tokens.expires_in * 1000);
                await supabase.from('user_email_tokens').upsert({
                    email: userInfo.email,
                    provider: 'gmail',
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expiry: expiry.toISOString(),
                    connected_at: new Date().toISOString()
                }, { onConflict: 'email' });
            }

            // Redirect back to app with success
            return {
                statusCode: 302,
                headers: { 'Location': '/app.html?email_connected=true' },
                body: ''
            };
        }

        // Default GET — connect email (start OAuth)
        if (!GOOGLE_CLIENT_ID) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Google OAuth not configured', config_missing: 'GOOGLE_CLIENT_ID' }) };
        }

        const scopes = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, auth_url: authUrl }) };
    }

    // POST actions
    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };

    try {
        const body = JSON.parse(event.body || '{}');
        const { action, email } = body;

        if (!email) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };
        }

        // Check if email connected (except connect action)
        if (action !== 'connect_email') {
            const accessToken = await getAccessToken(supabase, email);
            if (!accessToken) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email not connected. Connect via Gmail OAuth first.', needs_connect: true }) };
            }
            // Attach token for use
            body._accessToken = accessToken;
        }

        switch (action) {

            // ═══ CONNECT EMAIL ═══
            case 'connect_email': {
                if (!GOOGLE_CLIENT_ID) {
                    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Google OAuth not configured', config_missing: 'GOOGLE_CLIENT_ID' }) };
                }

                const scopes = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify';
                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, auth_url: authUrl, message: 'Open this URL to connect your Gmail account' })
                };
            }

            // ═══ LIST INBOX ═══
            case 'list_inbox': {
                const { max_results } = body;
                const data = await gmailAPI(body._accessToken, `messages?maxResults=${max_results || 10}&labelIds=INBOX`);

                if (!data.messages) {
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, emails: [], count: 0 }) };
                }

                // Fetch details for each message
                const emails = [];
                for (const msg of data.messages.slice(0, max_results || 10)) {
                    const detail = await gmailAPI(body._accessToken, `messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);

                    const getHeader = (name) => {
                        const h = detail.payload?.headers?.find(h => h.name === name);
                        return h ? h.value : '';
                    };

                    emails.push({
                        id: msg.id,
                        threadId: msg.threadId,
                        snippet: detail.snippet,
                        from: getHeader('From'),
                        subject: getHeader('Subject'),
                        date: getHeader('Date'),
                        unread: detail.labelIds?.includes('UNREAD') || false
                    });
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, emails, count: emails.length })
                };
            }

            // ═══ READ EMAIL ═══
            case 'read_email': {
                const { message_id } = body;
                if (!message_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'message_id required' }) };
                }

                const detail = await gmailAPI(body._accessToken, `messages/${message_id}?format=full`);

                const getHeader = (name) => {
                    const h = detail.payload?.headers?.find(h => h.name === name);
                    return h ? h.value : '';
                };

                // Extract body text
                let bodyText = '';
                if (detail.payload?.body?.data) {
                    bodyText = decodeBase64Url(detail.payload.body.data);
                } else if (detail.payload?.parts) {
                    const textPart = detail.payload.parts.find(p => p.mimeType === 'text/plain');
                    if (textPart?.body?.data) {
                        bodyText = decodeBase64Url(textPart.body.data);
                    }
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        email: {
                            id: detail.id,
                            from: getHeader('From'),
                            to: getHeader('To'),
                            subject: getHeader('Subject'),
                            date: getHeader('Date'),
                            body: bodyText,
                            snippet: detail.snippet
                        }
                    })
                };
            }

            // ═══ SEND EMAIL ═══
            case 'send_email': {
                const { to, subject, body: emailBody } = body;
                if (!to || !subject || !emailBody) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'to, subject, body required' }) };
                }

                // Create RFC 2822 formatted email
                const rawEmail = [
                    `To: ${to}`,
                    `Subject: ${subject}`,
                    'Content-Type: text/plain; charset=utf-8',
                    '',
                    emailBody
                ].join('\r\n');

                const encodedEmail = Buffer.from(rawEmail).toString('base64')
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                const result = await gmailAPI(body._accessToken, 'messages/send', 'POST', { raw: encodedEmail });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        message: `Email sent to ${to}`,
                        messageId: result.id
                    })
                };
            }

            // ═══ SEARCH EMAILS ═══
            case 'search_emails': {
                const { query, max_results } = body;
                if (!query) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'query required (e.g. "from:john subject:meeting")' }) };
                }

                const data = await gmailAPI(body._accessToken, `messages?q=${encodeURIComponent(query)}&maxResults=${max_results || 10}`);

                if (!data.messages) {
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, emails: [], count: 0 }) };
                }

                const emails = [];
                for (const msg of data.messages.slice(0, max_results || 10)) {
                    const detail = await gmailAPI(body._accessToken, `messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`);
                    const getHeader = (name) => detail.payload?.headers?.find(h => h.name === name)?.value || '';
                    emails.push({
                        id: msg.id,
                        snippet: detail.snippet,
                        from: getHeader('From'),
                        subject: getHeader('Subject'),
                        date: getHeader('Date'),
                        unread: detail.labelIds?.includes('UNREAD') || false
                    });
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, emails, count: emails.length, query })
                };
            }

            // ═══ CHECK CONNECTION STATUS ═══
            case 'check_status': {
                const { data: tokenRow } = await supabase
                    .from('user_email_tokens')
                    .select('provider, connected_at, token_expiry')
                    .eq('email', email)
                    .single();

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        connected: !!tokenRow,
                        provider: tokenRow?.provider || null,
                        connected_at: tokenRow?.connected_at || null
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        service: 'email-manager',
                        actions: ['connect_email', 'check_status', 'list_inbox', 'read_email', 'send_email', 'search_emails']
                    })
                };
        }
    } catch (error) {
        console.error('Email manager error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
