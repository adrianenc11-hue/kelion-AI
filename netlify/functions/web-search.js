// Web Search — Multi-engine search with synthesis
// Engines: Perplexity → Brave Search → Google Custom Search
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { query, engine, mode } = JSON.parse(event.body || '{}');
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required' }) };

        // Parallel mode — all engines search simultaneously
        if (mode === 'parallel') {
            const engines = [
                process.env.PERPLEXITY_API_KEY ? searchPerplexity(query) : null,
                process.env.BRAVE_SEARCH_KEY ? searchBrave(query) : null,
                (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) ? searchGoogle(query) : null
            ].filter(Boolean);

            if (engines.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No search API keys configured' }) };

            const results = await Promise.allSettled(engines);
            const responses = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, mode: 'parallel', engines_used: responses.length, results: responses })
            };
        }

        // Specific engine
        if (engine) {
            const map = { perplexity: searchPerplexity, brave: searchBrave, google: searchGoogle };
            if (!map[engine]) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown engine: ${engine}` }) };
            const result = await map[engine](query);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) };
        }

        // Cascade failover
        const searchEngines = [
            { key: 'PERPLEXITY_API_KEY', fn: () => searchPerplexity(query) },
            { key: 'BRAVE_SEARCH_KEY', fn: () => searchBrave(query) },
            { key: 'GOOGLE_CSE_KEY', fn: () => searchGoogle(query) }
        ].filter(e => process.env[e.key]);

        // DuckDuckGo fallback — always available, no API key needed
        searchEngines.push({ key: '_DDG_FREE_', fn: () => searchDuckDuckGo(query) });

        for (const se of searchEngines) {
            try {
                const result = await se.fn();
                if (result) {
                    fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'log_usage', model: result.engine, input_tokens: query.length, output_tokens: 0, endpoint: 'web-search' })
                    }).catch(() => { });
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result }) };
                }
            } catch (err) { console.error('Search %s failed:', se.key, err.message); }
        }

        return { statusCode: 503, headers, body: JSON.stringify({ error: 'All search engines failed or not configured' }) };
    } catch (error) {
        console.error('Web search error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ PERPLEXITY — AI-powered search with citations ═══
async function searchPerplexity(query) {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama-3.1-sonar-large-128k-online',
            messages: [{ role: 'user', content: query }],
            max_tokens: 2000,
            return_citations: true
        })
    });
    if (!res.ok) throw new Error(`Perplexity ${res.status}`);
    const data = await res.json();
    return {
        engine: 'perplexity',
        answer: data.choices?.[0]?.message?.content,
        citations: data.citations || [],
        model: 'sonar-large-online'
    };
}

// ═══ BRAVE SEARCH — Privacy-first web search ═══
async function searchBrave(query) {
    const key = process.env.BRAVE_SEARCH_KEY;
    if (!key) return null;
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
        headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Brave ${res.status}`);
    const data = await res.json();
    const results = (data.web?.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description
    }));
    return {
        engine: 'brave',
        results,
        answer: results.map(r => `**${r.title}**: ${r.snippet}`).join('\n\n'),
        model: 'brave-search-v1'
    };
}

// ═══ GOOGLE CUSTOM SEARCH ═══
async function searchGoogle(query) {
    const key = process.env.GOOGLE_CSE_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    if (!key || !cx) return null;
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`);
    if (!res.ok) throw new Error(`Google CSE ${res.status}`);
    const data = await res.json();
    const results = (data.items || []).map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet
    }));
    return {
        engine: 'google',
        results,
        answer: results.map(r => `**${r.title}**: ${r.snippet}`).join('\n\n'),
        model: 'google-cse-v1'
    };
}

// ═══ DUCKDUCKGO — Free fallback, no API key needed ═══
async function searchDuckDuckGo(query) {
    try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
        if (!res.ok) return { engine: 'duckduckgo', results: [], answer: `Search for "${query}" completed`, model: 'ddg-instant-v1' };
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { return { engine: 'duckduckgo', results: [], answer: `Search for "${query}" completed`, model: 'ddg-instant-v1' }; }

        const results = [];
        // Instant answer
        if (data.Abstract) {
            results.push({ title: data.Heading || 'DuckDuckGo', url: data.AbstractURL || '', snippet: data.Abstract });
        }
        // Related topics
        if (data.RelatedTopics) {
            for (const t of data.RelatedTopics.slice(0, 8)) {
                if (t.Text && t.FirstURL) {
                    results.push({ title: t.Text.substring(0, 80), url: t.FirstURL, snippet: t.Text });
                }
            }
        }
        // Answer box
        if (data.Answer) {
            results.unshift({ title: 'Answer', url: '', snippet: data.Answer });
        }

        return {
            engine: 'duckduckgo',
            results,
            answer: results.length > 0 ? results.map(r => r.snippet).join('\n\n') : `No instant results for "${query}". Try a more specific search.`,
            model: 'ddg-instant-v1'
        };
    } catch (e) {
        return { engine: 'duckduckgo', results: [], answer: `Search for "${query}" completed`, model: 'ddg-instant-v1' };
    }
}
