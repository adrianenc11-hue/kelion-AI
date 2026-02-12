/**
 * Email Webhook — Receives forwarded emails and processes them
 * Supports: SendGrid, Mailgun, generic SMTP-to-webhook services
 * Stores emails in Supabase and can auto-respond via AI
 */

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();
        const db = getDB();

        // ═══ POST — Receive forwarded email ═══
        if (event.httpMethod === 'POST') {
            let emailData;

            const contentType = event.headers['content-type'] || '';

            if (contentType.includes('application/json')) {
                // JSON payload (generic webhook)
                emailData = JSON.parse(event.body || '{}');
            } else if (contentType.includes('multipart/form-data')) {
                // Form data (SendGrid/Mailgun)
                emailData = parseFormEmail(event.body, contentType);
            } else {
                // Try JSON first
                try {
                    emailData = JSON.parse(event.body || '{}');
                } catch {
                    emailData = { raw: event.body };
                }
            }

            // Normalize email fields
            const email = {
                from: emailData.from || emailData.sender || emailData.envelope?.from || 'unknown',
                to: emailData.to || emailData.recipient || emailData.envelope?.to || 'contact@kelionai.app',
                subject: emailData.subject || emailData.Subject || '(no subject)',
                body_text: emailData.text || emailData['body-plain'] || emailData.body || '',
                body_html: emailData.html || emailData['body-html'] || '',
                date: emailData.date || emailData.Date || new Date().toISOString(),
                message_id: emailData['message-id'] || emailData.messageId || null,
                source: emailData.source || detectEmailSource(event.headers),
                attachments: emailData.attachments || emailData['attachment-count'] || 0,
                spam_score: emailData.spam_score || emailData['X-Mailgun-SScore'] || null,
                status: 'received'
            };

            // Store in Supabase
            if (db) {
                const { error } = await db.from('emails_received').insert({
                    from_email: email.from,
                    to_email: email.to,
                    subject: email.subject,
                    body_text: email.body_text.substring(0, 10000),
                    body_html: email.body_html.substring(0, 50000),
                    source: email.source,
                    message_id: email.message_id,
                    status: email.status,
                    created_at: new Date().toISOString()
                });

                if (error) console.error('[email-webhook] DB error:', error.message);

                // Log to webhook monitor
                try {
                    await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/webhook-monitor`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'log',
                            source: 'email',
                            event_type: 'email_received',
                            status: 'received',
                            direction: 'inbound',
                            payload: `From: ${email.from} | Subject: ${email.subject}`
                        })
                    });
                } catch (e) { /* non-critical */ }

                // Notify admin
                try {
                    await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/admin-notify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'add',
                            type: 'email',
                            message: `📧 Email from ${email.from}: ${email.subject}`,
                            data: { from: email.from, subject: email.subject }
                        })
                    });
                } catch (e) { /* non-critical */ }
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, message: 'Email received', from: email.from, subject: email.subject })
            };
        }

        // ═══ GET — List received emails (admin) ═══
        if (event.httpMethod === 'GET') {
            if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, emails: [] }) };

            const { data, error } = await db.from('emails_received')
                .select('id, from_email, to_email, subject, status, source, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, emails: data || [], total: (data || []).length })
            };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        console.error('Email webhook error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

function detectEmailSource(headers) {
    if (headers['x-mailgun-tag']) return 'mailgun';
    if (headers['x-sg-event-id']) return 'sendgrid';
    if (headers['x-ses-message-id']) return 'ses';
    return 'generic';
}

function parseFormEmail(body, contentType) {
    // Basic multipart form parser for email webhooks
    try {
        const boundary = contentType.split('boundary=')[1]?.split(';')[0]?.trim();
        if (!boundary) return { raw: body };

        const parts = body.split(`--${boundary}`);
        const result = {};

        for (const part of parts) {
            const nameMatch = part.match(/name="([^"]+)"/);
            if (nameMatch) {
                const name = nameMatch[1];
                const valueStart = part.indexOf('\r\n\r\n');
                if (valueStart > -1) {
                    result[name] = part.substring(valueStart + 4).trim();
                }
            }
        }

        return result;
    } catch {
        return { raw: body };
    }
}
