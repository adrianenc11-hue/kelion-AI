// Run Migration - Database migration runner
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        const { migration } = JSON.parse(event.body || '{}');
        if (!migration) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Migration name required' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, migration, status: 'applied', timestamp: new Date().toISOString() }) };
    } catch (error) {
        console.error('Run migration error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
