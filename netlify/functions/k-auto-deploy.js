// K Auto-Deploy - Deployment management via Netlify API (serverless-safe)
// Uses Netlify Deploy API instead of local CLI execSync

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { action } = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : { action: 'status' };
        const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
        const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;

        const netlifyFetch = async (endpoint, method = 'GET') => {
            if (!netlifyToken) return { error: 'NETLIFY_AUTH_TOKEN not configured' };
            const res = await fetch(`https://api.netlify.com/api/v1${endpoint}`, {
                method,
                headers: { 'Authorization': `Bearer ${netlifyToken}`, 'Content-Type': 'application/json' }
            });
            return res.json();
        };

        switch (action || 'status') {
            case 'status': {
                if (!siteId) return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'status', site: 'kelionai.app', note: 'Configure SITE_ID for detailed deploy info' }) };
                const site = await netlifyFetch(`/sites/${siteId}`);
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        action: 'status',
                        site: site.name || site.url,
                        state: site.state,
                        ssl: site.ssl,
                        last_deploy: site.published_deploy?.published_at,
                        deploy_id: site.published_deploy?.id?.substring(0, 8),
                        build_image: site.build_image,
                        functions_count: site.published_deploy?.summary?.messages?.length || 'N/A'
                    })
                };
            }

            case 'deploys': {
                if (!siteId) return { statusCode: 200, headers, body: JSON.stringify({ success: true, deploys: [], note: 'Configure SITE_ID' }) };
                const deploys = await netlifyFetch(`/sites/${siteId}/deploys?per_page=10`);
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        action: 'deploys',
                        deploys: Array.isArray(deploys) ? deploys.map(d => ({
                            id: d.id?.substring(0, 8),
                            state: d.state,
                            context: d.context,
                            branch: d.branch,
                            created: d.created_at,
                            deploy_time: d.deploy_time ? `${d.deploy_time}s` : null,
                            error: d.error_message || null
                        })) : []
                    })
                };
            }

            case 'health': {
                // Health check the live site
                const checks = ['health', 'env-check'].map(async (ep) => {
                    try {
                        const start = Date.now();
                        const res = await fetch(`https://kelionai.app/.netlify/functions/${ep}`);
                        return { endpoint: ep, status: res.status, latency: Date.now() - start };
                    } catch (e) { return { endpoint: ep, status: 'error', error: e.message }; }
                });
                const results = await Promise.all(checks);
                const allHealthy = results.every(r => r.status === 200);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'health', healthy: allHealthy, checks: results }) };
            }

            case 'rollback': {
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        action: 'rollback',
                        note: 'Rollback requires NETLIFY_AUTH_TOKEN. Use Netlify dashboard or CLI: netlify deploy --rollback'
                    })
                };
            }

            default:
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, available_actions: ['status', 'deploys', 'health', 'rollback'] }) };
        }
    } catch (error) {
        console.error('Auto-deploy error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
