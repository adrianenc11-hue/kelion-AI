// One-time setup: Create admin users
// Run once via: /.netlify/functions/setup-admin?key=YOUR_SECRET

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const SETUP_KEY = process.env.ADMIN_SETUP_KEY;

// Admin users to create — credentials from env vars (NEVER hardcoded)
const ADMIN_USERS = [
    { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: 'Administrator', role: 'admin' },
    { email: process.env.USER_EMAIL, password: process.env.USER_PASSWORD, name: process.env.USER_DISPLAY_NAME || 'Owner', role: 'user' }
];

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // Security check
    const key = event.queryStringParameters?.key;
    if (key !== SETUP_KEY) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Unauthorized' })
        };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const results = [];

        for (const admin of ADMIN_USERS) {
            const passwordHash = await bcrypt.hash(admin.password, 12);

            // Check if user exists
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .eq('email', admin.email)
                .single();

            if (existing) {
                // Update role with permanent subscription
                await supabase
                    .from('users')
                    .update({
                        role: admin.role,
                        status: 'active',
                        subscription_status: 'lifetime',
                        subscription_expires: null // Never expires
                    })
                    .eq('id', existing.id);

                results.push({ email: admin.email, role: admin.role, status: 'updated' });
            } else {
                // Create new user
                const { data: newUser, error } = await supabase
                    .from('users')
                    .insert({
                        email: admin.email,
                        password_hash: passwordHash,
                        role: admin.role,
                        status: 'active',
                        email_verified: true,
                        subscription_status: 'lifetime', // Permanent
                        subscription_expires: null // Never expires
                    })
                    .select()
                    .single();

                if (error) {
                    results.push({ email: admin.email, status: 'error', error: error.message });
                    continue;
                }

                // Create profile
                await supabase
                    .from('user_profiles')
                    .insert({
                        user_id: newUser.id,
                        display_name: admin.name
                    });

                results.push({ email: admin.email, status: 'created', userId: newUser.id });
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Admin users processed',
                results
            })
        };

    } catch (error) {
        console.error('Setup error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
