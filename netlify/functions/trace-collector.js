/**
 * AI Trace Collector — Real-time request tracing for brain map
 * POST: save trace event
 * GET: return recent trace events (last 30s)
 */
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();
        const supabase = getSupabase();
        if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'DB not configured' }) };

        // GET — return recent trace events
        if (event.httpMethod === 'GET') {
            const since = new Date(Date.now() - 30000).toISOString();
            const { data, error } = await supabase
                .from('ai_trace')
                .select('*')
                .gte('created_at', since)
                .order('created_at', { ascending: true })
                .limit(200);
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ events: data || [] }) };
        }

        // POST — save trace event
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { session_id, node, direction, label, trace_type, metadata } = body;
            if (!node) return { statusCode: 400, headers, body: JSON.stringify({ error: 'node required' }) };

            const { error } = await supabase.from('ai_trace').insert({
                session_id: session_id || 'unknown',
                node,
                direction: direction || 'enter',
                label: label || '',
                trace_type: trace_type || 'text',  // 'text' or 'voice' or 'gemini'
                metadata: metadata || {}
            });
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (e) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
};
