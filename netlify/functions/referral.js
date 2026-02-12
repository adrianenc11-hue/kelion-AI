// Netlify Function: Referral System
// POST /.netlify/functions/referral
// Actions: generate, track, rewards, status
// Uses Supabase 'referrals' table

const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

function generateCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'K-';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

exports.handler = async (event) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const db = getSupabase();
    if (!db) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    try {
        const { action, user_email, referral_code, referred_email } = JSON.parse(event.body || '{}');

        // ═══ GENERATE: Create a unique referral code for a user ═══
        if (action === 'generate') {
            if (!user_email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_email required' }) };
            }

            // Check if user already has a code
            const { data: existing } = await db.from('referrals')
                .select('referral_code')
                .eq('referrer_email', user_email)
                .limit(1);

            if (existing && existing.length > 0) {
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        referral_code: existing[0].referral_code,
                        message: 'Existing referral code retrieved'
                    })
                };
            }

            // Generate new code
            const code = generateCode();
            const { error } = await db.from('referrals').insert({
                referrer_email: user_email,
                referral_code: code,
                uses: 0,
                reward_months: 0,
                created_at: new Date().toISOString()
            });

            if (error) {
                console.error('[REFERRAL] Generate error:', error);
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate code' }) };
            }

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    referral_code: code,
                    share_url: `https://kelionai.app/subscribe.html?ref=${code}`
                })
            };
        }

        // ═══ TRACK: Record a referral signup ═══
        if (action === 'track') {
            if (!referral_code || !referred_email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'referral_code and referred_email required' }) };
            }

            // Find the referrer
            const { data: ref } = await db.from('referrals')
                .select('*')
                .eq('referral_code', referral_code)
                .limit(1);

            if (!ref || ref.length === 0) {
                return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid referral code' }) };
            }

            // Prevent self-referral
            if (ref[0].referrer_email === referred_email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot use your own referral code' }) };
            }

            // Increment uses and add reward
            const newUses = (ref[0].uses || 0) + 1;
            const newReward = (ref[0].reward_months || 0) + 1; // 1 free month per referral
            await db.from('referrals').update({
                uses: newUses,
                reward_months: newReward,
                last_used: new Date().toISOString()
            }).eq('referral_code', referral_code);

            // Log the referral event
            await db.from('referral_events').insert({
                referral_code: referral_code,
                referrer_email: ref[0].referrer_email,
                referred_email: referred_email,
                reward_type: 'free_month',
                created_at: new Date().toISOString()
            }).then(() => { }).catch(() => { });

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    message: 'Referral tracked successfully',
                    referrer_reward: '1 free month added'
                })
            };
        }

        // ═══ REWARDS: Check referral rewards for a user ═══
        if (action === 'rewards' || action === 'status') {
            if (!user_email) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_email required' }) };
            }

            const { data } = await db.from('referrals')
                .select('referral_code, uses, reward_months, created_at')
                .eq('referrer_email', user_email)
                .limit(1);

            if (!data || data.length === 0) {
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        referral_code: null,
                        total_referrals: 0,
                        reward_months: 0
                    })
                };
            }

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    referral_code: data[0].referral_code,
                    share_url: `https://kelionai.app/subscribe.html?ref=${data[0].referral_code}`,
                    total_referrals: data[0].uses || 0,
                    reward_months: data[0].reward_months || 0,
                    created_at: data[0].created_at
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: generate, track, rewards, status' }) };

    } catch (err) {
        console.error('[REFERRAL] Error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
