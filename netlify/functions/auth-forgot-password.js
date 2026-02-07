// ============================================================================
// Netlify Function: Forgot Password
// POST /auth/forgot-password
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const RESET_TOKEN_EXPIRY_HOURS = 1;

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type',
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
        const { email } = JSON.parse(event.body);
        const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        const userAgent = event.headers['user-agent'] || 'unknown';

        if (!email) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email is required' })
            };
        }

        const emailLower = email.toLowerCase().trim();

        // Always return success message to prevent email enumeration
        const successResponse = {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'If an account exists with that email, a password reset link has been sent.'
            })
        };

        // Find user
        const { data: user } = await supabase
            .from('users')
            .select('id, email, status')
            .eq('email', emailLower)
            .single();

        // User not found - still return success (security)
        if (!user) {
            return successResponse;
        }

        // User disabled - still return success (security)
        if (user.status === 'disabled' || user.status === 'deleted') {
            return successResponse;
        }

        // Invalidate any existing reset tokens
        await supabase
            .from('password_resets')
            .update({ used_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .is('used_at', null);

        // Generate reset token
        const resetToken = generateToken();
        const tokenHash = hashToken(resetToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await supabase.from('password_resets').insert({
            user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            ip: clientIp,
            user_agent: userAgent.substring(0, 500)
        });

        // Email reset link via email service
        const resetUrl = `https://kelionai.app/reset-password?token=${resetToken}`;

        // SendGrid/Mailgun integration here

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'If an account exists with that email, a password reset link has been sent.'
            })
        };

    } catch (error) {
        console.error('Forgot password error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
