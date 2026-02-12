// Gemini Chat - Google Gemini 2.0 Flash
// POST: { "message": "your question", "history": [] }

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

    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'config_missing', env: 'GEMINI_API_KEY' }) };
    }

    try {
        const { message, question, history, temperature } = JSON.parse(event.body || '{}');
        const query = message || question;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        const contents = [];
        if (history && Array.isArray(history)) {
            history.forEach(h => {
                contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
            });
        }
        contents.push({ role: 'user', parts: [{ text: query }] });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: {
                        temperature: temperature || 0.7,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gemini API error');

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, reply: reply, model: 'gemini-2.0-flash', engine: 'gemini' })
        };
    } catch (error) {
        console.error('Gemini error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
