// K Monitor - Continuous 24/7 health monitoring (Phase 11)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const baseUrl = 'https://kelionai.app/.netlify/functions/';
        const checks = {
            endpoints: ['health', 'chat', 'realtime-token', 'gemini-live-token', 'env-check'],
            results: [],
            status: 'ok',
            alerts: []
        };

        for (const ep of checks.endpoints) {
            const start = Date.now();
            try {
                const res = await fetch(baseUrl + ep, { signal: AbortSignal.timeout(10000) });
                const ms = Date.now() - start;
                const status = res.status < 500 ? 'ok' : 'critical';
                checks.results.push({ endpoint: ep, status: res.status, latency: ms, health: status });

                if (status === 'critical') { checks.alerts.push({ type: 'ENDPOINT_DOWN', endpoint: ep, status: res.status }); checks.status = 'critical'; }
                else if (ms > 5000) { checks.alerts.push({ type: 'SLOW_RESPONSE', endpoint: ep, latency: ms }); if (checks.status !== 'critical') checks.status = 'warning'; }
            } catch (e) {
                checks.results.push({ endpoint: ep, status: 'unreachable', error: e.message, health: 'critical' });
                checks.alerts.push({ type: 'UNREACHABLE', endpoint: ep, error: e.message });
                checks.status = 'critical';
            }
        }

        // Auto-response based on status
        const response = {
            success: true,
            monitor: {
                status: checks.status,
                uptime: checks.results.filter(r => r.health === 'ok').length + '/' + checks.endpoints.length,
                alerts: checks.alerts,
                action: checks.status === 'critical' ? 'ALERT_ADMIN' : (checks.status === 'warning' ? 'MONITOR_CLOSELY' : 'ALL_CLEAR'),
                results: checks.results
            },
            timestamp: new Date().toISOString()
        };

        return { statusCode: 200, headers, body: JSON.stringify(response) };
    } catch (error) {
        console.error('Monitor error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
