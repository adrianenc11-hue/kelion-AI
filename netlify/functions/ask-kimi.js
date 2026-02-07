// Ask Kimi - Moonshot AI (Kimi K2.5)
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { question, message } = JSON.parse(event.body || '{}');
        const query = question || message;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question required' }) };

        const apiKey = process.env.KIMI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'KIMI_API_KEY not configured' }) };

        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'moonshot-v1-8k',
                messages: [
                    { role: 'system', content: 'You are Kimi, a helpful AI assistant. Respond in the language the user uses.' },
                    { role: 'user', content: query }
                ],
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Kimi error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Kimi API error' }) };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reply: data.choices?.[0]?.message?.content, model: 'kimi' })
        };
    } catch (error) {
        console.error('Ask Kimi error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
