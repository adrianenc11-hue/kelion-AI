/**
 * Usage Limiter — Checks daily API usage against plan limits
 * Actions: check (GET remaining), check_and_increment (count usage)
 * Uses api_usage_log table in Supabase
 */

const { createClient } = require('@supabase/supabase-js');

// Daily limits per plan
const PLAN_LIMITS = {
    free: { queries: 10, tts: 3, images: 1 },
    pro: { queries: 200, tts: 50, images: 10 },
    family: { queries: 500, tts: 100, images: 20 },
    business: { queries: 99999, tts: 99999, images: 50 }
};

// Map endpoints to limit categories
const ENDPOINT_CATEGORY = {
    'smart-brain': 'queries',
    'speak': 'tts',
    'elevenlabs-tts': 'tts',
    'generate-image': 'images',
    'dalle': 'images',
    'vision': 'queries',
    'whisper': 'queries',
    'deep-research': 'queries'
};

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
    if (!supabase) {
        // If no DB, allow all (graceful degradation)
        return { statusCode: 200, headers, body: JSON.stringify({ allowed: true, remaining: 999, limit: 999, reason: 'no_db' }) };
    }

    try {
        const { user_email, endpoint, action } = JSON.parse(event.body || '{}');
        const email = user_email || 'anonymous';
        const category = ENDPOINT_CATEGORY[endpoint] || 'queries';

        // Determine user plan from users table
        let userPlan = 'free';
        if (email !== 'anonymous') {
            const { data: user } = await supabase
                .from('users')
                .select('subscription_type, subscription_status')
                .eq('email', email)
                .single();

            if (user && user.subscription_status === 'ACTIVE') {
                const sub = (user.subscription_type || '').toLowerCase();
                if (sub.includes('business')) userPlan = 'business';
                else if (sub.includes('family')) userPlan = 'family';
                else if (sub.includes('pro') || sub.includes('monthly') || sub.includes('annual')) userPlan = 'pro';
            }
        }

        const limits = PLAN_LIMITS[userPlan] || PLAN_LIMITS.free;
        const dailyLimit = limits[category] || limits.queries;

        // Count today's usage for this user + category
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get matching endpoints for this category
        const categoryEndpoints = Object.entries(ENDPOINT_CATEGORY)
            .filter(([_, cat]) => cat === category)
            .map(([ep, _]) => ep);

        const { count, error } = await supabase
            .from('api_usage_log')
            .select('id', { count: 'exact', head: true })
            .eq('user_email', email)
            .in('endpoint', categoryEndpoints)
            .gte('created_at', today.toISOString());

        const used = count || 0;
        const remaining = Math.max(0, dailyLimit - used);
        const allowed = used < dailyLimit;

        // Action: top_users — return usage stats for admin
        if (action === 'top_users') {
            const { data: topUsers } = await supabase
                .from('api_usage_log')
                .select('user_email, endpoint')
                .gte('created_at', today.toISOString());

            const userCounts = {};
            (topUsers || []).forEach(row => {
                const key = row.user_email || 'anonymous';
                if (!userCounts[key]) userCounts[key] = { total: 0, endpoints: {} };
                userCounts[key].total++;
                userCounts[key].endpoints[row.endpoint] = (userCounts[key].endpoints[row.endpoint] || 0) + 1;
            });

            const sorted = Object.entries(userCounts)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 20)
                .map(([email, data]) => ({ email, ...data }));

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, top_users: sorted }) };
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                allowed,
                remaining,
                limit: dailyLimit,
                used,
                plan: userPlan,
                category,
                upgrade_url: !allowed ? '/subscribe.html' : null,
                message: !allowed ? `Daily ${category} limit reached (${dailyLimit}/${category}). Upgrade for more →` : null
            })
        };
    } catch (error) {
        console.error('Usage limiter error:', error);
        // On error, allow (don't block users due to limiter bugs)
        return { statusCode: 200, headers, body: JSON.stringify({ allowed: true, remaining: 999, error: error.message }) };
    }
};
