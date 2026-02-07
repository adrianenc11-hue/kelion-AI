/**
 * API Gateway — Public endpoint for developer API access
 * Authenticates via API key, routes to internal services, deducts credits
 * Features: rate limiting (Supabase-backed), response caching (in-memory TTL)
 * 
 * Usage:
 *   POST /.netlify/functions/api-gateway
 *   Headers: Authorization: Bearer klion_xxxxxxxxxxxx
 *   Body: { "service": "smart-brain", "params": { "question": "Hello" } }
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const CREDIT_COSTS = {
    'smart-brain': 1,
    'speak': 5,
    'elevenlabs-tts': 5,
    'generate-image': 12,
    'dalle': 12,
    'vision': 3,
    'whisper': 2
};

const ALLOWED_SERVICES = ['smart-brain', 'speak', 'generate-image', 'vision', 'whisper'];

// ═══ IN-MEMORY RESPONSE CACHE (5 min TTL) ═══
const CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHEABLE_SERVICES = ['smart-brain']; // Only cache text queries

function getCacheKey(service, params) {
    const normalized = JSON.stringify({ service, q: params?.question || params?.text || '' });
    return crypto.createHash('md5').update(normalized).digest('hex');
}

function getCache(key) {
    const entry = CACHE.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > CACHE_TTL) { CACHE.delete(key); return null; }
    return entry.data;
}

function setCache(key, data) {
    // Keep cache small — max 200 entries
    if (CACHE.size > 200) {
        const oldest = CACHE.keys().next().value;
        CACHE.delete(oldest);
    }
    CACHE.set(key, { data, ts: Date.now() });
}

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    // ═══ AUTHENTICATE ═══
    const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
    const apiKey = authHeader.replace('Bearer ', '').trim();

    if (!apiKey || !apiKey.startsWith('klion_')) {
        return {
            statusCode: 401, headers, body: JSON.stringify({
                error: 'Missing or invalid API key',
                help: 'Add header: Authorization: Bearer klion_your_key_here',
                get_key: 'https://kelionai.app/developers.html'
            })
        };
    }

    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Service temporarily unavailable' }) };

    // Validate key
    const keyHash = hashKey(apiKey);
    const { data: keyData } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key_hash', keyHash)
        .eq('status', 'active')
        .single();

    if (!keyData) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or revoked API key' }) };
    }

    // ═══ RATE LIMITING ═══
    const rateLimit = keyData.rate_limit || 60; // requests per minute
    const oneMinAgo = new Date(Date.now() - 60000).toISOString();

    const { count: recentRequests } = await supabase
        .from('api_key_usage')
        .select('id', { count: 'exact', head: true })
        .eq('key_prefix', keyData.key_prefix)
        .gte('created_at', oneMinAgo);

    if (recentRequests >= rateLimit) {
        return {
            statusCode: 429,
            headers: { ...headers, 'Retry-After': '60' },
            body: JSON.stringify({
                error: 'Rate limit exceeded',
                limit: rateLimit,
                window: '1 minute',
                retry_after: 60
            })
        };
    }

    // ═══ PARSE REQUEST ═══
    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { service, params } = body;

    if (!service || !ALLOWED_SERVICES.includes(service)) {
        return {
            statusCode: 400, headers, body: JSON.stringify({
                error: `Invalid service. Allowed: ${ALLOWED_SERVICES.join(', ')}`,
                docs: 'https://kelionai.app/developers.html#docs'
            })
        };
    }

    // ═══ CHECK CREDITS ═══
    const creditsNeeded = CREDIT_COSTS[service] || 1;
    if (keyData.credits_remaining < creditsNeeded) {
        return {
            statusCode: 402, headers, body: JSON.stringify({
                error: 'Insufficient credits',
                credits_remaining: keyData.credits_remaining,
                credits_needed: creditsNeeded,
                buy_credits: 'https://kelionai.app/developers.html#credits'
            })
        };
    }

    // ═══ CHECK CACHE (text queries only) ═══
    if (CACHEABLE_SERVICES.includes(service) && params?.question) {
        const cacheKey = getCacheKey(service, params);
        const cached = getCache(cacheKey);
        if (cached) {
            // Return cached — NO credit deduction (free!)
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    service,
                    result: cached,
                    credits: { used: 0, remaining: keyData.credits_remaining },
                    cached: true
                })
            };
        }
    }

    // ═══ ROUTE TO SERVICE ═══
    const siteUrl = process.env.URL || 'https://kelionai.app';
    const baseUrl = `${siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl}/.netlify/functions`;

    try {
        const serviceParams = {
            ...params,
            user_email: keyData.owner_email,
            _via_gateway: true
        };

        const response = await fetch(`${baseUrl}/${service}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serviceParams)
        });

        const result = await response.json();

        // ═══ CACHE RESPONSE ═══
        if (CACHEABLE_SERVICES.includes(service) && params?.question && response.status === 200) {
            setCache(getCacheKey(service, params), result);
        }

        // ═══ DEDUCT CREDITS + LOG USAGE ═══
        await supabase.from('api_keys').update({
            credits_remaining: keyData.credits_remaining - creditsNeeded,
            last_used_at: new Date().toISOString()
        }).eq('key_hash', keyHash);

        await supabase.from('api_key_usage').insert({
            key_prefix: keyData.key_prefix,
            endpoint: service,
            credits_used: creditsNeeded,
            created_at: new Date().toISOString()
        });

        // ═══ RETURN RESPONSE ═══
        return {
            statusCode: response.status, headers,
            body: JSON.stringify({
                success: true,
                service,
                result,
                credits: {
                    used: creditsNeeded,
                    remaining: keyData.credits_remaining - creditsNeeded
                }
            })
        };

    } catch (error) {
        console.error('Gateway error:', error);
        return {
            statusCode: 502, headers, body: JSON.stringify({
                error: 'Service call failed',
                service,
                message: error.message
            })
        };
    }
};
