// K Analyze Codebase - Deep code analysis via GitHub API (serverless-safe)
const OpenAI = require('openai');

const GITHUB_API = 'https://api.github.com';

async function githubFetch(endpoint, token, repo) {
    const h = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${GITHUB_API}/repos/${repo}${endpoint}`, { headers: h });
    if (!res.ok) return null;
    return res.json();
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';

        // Get list of functions from GitHub
        const contents = await githubFetch('/contents/netlify/functions', token, repo);
        const files = Array.isArray(contents) ? contents.filter(f => f.name.endsWith('.js')) : [];

        // Categorize functions
        const categories = {
            auth: files.filter(f => f.name.startsWith('auth')),
            ai: files.filter(f => ['chat', 'smart-brain', 'supreme-brain', 'ask-kimi', 'deep-research', 'k-supreme-intelligence'].some(n => f.name.includes(n))),
            voice: files.filter(f => ['whisper', 'speak', 'elevenlabs', 'realtime', 'voice', 'gemini-live'].some(n => f.name.includes(n))),
            vision: files.filter(f => ['vision', 'analyze-screen', 'detect-emotion', 'k-vision'].some(n => f.name.includes(n))),
            media: files.filter(f => ['generate-image', 'generate-video', 'dalle', 'sound'].some(n => f.name.includes(n))),
            memory: files.filter(f => ['memory', 'vector', 'embeddings'].some(n => f.name.includes(n))),
            k_autonomous: files.filter(f => f.name.startsWith('k-')),
            payments: files.filter(f => ['stripe', 'paypal', 'subscription'].some(n => f.name.includes(n))),
            system: files.filter(f => ['health', 'env-check', 'code-audit', 'admin', 'page-tracking', 'audit-log'].some(n => f.name.includes(n))),
        };

        const analysis = {
            total_functions: files.length,
            categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, { count: v.length, files: v.map(f => f.name) }])),
            total_size_kb: Math.round(files.reduce((sum, f) => sum + (f.size || 0), 0) / 1024),
            largest_files: files.sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 10).map(f => ({ name: f.name, size_kb: Math.round((f.size || 0) / 1024) }))
        };

        // If AI query requested, analyze with GPT
        if (body.query && process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a code architecture analyst. Analyze the codebase structure and answer questions.' },
                    { role: 'user', content: `Codebase: ${JSON.stringify(analysis)}\n\nQuestion: ${body.query}` }
                ],
                max_tokens: 1500
            });
            analysis.ai_analysis = completion.choices[0]?.message?.content;
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...analysis }) };
    } catch (error) {
        console.error('Analyze error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
