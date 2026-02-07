// ============================================================================
// Netlify Function: Auth Register
// POST /auth/register
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const SALT_ROUNDS = 12;
const VERIFY_TOKEN_EXPIRY_HOURS = 24;

// Generate secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Hash token for storage
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
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
        const { email, password, displayName, acceptTerms, acceptPrivacy } = JSON.parse(event.body);
        const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        const userAgent = event.headers['user-agent'] || 'unknown';

        // Validation
        if (!email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Email and password are required' })
            };
        }

        const emailLower = email.toLowerCase().trim();

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid email format' })
            };
        }

        // Password strength validation
        if (password.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password must be at least 8 characters' })
            };
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, status')
            .eq('email', emailLower)
            .single();

        if (existingUser) {
            if (existingUser.status === 'pending_verify') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Account exists but not verified. Check your email or request a new verification link.',
                        code: 'PENDING_VERIFY'
                    })
                };
            }
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'An account with this email already exists' })
            };
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                email: emailLower,
                password_hash: passwordHash,
                status: 'pending_verify',
                role: 'user',
                terms_accepted_at: acceptTerms ? new Date().toISOString() : null,
                privacy_accepted_at: acceptPrivacy ? new Date().toISOString() : null,
                last_ip: clientIp,
                last_user_agent: userAgent.substring(0, 500)
            })
            .select()
            .single();

        if (createError) {
            console.error('Create user error:', createError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to create account' })
            };
        }

        // Create profile
        await supabase
            .from('user_profiles')
            .insert({
                user_id: newUser.id,
                display_name: displayName || emailLower.split('@')[0]
            });

        // Generate verification token
        const verifyToken = generateToken();
        const tokenHash = hashToken(verifyToken);
        const expiresAt = new Date(Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

        await supabase
            .from('email_verifications')
            .insert({
                user_id: newUser.id,
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
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Account created. Please check your email to verify your account.',
                userId: newUser.id
            })
        };

    } catch (error) {
        console.error('Register error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
