// Generate Image — DALL-E 3 (OpenAI)
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { prompt, size, user_email } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required' }) };

        // Usage limit check
        try {
            const lr = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/usage-limiter`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: user_email || 'anonymous', endpoint: 'generate-image' })
            });
            const ld = await lr.json();
            if (!ld.allowed) return { statusCode: 429, headers, body: JSON.stringify({ error: ld.message || 'Daily image limit reached', upgrade_url: '/subscribe.html' }) };
        } catch (e) { /* allow on error */ }

        const key = process.env.OPENAI_API_KEY;
        if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured for image generation' }) };

        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'dall-e-3', prompt, size: size || '1024x1024', n: 1, quality: 'standard' })
        });
        if (!res.ok) throw new Error(`DALL-E ${res.status}`);
        const data = await res.json();

        // Log cost (fire-and-forget)
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'dall-e-3', input_tokens: 1, output_tokens: 0, endpoint: 'generate-image' })
        }).catch(() => { });

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                url: data.data?.[0]?.url,
                revised_prompt: data.data?.[0]?.revised_prompt,
                model: 'dall-e-3', engine: 'dall-e-3'
            })
        };
    } catch (error) {
        console.error('Generate image error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
