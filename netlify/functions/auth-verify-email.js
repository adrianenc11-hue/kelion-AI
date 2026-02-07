// ============================================================================
// Netlify Function: Verify Email
// POST /auth/verify-email
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

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
        const { token } = JSON.parse(event.body);

        if (!token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Verification token is required' })
            };
        }

        const tokenHash = hashToken(token);

        // Find verification record
        const { data: verification, error: findError } = await supabase
            .from('email_verifications')
            .select('*')
            .eq('token_hash', tokenHash)
            .is('used_at', null)
            .single();

        if (!verification || findError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid or expired verification token' })
            };
        }

        // Check if expired
        if (new Date(verification.expires_at) < new Date()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Verification token has expired. Please request a new one.',
                    code: 'TOKEN_EXPIRED'
                })
            };
        }

        // Mark token as used
        await supabase
            .from('email_verifications')
            .update({ used_at: new Date().toISOString() })
            .eq('id', verification.id);

        // Update user status
        const { error: updateError } = await supabase
            .from('users')
            .update({
                email_verified: true,
                status: 'active'
            })
            .eq('id', verification.user_id);

        if (updateError) {
            console.error('Update user error:', updateError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to verify email' })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Email verified successfully. You can now log in.'
            })
        };

    } catch (error) {
        console.error('Verify email error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
