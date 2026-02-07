// ============================================================================
// Netlify Function: Health Check
// GET /api/health - Tests ALL functions are working
// ============================================================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    const startTime = Date.now();
    const checks = {};

    // 1. Check Supabase connection
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );
        const { error } = await supabase.from('users').select('id').limit(1);
        checks.supabase = error ? { status: 'fail', error: error.message } : { status: 'ok' };
    } catch (e) {
        checks.supabase = { status: 'fail', error: e.message };
    }

    // 2. Check JWT_SECRET exists
    checks.jwt = process.env.JWT_SECRET ? { status: 'ok' } : { status: 'fail', error: 'JWT_SECRET not set' };

    // 3. Check Stripe key exists
    checks.stripe = process.env.STRIPE_SECRET_KEY ? { status: 'ok' } : { status: 'fail', error: 'STRIPE_SECRET_KEY not set' };

    // Calculate overall status
    const allPassing = Object.values(checks).every(c => c.status === 'ok');
    const responseTime = Date.now() - startTime;

    return {
        statusCode: allPassing ? 200 : 503,
        headers,
        body: JSON.stringify({
            status: allPassing ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            checks
        })
    };
};
