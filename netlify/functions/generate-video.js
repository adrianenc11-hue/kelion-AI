// Generate Video - Video generation via Replicate (fetch API)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { prompt } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required' }) };

        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured' }) };

        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: '9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351',
                input: { prompt, num_frames: 24 }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Replicate error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Replicate API error' }) };
        }

        const data = await response.json();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, prediction_id: data.id, status: data.status }) };
    } catch (error) {
        console.error('Generate video error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
