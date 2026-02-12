// ═══ AUTO-POSTER API — HTTP Entry Point ═══
// Netlify Function — HTTP accessible (no schedule)
// Provides: status, preview, post_now actions via POST
//
// The cron posting is handled by auto-poster.js (scheduled function)
// This function provides the HTTP API for manual control and monitoring

const { respond, getStatus, previewNext, postNow } = require('./auto-poster-core');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// ═══ HANDLER — HTTP accessible ═══
exports.handler = async (event) => {
    // OPTIONS — CORS preflight
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const action = body.action || 'status';

        switch (action) {
            case 'status':
                return respond(200, getStatus());

            case 'preview':
                return respond(200, await previewNext());

            case 'post_now':
                return respond(200, await postNow(body.platform || 'facebook', body.topic_id));

            default:
                return respond(400, { error: 'Actions: status, preview, post_now' });
        }
    } catch (err) {
        console.error('❌ Auto-poster API error:', err.message);
        return respond(500, { error: err.message });
    }
};
