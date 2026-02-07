// Check if IP/fingerprint has active subscription or registered user
// Returns user status to determine flow after GDPR

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Fingerprint',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Get client IP
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['client-ip'] ||
        'unknown';

    const fingerprint = event.headers['x-fingerprint'] || '';
    const identifier = `${clientIP}_${fingerprint}`.substring(0, 100);

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check if this IP has a registered user with active subscription
        const { data: ipRecord } = await supabase
            .from('user_devices')
            .select('user_id')
            .eq('ip_address', clientIP)
            .single();

        if (ipRecord?.user_id) {
            // Check if user has active subscription
            const { data: user } = await supabase
                .from('users')
                .select('email, subscription_status, role')
                .eq('id', ipRecord.user_id)
                .single();

            if (user && (user.subscription_status === 'active' ||
                user.subscription_status === 'lifetime' ||
                user.role === 'admin')) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        hasSubscription: true,
                        needsLogin: true,
                        email: user.email,
                        message: 'Subscription found for this device'
                    })
                };
            }
        }

        // Check free trial usage
        const { data: trialUsage } = await supabase
            .from('free_trial_usage')
            .select('seconds_used, blocked')
            .eq('identifier', identifier)
            .single();

        const FREE_TRIAL_SECONDS = 60 * 60; // 60 minutes

        if (trialUsage) {
            const remainingSeconds = Math.max(0, FREE_TRIAL_SECONDS - trialUsage.seconds_used);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    hasSubscription: false,
                    needsLogin: false,
                    trialBlocked: trialUsage.blocked || remainingSeconds <= 0,
                    remainingSeconds,
                    message: remainingSeconds > 0 ? 'Free trial active' : 'Free trial expired'
                })
            };
        }

        // New user - full trial available
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                hasSubscription: false,
                needsLogin: false,
                trialBlocked: false,
                remainingSeconds: FREE_TRIAL_SECONDS,
                isNew: true,
                message: 'New user - full trial available'
            })
        };

    } catch (error) {
        console.error('Check user error:', error);
        // On error, allow access to app with trial
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                hasSubscription: false,
                needsLogin: false,
                trialBlocked: false,
                error: error.message
            })
        };
    }
};
