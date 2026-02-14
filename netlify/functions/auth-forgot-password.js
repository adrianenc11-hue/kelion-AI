// ============================================================================
// Netlify Function: Forgot Password
// POST /auth/forgot-password
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

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

exports.handler = async (event, _context) => {
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

        // Email reset link via Resend
        const resetUrl = `https://kelionai.app/reset-password?token=${resetToken}`;
        const RESEND_KEY = process.env.RESEND_API_KEY;
        if (RESEND_KEY) {
            const resetHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:30px;">
    <span style="font-size:36px;">🔮</span>
    <div style="color:#00e5ff;font-size:22px;font-weight:700;margin-top:8px;">Kelion AI</div>
  </div>
  <div style="background:linear-gradient(135deg,#0d1b2a,#1b2838);border:1px solid rgba(0,229,255,.3);border-radius:16px;padding:30px;">
    <h2 style="color:#fff;font-size:20px;margin:0 0 15px;">Password Reset Request 🔐</h2>
    <p style="color:#ccc;font-size:14px;line-height:1.6;">We received a request to reset the password for your Kelion AI account.</p>
    <p style="color:#ccc;font-size:14px;line-height:1.6;">Click the button below to set a new password:</p>
    <div style="text-align:center;margin:25px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#00e5ff,#0080ff);color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">🔑 Reset Password</a>
    </div>
    <hr style="border-color:rgba(0,229,255,.2);margin:25px 0;">
    <p style="color:#888;font-size:12px;text-align:center;">This link expires in ${RESET_TOKEN_EXPIRY_HOURS} hour(s).<br>
    If you didn't request this, you can safely ignore this email.</p>
  </div>
  <div style="text-align:center;margin-top:25px;color:#444;font-size:11px;">
    &copy; ${new Date().getFullYear()} Kelion AI &mdash; <a href="https://kelionai.app" style="color:#00e5ff;">kelionai.app</a>
  </div>
</div></body></html>`;

            try {
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: process.env.RESEND_FROM || 'Kelion AI <onboarding@resend.dev>',
                        to: [emailLower],
                        subject: '🔑 Reset Your Kelion AI Password',
                        html: resetHtml
                    })
                });
            } catch (emailErr) {
                console.error('[AUTH-FORGOT] Reset email failed:', emailErr.message);
            }
        } else {
            console.warn('[AUTH-FORGOT] RESEND_API_KEY not set, cannot send reset email');
        }

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
