// K Refactor - Multi-file code refactoring via GitHub API (serverless-safe)
const OpenAI = require('openai');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { pattern, instruction, files: targetFiles } = JSON.parse(event.body || '{}');
        if (!instruction) return { statusCode: 400, headers, body: JSON.stringify({ error: 'instruction required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';

        // Get function list from GitHub
        const h = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
        if (token) h['Authorization'] = `Bearer ${token}`;

        const contentsRes = await fetch(`https://api.github.com/repos/${repo}/contents/netlify/functions`, { headers: h });
        const contents = await contentsRes.json();
        let files = Array.isArray(contents) ? contents.filter(f => f.name.endsWith('.js')) : [];

        // Filter by pattern or target files
        if (pattern) files = files.filter(f => f.name.includes(pattern));
        if (targetFiles) files = files.filter(f => targetFiles.includes(f.name.replace('.js', '')));

        // Read file contents (max 5 files to stay within limits)
        const filesToAnalyze = files.slice(0, 5);
        const fileContents = await Promise.all(filesToAnalyze.map(async (f) => {
            const res = await fetch(f.url, { headers: h });
            const data = await res.json();
            return { name: f.name, content: Buffer.from(data.content || '', 'base64').toString('utf8') };
        }));

        // AI refactoring proposal
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a code refactoring expert. For each file, propose specific changes as diffs. Be precise and minimal.' },
                { role: 'user', content: `Instruction: ${instruction}\n\nFiles:\n${fileContents.map(f => `--- ${f.name} ---\n${f.content.substring(0, 3000)}`).join('\n\n')}` }
            ],
            max_tokens: 3000
        });

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                mode: 'proposal',
                files_analyzed: filesToAnalyze.map(f => f.name),
                total_matching: files.length,
                refactoring_proposal: completion.choices[0]?.message?.content,
                note: 'Review proposal and apply via local development'
            })
        };
    } catch (error) {
        console.error('Refactor error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
