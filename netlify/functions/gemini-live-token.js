// Gemini Live Token - Google Gemini 2.0 Live API
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                apiKey: apiKey,
                model: 'gemini-2.0-flash-live',
                wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
            })
        };
    } catch (error) {
        console.error('Gemini live token error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
