// Engine Discovery — Auto-detects, benchmarks, and tracks AI engine health
// Makes K Brain self-upgrading by dynamically managing the engine cascade
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const { action } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'discover': return await discoverEngines(headers);
            case 'benchmark': return await benchmarkEngines(headers);
            case 'status': return await getEngineStatus(headers);
            case 'optimize': return await optimizeCascade(headers);
            default: return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: discover, benchmark, status, optimize' }) };
        }
    } catch (error) {
        console.error('Engine discovery error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ ENGINE REGISTRY ═══
const ENGINE_REGISTRY = [
    {
        name: 'gemini', key: 'GEMINI_API_KEY', model: 'gemini-2.0-flash', type: 'llm', cost: 'free', speed: 'fast',
        test: async (key) => {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'Respond with: OK' }] }], generationConfig: { maxOutputTokens: 10 } })
            });
            return r.ok;
        }
    },
    {
        name: 'groq', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile', type: 'llm', cost: 'free', speed: 'fastest',
        test: async (key) => {
            const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'deepseek', key: 'DEEPSEEK_API_KEY', model: 'deepseek-chat', type: 'llm', cost: 'low', speed: 'medium',
        test: async (key) => {
            const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'openai', key: 'OPENAI_API_KEY', model: 'gpt-4o', type: 'llm', cost: 'high', speed: 'medium',
        test: async (key) => {
            const r = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'claude', key: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-20250514', type: 'llm', cost: 'high', speed: 'medium',
        test: async (key) => {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST', headers: { 'x-api-key': key, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
                body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'OK' }] })
            });
            return r.ok;
        }
    },
    {
        name: 'mistral', key: 'MISTRAL_API_KEY', model: 'mistral-large-latest', type: 'llm', cost: 'medium', speed: 'fast',
        test: async (key) => {
            const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'mistral-large-latest', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'grok', key: 'GROK_API_KEY', model: 'grok-2', type: 'llm', cost: 'medium', speed: 'fast',
        test: async (key) => {
            const r = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'grok-2', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'cohere', key: 'COHERE_API_KEY', model: 'command-r-plus', type: 'llm', cost: 'medium', speed: 'medium',
        test: async (key) => {
            const r = await fetch('https://api.cohere.ai/v1/chat', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'command-r-plus', message: 'OK', max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'together', key: 'TOGETHER_API_KEY', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', type: 'llm', cost: 'low', speed: 'fast',
        test: async (key) => {
            const r = await fetch('https://api.together.xyz/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    {
        name: 'ai21', key: 'AI21_API_KEY', model: 'jamba-large', type: 'llm', cost: 'medium', speed: 'medium',
        test: async (key) => {
            const r = await fetch('https://api.ai21.com/studio/v1/chat/completions', {
                method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'jamba-large', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 })
            });
            return r.ok;
        }
    },
    // Search engines
    { name: 'perplexity', key: 'PERPLEXITY_API_KEY', model: 'sonar-large-online', type: 'search', cost: 'medium', speed: 'fast', test: null },
    { name: 'tavily', key: 'TAVILY_API_KEY', model: 'tavily-search', type: 'search', cost: 'low', speed: 'fast', test: null },
    { name: 'brave', key: 'BRAVE_SEARCH_KEY', model: 'brave-search-v1', type: 'search', cost: 'free', speed: 'fast', test: null },
    // Vector store
    { name: 'pinecone', key: 'PINECONE_API_KEY', model: 'pinecone-embeddings', type: 'vector', cost: 'low', speed: 'fast', test: null },
];

// ═══ DISCOVER — Check which engines are available ═══
async function discoverEngines(headers) {
    const results = [];
    for (const engine of ENGINE_REGISTRY) {
        const hasKey = !!process.env[engine.key];
        results.push({
            name: engine.name,
            model: engine.model,
            type: engine.type,
            cost: engine.cost,
            speed: engine.speed,
            available: hasKey,
            key_configured: hasKey
        });
    }

    const available = results.filter(r => r.available);
    const missing = results.filter(r => !r.available);

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            success: true,
            total_engines: ENGINE_REGISTRY.length,
            available: available.length,
            missing: missing.length,
            engines: results,
            llm_count: available.filter(e => e.type === 'llm').length,
            search_count: available.filter(e => e.type === 'search').length,
            timestamp: new Date().toISOString()
        })
    };
}

// ═══ BENCHMARK — Test each engine's response time ═══
async function benchmarkEngines(headers) {
    const results = [];

    for (const engine of ENGINE_REGISTRY) {
        const key = process.env[engine.key];
        if (!key || !engine.test) {
            results.push({ name: engine.name, status: key ? 'no_test' : 'no_key', latency: null });
            continue;
        }

        const start = Date.now();
        try {
            const ok = await engine.test(key);
            const latency = Date.now() - start;
            results.push({ name: engine.name, status: ok ? 'online' : 'error', latency, model: engine.model });
            console.log(`[DISCOVERY] ${engine.name}: ${ok ? '✅' : '❌'} ${latency}ms`);
        } catch (err) {
            results.push({ name: engine.name, status: 'error', latency: Date.now() - start, error: err.message });
            console.log(`[DISCOVERY] ${engine.name}: ❌ ${err.message}`);
        }
    }

    // Save to Supabase
    try {
        const db = getDb();
        if (db) {
            await db.from('engine_registry').upsert(results.filter(r => r.status !== 'no_key').map(r => ({
                engine_name: r.name,
                status: r.status,
                latency_ms: r.latency,
                model: r.model || null,
                last_checked: new Date().toISOString()
            })), { onConflict: 'engine_name' });
        }
    } catch (e) { console.log('[DISCOVERY] DB save skipped:', e.message); }

    // Sort by latency (fastest first)
    results.sort((a, b) => (a.latency || 9999) - (b.latency || 9999));

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            success: true,
            benchmarks: results,
            fastest: results.find(r => r.status === 'online')?.name || null,
            online_count: results.filter(r => r.status === 'online').length,
            timestamp: new Date().toISOString()
        })
    };
}

// ═══ STATUS — Get current engine health from DB ═══
async function getEngineStatus(headers) {
    try {
        const db = getDb();
        if (!db) throw new Error('No database');

        const { data, error } = await db.from('engine_registry').select('*').order('latency_ms', { ascending: true });
        if (error) throw error;

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                engines: data || [],
                online: (data || []).filter(e => e.status === 'online').length,
                total: (data || []).length
            })
        };
    } catch (e) {
        // Fallback to discovery if no DB
        return discoverEngines(headers);
    }
}

// ═══ OPTIMIZE — Suggest optimal cascade order ═══
async function optimizeCascade(headers) {
    // Get benchmark data
    const benchResult = JSON.parse((await benchmarkEngines(headers)).body);
    const online = benchResult.benchmarks.filter(b => b.status === 'online');

    // Optimal order: free + fast first, then paid + fast, then paid + slow
    const costOrder = { free: 0, low: 1, medium: 2, high: 3 };
    const registryMap = Object.fromEntries(ENGINE_REGISTRY.map(e => [e.name, e]));

    const optimized = online.map(e => ({
        ...e,
        cost: registryMap[e.name]?.cost || 'medium',
        costRank: costOrder[registryMap[e.name]?.cost] || 2
    })).sort((a, b) => {
        // Primary: cost (free first)
        if (a.costRank !== b.costRank) return a.costRank - b.costRank;
        // Secondary: latency (fastest first)
        return (a.latency || 9999) - (b.latency || 9999);
    });

    return {
        statusCode: 200, headers,
        body: JSON.stringify({
            success: true,
            optimal_cascade: optimized.map(e => e.name),
            details: optimized,
            recommendation: `Use ${optimized[0]?.name || 'gemini'} as primary, ${optimized[1]?.name || 'groq'} as fallback`,
            timestamp: new Date().toISOString()
        })
    };
}

// ═══ HELPERS ═══
function getDb() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}
