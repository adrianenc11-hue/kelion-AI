// Detect Emotion - Facial emotion analysis
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { image } = JSON.parse(event.body || '{}');
        if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user', content: [
                        { type: 'text', text: 'Analizează expresia facială. Returnează JSON: {"emotion": "happy/sad/angry/surprised/neutral", "confidence": 0.0-1.0, "description": "..."}' },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }],
                max_tokens: 200
            })
        });

        if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Vision API error' }) };
        const data = await response.json();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, result: data.choices?.[0]?.message?.content }) };
    } catch (error) {
        console.error('Detect emotion error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
