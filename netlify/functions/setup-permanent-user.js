// Netlify Function: Setup Permanent User
// Creates/updates owner account with permanent premium access
// ALL credentials from env vars — ZERO hardcode
const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

let supabase = null;
function getSupabase() {
    if (!supabase) {
        const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        if (process.env.SUPABASE_URL && SB_KEY && SB_KEY.trim().length > 0) {
            supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        }
    }
    return supabase;
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // Only allow admin access (check for secret param from env)
    const params = event.queryStringParameters || {};
    const SETUP_SECRET = process.env.SETUP_SECRET;
    if (!SETUP_SECRET) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'SETUP_SECRET not configured in env' }) };
    }
    if (params.secret !== SETUP_SECRET) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const results = [];

        // Required env vars
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        const OWNER_EMAIL = process.env.OWNER_EMAIL || process.env.USER_EMAIL;
        const OWNER_PASSWORD = process.env.OWNER_PASSWORD || process.env.USER_PASSWORD;

        if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'ADMIN_EMAIL and ADMIN_PASSWORD env vars required' }) };
        }
        if (!OWNER_EMAIL || !OWNER_PASSWORD) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'OWNER_EMAIL and OWNER_PASSWORD (or USER_EMAIL/USER_PASSWORD) env vars required' }) };
        }

        // 1. Check/Create admin
        const { data: admin } = await getSupabase()
            .from('users')
            .select('*')
            .eq('email', ADMIN_EMAIL)
            .single();

        if (!admin) {
            const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
            const { error } = await getSupabase()
                .from('users')
                .insert({
                    email: ADMIN_EMAIL,
                    password_hash: adminHash,
                    role: 'admin',
                    status: 'active',
                    email_verified: true,
                    subscription_status: 'premium',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            results.push({
                email: ADMIN_EMAIL,
                action: error ? 'error' : 'created',
                error: error?.message
            });
        } else {
            results.push({
                email: ADMIN_EMAIL,
                action: 'exists',
                id: admin.id
            });
        }

        // 2. Check/Create owner user
        const { data: user } = await getSupabase()
            .from('users')
            .select('*')
            .eq('email', OWNER_EMAIL)
            .single();

        if (!user) {
            // Create user
            const userHash = await bcrypt.hash(OWNER_PASSWORD, 12);
            const { data: newUser, error } = await getSupabase()
                .from('users')
                .insert({
                    email: OWNER_EMAIL,
                    password_hash: userHash,
                    role: 'user',
                    status: 'active',
                    email_verified: true,
                    subscription_status: 'premium',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            results.push({
                email: OWNER_EMAIL,
                action: error ? 'error' : 'created',
                error: error?.message,
                id: newUser?.id
            });
        } else {
            // Update to ensure active + premium
            const userHash = await bcrypt.hash(OWNER_PASSWORD, 12);
            const { error: updateErr } = await getSupabase()
                .from('users')
                .update({
                    password_hash: userHash,
                    status: 'active',
                    email_verified: true,
                    subscription_status: 'premium',
                    failed_login_count: 0,
                    locked_until: null
                })
                .eq('id', user.id);

            results.push({
                email: OWNER_EMAIL,
                action: updateErr ? 'error' : 'updated',
                error: updateErr?.message,
                id: user.id
            });
        }

        // 3. List all users
        const { data: allUsers } = await getSupabase()
            .from('users')
            .select('id, email, role, status, subscription_status, email_verified')
            .order('created_at', { ascending: true });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                results,
                allUsers
            }, null, 2)
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
