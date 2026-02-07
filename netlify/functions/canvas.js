// Canvas - Collaborative document/code editor with AI assistance (like ChatGPT Canvas)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { action, content, instruction, language, format } = JSON.parse(event.body || '{}');
        if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: edit, review, format, explain, improve, generate' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const actions = {
            edit: `Edit the following ${language || 'text'} according to this instruction: "${instruction}". Return ONLY the edited version.`,
            review: `Review this ${language || 'code'} for bugs, security issues, and improvements. Format: 1) Issues found 2) Suggestions 3) Corrected version`,
            format: `Format and beautify this ${language || 'code'}. Fix indentation, spacing, and style. Return ONLY the formatted version.`,
            explain: `Explain this ${language || 'code'} line by line in a clear, educational way. Use the user's language.`,
            improve: `Improve this ${language || 'text'} to be more ${format || 'professional and clear'}. Return the improved version with a brief explanation of changes.`,
            generate: `Generate ${language || 'code'} for: ${instruction}. Include comments. Return clean, production-ready code.`
        };

        const prompt = actions[action];
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: 'Ești Kelion AI Canvas — un editor inteligent. Răspunzi precis, formatezi codul corect, și explici clar.'
                }, {
                    role: 'user',
                    content: content ? `${prompt}\n\n${content}` : prompt
                }],
                max_tokens: 4000
            })
        });

        if (!response.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Canvas AI error' }) };

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content || '';

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                action,
                result,
                original_length: content?.length || 0,
                result_length: result.length,
                follow_up_suggestions: [
                    '✏️ Editează din nou',
                    '🔍 Review pentru buguri',
                    '📋 Copiază în clipboard',
                    '💾 Salvează ca notă'
                ]
            })
        };
    } catch (error) {
        console.error('Canvas error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
