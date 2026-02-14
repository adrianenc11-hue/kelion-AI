/**
 * Usage Analytics — Real-time API usage charts data
 * Provides hourly/daily/weekly breakdowns for admin dashboard
 */
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'DB not configured' }) };

    try {
        const { action, _period, _key_prefix } = JSON.parse(event.body || '{}');

        // ═══ USAGE BY HOUR (last 24h) ═══
        if (action === 'hourly') {
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('api_key_usage')
                .select('service, credits_used, created_at')
                .gte('created_at', since)
                .order('created_at', { ascending: true });

            // Group by hour
            const hourly = {};
            (data || []).forEach(r => {
                const hour = r.created_at.substring(0, 13); // YYYY-MM-DDTHH
                if (!hourly[hour]) hourly[hour] = { calls: 0, credits: 0 };
                hourly[hour].calls++;
                hourly[hour].credits += r.credits_used || 0;
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, period: '24h', data: hourly })
            };
        }

        // ═══ USAGE BY DAY (last 30 days) ═══
        if (action === 'daily') {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('api_key_usage')
                .select('service, credits_used, created_at')
                .gte('created_at', since)
                .order('created_at', { ascending: true });

            const daily = {};
            (data || []).forEach(r => {
                const day = r.created_at.substring(0, 10); // YYYY-MM-DD
                if (!daily[day]) daily[day] = { calls: 0, credits: 0, services: {} };
                daily[day].calls++;
                daily[day].credits += r.credits_used || 0;
                daily[day].services[r.service] = (daily[day].services[r.service] || 0) + 1;
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, period: '30d', data: daily })
            };
        }

        // ═══ TOP USERS (by usage) ═══
        if (action === 'top_users') {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('api_key_usage')
                .select('key_prefix, service, credits_used')
                .gte('created_at', since);

            const users = {};
            (data || []).forEach(r => {
                if (!users[r.key_prefix]) users[r.key_prefix] = { calls: 0, credits: 0 };
                users[r.key_prefix].calls++;
                users[r.key_prefix].credits += r.credits_used || 0;
            });

            const sorted = Object.entries(users)
                .sort((a, b) => b[1].credits - a[1].credits)
                .slice(0, 20)
                .map(([prefix, stats]) => ({ key_prefix: prefix, ...stats }));

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, top_users: sorted })
            };
        }

        // ═══ SERVICE BREAKDOWN ═══
        if (action === 'services') {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('api_key_usage')
                .select('service, credits_used')
                .gte('created_at', since);

            const services = {};
            (data || []).forEach(r => {
                if (!services[r.service]) services[r.service] = { calls: 0, credits: 0 };
                services[r.service].calls++;
                services[r.service].credits += r.credits_used || 0;
            });

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, services })
            };
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ service: 'usage-analytics', actions: ['hourly', 'daily', 'top_users', 'services'] })
        };

    } catch (error) {
        console.error('Usage analytics error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
