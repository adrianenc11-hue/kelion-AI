// K Analytics - Usage tracking and reporting (serverless-safe)
// Uses Supabase for persistent analytics storage instead of local fs

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

        if (event.httpMethod === 'POST') {
            // Track an event
            const { event_name, category, metadata, user_id } = JSON.parse(event.body || '{}');
            if (!event_name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'event_name required' }) };

            const record = {
                event_name,
                category: category || 'general',
                metadata: metadata || {},
                user_id: user_id || 'anonymous',
                timestamp: new Date().toISOString()
            };

            // Store in Supabase if available
            if (supabaseUrl && supabaseKey) {
                try {
                    await fetch(`${supabaseUrl}/rest/v1/analytics`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`,
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(record)
                    });
                } catch (e) { /* Supabase store failed, continue */ }
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, tracked: record }) };
        }

        // GET: Return analytics summary
        // Get function count from GitHub
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO || 'adrianenc11/kelionai';
        let functionsCount = 0;

        try {
            const h = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'KelionAI' };
            if (token) h['Authorization'] = `Bearer ${token}`;
            const res = await fetch(`https://api.github.com/repos/${repo}/contents/netlify/functions`, { headers: h });
            const contents = await res.json();
            functionsCount = Array.isArray(contents) ? contents.filter(f => f.name.endsWith('.js')).length : 0;
        } catch (e) { /* skip */ }

        // Get analytics from Supabase if available
        let recentEvents = [];
        if (supabaseUrl && supabaseKey) {
            try {
                const res = await fetch(`${supabaseUrl}/rest/v1/analytics?order=timestamp.desc&limit=20`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                if (res.ok) recentEvents = await res.json();
            } catch (e) { /* skip */ }
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                summary: {
                    total_functions: functionsCount,
                    node_version: process.version,
                    uptime_s: Math.floor(process.uptime()),
                    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    timestamp: new Date().toISOString()
                },
                recent_events: recentEvents.length > 0 ? recentEvents : 'No analytics table configured yet',
                storage: supabaseUrl ? 'supabase' : 'none'
            })
        };
    } catch (error) {
        console.error('Analytics error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
