/**
 * Balance Monitor — Scheduled function (daily)
 * Checks AI provider balances and sends email alert when accounts are low
 * Uses Resend to send email to ADMIN_EMAIL
 * 
 * Schedule: runs daily at 08:00 UTC
 */

const { patchProcessEnv } = require('./get-secret');

// Payment/top-up links for each provider
const PROVIDER_LINKS = {
    deepseek: { name: 'DeepSeek', url: 'https://platform.deepseek.com/top_up', threshold: 2.00 },
    openai: { name: 'OpenAI', url: 'https://platform.openai.com/settings/organization/billing/overview', threshold: 5.00 },
    anthropic: { name: 'Anthropic (Claude)', url: 'https://console.anthropic.com/settings/billing', threshold: 5.00 },
    mistral: { name: 'Mistral', url: 'https://console.mistral.ai/billing/', threshold: 2.00 },
    grok: { name: 'Grok (xAI)', url: 'https://console.x.ai/billing', threshold: 2.00 },
    together: { name: 'Together (Llama)', url: 'https://api.together.xyz/settings/billing', threshold: 2.00 },
    ai21: { name: 'AI21 (Jamba)', url: 'https://studio.ai21.com/account/billing', threshold: 2.00 },
    replicate: { name: 'Replicate', url: 'https://replicate.com/account/billing', threshold: 2.00 },
    elevenlabs: { name: 'ElevenLabs', url: 'https://elevenlabs.io/subscription', threshold: 0 },
    cohere: { name: 'Cohere', url: 'https://dashboard.cohere.com/billing', threshold: 0 },
};

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();

        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.USER_EMAIL;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY || !ADMIN_EMAIL) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Email or admin not configured' }) };
        }

        const alerts = [];
        const statuses = {};

        // ═══ 1. DEEPSEEK — Has real balance API ═══
        try {
            const key = process.env.DEEPSEEK_API_KEY;
            if (key) {
                const res = await fetch('https://api.deepseek.com/user/balance', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    const balances = data.balance_infos || [];
                    const total = balances.reduce((sum, b) => sum + parseFloat(b.total_balance || 0), 0);
                    statuses.deepseek = { balance: total, status: 'ok' };
                    if (total < PROVIDER_LINKS.deepseek.threshold) {
                        alerts.push({ provider: 'deepseek', balance: `$${total.toFixed(2)}`, threshold: `$${PROVIDER_LINKS.deepseek.threshold}` });
                    }
                } else {
                    statuses.deepseek = { status: `error_${res.status}` };
                    alerts.push({ provider: 'deepseek', balance: 'ERROR - cannot check', threshold: 'N/A' });
                }
            }
        } catch (e) { statuses.deepseek = { status: 'fail', error: e.message }; }

        // ═══ 2. OPENAI — Test key validity ═══
        try {
            const key = process.env.OPENAI_API_KEY;
            if (key) {
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                statuses.openai = { status: res.ok ? 'ok' : `error_${res.status}` };
                if (!res.ok) {
                    alerts.push({ provider: 'openai', balance: `KEY ERROR (${res.status})`, threshold: 'N/A' });
                }
            }
        } catch (e) { statuses.openai = { status: 'fail' }; }

        // ═══ 3. ANTHROPIC — Test key ═══
        try {
            const key = process.env.ANTHROPIC_API_KEY;
            if (key) {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] })
                });
                statuses.anthropic = { status: res.ok ? 'ok' : `error_${res.status}` };
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alerts.push({ provider: 'anthropic', balance: `ERROR: ${err.error?.message || res.status}`, threshold: 'N/A' });
                }
            }
        } catch (e) { statuses.anthropic = { status: 'fail' }; }

        // ═══ 4. GROK — Test key ═══
        try {
            const key = process.env.GROK_API_KEY;
            if (key) {
                const res = await fetch('https://api.x.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                statuses.grok = { status: res.ok ? 'ok' : `error_${res.status}` };
                if (!res.ok) {
                    alerts.push({ provider: 'grok', balance: `KEY ERROR (${res.status})`, threshold: 'N/A' });
                }
            }
        } catch (e) { statuses.grok = { status: 'fail' }; }

        // ═══ Build email if there are alerts ═══
        const isManualTrigger = event.httpMethod === 'GET' || event.httpMethod === 'POST';

        if (alerts.length === 0 && !isManualTrigger) {
            console.log('Balance monitor: all OK, no alerts needed');
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, alerts: 0, message: 'All balances OK' }) };
        }

        // Build alert rows
        const alertRows = alerts.map(a => {
            const info = PROVIDER_LINKS[a.provider] || { name: a.provider, url: '#' };
            return `<tr>
        <td style="padding:10px 12px;color:#fff;font-weight:600;">${info.name}</td>
        <td style="padding:10px 12px;color:#ff6b6b;font-weight:700;">${a.balance}</td>
        <td style="padding:10px 12px;"><a href="${info.url}" style="color:#00e5ff;text-decoration:none;font-weight:600;">💳 Top-Up →</a></td>
      </tr>`;
        }).join('');

        // Build status summary rows
        const statusRows = Object.entries(statuses).map(([name, s]) => {
            const icon = s.status === 'ok' ? '🟢' : '🔴';
            const bal = s.balance !== undefined ? `$${s.balance.toFixed(2)}` : s.status;
            return `<tr><td style="padding:6px 12px;color:#aaa;">${icon} ${name}</td><td style="padding:6px 12px;color:#ccc;">${bal}</td></tr>`;
        }).join('');

        const subject = alerts.length > 0
            ? `⚠️ ${alerts.length} AI Provider${alerts.length > 1 ? 's' : ''} Need Attention`
            : '✅ All AI Providers OK';

        const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:30px 20px;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🔮</span>
    <span style="color:#00e5ff;font-size:18px;font-weight:700;vertical-align:middle;margin-left:8px;">Kelion AI — Balance Monitor</span>
  </div>

  ${alerts.length > 0 ? `
  <div style="background:#2d1b1b;border:1px solid #ff4444;border-radius:12px;padding:20px;margin-bottom:20px;">
    <h2 style="color:#ff6b6b;font-size:16px;margin:0 0 15px;">🚨 Low Balance / Error Alert</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
        <th style="padding:8px 12px;text-align:left;color:#888;font-size:12px;">PROVIDER</th>
        <th style="padding:8px 12px;text-align:left;color:#888;font-size:12px;">BALANCE</th>
        <th style="padding:8px 12px;text-align:left;color:#888;font-size:12px;">ACTION</th>
      </tr>
      ${alertRows}
    </table>
  </div>` : ''}

  <div style="background:#111827;border:1px solid #1e293b;border-radius:12px;padding:20px;">
    <h3 style="color:#818cf8;font-size:14px;margin:0 0 12px;">📊 Full Status</h3>
    <table style="width:100%;border-collapse:collapse;">
      ${statusRows}
    </table>
  </div>

  <div style="text-align:center;margin-top:20px;color:#444;font-size:11px;">
    Kelion AI Balance Monitor &mdash; ${new Date().toISOString().split('T')[0]}
  </div>
</div>
</body></html>`;

        const fromAddress = process.env.RESEND_FROM || 'Kelion AI <onboarding@resend.dev>';

        const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddress,
                to: [ADMIN_EMAIL],
                subject: `[Kelion AI] ${subject}`,
                html: emailHtml
            })
        });

        const emailData = await emailRes.json().catch(() => ({}));

        if (!emailRes.ok) {
            console.error('Balance monitor email failed:', emailRes.status, emailData);
            return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to send alert', detail: emailData }) };
        }

        console.log(`Balance monitor: ${alerts.length} alerts sent to ${ADMIN_EMAIL}, emailId: ${emailData.id}`);

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                alerts: alerts.length,
                alerted: alerts.map(a => a.provider),
                statuses,
                emailId: emailData.id
            })
        };
    } catch (error) {
        console.error('Balance monitor error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
