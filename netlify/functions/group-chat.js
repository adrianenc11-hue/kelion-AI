// ═══ GROUP CHAT — Supabase Realtime Channels ═══
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const db = getDB();
        const body = JSON.parse(event.body || '{}');
        const userId = body.user_id;
        if (!userId) return respond(401, { error: 'user_id required' });

        switch (body.action) {
            case 'send': return respond(200, await sendMessage(db, body));
            case 'history': return respond(200, await getHistory(db, body));
            case 'channels': return respond(200, await getChannels(db, userId));
            case 'create_channel': return respond(200, await createChannel(db, body));
            case 'join': return respond(200, await joinChannel(db, body));
            case 'leave': return respond(200, await leaveChannel(db, body));
            case 'members': return respond(200, await getMembers(db, body));
            default: return respond(400, { error: 'Actions: send, history, channels, create_channel, join, leave, members' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers, body: JSON.stringify({ success: c === 200, ...d }) }; }

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    return createClient(url, key);
}

async function sendMessage(db, { channel_id, user_id, message, message_type = 'text' }) {
    if (!channel_id || !message) return { error: 'channel_id and message required' };

    const { data, error } = await db.from('group_messages').insert({
        channel_id,
        user_id,
        message,
        message_type,
        created_at: new Date().toISOString()
    }).select().single();

    if (error) return { error: error.message };
    return { sent: true, message: data };
}

async function getHistory(db, { channel_id, limit = 50, before }) {
    if (!channel_id) return { error: 'channel_id required' };

    let query = db.from('group_messages')
        .select('*')
        .eq('channel_id', channel_id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) return { error: error.message };
    return { messages: (data || []).reverse(), channel_id, count: data?.length || 0 };
}

async function getChannels(db, userId) {
    const { data, error } = await db.from('group_channels')
        .select('*, group_members!inner(user_id)')
        .eq('group_members.user_id', userId);

    if (error) {
        // Fallback: get all public channels
        const { data: all, error: e2 } = await db.from('group_channels')
            .select('*').eq('is_public', true).limit(50);
        if (e2) return { error: e2.message };
        return { channels: all || [], note: 'Showing public channels' };
    }
    return { channels: data || [] };
}

async function createChannel(db, { user_id, name, description = '', is_public = true }) {
    if (!name) return { error: 'Channel name required' };

    const { data, error } = await db.from('group_channels').insert({
        name, description, is_public,
        created_by: user_id,
        created_at: new Date().toISOString()
    }).select().single();

    if (error) return { error: error.message };

    // Auto-join creator
    await db.from('group_members').insert({
        channel_id: data.id, user_id, role: 'admin',
        joined_at: new Date().toISOString()
    });

    return { created: true, channel: data };
}

async function joinChannel(db, { channel_id, user_id }) {
    if (!channel_id) return { error: 'channel_id required' };
    const { error } = await db.from('group_members').upsert({
        channel_id, user_id, role: 'member',
        joined_at: new Date().toISOString()
    }, { onConflict: 'channel_id,user_id' });
    if (error) return { error: error.message };
    return { joined: true, channel_id };
}

async function leaveChannel(db, { channel_id, user_id }) {
    if (!channel_id) return { error: 'channel_id required' };
    const { error } = await db.from('group_members')
        .delete().eq('channel_id', channel_id).eq('user_id', user_id);
    if (error) return { error: error.message };
    return { left: true, channel_id };
}

async function getMembers(db, { channel_id }) {
    if (!channel_id) return { error: 'channel_id required' };
    const { data, error } = await db.from('group_members')
        .select('*').eq('channel_id', channel_id);
    if (error) return { error: error.message };
    return { members: data || [], count: data?.length || 0 };
}
