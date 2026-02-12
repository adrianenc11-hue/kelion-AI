// Search Function - Web Search via Tavily (with DuckDuckGo fallback)
const { patchProcessEnv } = require('./get-secret');

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
        await patchProcessEnv(); // Load vault secrets
        const { query } = JSON.parse(event.body || '{}');

        if (!query) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required' }) };
        }

        const apiKey = process.env.TAVILY_API_KEY;

        // If Tavily key exists, use it
        if (apiKey) {
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
                    engine: 'tavily',
                    results: data.results?.map(r => ({
                        title: r.title,
                        url: r.url,
                        content: r.content?.substring(0, 300)
                    })) || [],
                    answer: data.answer
                })
            };
        }

        // Fallback: DuckDuckGo (free, no API key)
        const ddg = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        if (!ddg.ok) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Search services unavailable' }) };
        }
        const ddgData = await ddg.json();
        const results = [];
        if (ddgData.Abstract) results.push({ title: ddgData.Heading || 'Result', url: ddgData.AbstractURL || '', content: ddgData.Abstract });
        if (ddgData.RelatedTopics) {
            for (const t of ddgData.RelatedTopics.slice(0, 5)) {
                if (t.Text && t.FirstURL) results.push({ title: t.Text.substring(0, 80), url: t.FirstURL, content: t.Text });
            }
        }
        if (ddgData.Answer) results.unshift({ title: 'Answer', url: '', content: ddgData.Answer });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                query,
                engine: 'duckduckgo',
                results,
                answer: ddgData.Abstract || ddgData.Answer || 'No instant answer available'
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
