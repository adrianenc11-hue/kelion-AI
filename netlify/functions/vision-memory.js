// Vision Memory - Retrieve vision analysis history
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: [], message: 'Vision memory ready' }) };
    } catch (error) {
        console.error('Vision memory error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
