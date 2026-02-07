// K Git - Git operations via GitHub REST API (works on Netlify serverless)
// No local git CLI needed — uses GitHub API for all operations

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { action, message, branch, path } = JSON.parse(event.body || '{}');
        if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: status|log|branches|files|diff|commit_info' }) };

        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';
        const allowedActions = ['status', 'log', 'branches', 'files', 'diff', 'commit_info'];
        if (!allowedActions.includes(action)) return { statusCode: 400, headers, body: JSON.stringify({ error: `Action must be one of: ${allowedActions.join(', ')}` }) };

        const githubFetch = async (endpoint) => {
            const fetchHeaders = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
            if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, { headers: fetchHeaders });
            if (!res.ok) return { error: `GitHub API ${res.status}: ${res.statusText}` };
            return res.json();
        };

        let result = {};

        switch (action) {
            case 'status': {
                // Get latest commit info + repo info
                const [repoInfo, commits] = await Promise.all([
                    githubFetch(''),
                    githubFetch('/commits?per_page=5')
                ]);
                result = {
                    repo: repoInfo.full_name || repo,
                    default_branch: repoInfo.default_branch || 'main',
                    last_push: repoInfo.pushed_at,
                    recent_commits: Array.isArray(commits) ? commits.map(c => ({
                        sha: c.sha?.substring(0, 7),
                        message: c.commit?.message?.split('\n')[0],
                        author: c.commit?.author?.name,
                        date: c.commit?.author?.date
                    })) : [],
                    visibility: repoInfo.private ? 'private' : 'public'
                };
                break;
            }

            case 'log': {
                const commits = await githubFetch(`/commits?per_page=20&sha=${branch || 'main'}`);
                result = Array.isArray(commits) ? commits.map(c => ({
                    sha: c.sha?.substring(0, 7),
                    message: c.commit?.message?.split('\n')[0],
                    author: c.commit?.author?.name,
                    date: c.commit?.author?.date
                })) : commits;
                break;
            }

            case 'branches': {
                const branches = await githubFetch('/branches?per_page=30');
                result = Array.isArray(branches) ? branches.map(b => ({
                    name: b.name,
                    sha: b.commit?.sha?.substring(0, 7),
                    protected: b.protected
                })) : branches;
                break;
            }

            case 'files': {
                const target = path || 'netlify/functions';
                const contents = await githubFetch(`/contents/${target}?ref=${branch || 'main'}`);
                result = Array.isArray(contents) ? contents.map(f => ({
                    name: f.name,
                    type: f.type,
                    size: f.size
                })) : contents;
                break;
            }

            case 'diff': {
                // Compare branches or get recent changes
                const commits = await githubFetch('/commits?per_page=1');
                if (Array.isArray(commits) && commits[0]) {
                    const detail = await githubFetch(`/commits/${commits[0].sha}`);
                    result = {
                        sha: detail.sha?.substring(0, 7),
                        message: detail.commit?.message,
                        files_changed: detail.files?.map(f => ({
                            filename: f.filename,
                            status: f.status,
                            additions: f.additions,
                            deletions: f.deletions
                        })) || []
                    };
                }
                break;
            }

            case 'commit_info': {
                if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Commit SHA required in message field' }) };
                const detail = await githubFetch(`/commits/${message}`);
                result = {
                    sha: detail.sha,
                    message: detail.commit?.message,
                    author: detail.commit?.author?.name,
                    date: detail.commit?.author?.date,
                    files: detail.files?.map(f => ({ name: f.filename, status: f.status, changes: f.changes })) || []
                };
                break;
            }
        }

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, action, result }) };
    } catch (error) {
        console.error('Git API error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
