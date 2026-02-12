// K Presentation - Generate HTML presentations via Gemini Flash (ultra-fast)
// Gemini 2.0 Flash generates in ~3s vs GPT-4o's 26s — no Netlify timeout

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { topic, slides_count, style, language } = JSON.parse(event.body || '{}');
        if (!topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Topic required' }) };

        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!geminiKey && !openaiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API key configured' }) };

        const numSlides = Math.min(slides_count || 6, 12);
        const lang = language || 'ro';
        const designStyle = style || 'modern-dark';

        const systemPrompt = `Create a stunning ${numSlides}-slide HTML presentation. Style: ${designStyle}. Scroll-snap slides, CSS animations (fadeIn, slideUp), Google Fonts (Inter + Outfit), nav dots, keyboard arrows, progress bar, responsive. Language: ${lang}. Output ONLY the complete HTML.`;
        const userPrompt = `Presentation topic: ${topic}`;

        let html = '';

        if (geminiKey) {
            // Use Gemini 2.0 Flash — ultra fast
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                    generationConfig: { maxOutputTokens: 4000, temperature: 0.7 }
                })
            });
            const data = await res.json();
            html = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
            // Fallback: OpenAI gpt-4o-mini
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: openaiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 3500
            });
            html = completion.choices[0]?.message?.content || '';
        }

        // Extract HTML if wrapped in code blocks
        const htmlMatch = html.match(/```html\n?([\s\S]*?)```/);
        if (htmlMatch) html = htmlMatch[1];

        // If no HTML detected, wrap in styled structure
        if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
            html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${topic}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #e0e0e0; overflow-x: hidden; }
        .slide { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px; scroll-snap-align: start; }
        .slide:nth-child(odd) { background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 100%); }
        .slide:nth-child(even) { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); }
        h1 { font-family: 'Outfit', sans-serif; font-size: 3rem; margin-bottom: 1rem; background: linear-gradient(90deg, #00d2ff, #7b2ff7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        h2 { font-family: 'Outfit', sans-serif; font-size: 2rem; color: #00d2ff; margin-bottom: 1.5rem; }
        p, li { font-size: 1.2rem; line-height: 1.8; max-width: 800px; }
        ul { list-style: none; } ul li::before { content: "▸ "; color: #7b2ff7; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .slide > * { animation: fadeIn 0.8s ease-out; }
    </style>
</head>
<body style="scroll-snap-type: y mandatory; overflow-y: scroll; height: 100vh;">
${html}
</body>
</html>`;
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                engine: geminiKey ? 'gemini-2.0-flash' : 'gpt-4o-mini',
                presentation: { html, topic, slides: numSlides, style: designStyle, language: lang }
            })
        };
    } catch (error) {
        console.error('Presentation error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
