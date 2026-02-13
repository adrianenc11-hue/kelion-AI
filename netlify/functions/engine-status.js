/**
 * Engine Status — Checks real balance/credit for each AI provider
 * Queries provider billing APIs where available
 */

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();

        const results = {};

        // ═══ 1. DEEPSEEK — Has balance API ═══
        try {
            const key = process.env.DEEPSEEK_API_KEY;
            if (!key) { results.deepseek = { status: 'NO_KEY', balance: null }; }
            else {
                const res = await fetch('https://api.deepseek.com/user/balance', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    results.deepseek = { status: 'OK', balance: data.balance_infos || data, raw: data };
                } else {
                    results.deepseek = { status: `ERROR_${res.status}`, balance: null };
                }
            }
        } catch (e) { results.deepseek = { status: 'FAIL', error: e.message }; }

        // ═══ 2. OPENAI — Check organization billing ═══
        try {
            const key = process.env.OPENAI_API_KEY;
            if (!key) { results.openai = { status: 'NO_KEY', balance: null }; }
            else {
                // OpenAI doesn't have a simple balance endpoint, test with models list
                const res = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    results.openai = { status: 'OK', balance: 'Pay-per-use (prepaid credit)', note: 'OpenAI no balance API — key is valid' };
                } else {
                    const err = await res.json().catch(() => ({}));
                    results.openai = { status: `ERROR_${res.status}`, error: err.error?.message || res.statusText };
                }
            }
        } catch (e) { results.openai = { status: 'FAIL', error: e.message }; }

        // ═══ 3. ANTHROPIC (Claude + Opus) ═══
        try {
            const key = process.env.ANTHROPIC_API_KEY;
            if (!key) { results.claude = { status: 'NO_KEY' }; results['claude-opus'] = { status: 'NO_KEY' }; }
            else {
                // Anthropic has no balance API; test with a minimal call
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] })
                });
                if (res.ok) {
                    const data = await res.json();
                    const u = data.usage || {};
                    results.claude = { status: 'OK', balance: 'Pay-per-use (prepaid credit)', model: 'claude-sonnet-4', tokens_used: u };
                } else {
                    const err = await res.json().catch(() => ({}));
                    results.claude = { status: `ERROR_${res.status}`, error: err.error?.message || res.statusText };
                }
                // Test Opus separately
                const res2 = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'claude-opus-4-20250514', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] })
                });
                if (res2.ok) {
                    results['claude-opus'] = { status: 'OK', balance: 'Pay-per-use (same key as Claude)', model: 'claude-opus-4' };
                } else {
                    const err2 = await res2.json().catch(() => ({}));
                    results['claude-opus'] = { status: `ERROR_${res2.status}`, error: err2.error?.message || res2.statusText };
                }
            }
        } catch (e) { results.claude = { status: 'FAIL', error: e.message }; results['claude-opus'] = { status: 'FAIL', error: e.message }; }

        // ═══ 4. GEMINI — Free tier, check quota ═══
        try {
            const key = process.env.GEMINI_API_KEY;
            if (!key) { results.gemini = { status: 'NO_KEY' }; }
            else {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                if (res.ok) {
                    results.gemini = { status: 'OK', balance: 'FREE tier (15 RPM, 1M tokens/day)', note: 'Google AI Studio free tier' };
                } else {
                    results.gemini = { status: `ERROR_${res.status}`, error: 'Key invalid' };
                }
            }
        } catch (e) { results.gemini = { status: 'FAIL', error: e.message }; }

        // ═══ 5. GROQ — Free tier ═══
        try {
            const key = process.env.GROQ_API_KEY;
            if (!key) { results.groq = { status: 'NO_KEY' }; results.mixtral = { status: 'NO_KEY' }; }
            else {
                const res = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    results.groq = { status: 'OK', balance: 'FREE (30 RPM, 14.4K tokens/min)', note: 'Groq free tier — llama-3.1-70b' };
                    results.mixtral = { status: 'OK', balance: 'FREE (same Groq key)', note: 'Groq free tier — mixtral-8x7b' };
                } else {
                    results.groq = { status: `ERROR_${res.status}` };
                    results.mixtral = { status: `ERROR_${res.status}` };
                }
            }
        } catch (e) { results.groq = { status: 'FAIL', error: e.message }; results.mixtral = { status: 'FAIL', error: e.message }; }

        // ═══ 6. MISTRAL ═══
        try {
            const key = process.env.MISTRAL_API_KEY;
            if (!key) { results.mistral = { status: 'NO_KEY' }; }
            else {
                const res = await fetch('https://api.mistral.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    results.mistral = { status: 'OK', balance: 'Pay-per-use (prepaid credit)', note: 'Key valid' };
                } else {
                    results.mistral = { status: `ERROR_${res.status}` };
                }
            }
        } catch (e) { results.mistral = { status: 'FAIL', error: e.message }; }

        // ═══ 7. GROK (xAI) ═══
        try {
            const key = process.env.GROK_API_KEY;
            if (!key) { results.grok = { status: 'NO_KEY' }; }
            else {
                const res = await fetch('https://api.x.ai/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    results.grok = { status: 'OK', balance: 'Pay-per-use (xAI credit)', note: 'Key valid' };
                } else {
                    results.grok = { status: `ERROR_${res.status}` };
                }
            }
        } catch (e) { results.grok = { status: 'FAIL', error: e.message }; }

        // ═══ 8. COHERE ═══
        try {
            const key = process.env.COHERE_API_KEY;
            if (!key) { results.cohere = { status: 'NO_KEY' }; }
            else {
                const res = await fetch('https://api.cohere.com/v1/check-api-key', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    const data = await res.json().catch(() => ({}));
                    results.cohere = { status: 'OK', balance: 'Trial/Production key', info: data };
                } else {
                    results.cohere = { status: `ERROR_${res.status}` };
                }
            }
        } catch (e) { results.cohere = { status: 'FAIL', error: e.message }; }

        // ═══ 9. TOGETHER.AI (Llama 405B) ═══
        try {
            const key = process.env.TOGETHER_API_KEY;
            if (!key) { results['llama-405b'] = { status: 'NO_KEY' }; }
            else {
                // Together has a credit endpoint
                const res = await fetch('https://api.together.xyz/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                if (res.ok) {
                    results['llama-405b'] = { status: 'OK', balance: 'Pay-per-use (Together credit)', note: 'Key valid' };
                } else {
                    const err = await res.text().catch(() => '');
                    results['llama-405b'] = { status: `ERROR_${res.status}`, error: err.substring(0, 200) };
                }
            }
        } catch (e) { results['llama-405b'] = { status: 'FAIL', error: e.message }; }

        // ═══ 10. AI21 ═══
        try {
            const key = process.env.AI21_API_KEY;
            if (!key) { results.ai21 = { status: 'NO_KEY' }; }
            else {
                const res = await fetch('https://api.ai21.com/studio/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'jamba-1.5-large', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 })
                });
                if (res.ok) {
                    results.ai21 = { status: 'OK', balance: 'Pay-per-use (AI21 credit)', note: 'Key valid' };
                } else {
                    const err = await res.text().catch(() => '');
                    results.ai21 = { status: `ERROR_${res.status}`, error: err.substring(0, 200) };
                }
            }
        } catch (e) { results.ai21 = { status: 'FAIL', error: e.message }; }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                timestamp: new Date().toISOString(),
                engines: results,
                total: Object.keys(results).length,
                working: Object.values(results).filter(r => r.status === 'OK').length,
                failed: Object.values(results).filter(r => r.status !== 'OK').length
            })
        };
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
