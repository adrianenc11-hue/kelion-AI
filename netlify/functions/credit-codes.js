// ═══ CREDIT CODES — Admin generates, Users redeem ═══
// POST /.netlify/functions/credit-codes
// Actions: generate (admin), send (admin, emails code), redeem (users), check, list (admin)
// Validity: 1w (7 days), 1m (30 days), 6m (180 days), 1y (365 days)
// Single-use: code is deactivated after redemption

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

const ADMIN_EMAIL = 'admin@kelionai.app';
const VALIDITY_MAP = { '1w': 7, '1m': 30, '6m': 180, '1y': 365 };
const VALIDITY_LABELS = { '1w': '1 Week', '1m': '1 Month', '6m': '6 Months', '1y': '1 Year' };

function generateCode(validity) {
    const prefix = validity.toUpperCase();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = `K-${prefix}-`;
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

async function sendCreditEmail(recipientEmail, code, validity, days) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        console.warn('[CREDIT-CODES] Cannot send email: RESEND_API_KEY missing');
        return { success: false, error: 'Email service not configured' };
    }

    // Force Resend test domain until kelionai.app is verified in Resend
    const fromAddress = 'Kelion AI <onboarding@resend.dev>';
    const label = VALIDITY_LABELS[validity] || validity;

    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:30px;">
    <span style="font-size:36px;">🔮</span>
    <div style="color:#00e5ff;font-size:22px;font-weight:700;margin-top:8px;">Kelion AI</div>
  </div>
  <div style="background:linear-gradient(135deg,#0d1b2a,#1b2838);border:1px solid rgba(0,229,255,.3);border-radius:16px;padding:30px;text-align:center;">
    <div style="font-size:16px;color:#00e5ff;font-weight:600;margin-bottom:8px;">🎁 Your Credit Code</div>
    <h2 style="color:#fff;font-size:24px;margin:0 0 15px;">Pro Access — ${label}</h2>
    <div style="background:#000;border:2px dashed #00e5ff;border-radius:12px;padding:18px;margin:20px 0;">
      <code style="font-size:28px;color:#00e5ff;font-weight:800;letter-spacing:3px;">${code}</code>
    </div>
    <p style="color:#aaa;font-size:14px;line-height:1.6;margin:15px 0 0;">
      Go to <a href="https://kelionai.app/subscribe.html?code=${code}" style="color:#00e5ff;">kelionai.app/subscribe.html</a>,
      log in (or create an account), and your <strong style="color:#fff;">${label}</strong> Pro access will activate automatically.
    </p>
    <p style="color:#666;font-size:12px;margin-top:15px;">
      ⚠️ This code is single-use and expires after activation.
    </p>
  </div>
  <div style="text-align:center;margin-top:25px;color:#444;font-size:11px;">
    &copy; ${new Date().getFullYear()} Kelion AI &mdash; kelionai.app
  </div>
</div>
</body>
</html>`;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [recipientEmail],
                subject: `🎁 Your Kelion AI Credit Code — ${label} Pro Access`,
                html: emailHtml
            })
        });

        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { id: 'unknown' }; }

        if (!res.ok) {
            console.error('[CREDIT-CODES] Resend error:', res.status, text);
            return { success: false, error: text.substring(0, 200) };
        }

        console.log('[CREDIT-CODES] Email sent:', data.id, 'to:', recipientEmail);
        return { success: true, emailId: data.id };
    } catch (err) {
        console.error('[CREDIT-CODES] Email fetch error:', err.message);
        return { success: false, error: err.message };
    }
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        await patchProcessEnv();
        const db = getDB();
        if (!db) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        }

        const { action, admin_email, validity, count, code, user_email, send_to } = JSON.parse(event.body || '{}');

        // ═══ GENERATE — Admin creates credit codes ═══
        if (action === 'generate') {
            if (admin_email !== ADMIN_EMAIL) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
            }
            if (!VALIDITY_MAP[validity]) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid validity. Use: 1w, 1m, 6m, 1y' }) };
            }

            const batchSize = Math.min(count || 1, 50);
            const codes = [];

            for (let i = 0; i < batchSize; i++) {
                codes.push({
                    code: generateCode(validity),
                    validity: validity,
                    days: VALIDITY_MAP[validity],
                    created_by: admin_email,
                    is_used: false
                });
            }

            const { error } = await db.from('credit_codes').insert(codes);
            if (error) {
                console.error('[CREDIT-CODES] Generate error:', error);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate codes' }) };
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    generated: codes.length,
                    validity, days: VALIDITY_MAP[validity],
                    validity_label: VALIDITY_LABELS[validity],
                    codes: codes.map(c => c.code)
                })
            };
        }

        // ═══ SEND — Admin generates + emails code to recipient ═══
        if (action === 'send') {
            if (admin_email !== ADMIN_EMAIL) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
            }
            if (!send_to) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'send_to email required' }) };
            }
            if (!VALIDITY_MAP[validity]) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid validity. Use: 1w, 1m, 6m, 1y' }) };
            }

            // Generate one code
            const newCode = generateCode(validity);
            const { error: insertErr } = await db.from('credit_codes').insert({
                code: newCode,
                validity: validity,
                days: VALIDITY_MAP[validity],
                created_by: admin_email,
                is_used: false,
                sent_to: send_to
            });

            if (insertErr) {
                console.error('[CREDIT-CODES] Insert error:', insertErr);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create code' }) };
            }

            // Send email
            const emailResult = await sendCreditEmail(send_to, newCode, validity, VALIDITY_MAP[validity]);

            // Update tracking
            if (emailResult.success) {
                await db.from('credit_codes').update({
                    sent_at: new Date().toISOString(),
                    sent_email_id: emailResult.emailId
                }).eq('code', newCode);
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    code: newCode,
                    validity, days: VALIDITY_MAP[validity],
                    validity_label: VALIDITY_LABELS[validity],
                    sent_to: send_to,
                    email_sent: emailResult.success,
                    email_id: emailResult.emailId || null,
                    email_error: emailResult.error || null
                })
            };
        }

        // ═══ REDEEM — User applies a credit code ═══
        if (action === 'redeem') {
            if (!code || !user_email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'code and user_email required' }) };
            }

            const { data: creditCode, error: findErr } = await db.from('credit_codes')
                .select('*')
                .eq('code', code.toUpperCase().trim())
                .limit(1)
                .single();

            if (findErr || !creditCode) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid credit code' }) };
            }

            if (creditCode.is_used) {
                return {
                    statusCode: 400, headers,
                    body: JSON.stringify({
                        error: 'This code has already been used',
                        redeemed_by: creditCode.redeemed_by,
                        redeemed_at: creditCode.redeemed_at
                    })
                };
            }

            // Mark as used — SINGLE USE, deactivate immediately
            const now = new Date();

            const { error: updateErr } = await db.from('credit_codes').update({
                is_used: true,
                redeemed_by: user_email,
                redeemed_at: now.toISOString()
            }).eq('id', creditCode.id);

            if (updateErr) {
                console.error('[CREDIT-CODES] Redeem error:', updateErr);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to redeem code' }) };
            }

            // ADDITIVE LOGIC: extend from current expiry if still active
            let baseDate = now;
            const { data: existingUser } = await db.from('users')
                .select('subscription_expires')
                .eq('email', user_email)
                .limit(1)
                .single();

            if (existingUser && existingUser.subscription_expires) {
                const currentExpiry = new Date(existingUser.subscription_expires);
                if (currentExpiry > now) {
                    baseDate = currentExpiry; // Extend from existing expiry
                }
            }

            const expiresAt = new Date(baseDate.getTime() + creditCode.days * 24 * 60 * 60 * 1000);

            // Update user subscription
            await db.from('users').update({
                subscription_type: 'pro',
                subscription_expires: expiresAt.toISOString(),
                subscription_source: 'credit_code'
            }).eq('email', user_email);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    message: `Credit code redeemed! Pro access for ${VALIDITY_LABELS[creditCode.validity]}.`,
                    validity: creditCode.validity,
                    validity_label: VALIDITY_LABELS[creditCode.validity],
                    days: creditCode.days,
                    expires_at: expiresAt.toISOString(),
                    plan: 'pro'
                })
            };
        }

        // ═══ CHECK — Validate code without redeeming ═══
        if (action === 'check') {
            if (!code) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'code required' }) };
            }

            const { data, error } = await db.from('credit_codes')
                .select('code, validity, days, is_used, created_at, sent_to, sent_at')
                .eq('code', code.toUpperCase().trim())
                .limit(1)
                .single();

            if (error || !data) {
                return { statusCode: 404, headers, body: JSON.stringify({ valid: false, error: 'Code not found' }) };
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    valid: !data.is_used,
                    code: data.code,
                    validity: data.validity,
                    validity_label: VALIDITY_LABELS[data.validity],
                    days: data.days,
                    is_used: data.is_used
                })
            };
        }

        // ═══ LIST — Admin sees full evidence ═══
        if (action === 'list') {
            if (admin_email !== ADMIN_EMAIL) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin access required' }) };
            }

            const { data, error } = await db.from('credit_codes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to list codes' }) };
            }

            const unused = data.filter(c => !c.is_used).length;
            const used = data.filter(c => c.is_used).length;
            const sent = data.filter(c => c.sent_to).length;

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    total: data.length,
                    unused, used, sent,
                    codes: data
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: generate, send, redeem, check, list' }) };

    } catch (err) {
        console.error('[CREDIT-CODES] Error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
