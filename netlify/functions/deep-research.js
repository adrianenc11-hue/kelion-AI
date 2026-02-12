// Deep Research - Multi-AI research with failover + parallel synthesis
// GPT-4o primary → Gemini Flash → DeepSeek
// Parallel mode: all engines research simultaneously, then combine insights

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { topic, mode } = JSON.parse(event.body || '{}');
        if (!topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic required' }) };

        const _researchPrompt = `Cercetează în profunzime: ${topic}. Oferă analize detaliate, structurate, cu perspective multiple, date concrete, și concluzii bine fundamentate.`; // eslint-disable-line no-unused-vars
        const systemPrompt = 'Ești un cercetător expert. Oferă analize detaliate, structurate, cu surse și perspective multiple.';

        // ═══ PARALLEL MODE — All engines research simultaneously ═══
        if (mode === 'parallel' || mode === 'multi') {
            const results = await Promise.allSettled([
                researchOpenAI(topic, systemPrompt),
                researchGemini(topic, systemPrompt),
                researchDeepSeek(topic, systemPrompt)
            ]);

            const responses = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);

            // Synthesize all responses
            let synthesis = '';
            if (responses.length > 1 && process.env.GEMINI_API_KEY) {
                const synthRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: `Sintetizează aceste cercetări de la ${responses.length} motoare AI diferite într-un raport unic, complet, eliminând duplicatele:\n\n${responses.map(r => `[${r.engine}]: ${r.research}`).join('\n\n---\n\n')}` }] }], generationConfig: { maxOutputTokens: 3000 } })
                });
                const synthData = await synthRes.json();
                synthesis = synthData.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    mode: 'parallel',
                    topic,
                    engines_used: responses.length,
                    synthesis: synthesis || responses[0]?.research || 'No results',
                    individual_responses: responses
                })
            };
        }

        // ═══ CASCADE FAILOVER ═══
        const engines = [
            { key: 'OPENAI_API_KEY', fn: () => researchOpenAI(topic, systemPrompt) },
            { key: 'GEMINI_API_KEY', fn: () => researchGemini(topic, systemPrompt) },
            { key: 'DEEPSEEK_API_KEY', fn: () => researchDeepSeek(topic, systemPrompt) },

        ].filter(e => process.env[e.key]);

        if (engines.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI keys configured' }) };

        for (const engine of engines) {
            try {
                const result = await engine.fn();
                if (result?.research) return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result, failover_available: engines.length }) };
            } catch (e) { console.error(`Research engine failed: ${e.message}`); }
        }

        return { statusCode: 500, headers, body: JSON.stringify({ error: 'All research engines unavailable' }) };
    } catch (error) {
        console.error('Deep research error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

async function researchOpenAI(topic, systemPrompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Cercetează: ${topic}` }], max_tokens: 3000 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return { engine: 'gpt-4o', research: data.choices?.[0]?.message?.content, model: 'gpt-4o' };
}

async function researchGemini(topic, systemPrompt) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nCercetează: ${topic}` }] }], generationConfig: { maxOutputTokens: 3000 } })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return { engine: 'gemini-2.0-flash', research: data.candidates?.[0]?.content?.parts?.[0]?.text, model: 'gemini-2.0-flash' };
}

async function researchDeepSeek(topic, systemPrompt) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Cercetează: ${topic}` }], max_tokens: 3000 })
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    return { engine: 'deepseek', research: data.choices?.[0]?.message?.content, model: 'deepseek-chat' };
}


