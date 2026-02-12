// ═══ GROUP MANAGEMENT — Full CRUD with Supabase ═══
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
            case 'create': return respond(200, await createGroup(db, body));
            case 'update': return respond(200, await updateGroup(db, body));
            case 'delete': return respond(200, await deleteGroup(db, body));
            case 'list': return respond(200, await listGroups(db, userId));
            case 'get': return respond(200, await getGroup(db, body));
            case 'invite': return respond(200, await inviteUser(db, body));
            case 'remove_member': return respond(200, await removeMember(db, body));
            case 'set_role': return respond(200, await setRole(db, body));
            default: return respond(400, { error: 'Actions: create, update, delete, list, get, invite, remove_member, set_role' });
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

async function createGroup(db, { user_id, name, description = '', type = 'family', is_public = false, max_members = 50 }) {
    if (!name) return { error: 'Group name required' };

    const { data, error } = await db.from('group_channels').insert({
        name, description, type, is_public, max_members,
        created_by: user_id,
        created_at: new Date().toISOString()
    }).select().single();

    if (error) return { error: error.message };

    // Creator becomes admin
    await db.from('group_members').insert({
        channel_id: data.id, user_id, role: 'admin',
        joined_at: new Date().toISOString()
    });

    return { created: true, group: data };
}

async function updateGroup(db, { user_id, group_id, name, description, is_public, max_members }) {
    if (!group_id) return { error: 'group_id required' };

    // Check admin
    const { data: member } = await db.from('group_members')
        .select('role').eq('channel_id', group_id).eq('user_id', user_id).single();
    if (!member || member.role !== 'admin') return { error: 'Admin access required' };

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_public !== undefined) updates.is_public = is_public;
    if (max_members !== undefined) updates.max_members = max_members;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await db.from('group_channels')
        .update(updates).eq('id', group_id).select().single();

    if (error) return { error: error.message };
    return { updated: true, group: data };
}

async function deleteGroup(db, { user_id, group_id }) {
    if (!group_id) return { error: 'group_id required' };

    const { data: member } = await db.from('group_members')
        .select('role').eq('channel_id', group_id).eq('user_id', user_id).single();
    if (!member || member.role !== 'admin') return { error: 'Admin access required' };

    // Delete members first, then group
    await db.from('group_members').delete().eq('channel_id', group_id);
    await db.from('group_messages').delete().eq('channel_id', group_id);
    const { error } = await db.from('group_channels').delete().eq('id', group_id);

    if (error) return { error: error.message };
    return { deleted: true, group_id };
}

async function listGroups(db, userId) {
    const { data, error } = await db.from('group_members')
        .select('channel_id, role, group_channels(*)')
        .eq('user_id', userId);

    if (error) return { error: error.message };
    return { groups: (data || []).map(d => ({ ...d.group_channels, my_role: d.role })) };
}

async function getGroup(db, { group_id }) {
    if (!group_id) return { error: 'group_id required' };

    const { data: group, error } = await db.from('group_channels')
        .select('*').eq('id', group_id).single();
    if (error) return { error: error.message };

    const { data: members } = await db.from('group_members')
        .select('*').eq('channel_id', group_id);

    return { group, members: members || [], member_count: members?.length || 0 };
}

async function inviteUser(db, { user_id, group_id, invite_user_id }) {
    if (!group_id || !invite_user_id) return { error: 'group_id and invite_user_id required' };

    const { data: member } = await db.from('group_members')
        .select('role').eq('channel_id', group_id).eq('user_id', user_id).single();
    if (!member || !['admin', 'moderator'].includes(member.role)) return { error: 'Admin/moderator access required' };

    const { error } = await db.from('group_members').upsert({
        channel_id: group_id, user_id: invite_user_id, role: 'member',
        joined_at: new Date().toISOString()
    }, { onConflict: 'channel_id,user_id' });

    if (error) return { error: error.message };
    return { invited: true, user_id: invite_user_id, group_id };
}

async function removeMember(db, { user_id, group_id, remove_user_id }) {
    if (!group_id || !remove_user_id) return { error: 'group_id and remove_user_id required' };

    const { data: member } = await db.from('group_members')
        .select('role').eq('channel_id', group_id).eq('user_id', user_id).single();
    if (!member || member.role !== 'admin') return { error: 'Admin access required' };

    const { error } = await db.from('group_members')
        .delete().eq('channel_id', group_id).eq('user_id', remove_user_id);

    if (error) return { error: error.message };
    return { removed: true, user_id: remove_user_id, group_id };
}

async function setRole(db, { user_id, group_id, target_user_id, role }) {
    if (!group_id || !target_user_id || !role) return { error: 'group_id, target_user_id, role required' };
    if (!['admin', 'moderator', 'member'].includes(role)) return { error: 'Role must be: admin, moderator, member' };

    const { data: member } = await db.from('group_members')
        .select('role').eq('channel_id', group_id).eq('user_id', user_id).single();
    if (!member || member.role !== 'admin') return { error: 'Admin access required' };

    const { error } = await db.from('group_members')
        .update({ role }).eq('channel_id', group_id).eq('user_id', target_user_id);

    if (error) return { error: error.message };
    return { updated: true, user_id: target_user_id, new_role: role };
}
