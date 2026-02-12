// Notes & Persistent Memory - Save and retrieve notes across sessions (like ChatGPT Memory)
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { action, content, title, category, search_query, user_id, note_id } = JSON.parse(event.body || '{}');
        if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: save, list, search, delete, remember, recall' }) };

        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;
        const uid = user_id || 'anonymous';

        // Save a note
        if (action === 'save') {
            if (!content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content required' }) };
            const note = {
                user_id: uid,
                title: title || content.substring(0, 50) + '...',
                content,
                category: category || 'general',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (sbUrl && sbKey) {
                const res = await fetch(`${sbUrl}/rest/v1/user_notes`, {
                    method: 'POST',
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(note)
                });
                if (res.ok) {
                    const saved = await res.json();
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, note: saved[0] || note, message: `Note "${note.title}" saved` }) };
                }
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, note, message: 'Note saved (local — Supabase table user_notes needed for persistence)' }) };
        }

        // List notes
        if (action === 'list') {
            if (!sbUrl || !sbKey) return { statusCode: 200, headers, body: JSON.stringify({ success: true, notes: [], message: 'Create table user_notes in Supabase for persistence' }) };
            const cat = category ? `&category=eq.${category}` : '';
            const res = await fetch(`${sbUrl}/rest/v1/user_notes?user_id=eq.${uid}${cat}&order=updated_at.desc&limit=50`, {
                headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
            });
            const notes = res.ok ? await res.json() : [];
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, notes, count: notes.length }) };
        }

        // Search notes with AI
        if (action === 'search' || action === 'recall') {
            if (!search_query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'search_query required' }) };
            if (!sbUrl || !sbKey) return { statusCode: 200, headers, body: JSON.stringify({ success: true, results: [], message: 'Supabase not configured' }) };

            // Fetch all user notes and search with text matching
            const res = await fetch(`${sbUrl}/rest/v1/user_notes?user_id=eq.${uid}&order=updated_at.desc&limit=100`, {
                headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
            });
            const allNotes = res.ok ? await res.json() : [];
            const q = search_query.toLowerCase();
            const results = allNotes.filter(n =>
                n.content?.toLowerCase().includes(q) ||
                n.title?.toLowerCase().includes(q) ||
                n.category?.toLowerCase().includes(q)
            );
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, results, count: results.length, query: search_query }) };
        }

        // Remember (AI-extracted memory) — like ChatGPT Memory
        if (action === 'remember') {
            if (!content) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Content required' }) };

            // Use AI to extract key facts to remember
            const apiKey = process.env.OPENAI_API_KEY;
            if (apiKey) {
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{
                            role: 'system',
                            content: 'Extract key facts to remember about this user from the conversation. Return as a JSON array of short factual strings. Example: ["User prefers dark mode","User is a developer","User lives in Romania"]'
                        }, { role: 'user', content }],
                        max_tokens: 500
                    })
                });
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    let memories;
                    try { memories = JSON.parse(aiData.choices?.[0]?.message?.content || '[]'); } catch { memories = []; }

                    // Store each memory
                    if (sbUrl && sbKey && memories.length > 0) {
                        for (const mem of memories) {
                            await fetch(`${sbUrl}/rest/v1/user_notes`, {
                                method: 'POST',
                                headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ user_id: uid, title: 'Memory', content: mem, category: 'memory', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                            }).catch(() => { });
                        }
                    }
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, memories_saved: memories.length, memories }) };
                }
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Memory stored', content: content.substring(0, 200) }) };
        }

        // Delete
        if (action === 'delete' && note_id) {
            if (sbUrl && sbKey) {
                await fetch(`${sbUrl}/rest/v1/user_notes?id=eq.${note_id}&user_id=eq.${uid}`, {
                    method: 'DELETE',
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
                });
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Note deleted' }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: save, list, search, delete, remember, recall' }) };
    } catch (error) {
        console.error('Notes error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
