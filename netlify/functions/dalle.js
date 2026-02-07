// DALL-E - Direct DALL-E endpoint (alias for generate-image)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { prompt } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'dall-e-3', prompt, size: '1024x1024', n: 1 })
        });

        if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: 'DALL-E error' }) };
        const data = await response.json();
        // Log cost: DALL-E 3 = $0.04/image
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'dall-e-3', input_tokens: 1, output_tokens: 0, estimated_cost: 0.04, endpoint: 'dalle' })
        }).catch(() => { });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, url: data.data?.[0]?.url }) };
    } catch (error) {
        console.error('DALL-E error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
