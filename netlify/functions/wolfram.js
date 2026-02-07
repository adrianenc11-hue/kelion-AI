// Wolfram Alpha - Math, science, and factual computation
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { query } = JSON.parse(event.body || '{}');
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required. Example: "integrate x^2 from 0 to 1" or "population of Romania"' }) };

        const appId = process.env.WOLFRAM_APP_ID;
        if (!appId) return { statusCode: 503, headers, body: JSON.stringify({ error: 'WOLFRAM_APP_ID not configured. Get one free at developer.wolframalpha.com' }) };

        // Short Answers API — simple text response
        const shortUrl = `https://api.wolframalpha.com/v1/result?appid=${appId}&i=${encodeURIComponent(query)}`;
        const shortRes = await fetch(shortUrl);
        const shortAnswer = shortRes.ok ? await shortRes.text() : null;

        // Full Results API — detailed computation
        const fullUrl = `https://api.wolframalpha.com/v2/query?appid=${appId}&input=${encodeURIComponent(query)}&output=json&format=plaintext`;
        const fullRes = await fetch(fullUrl);
        let pods = [];

        if (fullRes.ok) {
            const fullData = await fullRes.json();
            if (fullData.queryresult?.pods) {
                pods = fullData.queryresult.pods.map(p => ({
                    title: p.title,
                    text: p.subpods?.map(s => s.plaintext).filter(Boolean).join('\n') || ''
                })).filter(p => p.text);
            }
        }

        // Log cost (Wolfram: 2000 free/month)
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'wolfram-alpha', input_tokens: query.length, output_tokens: 0, endpoint: 'wolfram' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                query,
                short_answer: shortAnswer,
                detailed: pods,
                source: 'Wolfram Alpha'
            })
        };
    } catch (error) {
        console.error('Wolfram error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
