// Chat Stream - Streaming AI responses
const OpenAI = require('openai');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { message, history = [] } = JSON.parse(event.body || '{}');
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Ești K, un asistent AI inteligent.' },
                ...history.slice(-10),
                { role: 'user', content: message }
            ],
            max_tokens: 1500
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reply: completion.choices[0]?.message?.content, model: 'gpt-4o-mini' })
        };
    } catch (error) {
        console.error('Chat stream error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
