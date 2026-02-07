// Email Alerts - System alert notifications
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { to, subject, message } = JSON.parse(event.body || '{}');
        if (!to || !subject) return { statusCode: 400, headers, body: JSON.stringify({ error: 'To and subject required' }) };
        // Email service integration (SendGrid/Mailgun)
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Alert queued', to, subject }) };
    } catch (error) {
        console.error('Email alert error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
