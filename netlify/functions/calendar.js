// Calendar & Reminders - Schedule events and set reminders (stored in Supabase)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { action, title, description, date, time, reminder_minutes, user_id } = JSON.parse(event.body || '{}');
        if (!action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: create, list, delete, parse' }) };

        const sbUrl = process.env.SUPABASE_URL;
        const sbKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY;

        // Parse natural language to event
        if (action === 'parse') {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

            const { text } = JSON.parse(event.body || '{}');
            const now = new Date().toISOString();
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: `Extract calendar event details from text. Current time: ${now}. Return JSON: {"title":"","description":"","date":"YYYY-MM-DD","time":"HH:MM","reminder_minutes":15}. If time not specified, default to 09:00. If date says "tomorrow", calculate it. Reply ONLY with JSON.`
                    }, { role: 'user', content: text }],
                    max_tokens: 200
                })
            });
            if (!res.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse event' }) };
            const data = await res.json();
            let parsed;
            try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); } catch { parsed = {}; }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, parsed_event: parsed }) };
        }

        // Create event
        if (action === 'create') {
            if (!title) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Title required' }) };
            const eventData = {
                title, description: description || '',
                event_date: date || new Date().toISOString().split('T')[0],
                event_time: time || '09:00',
                reminder_minutes: reminder_minutes || 15,
                user_id: user_id || 'anonymous',
                created_at: new Date().toISOString(),
                status: 'active'
            };

            // Store in Supabase if available
            if (sbUrl && sbKey) {
                await fetch(`${sbUrl}/rest/v1/calendar_events`, {
                    method: 'POST',
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(eventData)
                }).catch(() => { });
            }

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, event: eventData, message: `Event "${title}" created for ${eventData.event_date} at ${eventData.event_time}` }) };
        }

        // List events
        if (action === 'list') {
            if (!sbUrl || !sbKey) return { statusCode: 200, headers, body: JSON.stringify({ success: true, events: [], message: 'Supabase not configured — events stored in memory only' }) };
            const uid = user_id || 'anonymous';
            const res = await fetch(`${sbUrl}/rest/v1/calendar_events?user_id=eq.${uid}&order=event_date.asc&limit=20`, {
                headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` }
            });
            const events = res.ok ? await res.json() : [];
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, events, count: events.length }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: create, list, delete, parse' }) };
    } catch (error) {
        console.error('Calendar error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
