// Search Router — Intelligent multi-engine search routing
// Analyzes query type → routes to optimal search engine
// Routes: Tavily → Perplexity → Brave → Google → Pinecone (RAG)
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const { query, mode, source } = JSON.parse(event.body || '{}');
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required' }) };

        // ═══ CLASSIFY QUERY TYPE ═══
        const classification = classifyQuery(query);
        console.log(`[SEARCH-ROUTER] Query type: ${classification.type}, confidence: ${classification.confidence}`);

        // ═══ MODE: PARALLEL — all engines simultaneously ═══
        if (mode === 'parallel') {
            const engines = getAvailableEngines();
            if (engines.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No search APIs configured' }) };

            const results = await Promise.allSettled(engines.map(e => e.fn(query)));
            const responses = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    mode: 'parallel',
                    classification,
                    engines_used: responses.length,
                    results: deduplicateResults(responses),
                    combined_answer: combineAnswers(responses)
                })
            };
        }

        // ═══ MODE: AUTO — intelligent routing based on query type ═══
        const routePlan = getRoutePlan(classification);
        console.log(`[SEARCH-ROUTER] Route plan: ${routePlan.map(r => r.name).join(' → ')}`);

        for (const route of routePlan) {
            try {
                const result = await route.fn(query);
                if (result && (result.answer || result.results?.length > 0)) {
                    // Log cost
                    logSearchCost(route.name, query).catch(() => { });

                    return {
                        statusCode: 200, headers,
                        body: JSON.stringify({
                            success: true,
                            classification,
                            engine: route.name,
                            source: source || 'search-router',
                            ...result
                        })
                    };
                }
            } catch (err) {
                console.error(`[SEARCH-ROUTER] ${route.name} failed:`, err.message);
            }
        }

        return { statusCode: 503, headers, body: JSON.stringify({ error: 'All search engines failed', classification }) };
    } catch (error) {
        console.error('Search router error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ QUERY CLASSIFICATION ═══
function classifyQuery(query) {
    const q = query.toLowerCase();

    // Real-time: news, prices, weather, scores
    if (/\b(azi|acum|tocmai|breaking|ultimele|pretul|curs|vreme|meteo|scor|rezultat|live)\b/i.test(q) ||
        /\b(today|now|latest|current|breaking|price|weather|score)\b/i.test(q))
        return { type: 'realtime', confidence: 0.9 };

    // Deep research: complex topics, comparisons, analysis
    if (/\b(cercetează|analizează|compară|studiu|raport|avantaje|dezavantaje|istorie|evoluție)\b/i.test(q) ||
        /\b(research|analyze|compare|study|report|pros|cons|history|evolution)\b/i.test(q) ||
        q.length > 150)
        return { type: 'research', confidence: 0.85 };

    // Factual: simple questions, definitions, "ce este", "cât"
    if (/\b(ce este|ce înseamnă|câți|câte|cât|definiți|explică)\b/i.test(q) ||
        /\b(what is|define|how many|how much|explain)\b/i.test(q))
        return { type: 'factual', confidence: 0.8 };

    // Memory recall: personal, past conversations
    if (/\b(am spus|îți amintești|ultima dată|anterior|conversație|remember|last time)\b/i.test(q))
        return { type: 'memory', confidence: 0.9 };

    // Search: general web lookup
    if (/\b(caută|găsește|search|find|lookup|site|link|url)\b/i.test(q))
        return { type: 'search', confidence: 0.75 };

    return { type: 'auto', confidence: 0.5 };
}

// ═══ ROUTE PLAN — Based on classification ═══
function getRoutePlan(classification) {
    const engines = getAvailableEngines();
    const byName = Object.fromEntries(engines.map(e => [e.name, e]));

    const plans = {
        'realtime': ['perplexity', 'brave', 'tavily', 'google'],
        'research': ['perplexity', 'tavily', 'brave', 'google'],
        'factual': ['tavily', 'perplexity', 'brave', 'google'],
        'memory': ['pinecone', 'tavily', 'perplexity'],
        'search': ['brave', 'tavily', 'perplexity', 'google'],
        'auto': ['perplexity', 'tavily', 'brave', 'google']
    };

    const plan = plans[classification.type] || plans['auto'];
    return plan.map(name => byName[name]).filter(Boolean);
}

// ═══ AVAILABLE ENGINES ═══
function getAvailableEngines() {
    const engines = [];

    if (process.env.PERPLEXITY_API_KEY) engines.push({ name: 'perplexity', fn: searchPerplexity });
    if (process.env.TAVILY_API_KEY) engines.push({ name: 'tavily', fn: searchTavily });
    if (process.env.BRAVE_SEARCH_KEY) engines.push({ name: 'brave', fn: searchBrave });
    if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) engines.push({ name: 'google', fn: searchGoogle });
    if (process.env.PINECONE_API_KEY && process.env.PINECONE_HOST && process.env.OPENAI_API_KEY) engines.push({ name: 'pinecone', fn: searchPinecone });

    return engines;
}

// ═══ SEARCH ENGINES ═══

async function searchPerplexity(query) {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'sonar-pro',
            messages: [{ role: 'user', content: query }],
            max_tokens: 2000
        })
    });
    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Perplexity ${res.status}: ${errBody.substring(0, 200)}`);
    }
    const data = await res.json();
    return { answer: data.choices?.[0]?.message?.content, citations: data.citations || [], model: 'sonar-pro' };
}

async function searchTavily(query) {
    const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'advanced', max_results: 8 })
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data = await res.json();
    return {
        answer: data.answer || null,
        results: (data.results || []).map(r => ({ title: r.title, url: r.url, content: r.content?.substring(0, 300) }))
    };
}

async function searchBrave(query) {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`, {
        headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY, 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Brave ${res.status}`);
    const data = await res.json();
    const results = (data.web?.results || []).map(r => ({ title: r.title, url: r.url, content: r.description }));
    return { answer: results.map(r => `**${r.title}**: ${r.content}`).join('\n\n'), results };
}

async function searchGoogle(query) {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_KEY}&cx=${process.env.GOOGLE_CSE_CX}&q=${encodeURIComponent(query)}&num=10`);
    if (!res.ok) throw new Error(`Google CSE ${res.status}`);
    const data = await res.json();
    const results = (data.items || []).map(r => ({ title: r.title, url: r.link, content: r.snippet }));
    return { answer: results.map(r => `**${r.title}**: ${r.content}`).join('\n\n'), results };
}

async function searchPinecone(query) {
    // Get embedding
    const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: query })
    });
    if (!embedRes.ok) throw new Error(`Embeddings ${embedRes.status}`);
    const embedData = await embedRes.json();
    const vector = embedData.data?.[0]?.embedding;
    if (!vector) throw new Error('No embedding returned');

    // Query Pinecone
    const pcRes = await fetch(`https://${process.env.PINECONE_HOST}/query`, {
        method: 'POST',
        headers: { 'Api-Key': process.env.PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector, topK: 5, includeMetadata: true, namespace: 'default' })
    });
    if (!pcRes.ok) throw new Error(`Pinecone ${pcRes.status}`);
    const pcData = await pcRes.json();
    const matches = (pcData.matches || []).filter(m => m.score > 0.7);
    if (matches.length === 0) return null;
    return {
        answer: matches.map(m => m.metadata?.text || '').join('\n\n'),
        results: matches.map(m => ({ title: `Memory (${(m.score * 100).toFixed(0)}%)`, content: m.metadata?.text || '', score: m.score })),
        source: 'pinecone-rag'
    };
}

// ═══ HELPERS ═══

function deduplicateResults(responses) {
    const seen = new Set();
    const all = [];
    for (const r of responses) {
        if (r.results) {
            for (const item of r.results) {
                const key = item.url || item.title || item.content?.substring(0, 50);
                if (!seen.has(key)) { seen.add(key); all.push(item); }
            }
        }
    }
    return all;
}

function combineAnswers(responses) {
    return responses.filter(r => r.answer).map(r => r.answer).join('\n\n---\n\n');
}

function logSearchCost(engine, query) {
    return fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_usage', model: `search-${engine}`, input_tokens: query.length, output_tokens: 0, endpoint: 'search-router' })
    });
}
