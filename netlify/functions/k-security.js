// K Security - Advanced rate limiting, input validation, attack detection
const securityState = { blocked_ips: new Map(), request_counts: new Map() };

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';

        if (event.httpMethod === 'POST') {
            const { action, payload, endpoint } = JSON.parse(event.body || '{}');

            // Action: validate input
            if (action === 'validate') {
                if (!payload) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payload required' }) };
                const issues = [];
                const payloadStr = JSON.stringify(payload);

                // Check for SQL injection
                if (/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/i.test(payloadStr)) issues.push({ type: 'sql_injection', severity: 'critical' });
                // Check for XSS
                if (/<script|javascript:|on\w+=/i.test(payloadStr)) issues.push({ type: 'xss_attempt', severity: 'critical' });
                // Check for path traversal
                if (/\.\.\//g.test(payloadStr)) issues.push({ type: 'path_traversal', severity: 'high' });
                // Check for oversized payload
                if (payloadStr.length > 100000) issues.push({ type: 'oversized_payload', severity: 'medium', size: payloadStr.length });

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, valid: issues.length === 0, issues, checked_at: new Date().toISOString() }) };
            }

            // Action: check rate limit
            if (action === 'rate_check') {
                const key = `${clientIp}_${endpoint || 'global'}`;
                const now = Date.now();
                const window = 60000; // 1 minute
                const limit = 60;

                if (!securityState.request_counts.has(key)) securityState.request_counts.set(key, []);
                const requests = securityState.request_counts.get(key).filter(t => t > now - window);
                requests.push(now);
                securityState.request_counts.set(key, requests);

                const allowed = requests.length <= limit;
                return { statusCode: allowed ? 200 : 429, headers, body: JSON.stringify({ allowed, requests_in_window: requests.length, limit, remaining: Math.max(0, limit - requests.length) }) };
            }
        }

        // GET: security status
        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                security: {
                    status: 'active',
                    features: ['rate_limiting', 'input_validation', 'sql_injection_detection', 'xss_detection', 'path_traversal_detection'],
                    blocked_ips: securityState.blocked_ips.size,
                    active_rate_limits: securityState.request_counts.size
                }
            })
        };
    } catch (error) {
        console.error('Security error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
