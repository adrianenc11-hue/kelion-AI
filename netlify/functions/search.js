// Search Function - Web Search via Tavily
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { query } = JSON.parse(event.body || '{}');

        if (!query) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required' }) };
        }

        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'TAVILY_API_KEY not configured' }) };
        }

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query: query,
                search_depth: 'basic',
                max_results: 5
            })
        });

        if (!response.ok) {
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Search API error' }) };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                query: query,
                results: data.results?.map(r => ({
                    title: r.title,
                    url: r.url,
                    content: r.content?.substring(0, 300)
                })) || [],
                answer: data.answer
            })
        };

    } catch (error) {
        console.error('Search error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
