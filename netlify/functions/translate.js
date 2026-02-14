// Translate - Real-time translation in any language pair (like Google Translate + AI)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { text, from, to, mode } = JSON.parse(event.body || '{}');
        if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };

        const targetLang = to || 'English';
        const sourceLang = from || 'auto-detect';
        const translationMode = mode || 'accurate'; // accurate, casual, formal, technical

        // Try Gemini first (free), then OpenAI
        let apiKey = process.env.GEMINI_API_KEY;
        let useGemini = !!apiKey;

        if (!apiKey) {
            apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API key configured' }) };
        }

        const modeInstructions = {
            accurate: 'Translate accurately, preserving meaning and nuance.',
            casual: 'Translate in a casual, conversational tone.',
            formal: 'Translate in formal, professional language.',
            technical: 'Translate preserving all technical terms and jargon.'
        };

        const systemPrompt = `You are an expert translator. ${modeInstructions[translationMode] || modeInstructions.accurate}
Source language: ${sourceLang}
Target language: ${targetLang}
Rules:
- Return ONLY the translation, nothing else
- Preserve formatting (paragraphs, lists, etc.)
- Keep proper nouns unchanged
- If source language is auto-detect, identify it first`;

        let translated = '';
        let _detectedLang = sourceLang;

        if (useGemini) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nTranslate:\n${text}` }] }]
                })
            });
            if (res.ok) {
                const data = await res.json();
                translated = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
        }

        if (!translated) {
            const oaiKey = process.env.OPENAI_API_KEY;
            if (!oaiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Translation failed' }) };
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${oaiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
                    max_tokens: 3000
                })
            });
            if (res.ok) {
                const data = await res.json();
                translated = data.choices?.[0]?.message?.content || '';
            }
        }

        // Log cost
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: useGemini ? 'gemini-translate' : 'gpt-translate', input_tokens: text.length, output_tokens: translated.length, endpoint: 'translate' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                original: text,
                translated,
                from: sourceLang,
                to: targetLang,
                mode: translationMode,
                char_count: translated.length,
                engine: useGemini ? 'gemini-2.0-flash' : 'gpt-4o-mini'
            })
        };
    } catch (error) {
        console.error('Translate error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
