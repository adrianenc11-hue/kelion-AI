// ============================================================================
// Netlify Function: User Data CRUD
// GET/POST/PUT/DELETE /api/user-data
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(event) {
    const auth = event.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.split(' ')[1], JWT_SECRET);
    } catch {
        return null;
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Verify user is logged in
    const user = verifyToken(event);
    if (!user) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const userId = user.sub;

    try {
        await patchProcessEnv(); // Load vault secrets
        // GET: Retrieve user data
        if (event.httpMethod === 'GET') {
            const key = event.queryStringParameters?.key;

            let query = supabase.from('user_data').select('data_key, data_value').eq('user_id', userId);
            if (key) query = query.eq('data_key', key);

            const { data, error } = await query;
            if (error) throw error;

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
        }

        // POST/PUT: Store user data
        if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
            const { key, value } = JSON.parse(event.body);
            if (!key) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Key is required' }) };
            }

            const { error } = await supabase.from('user_data').upsert({
                user_id: userId,
                data_key: key,
                data_value: value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,data_key' });

            if (error) throw error;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // DELETE: Remove user data
        if (event.httpMethod === 'DELETE') {
            const { key } = JSON.parse(event.body);
            if (!key) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Key is required' }) };
            }

            const { error } = await supabase.from('user_data')
                .delete()
                .eq('user_id', userId)
                .eq('data_key', key);

            if (error) throw error;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    } catch (error) {
        console.error('User data error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
