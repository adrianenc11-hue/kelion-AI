// Track free trial usage by IP address
// Stores time used in Supabase and prevents localStorage bypass

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

const FREE_TRIAL_SECONDS = 60 * 60; // 60 minutes in seconds

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Fingerprint',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Get client IP
    const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['client-ip'] ||
        'unknown';

    // Get browser fingerprint from header (optional extra security)
    const fingerprint = event.headers['x-fingerprint'] || '';

    // Create unique identifier
    const identifier = `${clientIP}_${fingerprint}`.substring(0, 100);

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        if (event.httpMethod === 'GET') {
            // Check remaining time
            const { data: usage } = await supabase
                .from('free_trial_usage')
                .select('seconds_used, last_activity, blocked')
                .eq('identifier', identifier)
                .single();

            if (!usage) {
                // New user - full 60 minutes
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        remainingSeconds: FREE_TRIAL_SECONDS,
                        totalSeconds: FREE_TRIAL_SECONDS,
                        blocked: false,
                        isNew: true
                    })
                };
            }

            const remainingSeconds = Math.max(0, FREE_TRIAL_SECONDS - usage.seconds_used);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    remainingSeconds,
                    totalSeconds: FREE_TRIAL_SECONDS,
                    blocked: usage.blocked || remainingSeconds <= 0,
                    secondsUsed: usage.seconds_used
                })
            };
        }

        if (event.httpMethod === 'POST') {
            // Update time used
            const body = JSON.parse(event.body || '{}');
            const secondsToAdd = Math.min(body.seconds || 0, 300); // Max 5 min per update

            // Get current usage
            const { data: existing } = await supabase
                .from('free_trial_usage')
                .select('seconds_used')
                .eq('identifier', identifier)
                .single();

            if (existing) {
                const newTotal = existing.seconds_used + secondsToAdd;
                const blocked = newTotal >= FREE_TRIAL_SECONDS;

                await supabase
                    .from('free_trial_usage')
                    .update({
                        seconds_used: newTotal,
                        last_activity: new Date().toISOString(),
                        blocked
                    })
                    .eq('identifier', identifier);

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        remainingSeconds: Math.max(0, FREE_TRIAL_SECONDS - newTotal),
                        blocked,
                        secondsUsed: newTotal
                    })
                };
            } else {
                // Create new record
                await supabase
                    .from('free_trial_usage')
                    .insert({
                        identifier,
                        ip_address: clientIP,
                        fingerprint: fingerprint || null,
                        seconds_used: secondsToAdd,
                        last_activity: new Date().toISOString(),
                        blocked: false
                    });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        remainingSeconds: FREE_TRIAL_SECONDS - secondsToAdd,
                        blocked: false,
                        secondsUsed: secondsToAdd
                    })
                };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Free trial error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
