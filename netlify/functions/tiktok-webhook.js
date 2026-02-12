// ═══ TIKTOK WEBHOOK — K Pension Expert — Responds to TikTok comments ═══
// K răspunde la comentarii pe video-uri despre pensii
// Setup: TikTok Developer App → Webhook URL

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

const SITE_FOOTER = '\n\n🌐 kelionai.app';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    await patchProcessEnv();

    // ═══ WEBHOOK VERIFICATION ═══
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        if (params.challenge) {
            console.log('✅ TikTok webhook verified');
            return { statusCode: 200, body: params.challenge };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, type: 'tiktok-webhook', status: 'active' }) };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'POST only' };

    try {
        const body = JSON.parse(event.body || '{}');

        // TikTok webhook event — comment on video
        if (body.event === 'comment.create' || body.event === 'comment') {
            const comment = body.data || body.comment || {};
            const text = comment.text || comment.content || '';
            const userId = comment.user_id || comment.author_id || 'unknown';
            const commentId = comment.comment_id || comment.id || '';

            if (text && isPensionQuestion(text)) {
                const response = await generateResponse(text);
                await replyToComment(commentId, response);
                await logInteraction('tiktok', userId, text, response);
            }
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
        }

        // Direct test
        if (body.test_message) {
            const response = await generateResponse(body.test_message);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
    } catch (err) {
        console.error('TikTok webhook error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', message: err.message }) };
    }
};

// ═══ GENERATE RESPONSE ═══
async function generateResponse(question) {
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const aiRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Întrebare pensie (TikTok comment, max 150 chars): ${question}`,
                system: 'Ești K, expert pensii. Răspunde SCURT (max 150 chars), clar, prietenos, profesionist. Citează legea dacă e relevant. Doar pensii.',
                model: 'auto',
                max_tokens: 200
            })
        });
        if (aiRes.ok) {
            const data = await aiRes.json();
            const text = data.reply || data.response || data.text || data.content || '';
            if (text.length > 20) return text.slice(0, 300).trim() + SITE_FOOTER;
        }
    } catch (e) { console.error('AI error:', e.message); }

    // Fallback
    return 'Bună întrebare! Scrie-ne pe Messenger pentru răspuns detaliat. 💬' + SITE_FOOTER;
}

// ═══ CHECK IF PENSION QUESTION ═══
function isPensionQuestion(text) {
    const msg = text.toLowerCase();
    const pensionWords = ['pensie', 'pensionar', 'pensionare', 'recalculare', 'varsta', 'stagiu',
        'documente', 'drepturi', 'calcul', 'punctaj', 'grupe', 'militar', 'urmas',
        'cand ma pensionez', 'cat primesc', 'pilon', 'contribut'];
    return pensionWords.some(w => msg.includes(w));
}

// ═══ GET TIKTOK ACCESS TOKEN (auto-generate if needed) ═══
async function getTikTokToken() {
    if (process.env.TIKTOK_ACCESS_TOKEN) return process.env.TIKTOK_ACCESS_TOKEN;

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) return null;

    try {
        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `client_key=${clientKey}&client_secret=${clientSecret}&grant_type=client_credentials`
        });
        if (res.ok) {
            const data = await res.json();
            return data.access_token || null;
        }
    } catch (e) { console.error('Token generation error:', e.message); }
    return null;
}

// ═══ REPLY TO TIKTOK COMMENT ═══
async function replyToComment(commentId, text) {
    const accessToken = await getTikTokToken();
    if (!accessToken) { console.error('❌ No TikTok access token available'); return; }

    try {
        const res = await fetch('https://open.tiktokapis.com/v2/comment/reply/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                comment_id: commentId,
                text: text.slice(0, 300) // TikTok comment limit
            })
        });
        const data = await res.json();
        if (data.error) console.error('TikTok API error:', data.error);
        else console.log(`✅ TikTok reply sent on comment ${commentId}`);
    } catch (err) { console.error('TikTok reply error:', err.message); }
}

// ═══ LOG INTERACTION ═══
async function logInteraction(platform, userId, question, response) {
    const db = getSupabase();
    if (!db) return;
    try {
        await db.from('messenger_logs').insert({
            sender_id: userId,
            platform,
            user_message: question.slice(0, 1000),
            bot_response: response.slice(0, 2000),
            topic: 'tiktok_comment',
            created_at: new Date().toISOString()
        });
    } catch (e) { console.error('Log error:', e.message); }
}
