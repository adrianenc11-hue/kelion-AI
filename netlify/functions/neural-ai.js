// neural-ai.js — Multi-model AI deep analysis endpoint
// Orchestrates multiple AI models for complex reasoning tasks
// Timeout: 60s

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, message: 'POST only' }) };
    }

    try {
        await patchProcessEnv(); // Load API keys from Supabase vault
        let body;
        try { body = JSON.parse(event.body || '{}'); } catch (e) {
            return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error_code: 'invalid_json', message: 'Invalid JSON body' }) };
        }
        const { prompt, mode, models } = body;

        if (!prompt) {
            return {
                statusCode: 400,
                headers: CORS,
                body: JSON.stringify({ ok: false, error_code: 'missing_prompt', message: 'prompt required' })
            };
        }

        const analysisMode = mode || 'deep'; // deep | consensus | chain

        // Available engines (check which keys exist)
        const engines = [];
        if (process.env.OPENAI_API_KEY) engines.push('openai');
        if (process.env.GEMINI_API_KEY) engines.push('gemini');
        if (process.env.ANTHROPIC_API_KEY) engines.push('claude');
        if (process.env.DEEPSEEK_API_KEY) engines.push('deepseek');

        if (engines.length === 0) {
            return {
                statusCode: 503,
                headers: CORS,
                body: JSON.stringify({ ok: false, error_code: 'config_missing', message: 'No AI API keys configured' })
            };
        }

        const selectedModels = models || engines.slice(0, 3);
        const results = [];
        const startTime = Date.now();

        // Run models in parallel
        const promises = selectedModels.map(async (engine) => {
            try {
                return await callEngine(engine, prompt);
            } catch (err) {
                return { engine, error: err.message };
            }
        });

        const responses = await Promise.allSettled(promises);

        for (const r of responses) {
            if (r.status === 'fulfilled') {
                results.push(r.value);
            }
        }

        // Synthesize based on mode
        let synthesis;
        if (analysisMode === 'consensus') {
            synthesis = `Analysis from ${results.length} models. Look for patterns in common across responses.`;
        } else if (analysisMode === 'chain') {
            synthesis = results.map(r => r.response).filter(Boolean).join('\n\n---\n\n');
        } else {
            // Deep: use best response (longest, most detailed)
            const best = results
                .filter(r => r.response)
                .sort((a, b) => (b.response?.length || 0) - (a.response?.length || 0))[0];
            synthesis = best?.response || 'No response from any model';
        }

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({
                ok: true,
                mode: analysisMode,
                engines_used: results.map(r => r.engine),
                elapsed_ms: Date.now() - startTime,
                synthesis,
                details: results
            })
        };

    } catch (err) {
        console.error('Neural AI error:', err);
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ ok: false, error_code: 'neural_error', message: err.message })
        };
    }
};

/**
 * Call a specific AI engine
 */
async function callEngine(engine, prompt) {
    const systemPrompt = 'You are a deep analysis AI. Provide thorough, evidence-based analysis. Be precise and cite your reasoning.';

    switch (engine) {
        case 'openai': {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 2000
                })
            });
            const data = await res.json();
            return { engine, response: data.choices?.[0]?.message?.content, model: 'gpt-4o-mini' };
        }

        case 'gemini': {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt + '\n\n' + prompt }] }],
                    generationConfig: { maxOutputTokens: 2000 }
                })
            });
            const data = await res.json();
            return { engine, response: data.candidates?.[0]?.content?.parts?.[0]?.text, model: 'gemini-2.0-flash' };
        }

        case 'claude': {
            const { Anthropic } = require('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
            const msg = await client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }]
            });
            return { engine, response: msg.content[0]?.text, model: 'claude-sonnet-4-20250514' };
        }

        case 'deepseek': {
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 2000
                })
            });
            const data = await res.json();
            return { engine, response: data.choices?.[0]?.message?.content, model: 'deepseek-chat' };
        }

        default:
            return { engine, error: `Unknown engine: ${engine}` };
    }
}
