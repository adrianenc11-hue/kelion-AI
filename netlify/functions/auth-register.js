// ============================================================================
// Netlify Function: Auth Register
// POST /auth/register
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

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

exports.handler = async (event, _context) => {
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

        // ═══ WELCOME EMAIL via Resend ═══
        const verifyUrl = `https://kelionai.app/verify-email?token=${verifyToken}`;
        const RESEND_KEY = process.env.RESEND_API_KEY;
        if (RESEND_KEY) {
            const welcomeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:30px;">
    <span style="font-size:36px;">🔮</span>
    <div style="color:#00e5ff;font-size:22px;font-weight:700;margin-top:8px;">Kelion AI</div>
  </div>
  <div style="background:linear-gradient(135deg,#0d1b2a,#1b2838);border:1px solid rgba(0,229,255,.3);border-radius:16px;padding:30px;">
    <h2 style="color:#fff;font-size:20px;margin:0 0 15px;">Welcome to Kelion AI! 🎉</h2>
    <p style="color:#ccc;font-size:14px;line-height:1.6;">Hi <strong style="color:#fff;">${displayName || emailLower.split('@')[0]}</strong>,</p>
    <p style="color:#ccc;font-size:14px;line-height:1.6;">Thank you for creating your Kelion AI account. Please verify your email to get started:</p>
    <div style="text-align:center;margin:25px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#00e5ff,#0080ff);color:#000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">✅ Verify Email</a>
    </div>
    <hr style="border-color:rgba(0,229,255,.2);margin:25px 0;">
    <h3 style="color:#00e5ff;font-size:16px;margin:0 0 12px;">🌟 What's Included in Pro Access</h3>
    <ul style="color:#ccc;font-size:13px;line-height:2;padding-left:20px;">
      <li>🤖 <strong>AI Assistant</strong> — Smart conversations, code help, analysis</li>
      <li>📊 <strong>Trading Bot</strong> — Real-time market analysis & auto-trading</li>
      <li>🔍 <strong>Web Search</strong> — AI-powered research & fact-checking</li>
      <li>🎵 <strong>Audio Editor</strong> — Voice processing & audio tools</li>
      <li>📱 <strong>Social Media</strong> — Auto-posting & engagement analytics</li>
      <li>🌐 <strong>Multi-language</strong> — Support for 50+ languages</li>
      <li>📈 <strong>Analytics</strong> — Usage insights & performance reports</li>
      <li>⚡ <strong>Priority Support</strong> — Fast response & dedicated help</li>
    </ul>
    <hr style="border-color:rgba(0,229,255,.2);margin:25px 0;">
    <h3 style="color:#ffaa00;font-size:14px;margin:0 0 10px;">📋 Refund Policy</h3>
    <div style="background:rgba(0,0,0,.3);border-radius:8px;padding:15px;font-size:12px;color:#aaa;line-height:1.8;">
      <p style="margin:0 0 8px;"><strong style="color:#ff6b6b;">Monthly Plan (1 Month):</strong> No refund available. The monthly subscription is non-refundable once activated.</p>
      <p style="margin:0;"><strong style="color:#00ff88;">Annual Plan (12 Months):</strong> Refund available for unused months. If you cancel, you will be refunded for the remaining months minus the current month. (Example: cancel after 1 month = 11 months refunded.)</p>
    </div>
    <hr style="border-color:rgba(0,229,255,.2);margin:25px 0;">
    <p style="color:#888;font-size:12px;text-align:center;">If you didn't create this account, please ignore this email.<br>
    This verification link expires in 24 hours.</p>
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
                        cc: ['adrianenc11@gmail.com'],
                        subject: '🔮 Welcome to Kelion AI — Verify Your Email',
                        html: welcomeHtml
                    })
                });
            } catch (emailErr) {
                console.error('[AUTH-REGISTER] Welcome email failed:', emailErr.message);
            }
        }

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
