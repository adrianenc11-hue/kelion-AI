// Generate Music - Text-to-music via Replicate (MusicGen by Meta)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { prompt, duration } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required. Example: "upbeat electronic dance music with synths"' }) };

        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured' }) };

        // MusicGen by Meta — generates music from text descriptions
        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: '671ac645ce5e552cc63a54a2bbff63fcf798043055f2a28f2c3e837c3a0c8a5c',
                input: {
                    prompt: prompt,
                    model_version: 'stereo-melody-large',
                    output_format: 'mp3',
                    duration: Math.min(duration || 10, 30) // Max 30 seconds
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Replicate music error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Music generation API error' }) };
        }

        const data = await response.json();

        // Log cost
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'musicgen', input_tokens: prompt.length, output_tokens: 0, endpoint: 'generate-music' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                prediction_id: data.id,
                status: data.status,
                message: 'Music generation started. Poll prediction_id for result.',
                poll_url: `https://api.replicate.com/v1/predictions/${data.id}`
            })
        };
    } catch (error) {
        console.error('Music gen error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
