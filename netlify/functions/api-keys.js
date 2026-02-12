/**
 * API Keys Manager — Generate, validate, and manage developer API keys
 * Actions: generate, validate, get_usage, list_keys, revoke, buy_credits
 * Keys stored in Supabase: api_keys + api_key_usage tables
 */

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Credit costs per endpoint (1 credit ≈ $0.001 value)
const CREDIT_COSTS = {
    'smart-brain': 1,      // 1 credit per text query
    'speak': 5,            // 5 credits per TTS call
    'elevenlabs-tts': 5,
    'generate-image': 12,  // 12 credits per DALL-E image
    'dalle': 12,
    'vision': 3,           // 3 credits per vision query
    'whisper': 2,          // 2 credits per STT minute
    'deep-research': 5
};

// Credit packages
const PACKAGES = {
    starter: { credits: 1000, price_usd: 5, per_credit: 0.005 },
    developer: { credits: 10000, price_usd: 40, per_credit: 0.004 },
    business: { credits: 100000, price_usd: 300, per_credit: 0.003 }
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

function generateApiKey() {
    const raw = crypto.randomBytes(24).toString('base64url');
    return `klion_${raw}`;
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {

            // ═══ GENERATE NEW API KEY ═══
            case 'generate': {
                const { email, name } = body;
                if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

                const apiKey = generateApiKey();
                const keyHash = hashKey(apiKey);
                const keyPrefix = apiKey.substring(0, 14); // klion_xxxxxxxx

                const { error } = await supabase.from('api_keys').insert({
                    key_hash: keyHash,
                    key_prefix: keyPrefix,
                    owner_email: email,
                    key_name: name || 'My API Key',
                    credits_remaining: 100, // 100 free credits to start
                    credits_total: 100,
                    status: 'active',
                    rate_limit: 60,
                    created_at: new Date().toISOString()
                });

                if (error) {
                    console.error('Key generation error:', error);
                    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to generate key' }) };
                }

                // Notify admin
                try {
                    const siteUrl = process.env.URL || 'https://kelionai.app';
                    const base = siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl;
                    fetch(`${base}/.netlify/functions/admin-notify`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'notify', event_type: 'new_api_key', data: { email, key_prefix: keyPrefix, name: name || 'My API Key' } })
                    }).catch(() => { });
                } catch (e) { console.warn('Admin notify failed:', e.message); }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        api_key: apiKey, // Only shown ONCE at generation
                        prefix: keyPrefix,
                        credits: 100,
                        message: '⚠️ Save this key — it cannot be shown again!'
                    })
                };
            }

            // ═══ VALIDATE KEY + CHECK CREDITS ═══
            case 'validate': {
                const { api_key, endpoint } = body;
                if (!api_key) return { statusCode: 401, headers, body: JSON.stringify({ error: 'API key required' }) };

                const keyHash = hashKey(api_key);
                const { data: keyData } = await supabase
                    .from('api_keys')
                    .select('*')
                    .eq('key_hash', keyHash)
                    .eq('status', 'active')
                    .single();

                if (!keyData) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or revoked API key' }) };

                const creditsNeeded = CREDIT_COSTS[endpoint] || 1;
                if (keyData.credits_remaining < creditsNeeded) {
                    return {
                        statusCode: 402, headers, body: JSON.stringify({
                            error: 'Insufficient credits',
                            credits_remaining: keyData.credits_remaining,
                            credits_needed: creditsNeeded,
                            buy_url: '/developers.html#credits'
                        })
                    };
                }

                // Deduct credits
                await supabase.from('api_keys').update({
                    credits_remaining: keyData.credits_remaining - creditsNeeded,
                    last_used_at: new Date().toISOString()
                }).eq('key_hash', keyHash);

                // Log usage
                await supabase.from('api_key_usage').insert({
                    key_prefix: keyData.key_prefix,
                    endpoint: endpoint || 'unknown',
                    credits_used: creditsNeeded,
                    created_at: new Date().toISOString()
                });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        valid: true,
                        credits_remaining: keyData.credits_remaining - creditsNeeded,
                        owner_email: keyData.owner_email
                    })
                };
            }

            // ═══ GET USAGE STATS ═══
            case 'get_usage': {
                const { api_key } = body;
                if (!api_key) return { statusCode: 401, headers, body: JSON.stringify({ error: 'API key required' }) };

                const keyHash = hashKey(api_key);
                const { data: keyData } = await supabase
                    .from('api_keys')
                    .select('key_prefix, credits_remaining, credits_total, created_at, last_used_at')
                    .eq('key_hash', keyHash)
                    .single();

                if (!keyData) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid API key' }) };

                // Get usage breakdown
                const { data: usage } = await supabase
                    .from('api_key_usage')
                    .select('endpoint, credits_used, created_at')
                    .eq('key_prefix', keyData.key_prefix)
                    .order('created_at', { ascending: false })
                    .limit(100);

                // Aggregate by endpoint
                const byEndpoint = {};
                (usage || []).forEach(u => {
                    if (!byEndpoint[u.endpoint]) byEndpoint[u.endpoint] = { calls: 0, credits: 0 };
                    byEndpoint[u.endpoint].calls++;
                    byEndpoint[u.endpoint].credits += u.credits_used;
                });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        credits_remaining: keyData.credits_remaining,
                        credits_total: keyData.credits_total,
                        credits_used: keyData.credits_total - keyData.credits_remaining,
                        by_endpoint: byEndpoint,
                        recent_calls: (usage || []).slice(0, 20),
                        created_at: keyData.created_at,
                        last_used_at: keyData.last_used_at
                    })
                };
            }

            // ═══ LIST KEYS (by email) ═══
            case 'list_keys': {
                const { email } = body;
                if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

                const { data: keys } = await supabase
                    .from('api_keys')
                    .select('key_prefix, key_name, credits_remaining, credits_total, status, created_at, last_used_at')
                    .eq('owner_email', email)
                    .order('created_at', { ascending: false });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, keys: keys || [] })
                };
            }

            // ═══ REVOKE KEY ═══
            case 'revoke': {
                const { api_key } = body;
                if (!api_key) return { statusCode: 400, headers, body: JSON.stringify({ error: 'API key required' }) };

                const keyHash = hashKey(api_key);
                await supabase.from('api_keys').update({ status: 'revoked' }).eq('key_hash', keyHash);

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Key revoked' }) };
            }

            // ═══ GET PRICING INFO ═══
            case 'get_pricing': {
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        credit_costs: CREDIT_COSTS,
                        packages: PACKAGES,
                        info: '1 credit ≈ 1 text query. See credit_costs for per-endpoint pricing.'
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        service: 'api-keys',
                        actions: ['generate', 'validate', 'get_usage', 'list_keys', 'revoke', 'get_pricing']
                    })
                };
        }
    } catch (error) {
        console.error('API Keys error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
