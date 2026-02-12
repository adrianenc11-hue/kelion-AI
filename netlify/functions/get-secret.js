/**
 * Secrets Vault Helper — Fetches API keys from Supabase instead of process.env
 * 
 * Features:
 * - In-memory cache (survives Lambda warm starts)
 * - Bulk fetch on first call (1 query loads ALL secrets)
 * - Fallback to process.env if Supabase unavailable
 * - TTL of 5 minutes (auto-refresh)
 * 
 * Usage:
 *   const { getSecret, getSecrets } = require('./get-secret');
 *   const key = await getSecret('OPENAI_API_KEY');
 *   const { OPENAI_API_KEY, GEMINI_API_KEY } = await getSecrets(['OPENAI_API_KEY', 'GEMINI_API_KEY']);
 */

const { createClient } = require('@supabase/supabase-js');

// ═══ CACHE ═══
let _cache = {};
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ═══ SUPABASE CLIENT (lazy init) ═══
let _supabase = null;
function getSupabase() {
    if (!_supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        if (url && key) {
            _supabase = createClient(url, key);
        }
    }
    return _supabase;
}

// ═══ BULK LOAD ALL SECRETS ═══
async function loadSecrets() {
    const now = Date.now();

    // Return cache if fresh
    if (Object.keys(_cache).length > 0 && (now - _cacheTime) < CACHE_TTL) {
        return _cache;
    }

    const supabase = getSupabase();
    if (!supabase) {
        console.warn('[secrets] No Supabase client — using process.env fallback');
        return {};
    }

    try {
        const { data, error } = await supabase
            .from('app_secrets')
            .select('key_name, key_value');

        if (error) {
            console.error('[secrets] Supabase error:', error.message);
            return _cache; // Return stale cache on error
        }

        // Build cache map
        _cache = {};
        for (const row of data || []) {
            _cache[row.key_name] = row.key_value;
        }
        _cacheTime = now;

        console.log(`[secrets] Loaded ${Object.keys(_cache).length} secrets from vault`);
        return _cache;
    } catch (err) {
        console.error('[secrets] Failed to load:', err.message);
        return _cache; // Return stale cache
    }
}

// ═══ GET SINGLE SECRET ═══
async function getSecret(keyName) {
    // 1. Try cache first
    const secrets = await loadSecrets();
    if (secrets[keyName]) return secrets[keyName];

    // 2. Fallback to process.env
    return process.env[keyName] || null;
}

// ═══ GET MULTIPLE SECRETS ═══
async function getSecrets(keyNames) {
    const secrets = await loadSecrets();
    const result = {};
    for (const key of keyNames) {
        result[key] = secrets[key] || process.env[key] || null;
    }
    return result;
}

// ═══ PATCH process.env WITH VAULT SECRETS ═══
// Call this at the start of any function handler to inject vault secrets
// into process.env. Existing env vars are NOT overwritten (env takes priority).
async function patchProcessEnv() {
    const secrets = await loadSecrets();
    for (const [key, value] of Object.entries(secrets)) {
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
    return Object.keys(secrets).length;
}

// ═══ ADD OR UPDATE A SECRET ═══
async function addSecret(keyName, keyValue, category = 'api_key', description = '') {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
        .from('app_secrets')
        .upsert({
            key_name: keyName,
            key_value: keyValue,
            category,
            description
        }, { onConflict: 'key_name' });

    if (error) {
        console.error('[secrets] Failed to add secret:', error.message);
        return false;
    }

    // Invalidate cache
    _cacheTime = 0;
    return true;
}

// ═══ ALSO EXPOSE AS STANDALONE FUNCTION ENDPOINT ═══
// POST /.netlify/functions/get-secret { action: "health" }
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // Only allow health check — never expose secrets via HTTP
    try {
        const body = JSON.parse(event.body || '{}');

        if (body.action === 'health') {
            const secrets = await loadSecrets();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    ok: true,
                    vault_keys: Object.keys(secrets).length,
                    cache_age_sec: Math.round((Date.now() - _cacheTime) / 1000),
                    fallback: Object.keys(secrets).length === 0 ? 'process.env' : 'supabase'
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Only health action allowed' })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};

// ═══ EXPORTS FOR OTHER FUNCTIONS ═══
module.exports.getSecret = getSecret;
module.exports.getSecrets = getSecrets;
module.exports.loadSecrets = loadSecrets;
module.exports.patchProcessEnv = patchProcessEnv;
module.exports.addSecret = addSecret;
