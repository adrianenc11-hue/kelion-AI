// Email Alerts - System alert notifications via Resend
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { to, subject, message, type } = JSON.parse(event.body || '{}');
        if (!to || !subject) return { statusCode: 400, headers, body: JSON.stringify({ error: 'To and subject required' }) };

        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!RESEND_API_KEY) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Email service not configured', code: 'CONFIG_MISSING' }) };
        }

        const fromAddress = process.env.RESEND_FROM || 'Kelion AI <onboarding@resend.dev>';

        // Alert type styling
        const alertColors = {
            error: { bg: '#2d1b1b', border: '#ff4444', icon: '🚨', label: 'Eroare' },
            warning: { bg: '#2d2a1b', border: '#ffaa00', icon: '⚠️', label: 'Atenție' },
            info: { bg: '#1b2d2d', border: '#00e5ff', icon: '📢', label: 'Info' },
            success: { bg: '#1b2d1b', border: '#44ff44', icon: '✅', label: 'Succes' }
        };
        const style = alertColors[type] || alertColors.info;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:20px;">
    <span style="font-size:28px;">🔮</span>
    <span style="color:#00e5ff;font-size:18px;font-weight:600;vertical-align:middle;margin-left:8px;">Kelion AI Alert</span>
  </div>
  <div style="background:${style.bg};border:1px solid ${style.border};border-radius:12px;padding:25px;">
    <div style="font-size:14px;color:${style.border};font-weight:600;margin-bottom:10px;">
      ${style.icon} ${style.label}
    </div>
    <h2 style="color:#fff;font-size:18px;margin:0 0 12px;">${subject}</h2>
    <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message || 'No details provided.'}</p>
  </div>
  <div style="text-align:center;margin-top:20px;color:#444;font-size:11px;">
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
                to: Array.isArray(to) ? to : [to],
                subject: `[Kelion AI] ${subject}`,
                html: emailHtml
            })
        });

        if (!resendResponse.ok) {
            const errData = await resendResponse.text();
            console.error('Resend alert error:', resendResponse.status, errData);
            return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to send alert email', code: 'EMAIL_SEND_FAILED' }) };
        }

        const data = await resendResponse.json();
        console.log('Alert email sent:', data.id, 'to:', to, 'subject:', subject);

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Alert sent', emailId: data.id }) };
    } catch (error) {
        console.error('Email alert error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
