// Chat Function - AI Conversation with automatic failover
// Cascade: OpenAI GPT-4o-mini → Gemini Flash → DeepSeek → Kimi
// Parallel mode: all engines for comprehensive answers

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { message, history = [], mode } = JSON.parse(event.body || '{}');
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        const systemPrompt = 'Ești K, un asistent AI inteligent și prietenos. Răspunzi în limba utilizatorului. Ești natural, empatic și util.';
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10),
            { role: 'user', content: message }
        ];

        // ═══ PARALLEL MODE ═══
        if (mode === 'parallel') {
            const results = await Promise.allSettled([
                chatOpenAI(messages),
                chatGemini(message, systemPrompt),
                chatDeepSeek(messages),
                chatKimi(messages)
            ]);
            const responses = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, mode: 'parallel', responses, count: responses.length }) };
        }

        // ═══ CASCADE FAILOVER ═══
        const engines = [
            { key: 'OPENAI_API_KEY', fn: () => chatOpenAI(messages) },
            { key: 'GEMINI_API_KEY', fn: () => chatGemini(message, systemPrompt) },
            { key: 'DEEPSEEK_API_KEY', fn: () => chatDeepSeek(messages) },
            { key: 'KIMI_API_KEY', fn: () => chatKimi(messages) }
        ].filter(e => process.env[e.key]);

        if (engines.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI keys configured' }) };

        for (const engine of engines) {
            try {
                const result = await engine.fn();
                if (result?.reply) return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...result, failover_available: engines.length }) };
            } catch (e) { console.error(`Engine failed: ${e.message}`); }
        }

        return { statusCode: 500, headers, body: JSON.stringify({ error: 'All AI engines unavailable' }) };
    } catch (error) {
        console.error('Chat error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

async function chatOpenAI(messages) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return { engine: 'gpt-4o-mini', reply: data.choices?.[0]?.message?.content };
}

async function chatGemini(message, system) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\n${message}` }] }], generationConfig: { maxOutputTokens: 1000 } })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return { engine: 'gemini-2.0-flash', reply: data.candidates?.[0]?.content?.parts?.[0]?.text };
}

async function chatDeepSeek(messages) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 1000 })
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    return { engine: 'deepseek', reply: data.choices?.[0]?.message?.content };
}

async function chatKimi(messages) {
    const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.KIMI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'moonshot-v1-8k', messages, max_tokens: 1000 })
    });
    if (!res.ok) throw new Error(`Kimi ${res.status}`);
    const data = await res.json();
    return { engine: 'kimi-k2.5', reply: data.choices?.[0]?.message?.content };
}
