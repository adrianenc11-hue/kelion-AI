// ═══ ADMIN PANEL — Backend for adrianenc11@gmail.com ═══
// Traffic, AI Credits, Trading Dashboard, Messenger Conversations, Social Media Management
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kelionai.app';

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const db = getDB();
        const body = JSON.parse(event.body || '{}');

        // Auth check — only admin
        const userEmail = body.email || body.user_email;
        if (userEmail !== ADMIN_EMAIL) {
            return respond(403, { error: 'Admin access only', required: ADMIN_EMAIL });
        }

        switch (body.action) {
            // ═══ TRAFFIC ═══
            case 'traffic': return respond(200, await getTraffic(db, body));
            case 'traffic_live': return respond(200, await getLiveVisitors(db));

            // ═══ AI CREDITS ═══
            case 'ai_credits': return respond(200, await getAICredits(db, body));
            case 'ai_usage_detail': return respond(200, await getAIUsageDetail(db, body));

            // ═══ TRADING ═══
            case 'trading_dashboard': return respond(200, await getTradingDashboard(db));
            case 'trading_history': return respond(200, await getTradingHistory(db, body));
            case 'trading_recommendations': return respond(200, await getTradingRecommendations(db, body));
            case 'check_recommendation': return respond(200, await checkRecommendation(db, body));

            // ═══ MESSENGER CONVERSATIONS ═══
            case 'messenger_conversations': return respond(200, await getMessengerConversations(db, body));
            case 'messenger_detail': return respond(200, await getConversationDetail(db, body));

            // ═══ EMAIL ═══
            case 'email_list': return respond(200, await getEmails(db, body));
            case 'email_update': return respond(200, await updateEmailStatus(db, body));

            // ═══ TRENDING ═══
            case 'trending_keywords': return respond(200, await getTrendingKeywords(db, body));

            // ═══ USER REQUEST ANALYTICS ═══
            case 'user_requests': return respond(200, await getUserRequestAnalytics(db, body));

            // ═══ OVERVIEW ═══
            case 'overview': return respond(200, await getAdminOverview(db));

            // ═══ SOCIAL MEDIA ═══
            case 'social_media_status': return respond(200, await getSocialMediaStatus(db));
            case 'social_media_test_post': return respond(200, await testSocialPost(body));
            case 'social_media_post_now': return respond(200, await postNowFromAdmin(body));

            default: return respond(400, { error: 'Actions: overview, traffic, traffic_live, ai_credits, ai_usage_detail, trading_dashboard, trading_history, trading_recommendations, check_recommendation, messenger_conversations, messenger_detail, email_list, email_update, trending_keywords, user_requests, social_media_status, social_media_test_post, social_media_post_now' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers, body: JSON.stringify({ success: c === 200, ...d }) }; }

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    return createClient(url, key);
}

// ═══════════════════════════════════════════════════
// TRAFFIC — Page views, visitors, sessions
// ═══════════════════════════════════════════════════
async function getTraffic(db, { period = '7d', page }) {
    const since = periodToDate(period);

    let query = db.from('page_views')
        .select('page, visitor_id, created_at, referrer, device')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

    if (page) query = query.eq('page', page);
    const { data, error } = await query;
    if (error) return { error: error.message };

    // Aggregate
    const views = data || [];
    const uniqueVisitors = new Set(views.map(v => v.visitor_id)).size;
    const byPage = {};
    const byDay = {};
    const byReferrer = {};

    views.forEach(v => {
        const pg = v.page || '/';
        byPage[pg] = (byPage[pg] || 0) + 1;

        const day = v.created_at?.split('T')[0];
        if (day) byDay[day] = (byDay[day] || 0) + 1;

        const ref = v.referrer || 'direct';
        byReferrer[ref] = (byReferrer[ref] || 0) + 1;
    });

    return {
        period,
        total_views: views.length,
        unique_visitors: uniqueVisitors,
        by_page: sortObj(byPage),
        by_day: byDay,
        by_referrer: sortObj(byReferrer),
        top_pages: Object.entries(byPage).sort((a, b) => b[1] - a[1]).slice(0, 10)
    };
}

async function getLiveVisitors(db) {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const { data, count } = await db.from('page_views')
        .select('page, visitor_id, created_at', { count: 'exact' })
        .gte('created_at', fiveMinAgo);

    const activePages = {};
    (data || []).forEach(v => { activePages[v.page || '/'] = (activePages[v.page || '/'] || 0) + 1; });
    const uniqueNow = new Set((data || []).map(v => v.visitor_id)).size;

    return { live_visitors: uniqueNow, active_pages: activePages, since: fiveMinAgo };
}

// ═══════════════════════════════════════════════════
// AI CREDITS — Real usage per user, per model
// ═══════════════════════════════════════════════════
async function getAICredits(db, { period = '30d' }) {
    const since = periodToDate(period);
    const { data, error } = await db.from('ai_usage_log')
        .select('user_id, model, tokens_used, cost_estimate, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);

    if (error) return { error: error.message };
    const rows = data || [];

    // Totals
    const totalTokens = rows.reduce((s, r) => s + (r.tokens_used || 0), 0);
    const totalCost = rows.reduce((s, r) => s + parseFloat(r.cost_estimate || 0), 0);

    // By model
    const byModel = {};
    rows.forEach(r => {
        const m = r.model || 'unknown';
        if (!byModel[m]) byModel[m] = { requests: 0, tokens: 0, cost: 0 };
        byModel[m].requests++;
        byModel[m].tokens += (r.tokens_used || 0);
        byModel[m].cost += parseFloat(r.cost_estimate || 0);
    });

    // By user
    const byUser = {};
    rows.forEach(r => {
        const u = r.user_id || 'anonymous';
        if (!byUser[u]) byUser[u] = { requests: 0, tokens: 0 };
        byUser[u].requests++;
        byUser[u].tokens += (r.tokens_used || 0);
    });

    return {
        period,
        total_requests: rows.length,
        total_tokens: totalTokens,
        total_cost_estimate: `$${totalCost.toFixed(4)}`,
        by_model: byModel,
        top_users: Object.entries(byUser).sort((a, b) => b[1].requests - a[1].requests).slice(0, 20).map(([id, stats]) => ({ user_id: id, ...stats }))
    };
}

async function getAIUsageDetail(db, { user_id, model, limit = 50 }) {
    let query = db.from('ai_usage_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (user_id) query = query.eq('user_id', user_id);
    if (model) query = query.eq('model', model);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { usage: data || [] };
}

// ═══════════════════════════════════════════════════
// TRADING DASHBOARD — Live positions, P&L, bot status
// ═══════════════════════════════════════════════════
async function getTradingDashboard(db) {
    const dashboard = {};

    // Bot status from trading-bot-engine
    try {
        const fetch = (await import('node-fetch')).default;
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const res = await fetch(`${baseUrl}/.netlify/functions/trading-bot-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status' })
        });
        dashboard.bot_status = await res.json();
    } catch (e) { dashboard.bot_status = { error: e.message }; }

    // Recent trades from DB
    const { data: trades } = await db.from('trade_history')
        .select('*').order('created_at', { ascending: false }).limit(50);
    dashboard.recent_trades = trades || [];

    // P&L summary
    const pnl = (trades || []).reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const wins = (trades || []).filter(t => parseFloat(t.pnl || 0) > 0).length;
    dashboard.pnl_summary = {
        total_pnl: `$${pnl.toFixed(2)}`,
        total_trades: trades?.length || 0,
        wins, losses: (trades?.length || 0) - wins,
        win_rate: trades?.length ? `${Math.round(wins / trades.length * 100)}%` : '0%'
    };

    // Learning status
    const { data: learning } = await db.from('bot_learning_log')
        .select('*').order('learned_at', { ascending: false }).limit(1);
    dashboard.last_learning = learning?.[0] || null;

    return dashboard;
}

async function getTradingHistory(db, { period = '30d', symbol }) {
    const since = periodToDate(period);
    let query = db.from('trade_history').select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false });
    if (symbol) query = query.eq('symbol', symbol);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { trades: data || [], period };
}

// ═══════════════════════════════════════════════════
// MESSENGER CONVERSATIONS — Saved by year/month/day/hour/min/sec
// ═══════════════════════════════════════════════════
async function getMessengerConversations(db, { platform = 'all', period = '30d', page: pg = 1, per_page = 50 }) {
    const since = periodToDate(period);

    let query = db.from('messenger_conversations')
        .select('id, platform, sender_id, sender_name, started_at, last_message_at, message_count, ai_model_used', { count: 'exact' })
        .gte('started_at', since.toISOString())
        .order('last_message_at', { ascending: false })
        .range((pg - 1) * per_page, pg * per_page - 1);

    if (platform !== 'all') query = query.eq('platform', platform);
    const { data, count, error } = await query;
    if (error) return { error: error.message };

    // Group by time buckets
    const byYear = {}, byMonth = {}, byDay = {};
    (data || []).forEach(c => {
        const d = new Date(c.started_at);
        const y = d.getFullYear().toString();
        const m = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const day = `${m}-${String(d.getDate()).padStart(2, '0')}`;
        byYear[y] = (byYear[y] || 0) + 1;
        byMonth[m] = (byMonth[m] || 0) + 1;
        byDay[day] = (byDay[day] || 0) + 1;
    });

    return {
        conversations: data || [],
        total: count || 0,
        page: pg, per_page,
        period,
        by_year: byYear,
        by_month: byMonth,
        by_day: byDay,
        platforms_available: ['facebook', 'instagram', 'tiktok']
    };
}

async function getConversationDetail(db, { conversation_id }) {
    if (!conversation_id) return { error: 'conversation_id required' };

    // Get conversation metadata
    const { data: conv } = await db.from('messenger_conversations')
        .select('*').eq('id', conversation_id).single();

    // Get all messages with full timestamps
    const { data: messages, error } = await db.from('messenger_messages')
        .select('sender_type, sender_name, message, ai_response, ai_model, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true });

    if (error) return { error: error.message };

    // Format with year/month/day/hour/min/sec
    const formatted = (messages || []).map(m => {
        const d = new Date(m.created_at);
        return {
            ...m,
            timestamp: {
                year: d.getFullYear(),
                month: d.getMonth() + 1,
                day: d.getDate(),
                hour: d.getHours(),
                minute: d.getMinutes(),
                second: d.getSeconds(),
                full: d.toISOString()
            }
        };
    });

    return {
        conversation: conv,
        messages: formatted,
        total_messages: formatted.length
    };
}

// ═══════════════════════════════════════════════════
// ADMIN OVERVIEW — Dashboard summary
// ═══════════════════════════════════════════════════
async function getAdminOverview(db) {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = `${today}T00:00:00Z`;

    // Today's stats
    const { count: todayViews } = await db.from('page_views')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart);

    const { count: todayAI } = await db.from('ai_usage_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart);

    const { count: todayMessages } = await db.from('messenger_messages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart);

    const { count: totalUsers } = await db.from('users')
        .select('id', { count: 'exact', head: true });

    // Trading P&L today
    const { data: todayTrades } = await db.from('trade_history')
        .select('pnl').gte('created_at', todayStart);
    const todayPnL = (todayTrades || []).reduce((s, t) => s + parseFloat(t.pnl || 0), 0);

    return {
        today: {
            page_views: todayViews || 0,
            ai_requests: todayAI || 0,
            messenger_messages: todayMessages || 0,
            trading_pnl: `$${todayPnL.toFixed(2)}`,
            trades: todayTrades?.length || 0
        },
        total_users: totalUsers || 0,
        server_time: new Date().toISOString(),
        admin: ADMIN_EMAIL
    };
}

// ═══════════════════════════════════════════════════
// EMAIL MONITORING — Inbound emails from contact@kelionai.app
// ═══════════════════════════════════════════════════
async function getEmails(db, { status = 'all', period = '30d', page = 1, per_page = 50 }) {
    const since = periodToDate(period);
    let query = db.from('inbound_emails')
        .select('id, from_email, from_name, subject, body_text, received_at, status, attachments_count', { count: 'exact' })
        .gte('received_at', since.toISOString())
        .order('received_at', { ascending: false })
        .range((page - 1) * per_page, page * per_page - 1);

    if (status !== 'all') query = query.eq('status', status);
    const { data, count, error } = await query;
    if (error) return { error: error.message };

    // Stats
    const { count: newCount } = await db.from('inbound_emails')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
    const { count: totalCount } = await db.from('inbound_emails')
        .select('id', { count: 'exact', head: true });

    return {
        emails: (data || []).map(e => ({
            ...e,
            body_preview: (e.body_text || '').substring(0, 200)
        })),
        total: count || 0,
        new_count: newCount || 0,
        total_all: totalCount || 0,
        page, per_page, period
    };
}

async function updateEmailStatus(db, { email_id, status, notes }) {
    if (!email_id) return { error: 'email_id required' };
    if (!['new', 'read', 'replied', 'archived'].includes(status)) return { error: 'Invalid status' };
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    const { error } = await db.from('inbound_emails').update(update).eq('id', email_id);
    if (error) return { error: error.message };
    return { updated: true, email_id, status };
}

// ═══════════════════════════════════════════════════
// TRENDING KEYWORDS — Internet search trends analysis
// ═══════════════════════════════════════════════════
async function getTrendingKeywords(db, { category = 'general', country = 'RO', limit = 20 }) {
    try {
        const fetch = (await import('node-fetch')).default;
        const baseUrl = process.env.URL || 'https://kelionai.app';

        // Use our web-search function to get trending topics
        const queries = [
            'trending topics today ' + country,
            'most searched keywords ' + new Date().toISOString().split('T')[0],
            'top searches ' + (category !== 'general' ? category : '') + ' today'
        ];

        const results = [];
        for (const q of queries) {
            try {
                const res = await fetch(`${baseUrl}/.netlify/functions/web-search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: q, limit: 10 })
                });
                const data = await res.json();
                if (data.results) results.push(...data.results);
            } catch (e) { /* skip failed query */ }
        }

        // Also get our own top searched queries from ai_usage_log
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const { data: aiLogs } = await db.from('ai_usage_log')
            .select('query, model, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(500);

        // Extract and classify keywords from our own user queries
        const keywordCount = {};
        (aiLogs || []).forEach(log => {
            const words = (log.query || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
            words.forEach(w => { keywordCount[w] = (keywordCount[w] || 0) + 1; });
        });

        const topKeywords = Object.entries(keywordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([keyword, count], i) => ({ rank: i + 1, keyword, count, source: 'user_queries' }));

        // Classify by category
        const categories = {
            tech: ['ai', 'code', 'programming', 'software', 'app', 'website', 'bot', 'api'],
            health: ['health', 'diet', 'fitness', 'nutrition', 'exercise', 'weight', 'medical'],
            business: ['business', 'market', 'trade', 'sales', 'profit', 'invest', 'startup'],
            legal: ['law', 'legal', 'contract', 'rights', 'court', 'regulation', 'compliance'],
            education: ['learn', 'course', 'university', 'study', 'exam', 'school', 'teach']
        };

        const classified = {};
        topKeywords.forEach(kw => {
            let cat = 'other';
            for (const [c, words] of Object.entries(categories)) {
                if (words.some(w => kw.keyword.includes(w))) { cat = c; break; }
            }
            if (!classified[cat]) classified[cat] = [];
            classified[cat].push(kw);
        });

        return {
            country,
            category,
            top_keywords: topKeywords,
            classified,
            internet_results: results.slice(0, 10).map(r => ({
                title: r.title || r.name,
                url: r.url || r.link,
                snippet: r.snippet || r.description
            })),
            generated_at: new Date().toISOString(),
            total_queries_analyzed: aiLogs?.length || 0
        };
    } catch (err) {
        return { error: err.message, top_keywords: [], classified: {} };
    }
}

// ═══════════════════════════════════════════════════
// USER REQUEST ANALYTICS — Classify requests from chat, messenger, email
// ═══════════════════════════════════════════════════
async function getUserRequestAnalytics(db, { period = '30d', source = 'all' }) {
    const since = periodToDate(period);

    // 1. Chat requests from ai_usage_log
    const { data: chatLogs } = await db.from('ai_usage_log')
        .select('user_id, query, model, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

    // 2. Messenger requests
    const { data: messengerMsgs } = await db.from('messenger_messages')
        .select('sender_name, sender_type, message, platform, created_at')
        .eq('sender_type', 'user')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

    // 3. Combine all requests
    const allRequests = [];

    (chatLogs || []).forEach(r => {
        if (r.query) allRequests.push({
            text: r.query,
            source: 'chat',
            user: r.user_id || 'anonymous',
            date: r.created_at,
            model: r.model
        });
    });

    (messengerMsgs || []).forEach(r => {
        if (r.message) allRequests.push({
            text: r.message,
            source: 'messenger_' + (r.platform || 'unknown'),
            user: r.sender_name || 'anonymous',
            date: r.created_at
        });
    });

    // Classify requests by topic
    const topicPatterns = {
        'Legal / Juridic': ['lege', 'contract', 'drept', 'juridic', 'avocat', 'law', 'legal', 'rights'],
        'Health / Sanatate': ['sanatate', 'diet', 'nutritie', 'doctor', 'medical', 'health', 'fitness'],
        'Tech / Programare': ['cod', 'program', 'app', 'website', 'software', 'api', 'code', 'bug'],
        'Business / Afaceri': ['afacere', 'profit', 'vanzar', 'business', 'market', 'sales', 'invest'],
        'Education / Educatie': ['invatare', 'curs', 'universitate', 'examen', 'learn', 'course', 'study'],
        'Psychology / Psihologie': ['psiholog', 'anxietate', 'depresie', 'emotii', 'stress', 'therapy', 'mental'],
        'Food / Culinar': ['reteta', 'mancare', 'gatit', 'recipe', 'cook', 'food', 'ingredient'],
        'Architecture / Arhitectura': ['casa', 'constructie', 'design', 'interior', 'building', 'apartment'],
        'Trading / Investitii': ['trading', 'crypto', 'bitcoin', 'stock', 'invest', 'market', 'forex'],
        'General': []
    };

    const byTopic = {};
    const bySource = {};
    const byDay = {};
    const topRequestTexts = {};

    allRequests.forEach(r => {
        // Classify topic
        let topic = 'General';
        const textLower = r.text.toLowerCase();
        for (const [t, keywords] of Object.entries(topicPatterns)) {
            if (keywords.some(k => textLower.includes(k))) { topic = t; break; }
        }
        byTopic[topic] = (byTopic[topic] || 0) + 1;

        // By source
        bySource[r.source] = (bySource[r.source] || 0) + 1;

        // By day
        const day = r.date?.split('T')[0] || 'unknown';
        byDay[day] = (byDay[day] || 0) + 1;

        // Track unique request texts (truncated)
        const shortText = r.text.substring(0, 100);
        topRequestTexts[shortText] = (topRequestTexts[shortText] || 0) + 1;
    });

    // Sort topics by count
    const sortedTopics = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);

    // Most common requests
    const topRequests = Object.entries(topRequestTexts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([text, count], i) => ({ rank: i + 1, text, count }));

    return {
        period,
        total_requests: allRequests.length,
        by_topic: Object.fromEntries(sortedTopics),
        by_source: bySource,
        by_day: byDay,
        top_requests: topRequests,
        recent: allRequests.slice(0, 30).map(r => ({
            text: r.text.substring(0, 200),
            source: r.source,
            user: r.user,
            date: r.date
        })),
        sources_note: 'Chat (website), Messenger (Facebook/Instagram/TikTok). Email monitoring (contact@kelionai.app) requires email service integration.',
        generated_at: new Date().toISOString()
    };
}

// ═══════════════════════════════════════════════════
// TRADING RECOMMENDATIONS — Checkable by admin
// ═══════════════════════════════════════════════════
async function getTradingRecommendations(db, { period = '7d' }) {
    const since = periodToDate(period);
    const { data, error } = await db.from('bot_daily_reports')
        .select('id, report_date, market, recommendations, observations')
        .gte('created_at', since.toISOString())
        .order('report_date', { ascending: false });
    if (error) return { error: error.message };

    // Flatten all recommendations into a checkable list
    const allRecs = [];
    (data || []).forEach(report => {
        const recs = report.recommendations || [];
        const recsArray = Array.isArray(recs) ? recs : [{ text: String(recs), checked: false }];
        recsArray.forEach((rec, idx) => {
            allRecs.push({
                report_id: report.id,
                report_date: report.report_date,
                market: report.market,
                index: idx,
                text: rec.text || rec,
                checked: rec.checked || false
            });
        });
    });

    return { recommendations: allRecs, total: allRecs.length };
}

async function checkRecommendation(db, { report_id, index, checked }) {
    if (!report_id || index === undefined) return { error: 'report_id and index required' };

    // Get current recommendations
    const { data: report } = await db.from('bot_daily_reports')
        .select('recommendations').eq('id', report_id).single();
    if (!report) return { error: 'Report not found' };

    let recs = report.recommendations || [];
    if (!Array.isArray(recs)) recs = [{ text: String(recs), checked: false }];
    if (index >= recs.length) return { error: 'Invalid index' };

    // Toggle or set
    if (typeof recs[index] === 'string') {
        recs[index] = { text: recs[index], checked: checked !== undefined ? checked : true };
    } else {
        recs[index].checked = checked !== undefined ? checked : !recs[index].checked;
    }

    const { error } = await db.from('bot_daily_reports')
        .update({ recommendations: recs }).eq('id', report_id);
    if (error) return { error: error.message };

    return { updated: true, report_id, index, checked: recs[index].checked };
}

// ═══════════════════════════════════════════════════
// SOCIAL MEDIA STATUS — Real-time FB/Instagram/TikTok monitoring
// ═══════════════════════════════════════════════════
async function getSocialMediaStatus(db) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const result = { timestamp: new Date().toISOString(), platforms: {} };

    // ═══ FACEBOOK ═══
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const PAGE_ID = process.env.META_PAGE_ID;
    const fb = { configured: !!(PAGE_TOKEN && PAGE_ID), token_present: !!PAGE_TOKEN, page_id: PAGE_ID || 'NOT SET' };
    if (PAGE_TOKEN) {
        try {
            const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${PAGE_TOKEN}&access_token=${PAGE_TOKEN}`);
            const debugData = await debugRes.json();
            fb.token_valid = debugData.data?.is_valid || false;
            fb.token_expires = debugData.data?.expires_at === 0 ? 'Never' : new Date(debugData.data?.expires_at * 1000).toISOString();
            fb.scopes = debugData.data?.scopes || [];
            fb.app_name = debugData.data?.application || 'Unknown';
            fb.app_id = debugData.data?.app_id || 'Unknown';
            fb.profile_id = debugData.data?.profile_id || 'Unknown';
        } catch (e) { fb.token_check_error = e.message; }
        // Webhook subscription
        try {
            const subRes = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/subscribed_apps?access_token=${PAGE_TOKEN}`);
            const subData = await subRes.json();
            fb.webhook_subscribed = !!(subData.data && subData.data.length > 0);
            fb.webhook_fields = subData.data?.[0]?.subscribed_fields || [];
        } catch (e) { fb.webhook_error = e.message; }
        // Recent conversations
        try {
            const convRes = await fetch(`https://graph.facebook.com/v21.0/me/conversations?fields=id,updated_time&limit=5&access_token=${PAGE_TOKEN}`);
            const convData = await convRes.json();
            fb.recent_conversations = (convData.data || []).map(c => ({ id: c.id, updated: c.updated_time }));
            fb.total_conversations = convData.data?.length || 0;
        } catch (e) { fb.conversations_error = e.message; }
    }
    result.platforms.facebook = fb;

    // ═══ INSTAGRAM ═══
    const ig = { configured: !!(PAGE_TOKEN && PAGE_ID), uses_same_token: true, note: 'Instagram DM uses same Meta Page token as Facebook' };
    if (PAGE_TOKEN) {
        try {
            const igRes = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=instagram_business_account&access_token=${PAGE_TOKEN}`);
            const igData = await igRes.json();
            ig.instagram_business_account = igData.instagram_business_account?.id || 'NOT LINKED';
            ig.linked = !!igData.instagram_business_account;
        } catch (e) { ig.check_error = e.message; }
    }
    result.platforms.instagram = ig;

    // ═══ TIKTOK ═══
    const TT_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
    const TT_OPEN_ID = process.env.TIKTOK_OPEN_ID;
    result.platforms.tiktok = {
        configured: !!(TT_TOKEN && TT_OPEN_ID),
        token_present: !!TT_TOKEN,
        open_id_present: !!TT_OPEN_ID,
        note: TT_TOKEN ? 'Token present' : 'TIKTOK_ACCESS_TOKEN and TIKTOK_OPEN_ID needed in Netlify env vars',
        account: '@kelion_ai_expert'
    };

    // ═══ AUTO-POSTER STATUS ═══
    try {
        const apRes = await fetch(`${baseUrl}/.netlify/functions/auto-poster-api`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'status' })
        });
        result.auto_poster = await apRes.json();
    } catch (e) { result.auto_poster = { error: e.message }; }

    // ═══ RECENT MESSENGER LOGS from DB ═══
    try {
        const { data: recentLogs } = await db.from('messenger_logs')
            .select('sender_id, platform, user_message, bot_response, topic, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
        result.recent_messenger = (recentLogs || []).map(l => ({
            sender: l.sender_id?.substring(0, 8) + '...',
            platform: l.platform,
            question: (l.user_message || '').substring(0, 100),
            answer: (l.bot_response || '').substring(0, 100),
            topic: l.topic,
            time: l.created_at
        }));
    } catch (e) { result.recent_messenger = []; }

    // ═══ RECENT AUTO-POSTS from DB ═══
    try {
        const { data: posts } = await db.from('auto_posts')
            .select('platform, topic_id, posted, error, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
        result.recent_auto_posts = posts || [];
    } catch (e) { result.recent_auto_posts = []; }

    return result;
}

async function testSocialPost(body) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const platform = body.platform || 'facebook';
    try {
        const res = await fetch(`${baseUrl}/.netlify/functions/auto-poster-api`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'preview' })
        });
        return await res.json();
    } catch (e) { return { error: e.message }; }
}

async function postNowFromAdmin(body) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    try {
        const res = await fetch(`${baseUrl}/.netlify/functions/auto-poster-api`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'post_now', platform: body.platform || 'all', topic_id: body.topic_id })
        });
        return await res.json();
    } catch (e) { return { error: e.message }; }
}
// ═══ HELPERS ═══
function periodToDate(period) {
    const now = new Date();
    const match = period.match(/^(\d+)(d|h|m|w)$/);
    if (!match) return new Date(now - 7 * 86400000);
    const [, num, unit] = match;
    const ms = { d: 86400000, h: 3600000, m: 60000, w: 604800000 };
    return new Date(now - parseInt(num) * (ms[unit] || 86400000));
}

function sortObj(obj) {
    return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]));
}
