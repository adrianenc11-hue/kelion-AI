// Analyze Screen - Screenshot analysis
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { screenshot } = JSON.parse(event.body || '{}');
        if (!screenshot) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Screenshot required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const imageUrl = screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`;
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user', content: [
                        { type: 'text', text: 'Analizează acest screenshot. Ce se vede pe ecran? Oferă detalii utile.' },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }],
                max_tokens: 500
            })
        });

        if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Vision API error' }) };
        const data = await response.json();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, analysis: data.choices?.[0]?.message?.content }) };
    } catch (error) {
        console.error('Analyze screen error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
