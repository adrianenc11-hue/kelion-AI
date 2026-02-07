// Code Audit - Function inventory and health check (serverless-safe)
// Uses GitHub API instead of local filesystem

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';

        // Get function list from GitHub
        const h = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
        if (token) h['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`https://api.github.com/repos/${repo}/contents/netlify/functions`, { headers: h });
        const contents = await res.json();
        const files = Array.isArray(contents) ? contents.filter(f => f.name.endsWith('.js')) : [];

        const audit = {
            total_functions: files.length,
            functions: files.map(f => ({
                name: f.name.replace('.js', ''),
                size_bytes: f.size,
                size_kb: Math.round(f.size / 1024 * 10) / 10
            })),
            total_size_kb: Math.round(files.reduce((s, f) => s + (f.size || 0), 0) / 1024),
            largest: files.sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5).map(f => ({ name: f.name, size_kb: Math.round(f.size / 1024 * 10) / 10 })),
            timestamp: new Date().toISOString(),
            source: 'github_api'
        };

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, ...audit }) };
    } catch (error) {
        console.error('Code audit error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
