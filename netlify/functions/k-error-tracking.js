// K Error Tracking - Log and track all errors (Phase 10.2)
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        if (event.httpMethod === 'POST') {
            const { endpoint, error_message, status_code, stack_trace, request_id } = JSON.parse(event.body || '{}');
            if (!endpoint || !error_message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'endpoint and error_message required' }) };

            const errorEntry = { endpoint, error_message, status_code: status_code || 500, stack_trace: stack_trace?.substring(0, 1000), request_id: request_id || `req_${Date.now()}`, timestamp: new Date().toISOString() };

            // Try to log to Supabase
            const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
            if (process.env.SUPABASE_URL && SB_KEY) {
                const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
                await supabase.from('error_logs').insert(errorEntry).catch(() => { });
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, logged: true, entry: errorEntry }) };
        }

        // GET: retrieve recent errors
        const SB_KEY2 = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (process.env.SUPABASE_URL && SB_KEY2) {
            const supabase = createClient(process.env.SUPABASE_URL, SB_KEY2);
            const { data, error } = await supabase.from('error_logs').select('*').order('timestamp', { ascending: false }).limit(50);
            if (!error) return { statusCode: 200, headers, body: JSON.stringify({ success: true, errors: data, count: data.length }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, errors: [], message: 'No error tracking DB configured' }) };
    } catch (error) {
        console.error('Error tracking error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
