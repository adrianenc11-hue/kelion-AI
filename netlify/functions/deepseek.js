// DeepSeek - Code-focused AI
// POST: { "message": "your question", "system": "optional system prompt" }

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    await patchProcessEnv(); // Load vault secrets FIRST
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    if (!DEEPSEEK_KEY) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'config_missing', env: 'DEEPSEEK_API_KEY' }) };
    }

    try {
        const { message, question, system, temperature } = JSON.parse(event.body || '{}');
        const query = message || question;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        const messages = [];
        if (system) messages.push({ role: 'system', content: system });
        messages.push({ role: 'user', content: query });

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: temperature || 0.7,
                max_tokens: 4096
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'DeepSeek API error');

        const reply = data.choices?.[0]?.message?.content || 'No response from DeepSeek';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                reply: reply,
                model: 'deepseek-chat',
                engine: 'deepseek',
                usage: data.usage || null
            })
        };
    } catch (error) {
        console.error('DeepSeek error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
