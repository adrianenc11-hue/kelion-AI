// Netlify Function: Setup Permanent User
// Creates/updates adrianenc11@gmail.com with permanent premium access
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Content-Type': 'application/json'
    };

    // Only allow admin access (check for secret param)
    const params = event.queryStringParameters || {};
    if (params.secret !== 'kelion2024setup') {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Forbidden' })
        };
    }

    try {
        const results = [];

        // 1. Check/Create admin@kelionai.app
        const { data: admin, error: adminErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'admin@kelionai.app')
            .single();

        if (!admin) {
            const adminHash = await bcrypt.hash('AdminKelion2024!', 12);
            const { data: newAdmin, error } = await supabase
                .from('users')
                .insert({
                    email: 'admin@kelionai.app',
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
                email: 'admin@kelionai.app',
                action: error ? 'error' : 'created',
                error: error?.message
            });
        } else {
            results.push({
                email: 'admin@kelionai.app',
                action: 'exists',
                id: admin.id
            });
        }

        // 2. Check/Create adrianenc11@gmail.com
        const { data: user, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'adrianenc11@gmail.com')
            .single();

        if (!user) {
            // Create user
            const userHash = await bcrypt.hash('Andrada_1968!', 12);
            const { data: newUser, error } = await supabase
                .from('users')
                .insert({
                    email: 'adrianenc11@gmail.com',
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
                email: 'adrianenc11@gmail.com',
                action: error ? 'error' : 'created',
                error: error?.message,
                id: newUser?.id
            });
        } else {
            // Update to ensure active + premium
            const userHash = await bcrypt.hash('Andrada_1968!', 12);
            const { error: updateErr } = await supabase
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
                email: 'adrianenc11@gmail.com',
                action: updateErr ? 'error' : 'updated',
                error: updateErr?.message,
                id: user.id
            });
        }

        // 3. List all users
        const { data: allUsers } = await supabase
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
