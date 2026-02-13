// K Strategic Planner - Multi-phase project planning (Gemini Flash = fast)
// Gemini 2.0 Flash for speed (~3s), GPT-4o fallback for complex reasoning

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { project, scope, timeline } = JSON.parse(event.body || '{}');
        if (!project) return { statusCode: 400, headers, body: JSON.stringify({ error: 'project description required' }) };

        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!geminiKey && !openaiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API key configured' }) };

        // Get current capabilities from GitHub
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;
        let existingFunctions = [];

        try {
            const h = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
            if (token) h['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/netlify/functions`, { headers: h });
            const contents = await res.json();
            existingFunctions = Array.isArray(contents) ? contents.filter(f => f.name.endsWith('.js')).map(f => f.name.replace('.js', '')) : [];
        } catch (e) { /* skip */ }

        const prompt = `You are a strategic project planner for a serverless AI platform (Netlify + OpenAI + Supabase + Gemini).
Current capabilities: ${existingFunctions.length} functions: ${existingFunctions.slice(0, 30).join(', ')}${existingFunctions.length > 30 ? '...' : ''}
Create a structured multi-phase plan with: phases, tasks, dependencies, effort estimates, risks, and success metrics.
Project: ${project}${scope ? `\nScope: ${scope}` : ''}${timeline ? `\nTimeline: ${timeline}` : ''}
Output as structured JSON with a phases array.`;

        let plan = '';
        let engine = '';

        if (geminiKey) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { maxOutputTokens: 2500, temperature: 0.4 }
                })
            });
            const data = await res.json();
            plan = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            engine = 'gemini-2.0-flash';
        } else {
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: openaiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2500
            });
            plan = completion.choices[0]?.message?.content || '';
            engine = 'gpt-4o-mini';
        }

        // Try to parse JSON from response
        let structured;
        try {
            const jsonMatch = plan.match(/```json\n?([\s\S]*?)\n?```/) || plan.match(/\{[\s\S]*\}/);
            structured = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : plan);
        } catch (e) {
            structured = { raw_plan: plan };
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                engine,
                project,
                existing_capabilities: existingFunctions.length,
                plan: structured
            })
        };
    } catch (error) {
        console.error('Planner error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
