// Realtime Session - Create OpenAI Realtime session
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, apiKey: apiKey, model: 'gpt-4o-realtime-preview' }) };
    } catch (error) {
        console.error('Realtime session error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
