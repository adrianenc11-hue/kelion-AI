// GDPR Cleanup - Remove user data per GDPR request
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { user_id, confirm } = JSON.parse(event.body || '{}');
        if (!user_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'User ID required' }) };
        if (!confirm) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Confirmation required', message: 'Set confirm: true to proceed with data deletion' }) };
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };

        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        await supabase.from('user_memories').delete().eq('user_id', user_id);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `User data deleted for ${user_id}`, gdpr_compliant: true }) };
    } catch (error) {
        console.error('GDPR cleanup error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
