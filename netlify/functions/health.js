// ============================================================================
// Health Check — Combined monitoring endpoint for Kelion AI
// GET /api/health — Tests critical services + env var presence
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    const startTime = Date.now();
    const checks = {};

    // 1. Check Supabase connection (live query)
    try {
        await patchProcessEnv(); // Load vault secrets
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        if (url && key) {
            const supabase = createClient(url, key);
            const { error } = await supabase.from('users').select('id').limit(1);
            checks.supabase = error ? { status: 'fail', error: error.message } : { status: 'ok' };
        } else {
            checks.supabase = { status: 'fail', error: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set' };
        }
    } catch (e) {
        checks.supabase = { status: 'fail', error: e.message };
    }

    // 2. Check critical env vars
    const requiredKeys = {
        jwt: 'JWT_SECRET',
        openai: 'OPENAI_API_KEY',
        supabase_url: 'SUPABASE_URL',
        supabase_key: 'SUPABASE_SERVICE_KEY'
    };

    const optionalKeys = {
        gemini: 'GEMINI_API_KEY',
        deepgram: 'DEEPGRAM_API_KEY',
        stripe: 'STRIPE_SECRET_KEY',
        openweather: 'OPENWEATHER_API_KEY',
        replicate: 'REPLICATE_API_TOKEN',
        deepseek: 'DEEPSEEK_API_KEY',
        paypal_client: 'PAYPAL_CLIENT_ID',
        resend: 'RESEND_API_KEY'
    };

    // Required keys — failures affect overall status
    for (const [name, envVar] of Object.entries(requiredKeys)) {
        checks[name] = process.env[envVar] ? { status: 'ok' } : { status: 'fail', error: `${envVar} not set` };
    }

    // Optional keys — won't cause unhealthy, but reported
    const optionalStatus = {};
    for (const [name, envVar] of Object.entries(optionalKeys)) {
        optionalStatus[name] = { configured: !!process.env[envVar], env_var: envVar };
    }

    // Calculate overall status
    const criticalFails = Object.values(checks).filter(c => c.status === 'fail').length;
    const responseTime = Date.now() - startTime;
    const overallStatus = criticalFails === 0 ? 'healthy' : 'unhealthy';

    return {
        statusCode: overallStatus === 'healthy' ? 200 : 503,
        headers,
        body: JSON.stringify({
            status: overallStatus,
            version: 'v1.6',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            critical_checks: checks,
            critical_failures: criticalFails,
            optional_services: optionalStatus
        })
    };
};
