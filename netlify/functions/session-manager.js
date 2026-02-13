// Session Manager — Structured session storage for K Teaching Planner
// Actions: save_session, list_sessions, load_session, delete_session, create_plan
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !SB_KEY) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };
        }
        const supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        const parsed = JSON.parse(event.body || '{}');
        const { action, user_email, fingerprint } = parsed;
        const userId = user_email || 'anonymous';

        // ═══ SAVE SESSION — store a completed or in-progress session ═══
        if (action === 'save_session') {
            const { title, category, subject, plan, messages, monitor_html,
                session_number, total_sessions, duration_ms, message_count,
                status, parent_plan_id } = parsed;

            if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'title required' }) };
            if (!messages || !Array.isArray(messages)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };

            const record = {
                user_email: userId,
                fingerprint: fingerprint || null,
                title: title.substring(0, 200),
                category: category || 'general',
                subject: subject || null,
                plan: plan || null,
                messages: JSON.stringify(messages),
                monitor_html: monitor_html || null,
                session_number: session_number || 1,
                total_sessions: total_sessions || 1,
                duration_ms: duration_ms || 0,
                message_count: message_count || messages.length,
                status: status || 'completed',
                parent_plan_id: parent_plan_id || null,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase.from('k_sessions').insert(record).select('id').single();

            if (error && error.code === '42P01') {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, fallback: true, message: 'Table not created yet — using localStorage' }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, session_id: data?.id, message: 'Session saved' }) };
        }

        // ═══ LIST SESSIONS — grouped by category and subject ═══
        if (action === 'list_sessions') {
            const { category, subject, limit: queryLimit } = parsed;
            let query = supabase.from('k_sessions')
                .select('id, title, category, subject, session_number, total_sessions, status, message_count, duration_ms, created_at, updated_at, parent_plan_id')
                .eq('user_email', userId)
                .order('updated_at', { ascending: false });

            if (category) query = query.eq('category', category);
            if (subject) query = query.ilike('subject', `%${subject}%`);
            query = query.limit(queryLimit || 50);

            const { data, error } = await query;

            if (error && error.code === '42P01') {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, sessions: [], fallback: true }) };
            }
            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

            // Group by category → subject
            const grouped = {};
            (data || []).forEach(s => {
                const cat = s.category || 'general';
                const sub = s.subject || 'General';
                if (!grouped[cat]) grouped[cat] = {};
                if (!grouped[cat][sub]) grouped[cat][sub] = [];
                grouped[cat][sub].push(s);
            });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, sessions: data || [], grouped, total: (data || []).length }) };
        }

        // ═══ LOAD SESSION — retrieve full session for replay/continue ═══
        if (action === 'load_session') {
            const { session_id } = parsed;
            if (!session_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'session_id required' }) };

            const { data, error } = await supabase.from('k_sessions')
                .select('*')
                .eq('id', session_id)
                .eq('user_email', userId)
                .single();

            if (error) return { statusCode: error.code === 'PGRST116' ? 404 : 500, headers, body: JSON.stringify({ error: error.message }) };

            // Parse messages if stored as string
            if (data && typeof data.messages === 'string') {
                try { data.messages = JSON.parse(data.messages); } catch (e) { /* keep as-is */ }
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, session: data }) };
        }

        // ═══ UPDATE SESSION — update status, add messages, etc. ═══
        if (action === 'update_session') {
            const { session_id, status: newStatus, messages: newMessages, monitor_html: newHtml, duration_ms: newDuration } = parsed;
            if (!session_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'session_id required' }) };

            const updates = { updated_at: new Date().toISOString() };
            if (newStatus) updates.status = newStatus;
            if (newMessages) { updates.messages = JSON.stringify(newMessages); updates.message_count = newMessages.length; }
            if (newHtml) updates.monitor_html = newHtml;
            if (newDuration) updates.duration_ms = newDuration;

            const { error } = await supabase.from('k_sessions')
                .update(updates)
                .eq('id', session_id)
                .eq('user_email', userId);

            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Session updated' }) };
        }

        // ═══ DELETE SESSION ═══
        if (action === 'delete_session') {
            const { session_id } = parsed;
            if (!session_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'session_id required' }) };

            const { error } = await supabase.from('k_sessions')
                .delete()
                .eq('id', session_id)
                .eq('user_email', userId);

            if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Session deleted' }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: save_session, list_sessions, load_session, update_session, delete_session' }) };
    } catch (error) {
        console.error('Session manager error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
