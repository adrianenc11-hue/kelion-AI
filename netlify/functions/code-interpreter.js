// Code Interpreter - Execute JavaScript code in a sandboxed environment
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { code, language, question } = JSON.parse(event.body || '{}');

        // Mode 1: User provides code to run
        if (code && language === 'javascript') {
            return executeJS(code);
        }

        // Mode 2: User asks a question that needs code — AI writes & runs it
        if (question) {
            const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
            if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'API key not configured' }) };

            // Ask AI to write JavaScript code
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: `You are a code interpreter. Write JavaScript code to answer the user's question.
Rules:
- Use console.log() for output
- No external modules (pure JS only)
- No network requests or file system access
- Include comments explaining the logic
- The code must be self-contained and runnable
Return ONLY the JavaScript code, no markdown fences.`
                    }, {
                        role: 'user',
                        content: question
                    }],
                    max_tokens: 2000
                })
            });

            if (!response.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI code generation failed' }) };

            const data = await response.json();
            let generatedCode = data.choices?.[0]?.message?.content || '';
            // Clean markdown fences if present
            generatedCode = generatedCode.replace(/^```(?:javascript|js)?\n?/gm, '').replace(/```$/gm, '').trim();

            const result = executeJS(generatedCode);
            const resultBody = JSON.parse(result.body);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    question,
                    generated_code: generatedCode,
                    output: resultBody.output || resultBody.error,
                    execution_time_ms: resultBody.execution_time_ms,
                    follow_up_suggestions: [
                        '🔄 Modifică codul și rulează din nou',
                        '📊 Vizualizează rezultatele ca grafic',
                        '💾 Salvează codul ca snippet',
                        '🔍 Explică pas cu pas ce face codul'
                    ]
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide "code" with "language":"javascript", or "question" for AI-generated code' }) };
    } catch (error) {
        console.error('Code interpreter error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

function executeJS(code) {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    const startTime = Date.now();
    const logs = [];

    try {
        // Sandbox: override console.log to capture output
        const sandbox = {
            console: {
                log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')),
                error: (...args) => logs.push('ERROR: ' + args.join(' ')),
                warn: (...args) => logs.push('WARN: ' + args.join(' '))
            },
            Math, Date, JSON, parseInt, parseFloat, isNaN, isFinite,
            Array, Object, String, Number, Boolean, Map, Set, RegExp,
            setTimeout: undefined, setInterval: undefined,
            fetch: undefined, require: undefined, process: undefined,
            __dirname: undefined, __filename: undefined
        };

        // Create safe function
        const safeCode = `"use strict";\n${code}`;
        const fn = new Function(...Object.keys(sandbox), safeCode);
        fn(...Object.values(sandbox));

        const elapsedMs = Date.now() - startTime;

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                output: logs.join('\n'),
                lines: logs.length,
                execution_time_ms: elapsedMs
            })
        };
    } catch (error) {
        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                output: logs.join('\n'),
                execution_time_ms: Date.now() - startTime
            })
        };
    }
}
