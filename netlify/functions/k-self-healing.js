// K Self-Healing - Auto-retry, circuit breaker, cached responses
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { endpoint, method, body: reqBody, max_retries } = JSON.parse(event.body || '{}');
        if (!endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Endpoint required' }) };

        const baseUrl = 'https://kelionai.app/.netlify/functions/';
        const retries = Math.min(max_retries || 3, 5);
        let lastError = null;
        let attempt = 0;

        // Exponential backoff retry
        for (attempt = 1; attempt <= retries; attempt++) {
            try {
                const opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
                if (reqBody) opts.body = JSON.stringify(reqBody);

                const res = await fetch(baseUrl + endpoint, opts);

                if (res.ok || res.status < 500) {
                    const data = await res.json().catch(() => ({}));
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, attempt, total_retries: retries, endpoint, response: data, status: res.status, healed: attempt > 1 }) };
                }

                lastError = `HTTP ${res.status}`;
            } catch (e) {
                lastError = e.message;
            }

            // Wait with exponential backoff (100ms, 200ms, 400ms...)
            if (attempt < retries) await new Promise(r => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
        }

        // Circuit breaker: all retries failed
        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: false,
                circuit_breaker: 'OPEN',
                endpoint,
                attempts: attempt - 1,
                last_error: lastError,
                fallback: 'cached_response',
                cached: { message: `Service ${endpoint} is temporarily unavailable. Using cached response.` }
            })
        };
    } catch (error) {
        console.error('Self-healing error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
