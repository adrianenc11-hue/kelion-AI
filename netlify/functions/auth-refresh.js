// ============================================================================
// Netlify Function: Auth Refresh Token
// POST /auth/refresh - Get new access token using refresh token
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

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
        await patchProcessEnv(); // Load vault secrets
        const { refreshToken } = JSON.parse(event.body);
        const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
        const userAgent = event.headers['user-agent'] || 'unknown';

        if (!refreshToken) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Refresh token is required' })
            };
        }

        const tokenHash = hashToken(refreshToken);

        // Find session
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('refresh_token_hash', tokenHash)
            .is('revoked_at', null)
            .single();

        if (!session || sessionError) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid refresh token' })
            };
        }

        // Check if expired
        if (new Date(session.expires_at) < new Date()) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Refresh token has expired. Please log in again.' })
            };
        }

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user_id)
            .single();

        if (!user || userError) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'User not found' })
            };
        }

        // Check user status
        if (user.status !== 'active') {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'Account is not active' })
            };
        }

        // Revoke old session
        await supabase
            .from('sessions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', session.id);

        // Generate new tokens
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

        const newRefreshToken = generateToken();
        const newRefreshTokenHash = hashToken(newRefreshToken);
        const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        // Create new session
        await supabase.from('sessions').insert({
            user_id: user.id,
            refresh_token_hash: newRefreshTokenHash,
            expires_at: refreshExpires.toISOString(),
            ip: clientIp,
            user_agent: userAgent.substring(0, 500)
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                accessToken,
                refreshToken: newRefreshToken,
                expiresIn: 900
            })
        };

    } catch (error) {
        console.error('Refresh token error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
