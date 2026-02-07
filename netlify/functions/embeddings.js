// Embeddings - Generate text embeddings via OpenAI
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { text } = JSON.parse(event.body || '{}');
        if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'text-embedding-3-small', input: text.substring(0, 8000) })
        });

        if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Embeddings API error' }) };
        const data = await response.json();
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, embedding: data.data?.[0]?.embedding, dimensions: data.data?.[0]?.embedding?.length }) };
    } catch (error) {
        console.error('Embeddings error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
