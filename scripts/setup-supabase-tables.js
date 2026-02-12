/**
 * Create all required Supabase tables for Family/Business features
 * Run ONCE: node setup-supabase-tables.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars first');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SQL_MIGRATIONS = [
    // 1. Groups table
    `CREATE TABLE IF NOT EXISTS groups (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        owner_email text NOT NULL,
        group_type text NOT NULL CHECK (group_type IN ('family', 'business')),
        group_name text NOT NULL,
        company_name text,
        group_code text UNIQUE NOT NULL,
        max_members integer DEFAULT 5,
        created_at timestamptz DEFAULT now()
    )`,

    // 2. Group members table
    `CREATE TABLE IF NOT EXISTS group_members (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
        email text NOT NULL,
        name text,
        role text DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member')),
        status text DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'removed')),
        joined_at timestamptz DEFAULT now(),
        UNIQUE(group_id, email)
    )`,

    // 3. Group locations (GPS tracking)
    `CREATE TABLE IF NOT EXISTS group_locations (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
        email text NOT NULL,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        accuracy double precision,
        speed double precision,
        heading double precision,
        updated_at timestamptz DEFAULT now(),
        UNIQUE(group_id, email)
    )`,

    // 4. Group messages (chat)
    `CREATE TABLE IF NOT EXISTS group_messages (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
        sender_email text NOT NULL,
        sender_name text,
        type text DEFAULT 'text' CHECK (type IN ('text', 'audio', 'file')),
        content text,
        file_url text,
        file_name text,
        created_at timestamptz DEFAULT now()
    )`,

    // 5. User email tokens (Gmail OAuth)
    `CREATE TABLE IF NOT EXISTS user_email_tokens (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        email text NOT NULL UNIQUE,
        provider text DEFAULT 'gmail',
        access_token text,
        refresh_token text,
        token_expiry timestamptz,
        connected_at timestamptz DEFAULT now()
    )`,

    // Indexes for performance
    `CREATE INDEX IF NOT EXISTS idx_group_members_email ON group_members(email)`,
    `CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)`,
    `CREATE INDEX IF NOT EXISTS idx_group_locations_group ON group_locations(group_id)`,
    `CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_groups_code ON groups(group_code)`
];

async function run() {
    console.log('🔧 Creating Supabase tables...\n');

    let success = 0;
    let failed = 0;

    for (const sql of SQL_MIGRATIONS) {
        const tableName = sql.match(/(?:TABLE|INDEX).*?(\w+)/i)?.[1] || 'unknown';
        try {
            const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error) {
                // Try alternative method
                const { error: error2 } = await supabase.from('_migrations').select('*').limit(0);
                console.log(`  ⚠️  ${tableName}: RPC not available, use SQL Editor`);
                failed++;
            } else {
                console.log(`  ✅ ${tableName}`);
                success++;
            }
        } catch (e) {
            console.log(`  ⚠️  ${tableName}: ${e.message?.slice(0, 60)}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${success} succeeded, ${failed} need manual SQL`);

    if (failed > 0) {
        console.log('\n═══ MANUAL SQL ═══');
        console.log('Go to: Supabase Dashboard → SQL Editor → New Query');
        console.log('Paste and run this:\n');
        console.log(SQL_MIGRATIONS.join(';\n\n') + ';');
    }
}

run();
