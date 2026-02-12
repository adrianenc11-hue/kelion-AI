// Brain Memory — Long-term conversation storage (Hippocampus)
// Saves/loads/searches conversation context via Supabase
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);

        const parsed = JSON.parse(event.body || '{}');
        const { action, user_email } = parsed;

        // ═══ SAVE: Store conversation turn ═══
        if (action === 'save') {
            const { messages, session_id, emotion, query_type } = parsed;
            if (!messages || !Array.isArray(messages)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };

            const record = {
                user_email: user_email || 'anonymous',
                session_id: session_id || Date.now().toString(),
                messages: JSON.stringify(messages.slice(-20)), // Keep last 20
                query_type: query_type || 'general',
                emotion: emotion || 'neutral',
                created_at: new Date().toISOString()
            };

            const { error } = await supabase.from('brain_memory').insert(record);

            // If table doesn't exist, try creating it via RPC or just log
            if (error && error.code === '42P01') {
                console.log('[BRAIN-MEMORY] Table brain_memory does not exist — using localStorage fallback');
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, fallback: 'localStorage', message: 'Table not created yet' }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Memory saved' }) };
        }

        // ═══ LOAD: Get recent conversations ═══
        if (action === 'load') {
            const limit = parsed.limit || 10;
            const { data, error } = await supabase
                .from('brain_memory')
                .select('*')
                .eq('user_email', user_email || 'anonymous')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error && error.code === '42P01') {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: [], fallback: 'no table' }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: data || [] }) };
        }

        // ═══ RECALL: Search memories by keyword ═══
        if (action === 'recall') {
            const { keyword } = parsed;
            if (!keyword) return { statusCode: 400, headers, body: JSON.stringify({ error: 'keyword required' }) };

            const { data, error } = await supabase
                .from('brain_memory')
                .select('*')
                .eq('user_email', user_email || 'anonymous')
                .ilike('messages', `%${keyword}%`)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error && error.code === '42P01') {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: [], fallback: 'no table' }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories: data || [], keyword }) };
        }

        // ═══ STATS: Get memory statistics ═══
        if (action === 'stats') {
            const { data, error } = await supabase
                .from('brain_memory')
                .select('id, query_type, emotion, created_at')
                .eq('user_email', user_email || 'anonymous')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error && error.code === '42P01') {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: { total: 0, fallback: true } }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

            // Compute stats
            const total = (data || []).length;
            const byType = {};
            const byEmotion = {};
            (data || []).forEach(m => {
                byType[m.query_type] = (byType[m.query_type] || 0) + 1;
                byEmotion[m.emotion] = (byEmotion[m.emotion] || 0) + 1;
            });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: { total, byType, byEmotion } }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: save, load, recall, stats' }) };
    } catch (error) {
        console.error('Brain memory error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
