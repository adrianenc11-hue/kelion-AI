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

        // Email verification link
        const verifyUrl = `https://kelionai.app/verify-email?token=${verifyToken}`;

        // Send email via Resend API
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured');
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Email service not configured', code: 'CONFIG_MISSING' }) };
        }

        const fromAddress = process.env.RESEND_FROM || 'Kelion AI <onboarding@resend.dev>';

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:30px;">
    <div style="font-size:40px;margin-bottom:10px;">🔮</div>
    <h1 style="color:#00e5ff;font-size:24px;margin:0;">Kelion AI</h1>
  </div>
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid rgba(0,229,255,0.2);border-radius:16px;padding:40px 30px;text-align:center;">
    <h2 style="color:#fff;font-size:22px;margin:0 0 15px;">Verifică-ți emailul</h2>
    <p style="color:#b0b0b0;font-size:15px;line-height:1.6;margin:0 0 30px;">
      Bine ai venit! Apasă butonul de mai jos pentru a-ți activa contul Kelion AI.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#00e5ff,#0080ff);color:#fff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:600;">
      ✓ Verifică Email
    </a>
    <p style="color:#666;font-size:12px;margin:25px 0 0;line-height:1.5;">
      Linkul expiră în 24 de ore.<br>Dacă nu ai creat un cont Kelion AI, ignoră acest email.
    </p>
  </div>
  <div style="text-align:center;margin-top:30px;color:#444;font-size:11px;">
    © ${new Date().getFullYear()} Kelion AI — kelionai.app
  </div>
</div>
</body>
</html>`;

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [emailLower],
                subject: 'Verifică emailul tău — Kelion AI',
                html: emailHtml
            })
        });

        if (!resendResponse.ok) {
            const errData = await resendResponse.text();
            console.error('Resend API error:', resendResponse.status, errData);
            return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to send email', code: 'EMAIL_SEND_FAILED' }) };
        }

        const resendData = await resendResponse.json();
        console.log('Verification email sent via Resend:', resendData.id, 'to:', emailLower);

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
