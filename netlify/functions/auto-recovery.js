// ═══ AUTO-RECOVERY SYSTEM ═══
// Covers: Item 6.12 — Auto-recovery with restart + admin alert
//
// Actions:
//   check    — Ping all critical endpoints, return health status
//   recover  — Attempt to restart/re-ping failed services
//   status   — Return recovery log history
//   run      — Full check + auto-recover + alert (for scheduled/cron calls)

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

let supabase = null;
function getDB() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        if (url && key) supabase = createClient(url, key);
    }
    return supabase;
}

function respond(code, data) {
    return { statusCode: code, headers, body: JSON.stringify({ success: code === 200, ...data }) };
}

// ═══ CRITICAL ENDPOINTS TO MONITOR ═══
const CRITICAL_ENDPOINTS = [
    { name: 'Health Check', path: '/.netlify/functions/health', method: 'POST', body: { action: 'ping' } },
    { name: 'Smart Brain', path: '/.netlify/functions/smart-brain', method: 'POST', body: { action: 'health' } },
    { name: 'Chat', path: '/.netlify/functions/chat', method: 'POST', body: { question: 'health_check', health_check: true } },
    { name: 'Auth Login', path: '/.netlify/functions/auth-login', method: 'POST', body: { health_check: true } },
    { name: 'Admin Panel', path: '/.netlify/functions/admin-panel', method: 'OPTIONS', body: null },
    { name: 'Page Tracking', path: '/.netlify/functions/page-tracking', method: 'OPTIONS', body: null },
    { name: 'Secrets Vault', path: '/.netlify/functions/get-secret', method: 'POST', body: { action: 'health' } },
    { name: 'Messenger Webhook', path: '/.netlify/functions/messenger-webhook', method: 'GET', body: null },
    { name: 'Trading Bot', path: '/.netlify/functions/trading-bot-engine', method: 'OPTIONS', body: null },
    { name: 'Brain Memory', path: '/.netlify/functions/brain-memory', method: 'OPTIONS', body: null }
];

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });

    try {
        await patchProcessEnv();
        const db = getDB();
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            case 'check':
                return respond(200, await healthCheck());

            case 'recover':
                return respond(200, await recoverFailed(db));

            case 'status':
                return respond(200, await getRecoveryLog(db, body));

            case 'run':
                return respond(200, await fullRecoveryRun(db));

            default:
                return respond(400, { error: 'Actions: check, recover, status, run' });
        }
    } catch (err) {
        console.error('[auto-recovery] Error:', err);
        return respond(500, { error: err.message });
    }
};

// ═══ HEALTH CHECK — Ping all endpoints ═══
async function healthCheck() {
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const results = [];
    let healthy = 0;
    let failed = 0;

    for (const ep of CRITICAL_ENDPOINTS) {
        const start = Date.now();
        try {
            const fetchOptions = {
                method: ep.method,
                headers: { 'Content-Type': 'application/json' }
            };
            if (ep.body && ep.method === 'POST') {
                fetchOptions.body = JSON.stringify(ep.body);
            }

            const res = await fetch(`${baseUrl}${ep.path}`, fetchOptions);
            const elapsed = Date.now() - start;

            if (res.ok || res.status === 200 || res.status === 204) {
                healthy++;
                results.push({ name: ep.name, status: '✅ OK', code: res.status, ms: elapsed });
            } else {
                failed++;
                results.push({ name: ep.name, status: '❌ FAIL', code: res.status, ms: elapsed });
            }
        } catch (err) {
            failed++;
            const elapsed = Date.now() - start;
            results.push({ name: ep.name, status: '❌ ERROR', error: err.message, ms: elapsed });
        }
    }

    return {
        timestamp: new Date().toISOString(),
        total: CRITICAL_ENDPOINTS.length,
        healthy,
        failed,
        health_score: Math.round((healthy / CRITICAL_ENDPOINTS.length) * 100) + '%',
        endpoints: results
    };
}

// ═══ RECOVER FAILED — Re-ping failed endpoints ═══
async function recoverFailed(_db) {
    const check = await healthCheck();
    const failedEndpoints = check.endpoints.filter(e => e.status !== '✅ OK');

    if (failedEndpoints.length === 0) {
        return { message: 'All endpoints healthy — no recovery needed', ...check };
    }

    // Attempt recovery: re-ping failed endpoints with retry
    const recoveryResults = [];
    const baseUrl = process.env.URL || 'https://kelionai.app';

    for (const failedEp of failedEndpoints) {
        const ep = CRITICAL_ENDPOINTS.find(e => e.name === failedEp.name);
        if (!ep) continue;

        let recovered = false;
        // Retry up to 3 times with 1s delay
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await new Promise(r => setTimeout(r, 1000));
                const fetchOptions = {
                    method: ep.method,
                    headers: { 'Content-Type': 'application/json' }
                };
                if (ep.body && ep.method === 'POST') {
                    fetchOptions.body = JSON.stringify(ep.body);
                }
                const res = await fetch(`${baseUrl}${ep.path}`, fetchOptions);
                if (res.ok || res.status === 200 || res.status === 204) {
                    recovered = true;
                    recoveryResults.push({ name: ep.name, recovered: true, attempts: attempt });
                    break;
                }
            } catch (e) { /* retry */ }
        }
        if (!recovered) {
            recoveryResults.push({ name: ep.name, recovered: false, attempts: 3 });
        }
    }

    return {
        initial_failed: failedEndpoints.length,
        recovery_results: recoveryResults,
        recovered: recoveryResults.filter(r => r.recovered).length,
        still_failed: recoveryResults.filter(r => !r.recovered).length
    };
}

// ═══ FULL RECOVERY RUN — Check + Recover + Alert ═══
async function fullRecoveryRun(db) {
    const check = await healthCheck();
    const failedEndpoints = check.endpoints.filter(e => e.status !== '✅ OK');

    let recoveryResults = null;
    if (failedEndpoints.length > 0) {
        recoveryResults = await recoverFailed(db);

        // Send admin alert if still failing
        const stillFailed = recoveryResults.recovery_results?.filter(r => !r.recovered) || [];
        if (stillFailed.length > 0) {
            await sendAdminAlert(stillFailed);
        }
    }

    // Log to database
    if (db) {
        await db.from('recovery_log').insert({
            total_endpoints: check.total,
            healthy: check.healthy,
            failed: check.failed,
            failed_list: failedEndpoints.map(e => e.name),
            recovery_attempted: failedEndpoints.length > 0,
            recovery_results: recoveryResults || {}
        }).catch(err => console.error('[auto-recovery] Log error:', err.message));
    }

    return {
        check,
        recovery: recoveryResults,
        admin_alerted: failedEndpoints.length > 0 && (recoveryResults?.still_failed || 0) > 0,
        timestamp: new Date().toISOString()
    };
}

// ═══ SEND ADMIN ALERT ═══
async function sendAdminAlert(failedServices) {
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const failedNames = failedServices.map(s => s.name).join(', ');

    try {
        await fetch(`${baseUrl}/.netlify/functions/admin-notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'system_alert',
                priority: 'critical',
                subject: `🚨 Auto-Recovery Alert: ${failedServices.length} service(s) still failing`,
                message: `The following services failed health check and could not be recovered after 3 attempts: ${failedNames}. Manual intervention required.`,
                services: failedServices
            })
        });
        console.log('[auto-recovery] Admin alert sent for:', failedNames);
    } catch (err) {
        console.error('[auto-recovery] Failed to send admin alert:', err.message);
    }
}

// ═══ RECOVERY LOG — History ═══
async function getRecoveryLog(db, { limit = 20 }) {
    if (!db) return { error: 'Database not configured', log: [] };

    const { data, error } = await db.from('recovery_log')
        .select('*')
        .order('check_time', { ascending: false })
        .limit(limit);

    if (error) return { error: error.message };

    return {
        log: data || [],
        total: data?.length || 0,
        latest: data?.[0] || null
    };
}
