// ============================================================================
// Netlify Function: Auth Login
// POST /auth/login
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is not set!');
}
const JWT_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function logLoginAttempt(userId, email, success, reason, ip, userAgent) {
    await supabase.from('login_audit').insert({
        user_id: userId,
        email_attempted: email,
        success,
        reason,
        ip,
        user_agent: userAgent?.substring(0, 500)
    });
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const { email, password } = JSON.parse(event.body);
        const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        const userAgent = event.headers['user-agent'] || 'unknown';

        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and password are required' })
            };
        }

        const emailLower = email.toLowerCase().trim();

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', emailLower)
            .single();

        // User not found
        if (!user || userError) {
            await logLoginAttempt(null, emailLower, false, 'not_found', clientIp, userAgent);
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid email or password' })
            };
        }

        // Check if locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            await logLoginAttempt(user.id, emailLower, false, 'locked', clientIp, userAgent);
            const unlockTime = new Date(user.locked_until).toISOString();
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: 'Account is temporarily locked due to too many failed attempts',
                    locked_until: unlockTime
                })
            };
        }

        // Check if disabled
        if (user.status === 'disabled' || user.status === 'deleted') {
            await logLoginAttempt(user.id, emailLower, false, 'disabled', clientIp, userAgent);
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Account has been disabled' })
            };
        }

        // Check if email verified
        if (!user.email_verified || user.status === 'pending_verify') {
            await logLoginAttempt(user.id, emailLower, false, 'unverified', clientIp, userAgent);
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: 'Please verify your email address before logging in',
                    code: 'EMAIL_NOT_VERIFIED'
                })
            };
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordValid) {
            const newFailedCount = (user.failed_login_count || 0) + 1;
            const updateData = { failed_login_count: newFailedCount };

            // Lock account if too many failures
            if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
                updateData.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
            }

            await supabase.from('users').update(updateData).eq('id', user.id);
            await logLoginAttempt(user.id, emailLower, false, 'bad_password', clientIp, userAgent);

            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: 'Invalid email or password',
                    attempts_remaining: MAX_FAILED_ATTEMPTS - newFailedCount
                })
            };
        }

        // Success! Reset failed count and update last login
        await supabase.from('users').update({
            failed_login_count: 0,
            locked_until: null,
            last_login_at: new Date().toISOString(),
            last_ip: clientIp,
            last_user_agent: userAgent.substring(0, 500)
        }).eq('id', user.id);

        // Get profile
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        // Generate JWT access token
        const accessToken = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role,
                subscription: user.subscription_status
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        // Generate refresh token
        const refreshToken = generateToken();
        const refreshTokenHash = hashToken(refreshToken);
        const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await supabase.from('sessions').insert({
            user_id: user.id,
            refresh_token_hash: refreshTokenHash,
            expires_at: refreshExpires.toISOString(),
            ip: clientIp,
            user_agent: userAgent.substring(0, 500)
        });

        // Save device/IP for recognition on next visit
        await supabase.from('user_devices').upsert({
            user_id: user.id,
            ip_address: clientIp.split(',')[0].trim(),
            fingerprint: event.headers['x-fingerprint'] || null,
            user_agent: userAgent.substring(0, 500),
            last_seen: new Date().toISOString()
        }, {
            onConflict: 'user_id,ip_address',
            ignoreDuplicates: false
        });

        await logLoginAttempt(user.id, emailLower, true, 'success', clientIp, userAgent);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                accessToken,
                refreshToken,
                expiresIn: 900, // 15 minutes in seconds
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    subscription: user.subscription_status,
                    displayName: profile?.display_name,
                    firstName: profile?.first_name,
                    lastName: profile?.last_name,
                    avatarUrl: profile?.avatar_url
                }
            })
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
