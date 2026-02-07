// ============================================================================
// Netlify Function: Reset Password
// POST /auth/reset-password
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const SALT_ROUNDS = 12;

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
        const { token, newPassword } = JSON.parse(event.body);

        if (!token || !newPassword) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Token and new password are required' })
            };
        }

        // Password strength validation
        if (newPassword.length < 8) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Password must be at least 8 characters' })
            };
        }

        const tokenHash = hashToken(token);

        // Find reset record
        const { data: resetRecord, error: findError } = await supabase
            .from('password_resets')
            .select('*')
            .eq('token_hash', tokenHash)
            .is('used_at', null)
            .single();

        if (!resetRecord || findError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid or expired reset token' })
            };
        }

        // Check if expired
        if (new Date(resetRecord.expires_at) < new Date()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Reset token has expired. Please request a new one.',
                    code: 'TOKEN_EXPIRED'
                })
            };
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Mark token as used
        await supabase
            .from('password_resets')
            .update({ used_at: new Date().toISOString() })
            .eq('id', resetRecord.id);

        // Update user password and unlock account
        const { error: updateError } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                failed_login_count: 0,
                locked_until: null
            })
            .eq('id', resetRecord.user_id);

        if (updateError) {
            console.error('Update password error:', updateError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to reset password' })
            };
        }

        // Revoke all existing sessions (force re-login)
        await supabase
            .from('sessions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('user_id', resetRecord.user_id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Password reset successfully. You can now log in with your new password.'
            })
        };

    } catch (error) {
        console.error('Reset password error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
