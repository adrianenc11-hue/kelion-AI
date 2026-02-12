// ═══ ANALYTICS DASHBOARD — Real data from Supabase (zero fake) ═══

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': 'https://kelionai.app',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    const supabase = getSupabase();
    if (!supabase) {
        return respond(503, { error: 'config_missing', message: 'SUPABASE_URL and SUPABASE_KEY not configured', setup: 'Set these in Netlify env vars' });
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            case 'overview':
                return respond(200, await getOverview(supabase, body));
            case 'traffic':
                return respond(200, await getTraffic(supabase, body));
            case 'conversions':
                return respond(200, await getConversions(supabase, body));
            case 'engagement':
                return respond(200, await getEngagement(supabase, body));
            case 'revenue':
                return respond(200, await getRevenue(supabase, body));
            case 'compare':
                return respond(200, await comparePeriods(supabase, body));
            default:
                return respond(400, { error: 'Actions: overview, traffic, conversions, engagement, revenue, compare' });
        }
    } catch (err) {
        console.error('Analytics error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

function getSince(period) {
    const days = parseInt(period) || 7;
    return { days, since: new Date(Date.now() - days * 86400000).toISOString() };
}

async function getOverview(supabase, { period = '7d', site = 'kelionai.app' }) {
    const { days, since } = getSince(period);

    // Get page views from Supabase
    const { data: views, error } = await supabase
        .from('page_views')
        .select('page, created_at, duration_ms, session_id, ip_address')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Overview query error:', error);
        return { error: 'Failed to query page_views', details: error.message, source: 'supabase' };
    }

    const rows = views || [];
    const uniqueIPs = new Set(rows.map(r => r.ip_address).filter(Boolean));
    const uniqueSessions = new Set(rows.map(r => r.session_id).filter(Boolean));

    // Group by day
    const dailyMap = {};
    rows.forEach(r => {
        const day = r.created_at?.split('T')[0];
        if (!day) return;
        if (!dailyMap[day]) dailyMap[day] = { visitors: new Set(), page_views: 0, sessions: new Set() };
        dailyMap[day].page_views++;
        if (r.ip_address) dailyMap[day].visitors.add(r.ip_address);
        if (r.session_id) dailyMap[day].sessions.add(r.session_id);
    });

    const dailyData = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
            date,
            visitors: d.visitors.size,
            page_views: d.page_views,
            sessions: d.sessions.size
        }));

    // Top pages
    const pageCounts = {};
    rows.forEach(r => { const p = r.page || '/'; pageCounts[p] = (pageCounts[p] || 0) + 1; });
    const topPages = Object.entries(pageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([page, views]) => ({ page, views }));

    return {
        site,
        period: `${days} zile`,
        summary: {
            total_visitors: uniqueIPs.size,
            total_page_views: rows.length,
            total_sessions: uniqueSessions.size,
            avg_daily_visitors: days > 0 ? Math.round(uniqueIPs.size / days) : 0,
            pages_per_session: uniqueSessions.size > 0 ? Math.round(rows.length / uniqueSessions.size * 10) / 10 : 0
        },
        daily: dailyData,
        top_pages: topPages,
        source: '🟢 Supabase (live)'
    };
}

async function getTraffic(supabase, { period = '7d' }) {
    const { since } = getSince(period);

    const { data: views } = await supabase
        .from('page_views')
        .select('ip_address, metadata, created_at')
        .gte('created_at', since);

    const rows = views || [];

    // Aggregate by device, country from metadata
    const devices = {};
    const countries = {};
    const referrers = {};

    rows.forEach(r => {
        const meta = r.metadata || {};
        const device = meta.device_type || 'Unknown';
        const country = meta.country || 'Unknown';
        const referrer = meta.referrer || 'Direct';

        devices[device] = (devices[device] || 0) + 1;
        countries[country] = (countries[country] || 0) + 1;
        referrers[referrer] = (referrers[referrer] || 0) + 1;
    });

    const total = rows.length || 1;
    const toList = (obj) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count, percentage: `${Math.round(count / total * 100)}%` }));

    return {
        period,
        total_views: rows.length,
        sources: toList(referrers),
        devices: toList(devices),
        locations: toList(countries),
        source: '🟢 Supabase (live)'
    };
}

async function getConversions(supabase, { period = '30d' }) {
    const { since } = getSince(period);

    // Count unique users created in period
    const { count: newUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);

    // Count active subscriptions
    const { count: activeSubs } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active');

    // Count total users
    const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

    return {
        period,
        new_users: newUsers || 0,
        active_subscribers: activeSubs || 0,
        total_users: totalUsers || 0,
        conversion_rate: totalUsers > 0 ? `${Math.round((activeSubs || 0) / totalUsers * 1000) / 10}%` : '0%',
        source: '🟢 Supabase (live)'
    };
}

async function getEngagement(supabase, { period = '7d' }) {
    const { since } = getSince(period);

    // Chat messages count
    const { count: msgCount } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'chat_message')
        .gte('created_at', since);

    // Tool uses
    const { count: toolCount } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'tool_use')
        .gte('created_at', since);

    // Total views
    const { count: viewCount } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', since);

    return {
        period,
        total_page_views: viewCount || 0,
        chat_messages: msgCount || 0,
        tool_uses: toolCount || 0,
        source: '🟢 Supabase (live)'
    };
}

async function getRevenue(supabase, { period = '30d', currency = 'RON' }) {
    const { since } = getSince(period);

    // Revenue from revenue_log if it exists
    const { data: revenue } = await supabase
        .from('revenue_log')
        .select('amount, type, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    const rows = revenue || [];
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    const byType = {};
    rows.forEach(r => {
        const t = r.type || 'other';
        byType[t] = (byType[t] || 0) + (r.amount || 0);
    });

    // Active subscribers
    const { count: activeSubs } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active');

    return {
        period, currency,
        summary: {
            total_revenue: Math.round(total * 100) / 100,
            by_type: byType,
            transactions: rows.length
        },
        subscriptions: {
            active: activeSubs || 0
        },
        source: '🟢 Supabase (live)'
    };
}

async function comparePeriods(supabase, { period_a = '7d', period_b = 'previous' }) {
    const daysA = parseInt(period_a) || 7;
    const sinceA = new Date(Date.now() - daysA * 86400000).toISOString();
    const sinceB = new Date(Date.now() - daysA * 2 * 86400000).toISOString();

    // Current period
    const { count: viewsA } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sinceA);

    // Previous period
    const { count: viewsB } = await supabase
        .from('page_views')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sinceB)
        .lt('created_at', sinceA);

    const change = viewsB > 0 ? Math.round((viewsA - viewsB) / viewsB * 1000) / 10 : 0;

    return {
        comparison: `${period_a} vs ${period_b}`,
        current_period: { views: viewsA || 0, days: daysA },
        previous_period: { views: viewsB || 0, days: daysA },
        change: `${change >= 0 ? '+' : ''}${change}%`,
        trend: change >= 0 ? '📈' : '📉',
        source: '🟢 Supabase (live)'
    };
}
