// K Crisis Manager - Auto-fix production bugs (Phase 8)
const OpenAI = require('openai');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const { action } = body;

        // Default: scan for issues
        const endpoints = ['health', 'chat', 'realtime-token', 'gemini-live-token', 'weather', 'search'];
        const baseUrl = 'https://kelionai.app/.netlify/functions/';
        const results = [];
        let criticalCount = 0;

        for (const ep of endpoints) {
            try {
                const start = Date.now();
                const res = await fetch(baseUrl + ep);
                const ms = Date.now() - start;
                const status = res.status >= 500 ? 'critical' : (res.status >= 400 ? 'warning' : 'ok');
                if (status === 'critical') criticalCount++;
                results.push({ endpoint: ep, status: res.status, latency: ms, severity: status });
            } catch (e) {
                criticalCount++;
                results.push({ endpoint: ep, status: 'error', error: e.message, severity: 'critical' });
            }
        }

        const crisis = criticalCount >= 3;
        const response = { success: true, crisis_detected: crisis, critical_count: criticalCount, total_checked: endpoints.length, results, timestamp: new Date().toISOString() };

        // If crisis and action=analyze, get AI analysis
        if (action === 'analyze' && crisis && process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Analyze this crisis report and suggest immediate actions. Be concise.' },
                    { role: 'user', content: JSON.stringify(results) }
                ],
                max_tokens: 500
            });
            response.analysis = completion.choices[0]?.message?.content;
            response.confidence = criticalCount >= 5 ? 'low' : (criticalCount >= 3 ? 'medium' : 'high');
            response.recommendation = criticalCount >= 5 ? 'ALERT_ADMIN' : 'AUTO_FIX_POSSIBLE';
        }

        return { statusCode: 200, headers, body: JSON.stringify(response) };
    } catch (error) {
        console.error('Crisis manager error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
