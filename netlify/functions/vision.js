// Vision Function - Image Analysis via OpenAI GPT-4o
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { image, question } = JSON.parse(event.body || '{}');
        if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: question || 'Ce vezi in aceasta imagine? Descrie detaliat.' },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }],
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Vision API error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Vision API error' }) };
        }

        const data = await response.json();

        // Log cost: gpt-4o-mini vision — use actual usage from API
        const usage = data.usage || {};
        const inCost = ((usage.prompt_tokens || 500) / 1000000) * 0.15;
        const outCost = ((usage.completion_tokens || 300) / 1000000) * 0.60;
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'gpt-4o-mini', input_tokens: usage.prompt_tokens || 500, output_tokens: usage.completion_tokens || 300, estimated_cost: inCost + outCost, endpoint: 'vision' })
        }).catch(() => { });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, analysis: data.choices?.[0]?.message?.content })
        };
    } catch (error) {
        console.error('Vision error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
