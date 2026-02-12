// ============================================================================
// Netlify Function: Audit Log
// POST /api/audit-log - Logs actions to audit_log table
// GET /api/audit-log - Retrieves logs (admin only)
// ============================================================================

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Lazy init — vault secrets loaded inside handler first
function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    return createClient(url, key);
}

function verifyToken(event) {
    const auth = event.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const user = verifyToken(event);
    const clientIp = event.headers['x-forwarded-for'] || 'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';

    try {
        await patchProcessEnv(); // Load vault secrets FIRST
        const supabase = getSupabase(); // NOW create client after vault loaded

        // POST: Log an action
        if (event.httpMethod === 'POST') {
            const { action, resource, details, success, error_message } = JSON.parse(event.body);

            const { error } = await supabase.from('audit_log').insert({
                action,
                resource,
                user_id: user?.sub || null,
                details,
                ip: clientIp,
                user_agent: userAgent.substring(0, 500),
                success: success !== false,
                error_message
            });

            if (error) throw error;
            return { statusCode: 200, headers, body: JSON.stringify({ logged: true }) };
        }

        // GET: Retrieve logs (admin only)
        if (event.httpMethod === 'GET') {
            if (!user || user.role !== 'admin') {
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin only' }) };
            }

            const limit = parseInt(event.queryStringParameters?.limit || '100');
            const action = event.queryStringParameters?.action;

            let query = supabase.from('audit_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (action) query = query.eq('action', action);

            const { data, error } = await query;
            if (error) throw error;

            return { statusCode: 200, headers, body: JSON.stringify({ logs: data }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        console.error('Audit log error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
