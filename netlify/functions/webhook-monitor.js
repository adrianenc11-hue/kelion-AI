/**
 * Webhook Monitor — Tracks and logs all incoming/outgoing webhook events
 * Provides real-time visibility into system integrations
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
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const db = getDB();
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            // ═══ LOG A WEBHOOK EVENT ═══
            case 'log': {
                const { source, event_type, status, payload, direction } = body;
                if (!source) return { statusCode: 400, headers, body: JSON.stringify({ error: 'source required' }) };

                if (db) {
                    await db.from('webhook_logs').insert({
                        source: source,
                        event_type: event_type || 'unknown',
                        direction: direction || 'inbound',
                        status: status || 'received',
                        payload_preview: typeof payload === 'string' ? payload.substring(0, 500) : JSON.stringify(payload || {}).substring(0, 500),
                        created_at: new Date().toISOString()
                    });
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }

            // ═══ GET RECENT EVENTS ═══
            case 'list': {
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, events: [], total: 0 }) };

                const limit = Math.min(body.limit || 50, 200);
                const source_filter = body.source;

                let query = db.from('webhook_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);

                if (source_filter) query = query.eq('source', source_filter);

                const { data, error } = await query;
                if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, events: data || [], total: (data || []).length })
                };
            }

            // ═══ STATS ═══
            case 'stats': {
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: {} }) };

                // Get counts per source in last 24h
                const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data } = await db.from('webhook_logs')
                    .select('source, status')
                    .gte('created_at', since);

                const stats = {};
                for (const row of (data || [])) {
                    if (!stats[row.source]) stats[row.source] = { total: 0, success: 0, error: 0 };
                    stats[row.source].total++;
                    if (row.status === 'success' || row.status === 'received') stats[row.source].success++;
                    else stats[row.source].error++;
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, stats, period: '24h', since })
                };
            }

            // ═══ CLEAR OLD LOGS ═══
            case 'clear': {
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

                const days = body.older_than_days || 30;
                const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
                const { count } = await db.from('webhook_logs').delete({ count: 'exact' }).lt('created_at', before);

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: count || 0, older_than: `${days} days` }) };
            }

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action', available: ['log', 'list', 'stats', 'clear'] }) };
        }
    } catch (error) {
        console.error('Webhook monitor error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
