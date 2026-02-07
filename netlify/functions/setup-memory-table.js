// Setup Memory Table - Create memory tables in Supabase
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        // Check if table exists
        const { error } = await supabase.from('user_memories').select('id').limit(1);
        if (error) return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Table needs creation', sql: 'CREATE TABLE user_memories (id uuid DEFAULT gen_random_uuid(), key text, value text, user_id text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Memory table exists' }) };
    } catch (error) {
        console.error('Setup memory table error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
