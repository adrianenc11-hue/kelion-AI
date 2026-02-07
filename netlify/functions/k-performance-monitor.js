// K Performance Monitor - Latency tracking per endpoint (Phase 10.3)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const endpoints = ['health', 'chat', 'realtime-token', 'gemini-live-token', 'search', 'weather', 'env-check', 'ai-credits'];
        const baseUrl = 'https://kelionai.app/.netlify/functions/';
        const metrics = [];
        let slowCount = 0;

        for (const ep of endpoints) {
            const start = Date.now();
            try {
                const res = await fetch(baseUrl + ep);
                const latency = Date.now() - start;
                const slow = latency > 5000;
                if (slow) slowCount++;
                metrics.push({ endpoint: ep, latency_ms: latency, status: res.status, slow, ok: res.status < 500 });
            } catch (e) {
                metrics.push({ endpoint: ep, latency_ms: Date.now() - start, status: 'error', slow: true, ok: false, error: e.message });
                slowCount++;
            }
        }

        const avgLatency = Math.round(metrics.reduce((sum, m) => sum + m.latency_ms, 0) / metrics.length);
        const maxLatency = Math.max(...metrics.map(m => m.latency_ms));
        const minLatency = Math.min(...metrics.map(m => m.latency_ms));

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                summary: { endpoints_checked: endpoints.length, avg_latency_ms: avgLatency, max_latency_ms: maxLatency, min_latency_ms: minLatency, slow_endpoints: slowCount, alert: slowCount > 2 },
                metrics,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Performance monitor error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
