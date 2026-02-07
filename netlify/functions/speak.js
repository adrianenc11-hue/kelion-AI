// Speak - TTS via OpenAI
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { text, voice, user_email } = JSON.parse(event.body || '{}');
        if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        // Usage limit check
        try {
            const lr = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/usage-limiter`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: user_email || 'anonymous', endpoint: 'speak' })
            });
            const ld = await lr.json();
            if (!ld.allowed) return { statusCode: 429, headers, body: JSON.stringify({ error: ld.message || 'Daily TTS limit reached', upgrade_url: '/subscribe.html' }) };
        } catch (e) { /* allow on error */ }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'tts-1', input: text.substring(0, 4096), voice: voice || 'alloy' })
        });

        if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ error: 'TTS API error' }) };

        const audioBuffer = await response.arrayBuffer();
        // Log cost: OpenAI TTS = $0.015 per 1K chars
        const chars = text.length;
        const cost = (chars / 1000) * 0.015;
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'tts-1', input_tokens: chars, output_tokens: 0, estimated_cost: cost, endpoint: 'speak' })
        }).catch(() => { });
        return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, audio: Buffer.from(audioBuffer).toString('base64'), format: 'mp3' }) };
    } catch (error) {
        console.error('Speak error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
