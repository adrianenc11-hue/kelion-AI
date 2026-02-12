// ============================================================================
// Netlify Function: Auth Logout
// POST /auth/logout - Revoke refresh token / session
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

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
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
        const body = event.body ? JSON.parse(event.body) : {};
        const { refreshToken, logoutAll } = body;

        // Try to get user from JWT
        const decoded = verifyToken(event.headers.authorization);

        if (logoutAll && decoded) {
            // Revoke all sessions for this user
            await supabase
                .from('sessions')
                .update({ revoked_at: new Date().toISOString() })
                .eq('user_id', decoded.sub);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Logged out from all devices'
                })
            };
        }

        if (refreshToken) {
            // Revoke specific session
            const tokenHash = hashToken(refreshToken);

            await supabase
                .from('sessions')
                .update({ revoked_at: new Date().toISOString() })
                .eq('refresh_token_hash', tokenHash);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Logged out successfully'
                })
            };
        }

        // No token provided but still success (client-side logout)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Logged out'
            })
        };

    } catch (error) {
        console.error('Logout error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
