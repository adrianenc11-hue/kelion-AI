// Run SQL migration — creates missing tables
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { patchProcessEnv } = require('./netlify/functions/get-secret');

async function run() {
    await patchProcessEnv();
    const url = process.env.SUPABASE_URL; // Should be loaded by dotenv above if not in vault
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    console.log('URL:', url ? 'SET (' + url + ')' : 'MISSING');
    console.log('KEY:', key ? 'SET' : 'MISSING');

    const sb = createClient(url, key);

    // Check which tables exist
    const checks = ['audit_log', 'page_views', 'ai_trace'];
    for (const table of checks) {
        const { error } = await sb.from(table).select('count').limit(1);
        console.log(`Table ${table}: ${error ? 'MISSING (' + error.message + ')' : 'EXISTS'}`);
    }

    // Try to create audit_log via SQL (if rpc exec_sql available)
    const { data, error } = await sb.rpc('exec_sql', {
        sql: "CREATE TABLE IF NOT EXISTS audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL, resource text, user_id text, details jsonb DEFAULT '{}', ip text DEFAULT 'unknown', user_agent text DEFAULT '', success boolean DEFAULT true, error_message text, created_at timestamptz DEFAULT now())"
    });
    if (error) {
        console.log('RPC exec_sql not available:', error.message);
        console.log('');
        console.log('>>> MANUAL STEP NEEDED: Run the SQL in Supabase Dashboard SQL Editor');
        console.log('>>> File: supabase/migrations/create_audit_and_pageviews.sql');
        console.log('>>> URL: https://supabase.com/dashboard/project/mtyzzxfbqpinskccpjms/sql/new');
    } else {
        console.log('audit_log created:', data);
    }
}

run().catch(e => console.error('Error:', e.message));
