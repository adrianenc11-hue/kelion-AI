// K Self-Modify - K reads & proposes code changes via GitHub API (works on Netlify)
// Uses GitHub Contents API to read actual function code, AI to propose modifications
const OpenAI = require('openai');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { target_function, instruction, dry_run = true } = JSON.parse(event.body || '{}');
        if (!target_function || !instruction) return { statusCode: 400, headers, body: JSON.stringify({ error: 'target_function and instruction required' }) };
        if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';
        const token = process.env.GITHUB_TOKEN;

        // Step 1: Read current function code from GitHub
        let currentCode = null;
        const filePath = `netlify/functions/${target_function}.js`;

        try {
            const fetchHeaders = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
            if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, { headers: fetchHeaders });
            if (res.ok) {
                const data = await res.json();
                currentCode = Buffer.from(data.content, 'base64').toString('utf8');
            }
        } catch (e) { /* GitHub read failed, continue with AI-only proposal */ }

        // Step 2: Ask AI to generate modified code
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const prompt = currentCode
            ? `Current code of ${target_function}.js:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nInstruction: ${instruction}\n\nOutput ONLY the complete modified file, no explanations:`
            : `Create a Netlify serverless function named ${target_function} that: ${instruction}\n\nOutput ONLY the complete file, no explanations:`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a code modification assistant for Netlify serverless functions (Node.js). Output ONLY complete, working code. Use exports.handler format. Include proper CORS headers.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 4000
        });

        const newCode = completion.choices[0]?.message?.content?.replace(/```javascript\n?/g, '').replace(/```\n?/g, '').trim();

        // Step 3: Create a diff summary
        let diffSummary = '';
        if (currentCode && newCode) {
            const oldLines = currentCode.split('\n').length;
            const newLines = newCode.split('\n').length;
            diffSummary = `Lines: ${oldLines} → ${newLines} (${newLines > oldLines ? '+' : ''}${newLines - oldLines})`;
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                mode: dry_run ? 'dry_run' : 'proposed',
                target: target_function,
                source: currentCode ? 'github' : 'generated',
                original_available: !!currentCode,
                original_length: currentCode?.length || 0,
                proposed_code: newCode?.substring(0, 8000),
                new_length: newCode?.length || 0,
                diff_summary: diffSummary,
                note: 'Changes proposed via AI. Review and apply via local development or CI/CD pipeline.'
            })
        };
    } catch (error) {
        console.error('Self-modify error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
