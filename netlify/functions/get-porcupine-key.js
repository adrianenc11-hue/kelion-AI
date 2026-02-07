// Get Porcupine Key - Wake word detection API key
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const key = process.env.PORCUPINE_API_KEY;
        if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: 'PORCUPINE_API_KEY not configured' }) };
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, accessKey: key }) };
    } catch (error) {
        console.error('Porcupine key error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
