// ═══ SOCIAL MEDIA STATS — Statistici Instagram DM + Facebook Messenger ═══
// Endpoint pentru admin panel — rapoarte mesaje social media

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : { action: event.queryStringParameters?.action || 'overview' };

        switch (body.action) {
            case 'overview':
                return respond(200, getOverview(body));
            case 'log_message':
                return respond(200, await logMessage(body));
            case 'get_logs':
                return respond(200, await getLogs(body));
            case 'topic_stats':
                return respond(200, getTopicStats(body));
            default:
                return respond(400, { error: 'Actions: overview, log_message, get_logs, topic_stats' });
        }
    } catch (err) {
        console.error('Social stats error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

// ═══ OVERVIEW — Rezumat general ═══
function getOverview(body) {
    // In production, these would come from Supabase
    // For now, return structure ready for integration
    return {
        title: '📊 Social Media Dashboard — K Pension Assistant',
        platforms: {
            instagram: {
                name: 'Instagram DM',
                account: '@kelion_ai',
                status: 'active',
                icon: '📸',
                focus: 'Pensii, legislație, drepturi pensionari',
                stats: {
                    messages_today: 0,
                    messages_week: 0,
                    messages_month: 0,
                    messages_total: 0,
                    unique_users: 0,
                    avg_response_time: 'instant (bot)',
                    satisfaction_rate: 'N/A'
                }
            },
            messenger: {
                name: 'Facebook Messenger',
                account: 'Kelion AI - Asistent Pensii',
                status: 'pending_setup',
                icon: '💬',
                focus: 'Pensii, legislație, drepturi pensionari',
                stats: {
                    messages_today: 0,
                    messages_week: 0,
                    messages_month: 0,
                    messages_total: 0,
                    unique_users: 0,
                    avg_response_time: 'instant (bot)',
                    satisfaction_rate: 'N/A'
                }
            }
        },
        topics: {
            documente: { count: 0, percentage: '0%', icon: '📋' },
            calcul_pensie: { count: 0, percentage: '0%', icon: '🧮' },
            drepturi: { count: 0, percentage: '0%', icon: '🛡️' },
            legislatie: { count: 0, percentage: '0%', icon: '⚖️' },
            recalculare: { count: 0, percentage: '0%', icon: '📊' },
            contestatie: { count: 0, percentage: '0%', icon: '⚖️' },
            varsta: { count: 0, percentage: '0%', icon: '📅' },
            cereri_modele: { count: 0, percentage: '0%', icon: '📝' },
            altele: { count: 0, percentage: '0%', icon: '❓' }
        },
        webhook_url: '/.netlify/functions/messenger-webhook',
        setup_status: {
            messenger_webhook: '✅ Deployed',
            meta_app: '⏳ Needs Meta Developer App',
            page_token: '⏳ Needs META_PAGE_ACCESS_TOKEN env var',
            verify_token: '✅ Default set (kelionai_pension_verify_2025)',
            instagram_business: '⏳ Need Instagram Business Account connected to FB Page',
            facebook_page: '⏳ Need "Kelion AI - Asistent Pensii" page'
        },
        recent_messages: [],
        note: 'Stats will populate automatically once Meta API webhook is connected.'
    };
}

// ═══ LOG MESSAGE — Called by messenger-webhook ═══
async function logMessage({ platform, sender_id, message, topic, response_sent }) {
    const logEntry = {
        platform: platform || 'unknown',
        sender_id: sender_id || 'anonymous',
        message: (message || '').slice(0, 500),
        topic: topic || classifyTopic(message || ''),
        response_sent: response_sent || false,
        created_at: new Date().toISOString()
    };

    const supabase = getSupabase();
    if (supabase) {
        const { error } = await supabase.from('messenger_logs').insert(logEntry);
        if (error) console.error('Failed to log message:', error.message);
    }

    return { logged: true, entry: logEntry };
}

// ═══ GET LOGS — Retrieve message logs ═══
async function getLogs({ platform, limit = 50, offset = 0, date_from, date_to }) {
    const supabase = getSupabase();
    if (!supabase) return { logs: [], total: 0, note: 'Database not configured' };

    let query = supabase.from('messenger_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (platform) query = query.eq('platform', platform);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    const { data, count, error } = await query;
    if (error) return { logs: [], total: 0, error: error.message };

    return { logs: data || [], total: count || 0, limit, offset, filters: { platform, date_from, date_to } };
}

// ═══ TOPIC STATS — Frecvența subiectelor ═══
function getTopicStats(body) {
    return {
        period: body.period || 'all_time',
        topics: [
            { topic: 'Documente necesare', icon: '📋', count: 0, trend: '—' },
            { topic: 'Calcul pensie', icon: '🧮', count: 0, trend: '—' },
            { topic: 'Drepturi pensionari', icon: '🛡️', count: 0, trend: '—' },
            { topic: 'Legislație', icon: '⚖️', count: 0, trend: '—' },
            { topic: 'Recalculare', icon: '📊', count: 0, trend: '—' },
            { topic: 'Contestație', icon: '⚖️', count: 0, trend: '—' },
            { topic: 'Vârstă pensionare', icon: '📅', count: 0, trend: '—' },
            { topic: 'Cereri/Modele', icon: '📝', count: 0, trend: '—' },
            { topic: 'Altele', icon: '❓', count: 0, trend: '—' }
        ],
        total_messages: 0,
        note: 'Stats populate automatically from messenger-webhook logs.'
    };
}

// ═══ CLASSIFY TOPIC ═══
function classifyTopic(message) {
    const msg = message.toLowerCase();
    if (/documente|acte|dosar|pregatesc/.test(msg)) return 'documente';
    if (/calcul|cat primesc|estimare|punctaj/.test(msg)) return 'calcul_pensie';
    if (/drepturi|beneficii|transport|gratuit/.test(msg)) return 'drepturi';
    if (/lege|legislatie|articol|oug/.test(msg)) return 'legislatie';
    if (/recalculare|majorare|indexare/.test(msg)) return 'recalculare';
    if (/contest|nemultumit|tribunal/.test(msg)) return 'contestatie';
    if (/varsta|cand ma pensionez/.test(msg)) return 'varsta';
    if (/cerere|model|formular/.test(msg)) return 'cereri_modele';
    return 'altele';
}
