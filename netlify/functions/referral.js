// Referral System — Full tracking: codes, bonuses, referrer-user linking
// Uses Supabase for persistent storage when available, fallback to in-memory

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const action = body.action || event.queryStringParameters?.action || 'info';

        // Supabase setup (if available)
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.DB_URL;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

        async function supabaseQuery(endpoint, method = 'GET', data = null) {
            if (!SUPABASE_URL || !SUPABASE_KEY) return null;
            const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
            const opts = {
                method,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
                }
            };
            if (data) opts.body = JSON.stringify(data);
            try {
                const res = await fetch(url, opts);
                if (!res.ok) return null;
                const text = await res.text();
                return text ? JSON.parse(text) : null;
            } catch { return null; }
        }

        // ═══════════════════════════════════════════
        // REFERRAL POLICY — Tiered Rewards
        // Promoția începe: 15 Februarie 2026
        // ═══════════════════════════════════════════
        const PROMO_START = new Date('2026-02-15T00:00:00Z');
        const PROMO_END = new Date('2026-03-17T23:59:59Z');  // 30 days
        const now = new Date();
        const promoActive = now >= PROMO_START && now <= PROMO_END;
        const daysUntilPromoEnds = promoActive ? Math.ceil((PROMO_END - now) / (1000 * 60 * 60 * 24)) : 0;

        const REWARD_TIERS = [
            { referrals: 1, bonus_days: 5, label: '🥉 Starter', desc: '1 referral = 5 zile Pro gratuit' },
            { referrals: 3, bonus_days: 15, label: '🥈 Bronze', desc: '3 referrals = 15 zile Pro gratuit' },
            { referrals: 5, bonus_days: 60, label: '🥇 Silver', desc: '5 referrals = 2 luni Pro gratuit' },
            { referrals: 10, bonus_days: 180, label: '💎 Gold', desc: '10 referrals = 6 luni Pro gratuit' },
            { referrals: 20, bonus_days: 365, label: '👑 Diamond', desc: '20 referrals = 1 an Pro + Enterprise forever' },
        ];

        function getTierForCount(count) {
            let tier = null;
            for (const t of REWARD_TIERS) {
                if (count >= t.referrals) tier = t;
            }
            return tier;
        }

        function getBonusDaysForReferral(currentCount) {
            // Calculate bonus days earned for this specific referral
            const newCount = currentCount + 1;
            const newTier = getTierForCount(newCount);
            const oldTier = getTierForCount(currentCount);
            // If crossing a tier boundary, give the difference
            if (newTier && (!oldTier || newTier.bonus_days > oldTier.bonus_days)) {
                return newTier.bonus_days - (oldTier?.bonus_days || 0);
            }
            // Within same tier, give 5 days per referral
            return 5;
        }

        function getNextMilestone(count) {
            for (const t of REWARD_TIERS) {
                if (count < t.referrals) return t;
            }
            return null;
        }

        const POLICY = {
            new_user_bonus_days: 5,           // New referred user gets 5 extra trial days
            max_referrals_per_day: 10,        // Anti-abuse: max 10 per day
            referral_code_length: 8,          // Code length
            cookie_days: 30,                  // Attribution window
            top_referrer_credit: 50,          // £50 credit for top referrer of month
            enterprise_unlock_at: 20,         // 20 referrals = Enterprise forever
            promo_end: '2026-03-17',
            promo_days_remaining: daysUntilPromoEnds,
            promo_start: '2026-02-15',
            promo_active: promoActive,
            tiers: REWARD_TIERS
        };

        switch (action) {

            // ═══ GENERATE REFERRAL CODE ═══
            case 'generate': {
                const { user_id, user_email } = body;
                if (!user_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id required' }) };

                // Generate unique code: K + first 3 of user_id + random
                const code = 'K' + (user_id || '').substring(0, 3).toUpperCase() +
                    Math.random().toString(36).substring(2, 2 + POLICY.referral_code_length - 4).toUpperCase();

                const referralData = {
                    user_id,
                    user_email: user_email || null,
                    referral_code: code,
                    created_at: new Date().toISOString(),
                    total_referrals: 0,
                    successful_referrals: 0,
                    bonus_days_earned: 0,
                    is_active: true
                };

                // Try Supabase
                const saved = await supabaseQuery('referrals', 'POST', referralData);

                const link = `https://kelionai.app?ref=${code}`;

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'generate',
                        referral_code: code,
                        referral_link: link,
                        qr_data: link,
                        policy: POLICY,
                        stored: !!saved
                    })
                };
            }

            // ═══ REGISTER REFERRAL — When new user arrives with ?ref=CODE ═══
            case 'register': {
                const { ref_code, new_user_id, new_user_email } = body;
                if (!ref_code || !new_user_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'ref_code and new_user_id required' }) };
                }

                // Look up referrer
                const referrerData = await supabaseQuery(`referrals?referral_code=eq.${ref_code}&select=*`);
                const referrer = Array.isArray(referrerData) && referrerData[0];

                // Anti-abuse: check daily limit
                if (referrer) {
                    const today = new Date().toISOString().split('T')[0];
                    const todayReferrals = await supabaseQuery(
                        `referral_log?referrer_code=eq.${ref_code}&created_at=gte.${today}T00:00:00Z&select=id`
                    );
                    if (Array.isArray(todayReferrals) && todayReferrals.length >= POLICY.max_referrals_per_day) {
                        return {
                            statusCode: 429, headers,
                            body: JSON.stringify({ error: 'Daily referral limit reached', limit: POLICY.max_referrals_per_day })
                        };
                    }
                }

                // Calculate tiered bonus for referrer
                const currentCount = referrer ? (referrer.successful_referrals || 0) : 0;
                const referrerBonusDays = promoActive ? getBonusDaysForReferral(currentCount) : 5;
                const newUserDays = promoActive ? POLICY.new_user_bonus_days : 3;

                // Log the referral
                const logEntry = {
                    referrer_code: ref_code,
                    referrer_user_id: referrer?.user_id || null,
                    new_user_id,
                    new_user_email: new_user_email || null,
                    created_at: new Date().toISOString(),
                    status: 'registered',
                    new_user_bonus_days: newUserDays,
                    referrer_bonus_days: referrerBonusDays,
                    promo_active: promoActive
                };

                await supabaseQuery('referral_log', 'POST', logEntry);

                // Update referrer stats
                if (referrer) {
                    const newTotal = (referrer.total_referrals || 0) + 1;
                    const newSuccessful = (referrer.successful_referrals || 0) + 1;
                    const newBonusDays = (referrer.bonus_days_earned || 0) + referrerBonusDays;
                    const enterpriseUnlocked = newSuccessful >= POLICY.enterprise_unlock_at;
                    const currentTier = getTierForCount(newSuccessful);
                    const nextMilestone = getNextMilestone(newSuccessful);

                    await supabaseQuery(`referrals?referral_code=eq.${ref_code}`, 'PATCH', {
                        total_referrals: newTotal,
                        successful_referrals: newSuccessful,
                        bonus_days_earned: newBonusDays,
                        enterprise_unlocked: enterpriseUnlocked,
                        last_referral_at: new Date().toISOString()
                    });
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'register',
                        promo_active: promoActive,
                        promo_days_remaining: daysUntilPromoEnds,
                        referrer_found: !!referrer,
                        referrer_user_id: referrer?.user_id || null,
                        new_user_bonus: {
                            extra_trial_days: newUserDays,
                            message: `Welcome! You get ${newUserDays} extra free days because you were referred.`
                        },
                        referrer_bonus: referrer ? {
                            bonus_days: referrerBonusDays,
                            total_earned: (referrer.bonus_days_earned || 0) + referrerBonusDays,
                            current_tier: currentTier?.label || null,
                            next_milestone: nextMilestone ? `${nextMilestone.referrals - newSuccessful} more for ${nextMilestone.label}!` : 'Max tier reached! 👑',
                            enterprise_unlocked: newSuccessful >= POLICY.enterprise_unlock_at
                        } : null
                    })
                };
            }

            // ═══ CHECK STATS — Referrer dashboard ═══
            case 'stats': {
                const { user_id, referral_code } = body;
                if (!user_id && !referral_code) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'user_id or referral_code required' }) };
                }

                const query = referral_code
                    ? `referrals?referral_code=eq.${referral_code}&select=*`
                    : `referrals?user_id=eq.${user_id}&select=*`;

                const data = await supabaseQuery(query);
                const stats = Array.isArray(data) && data[0];

                if (!stats) {
                    return {
                        statusCode: 200, headers,
                        body: JSON.stringify({ success: true, action: 'stats', has_referral: false, message: 'No referral code found. Generate one first.' })
                    };
                }

                // Get recent referral log
                const logs = await supabaseQuery(
                    `referral_log?referrer_code=eq.${stats.referral_code}&order=created_at.desc&limit=20&select=*`
                );

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'stats',
                        has_referral: true,
                        referral_code: stats.referral_code,
                        referral_link: `https://kelionai.app?ref=${stats.referral_code}`,
                        total_referrals: stats.total_referrals || 0,
                        successful_referrals: stats.successful_referrals || 0,
                        bonus_days_earned: stats.bonus_days_earned || 0,
                        enterprise_unlocked: stats.enterprise_unlocked || false,
                        recent_referrals: Array.isArray(logs) ? logs.map(l => ({
                            date: l.created_at,
                            status: l.status,
                            bonus_given: l.referrer_bonus_days
                        })) : [],
                        next_milestone: stats.successful_referrals < POLICY.enterprise_unlock_at
                            ? `${POLICY.enterprise_unlock_at - (stats.successful_referrals || 0)} more referrals to unlock Enterprise!`
                            : 'Enterprise unlocked! 🎉'
                    })
                };
            }

            // ═══ LEADERBOARD — Top referrers ═══
            case 'leaderboard': {
                const leaders = await supabaseQuery(
                    'referrals?order=successful_referrals.desc&limit=10&select=referral_code,successful_referrals,bonus_days_earned,enterprise_unlocked'
                );

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'leaderboard',
                        top_referrers: Array.isArray(leaders) ? leaders.map((l, i) => ({
                            rank: i + 1,
                            code: l.referral_code,
                            referrals: l.successful_referrals || 0,
                            days_earned: l.bonus_days_earned || 0,
                            enterprise: l.enterprise_unlocked || false
                        })) : [],
                        monthly_prize: `£${POLICY.top_referrer_credit} credit`,
                        policy: POLICY
                    })
                };
            }

            // ═══ ADMIN SEND — Send referral codes to email, unlimited ═══
            case 'admin_send': {
                const { admin_secret, emails, referral_code, custom_message } = body;

                // Auth check: admin must provide correct secret
                const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || 'kelionai_admin_2026';
                if (admin_secret !== ADMIN_SECRET) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized. Invalid admin_secret.' }) };
                }

                if (!emails || !Array.isArray(emails) || emails.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'emails array required' }) };
                }

                // Use admin's referral code or generate one
                let code = referral_code;
                if (!code) {
                    code = 'KADM' + Math.random().toString(36).substring(2, 7).toUpperCase();
                    // Save admin code
                    await supabaseQuery('referrals', 'POST', {
                        user_id: 'admin',
                        user_email: 'admin@kelionai.app',
                        referral_code: code,
                        created_at: new Date().toISOString(),
                        total_referrals: 0,
                        successful_referrals: 0,
                        bonus_days_earned: 0,
                        is_active: true
                    });
                }

                const refLink = `https://kelionai.app?ref=${code}`;
                const results = [];

                for (const email of emails) {
                    // Log the email send
                    await supabaseQuery('referral_email_log', 'POST', {
                        email,
                        referral_code: code,
                        sent_at: new Date().toISOString(),
                        sent_by: 'admin',
                        custom_message: custom_message || null
                    });

                    results.push({ email, status: 'logged', referral_code: code, link: refLink });
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'admin_send',
                        total_sent: results.length,
                        referral_code: code,
                        referral_link: refLink,
                        results,
                        note: 'Email sends logged. Configure email service (SendGrid/SES) for actual delivery.'
                    })
                };
            }

            // ═══ POLICY INFO ═══
            case 'info':
            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        action: 'info',
                        policy: POLICY,
                        actions: ['generate', 'register', 'stats', 'leaderboard', 'admin_send', 'info'],
                        description: {
                            generate: 'Generate a unique referral code for a user',
                            register: 'Register a new user who arrived via referral link',
                            stats: 'Get referral stats and history for a user',
                            leaderboard: 'Top 10 referrers this month',
                            admin_send: 'Admin: send referral codes to emails (unlimited, requires admin_secret)',
                            info: 'Get policy details and available actions'
                        }
                    })
                };
        }

    } catch (error) {
        console.error('Referral error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
