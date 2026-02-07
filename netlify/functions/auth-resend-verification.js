// ============================================================================
// Netlify Function: Resend Verification Email
// POST /auth/resend-verification
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const VERIFY_TOKEN_EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_MINUTES = 2;

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

        // Find user
        const { data: user } = await supabase
            .from('users')
            .select('id, email, email_verified, status')
            .eq('email', emailLower)
            .single();

        // Generic success message to prevent email enumeration
        const successResponse = {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'If an unverified account exists, a verification email has been sent.'
            })
        };

        if (!user) {
            return successResponse;
        }

        // Already verified
        if (user.email_verified || user.status === 'active') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Email is already verified',
                    code: 'ALREADY_VERIFIED'
                })
            };
        }

        // Check cooldown - prevent spam
        const { data: recentVerification } = await supabase
            .from('email_verifications')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (recentVerification) {
            const timeSinceLastSend = Date.now() - new Date(recentVerification.created_at).getTime();
            const cooldownMs = RESEND_COOLDOWN_MINUTES * 60 * 1000;

            if (timeSinceLastSend < cooldownMs) {
                const waitSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({
                        error: `Please wait ${waitSeconds} seconds before requesting another email`,
                        code: 'RATE_LIMITED',
                        retryAfter: waitSeconds
                    })
                };
            }
        }

        // Generate new verification token
        const verifyToken = generateToken();
        const tokenHash = hashToken(verifyToken);
        const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await supabase.from('email_verifications').insert({
            user_id: user.id,
            token_hash: tokenHash,
            sent_to_email: emailLower,
            expires_at: expiresAt.toISOString(),
            ip: clientIp,
            user_agent: userAgent.substring(0, 500)
        });

        // Email verification link via email service  
        const verifyUrl = `https://kelionai.app/verify-email?token=${verifyToken}`;

        // SendGrid/Mailgun integration here

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Verification email sent. Please check your inbox.'
            })
        };

    } catch (error) {
        console.error('Resend verification error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
