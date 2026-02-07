// Supreme Brain - GPT-4o for premium AI responses
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
        const { message, question } = JSON.parse(event.body || '{}');
        const query = message || question;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'Ești K Supreme, cel mai avansat nivel de inteligență. Oferi răspunsuri detaliate, precise și comprehensive.' },
                { role: 'user', content: query }
            ],
            max_tokens: 2000
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reply: completion.choices[0]?.message?.content, model: 'gpt-4o' })
        };
    } catch (error) {
        console.error('Supreme brain error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
