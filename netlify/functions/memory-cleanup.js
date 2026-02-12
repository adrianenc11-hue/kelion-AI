// Memory Cleanup - Clean old memories
const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase.from('user_memories').delete().lt('created_at', thirtyDaysAgo).select('id');
        if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, deleted: data?.length || 0 }) };
    } catch (error) {
        console.error('Memory cleanup error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
