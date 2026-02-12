// Claude Orchestrator - Anthropic Claude for complex task orchestration
// POST: { "message": "your task", "system": "optional system prompt", "mode": "orchestrate|audit|analyze" }

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

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'config_missing', env: 'ANTHROPIC_API_KEY' }) };
    }

    try {
        const { message, question, system, mode, temperature } = JSON.parse(event.body || '{}');
        const query = message || question;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        const systemPrompt = system || getSystemPrompt(mode);

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                temperature: temperature || 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: query }]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Claude API error');

        const reply = data.content?.[0]?.text || 'No response from Claude';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                reply: reply,
                model: data.model || 'claude-sonnet-4-20250514',
                engine: 'claude',
                mode: mode || 'default',
                usage: data.usage || null
            })
        };
    } catch (error) {
        console.error('Claude error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

function getSystemPrompt(mode) {
    switch (mode) {
        case 'orchestrate':
            return 'You are an AI orchestrator. Break complex tasks into clear steps, delegate to the right tools, and synthesize results. Be systematic and thorough.';
        case 'audit':
            return 'You are a code auditor. Analyze code for bugs, security issues, performance problems, and best practices. Be specific with line numbers and fixes.';
        case 'analyze':
            return 'You are a data analyst. Provide clear, structured analysis with insights, patterns, and actionable recommendations.';
        default:
            return 'You are Claude, a helpful AI assistant. Provide detailed, accurate, and well-structured responses.';
    }
}
