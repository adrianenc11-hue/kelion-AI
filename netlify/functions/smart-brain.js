// Smart Brain - Multi-AI reasoning with automatic failover + parallel mode
// Cascade: DeepSeek → Gemini Flash → GPT-4o-mini → Kimi K2.5
// Parallel mode: all engines work simultaneously for heavy tasks

// ═══ CONTENT SAFETY FILTER ═══
const BLOCKED_PATTERNS = [
    // Violence & harm
    /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive|gun|firearm)/i,
    /how\s+to\s+(kill|murder|assassinate|poison)\s/i,
    /instructions?\s+(for|to)\s+(making|building)\s+(weapons?|explosives?|drugs?)/i,
    // CSAM - zero tolerance
    /child\s+(porn|sex|nude|naked)/i,
    /sex(ual)?\s+(with|involving)\s+(child|minor|kid|underage)/i,
    /nude\s+(child|minor|kid)/i,
    // Drugs manufacturing
    /how\s+to\s+(make|cook|synthesize|manufacture)\s+(meth|cocaine|heroin|fentanyl|lsd)/i,
    // Hacking & exploitation
    /how\s+to\s+hack\s+(into|someone)/i,
    /create\s+(a\s+)?(virus|malware|ransomware|trojan|keylogger)/i,
    // Self-harm
    /how\s+to\s+(commit\s+)?suicide/i,
    /methods?\s+(of|for)\s+suicide/i,
    // Fraud & deception
    /how\s+to\s+(forge|fake|counterfeit)\s+(id|passport|money|document)/i,
    /how\s+to\s+(scam|phish|catfish)/i,
    // Hate speech patterns
    /why\s+(are|is)\s+\w+\s+(race|ethnicity)\s+(inferior|worse|evil)/i,
];

const SAFETY_RESPONSE = {
    success: true,
    engine: 'safety-filter',
    reply: '⚠️ I cannot help with this type of request. Kelion AI is designed to be helpful, harmless, and honest. This query appears to involve content that could be harmful, illegal, or dangerous.\n\nIf you\'re experiencing a crisis:\n• 🇬🇧 UK: Call 999 or Samaritans 116 123\n• 🇺🇸 US: Call 988 (Suicide & Crisis Lifeline)\n• 🇪🇺 EU: Call 112\n\nI\'m happy to help with any other question!',
    model: 'content-safety-v1',
    safety_blocked: true
};

function isContentSafe(query) {
    if (!query || typeof query !== 'string') return true;
    const normalized = query.toLowerCase().trim();
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(normalized)) return false;
    }
    return true;
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { question, message, mode, user_email } = JSON.parse(event.body || '{}');
        const query = question || message;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question required' }) };

        // ═══ USAGE LIMIT CHECK ═══
        try {
            const limitRes = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/usage-limiter`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: user_email || 'anonymous', endpoint: 'smart-brain' })
            });
            const limitData = await limitRes.json();
            if (!limitData.allowed) {
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true, reply: limitData.message || 'Limita zilnică de întrebări a fost atinsă. Fă upgrade pentru mai mult! 🚀',
                        engine: 'limit', limit_reached: true, upgrade_url: '/subscribe.html',
                        remaining: 0, plan: limitData.plan
                    })
                };
            }
        } catch (e) { /* On limiter error, allow — don't block users */ }

        // ═══ CONTENT SAFETY CHECK ═══
        if (!isContentSafe(query)) {
            console.warn(`[SAFETY] Blocked query: "${query.substring(0, 50)}..."`);
            return { statusCode: 200, headers, body: JSON.stringify(SAFETY_RESPONSE) };
        }

        const systemPrompt = `Ești Kelion AI (K), un asistent AI inteligent. Reguli stricte:
1. ADEVĂR: Nu inventa fapte, statistici sau surse. Dacă nu știi, spune "Nu sunt sigur".
2. IDENTITATE: Ești un AI, nu un om. Menționează asta dacă ești întrebat.
3. LIMITĂRI: NU dai sfaturi medicale, legale sau financiare specifice. Recomandă consultarea unui profesionist.
4. SIGURANȚĂ: Refuză orice cerere de conținut ilegal, dăunător sau discriminatoriu.
5. LIMBĂ: Răspunzi în limba utilizatorului, detaliat și structurat.`;

        // ═══ PARALLEL MODE — All engines at once ═══
        if (mode === 'parallel' || mode === 'multi') {
            const results = await Promise.allSettled([
                callDeepSeek(query, systemPrompt),
                callGemini(query, systemPrompt),
                callOpenAI(query, systemPrompt),
                callKimi(query, systemPrompt)
            ]);

            const responses = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    mode: 'parallel',
                    engines_responded: responses.length,
                    responses,
                    combined: responses.map(r => `[${r.engine}]: ${r.reply}`).join('\n\n---\n\n')
                })
            };
        }

        // ═══ CASCADE MODE — Gemini first (free tier), then paid fallbacks ═══
        const engines = [
            { name: 'gemini', fn: () => callGemini(query, systemPrompt) },
            { name: 'deepseek', fn: () => callDeepSeek(query, systemPrompt) },
            { name: 'openai', fn: () => callOpenAI(query, systemPrompt) },
            { name: 'kimi', fn: () => callKimi(query, systemPrompt) }
        ];

        // Filter to only engines with API keys configured
        const available = engines.filter(e => {
            if (e.name === 'deepseek') return !!process.env.DEEPSEEK_API_KEY;
            if (e.name === 'gemini') return !!process.env.GEMINI_API_KEY;
            if (e.name === 'openai') return !!process.env.OPENAI_API_KEY;
            if (e.name === 'kimi') return !!process.env.KIMI_API_KEY;
            return false;
        });

        if (available.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API keys configured' }) };

        let lastError = null;
        for (const engine of available) {
            try {
                const result = await engine.fn();
                if (result && result.reply) {
                    // Fire-and-forget: log API cost (non-blocking)
                    logCost(result.model, result.usage?.input || 0, result.usage?.output || 0).catch(() => { });
                    return {
                        statusCode: 200, headers, body: JSON.stringify({
                            success: true,
                            ...result,
                            failover_chain: available.map(e => e.name),
                            engines_available: available.length
                        })
                    };
                }
            } catch (err) {
                console.error(`${engine.name} failed:`, err.message);
                lastError = err;
                // Continue to next engine
            }
        }

        return { statusCode: 500, headers, body: JSON.stringify({ error: `All engines failed. Last: ${lastError?.message}` }) };
    } catch (error) {
        console.error('Smart brain error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ COST LOGGING (fire-and-forget) ═══
async function logCost(model, inputTokens, outputTokens) {
    await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_usage', model, input_tokens: inputTokens, output_tokens: outputTokens, endpoint: 'smart-brain', user_type: 'free' })
    });
}

// ═══ AI ENGINE IMPLEMENTATIONS ═══

async function callDeepSeek(query, systemPrompt) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    const u = data.usage || {};
    return { engine: 'deepseek', reply: data.choices?.[0]?.message?.content, model: 'deepseek-chat', usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } };
}

async function callGemini(query, systemPrompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${query}` }] }], generationConfig: { maxOutputTokens: 2000 } })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const um = data.usageMetadata || {};
    return { engine: 'gemini-2.0-flash', reply: data.candidates?.[0]?.content?.parts?.[0]?.text, model: 'gemini-2.0-flash', usage: { input: um.promptTokenCount || 0, output: um.candidatesTokenCount || 0 } };
}

async function callOpenAI(query, systemPrompt) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const uo = data.usage || {};
    return { engine: 'gpt-4o-mini', reply: data.choices?.[0]?.message?.content, model: 'gpt-4o-mini', usage: { input: uo.prompt_tokens || 0, output: uo.completion_tokens || 0 } };
}

async function callKimi(query, systemPrompt) {
    const key = process.env.KIMI_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.moonshot.cn/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'moonshot-v1-8k', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`Kimi ${res.status}`);
    const data = await res.json();
    const uk = data.usage || {};
    return { engine: 'kimi-k2.5', reply: data.choices?.[0]?.message?.content, model: 'moonshot-v1-8k', usage: { input: uk.prompt_tokens || 0, output: uk.completion_tokens || 0 } };
}
