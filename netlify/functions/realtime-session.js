// Realtime Session - Create OpenAI Realtime ephemeral session
// SECURITY: Never returns raw API key. Creates ephemeral token via OpenAI API.
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': 'https://kelionai.app', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'config_missing', env: 'OPENAI_API_KEY' }) };

        // Create ephemeral session via OpenAI Realtime API
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview',
                modalities: ['audio', 'text']
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('OpenAI Realtime session error:', response.status, errData);
            return { statusCode: 502, headers, body: JSON.stringify({ error: 'Failed to create realtime session', status: response.status }) };
        }

        const session = await response.json();
        // Return session details (ephemeral token) — NEVER the raw API key
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, session, model: 'gpt-4o-realtime-preview' }) };
    } catch (error) {
        console.error('Realtime session error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
