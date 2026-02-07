// K Self-Diagnostic - System health scan (serverless-safe)
// Uses live endpoint probes instead of local filesystem scanning

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const BASE = 'https://kelionai.app/.netlify/functions/';

        // Critical endpoints to probe
        const probes = [
            { name: 'health', url: 'health' },
            { name: 'env-check', url: 'env-check' },
            { name: 'weather', url: 'weather', method: 'POST', body: { lat: 44.43, lon: 26.10 } },
            { name: 'chat', url: 'chat', method: 'POST', body: { message: 'ping' } },
            { name: 'memory', url: 'memory' },
            { name: 'k-analytics', url: 'k-analytics' },
            { name: 'k-security', url: 'k-security' },
        ];

        const results = await Promise.all(probes.map(async (probe) => {
            try {
                const start = Date.now();
                const opts = { method: probe.method || 'GET', headers: { 'Content-Type': 'application/json' } };
                if (probe.body) opts.body = JSON.stringify(probe.body);
                const res = await fetch(BASE + probe.url, opts);
                const latency = Date.now() - start;
                return {
                    name: probe.name,
                    status: res.status,
                    healthy: res.status >= 200 && res.status < 500,
                    latency_ms: latency,
                    slow: latency > 5000
                };
            } catch (e) {
                return { name: probe.name, status: 'error', healthy: false, error: e.message };
            }
        }));

        const healthy = results.filter(r => r.healthy).length;
        const total = results.length;
        const avgLatency = Math.round(results.reduce((s, r) => s + (r.latency_ms || 0), 0) / total);

        // Environment check
        const envVars = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'].map(key => ({
            name: key,
            configured: !!process.env[key],
            masked: process.env[key] ? `${key.substring(0, 3)}***` : 'MISSING'
        }));

        const score = Math.round((healthy / total) * 100);

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                health_score: score,
                status: score >= 90 ? 'HEALTHY' : score >= 70 ? 'DEGRADED' : 'CRITICAL',
                summary: `${healthy}/${total} endpoints healthy, avg latency ${avgLatency}ms`,
                probes: results,
                environment: envVars,
                slow_endpoints: results.filter(r => r.slow).map(r => r.name),
                node_version: process.version,
                memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Diagnostic error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
