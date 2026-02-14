// ═══ AUTO-POSTER — Scheduled (Cron) Entry Point ═══
// Netlify Scheduled Function — runs on cron, NOT HTTP-accessible
// Schedule: 0 9,18 * * * (09:00 UTC and 18:00 UTC daily)
//
// For HTTP access (status, preview, post_now), use auto-poster-api.js
//
// ═══ LOGIC FLOW ═══
// 1. Netlify cron triggers this handler
// 2. Calls autoPost('all') from core module
// 3. Core module: selects topic → searches facts → generates AI post → publishes → logs

const { autoPost } = require('./auto-poster-core');

// ═══ HANDLER — Cron only ═══
exports.handler = async (_event) => {
    console.log('[auto-poster] Cron trigger fired at', new Date().toISOString());

    try {
        const results = await autoPost('all');

        console.log('[auto-poster] Cron complete:', JSON.stringify({
            posts: results.posts?.length || 0,
            posted: results.posts?.filter(p => p.posted).length || 0
        }));

        // Scheduled functions don't return HTTP responses, but we return for logging
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, ...results })
        };
    } catch (e) {
        console.error('[auto-poster] FATAL cron error:', e.message, e.stack);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: e.message })
        };
    }
};
