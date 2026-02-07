// Realtime Token - OpenAI Realtime API Session Token
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };
        }

        // Create ephemeral token for realtime API
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-realtime-preview-2024-12-17',
                voice: 'alloy',
                instructions: 'Ești K, un asistent AI vocal. Răspunzi natural și prietenos în limba în care ți se vorbește.',
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Realtime session error:', error);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Failed to create realtime session' }) };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                client_secret: data.client_secret,
                session_id: data.id,
                expires_at: data.expires_at
            })
        };

    } catch (error) {
        console.error('Realtime token error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
