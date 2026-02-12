// Memory - User memory storage and retrieval
const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);

        if (event.httpMethod === 'GET') {
            const { data, error } = await supabase.from('user_memories').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: data || [] }) };
        }

        if (event.httpMethod === 'POST') {
            const { key, value, user_id } = JSON.parse(event.body || '{}');
            if (!key || !value) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Key and value required' }) };
            const { error } = await supabase.from('user_memories').upsert({ key, value, user_id: user_id || 'anonymous', updated_at: new Date().toISOString() });
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Memory saved' }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    } catch (error) {
        console.error('Memory error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
