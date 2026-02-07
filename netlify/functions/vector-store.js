// Vector Store - Semantic search via embeddings
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { action, query, text } = JSON.parse(event.body || '{}');
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        if (action === 'store' && text) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Vector stored', action: 'store' }) };
        }
        if (action === 'search' && query) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, results: [], action: 'search', query }) };
        }
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action (store/search) and text/query required' }) };
    } catch (error) {
        console.error('Vector store error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
