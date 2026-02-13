// ============================================================================
// Netlify Function: Admin Registration Gateway
// POST /.netlify/functions/admin-register
// Separate gateway for admin/staff registration — requires invite code
// ============================================================================

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv();

        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        const { email, password, displayName, inviteCode } = JSON.parse(event.body);

        // ── Validation ──
        if (!email || !password || !inviteCode) {
            return {
                statusCode: 400, headers,
                body: JSON.stringify({ error: 'Email, password, and invite code are required' })
            };
        }

        // ── Invite Code Verification ──
        // Accepts ADMIN_INVITE_CODE from env/vault
        const validInviteCode = process.env.ADMIN_INVITE_CODE;
        if (!validInviteCode) {
            return {
                statusCode: 503, headers,
                body: JSON.stringify({
                    error: 'Admin registration not configured',
                    message: 'Set ADMIN_INVITE_CODE in environment or Supabase vault'
                })
            };
        }

        if (inviteCode !== validInviteCode) {
            console.warn(`[ADMIN-REGISTER] Invalid invite code attempt from ${email}`);
            return {
                statusCode: 403, headers,
                body: JSON.stringify({ error: 'Invalid invite code' })
            };
        }

        // ── Email validation ──
        const emailLower = email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email format' }) };
        }

        // ── Password validation ──
        if (password.length < 8) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
        }

        // ── Check existing user ──
        const { data: existing } = await supabase
            .from('users')
            .select('id, role')
            .eq('email', emailLower)
            .single();

        if (existing) {
            if (existing.role === 'admin') {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Admin account already exists for this email' }) };
            }
            // Upgrade existing user to admin
            const { error: updateErr } = await supabase
                .from('users')
                .update({
                    role: 'admin',
                    status: 'active',
                    subscription_status: 'lifetime',
                    subscription_expires: null
                })
                .eq('id', existing.id);

            if (updateErr) {
                console.error('[ADMIN-REGISTER] Upgrade error:', updateErr);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to upgrade account' }) };
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Existing account upgraded to admin role',
                    userId: existing.id
                })
            };
        }

        // ── Create new admin user ──
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const clientIp = event.headers['x-forwarded-for'] || 'unknown';

        const { data: newUser, error: createErr } = await supabase
            .from('users')
            .insert({
                email: emailLower,
                password_hash: passwordHash,
                role: 'admin',
                status: 'active',
                email_verified: true,
                subscription_status: 'lifetime',
                subscription_expires: null,
                last_ip: clientIp
            })
            .select()
            .single();

        if (createErr) {
            console.error('[ADMIN-REGISTER] Create error:', createErr);
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create admin account' }) };
        }

        // Create profile
        await supabase
            .from('user_profiles')
            .insert({
                user_id: newUser.id,
                display_name: displayName || emailLower.split('@')[0]
            });

        console.log(`[ADMIN-REGISTER] New admin created: ${emailLower}`);

        return {
            statusCode: 201, headers,
            body: JSON.stringify({
                success: true,
                message: 'Admin account created successfully',
                userId: newUser.id
            })
        };

    } catch (error) {
        console.error('[ADMIN-REGISTER] Error:', error);
        return {
            statusCode: 500, headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
