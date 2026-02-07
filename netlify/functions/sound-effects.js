// Sound Effects - Audio effects generator
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { effect } = JSON.parse(event.body || '{}');
        if (!effect) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Effect name required' }) };

        const effects = { notification: 'ready', alert: 'ready', success: 'ready', error: 'ready', click: 'ready' };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, effect: effect, status: effects[effect] || 'unknown' }) };
    } catch (error) {
        console.error('Sound effects error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
