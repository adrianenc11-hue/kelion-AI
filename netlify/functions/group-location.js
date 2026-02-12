// ═══ GROUP LOCATION — Browser Geolocation + Supabase ═══
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
            case 'update': return respond(200, await updateLocation(db, body));
            case 'get_group': return respond(200, await getGroupLocations(db, body));
            case 'nearby': return respond(200, await getNearby(db, body));
            case 'history': return respond(200, await getHistory(db, body));
            default: return respond(400, { error: 'Actions: update, get_group, nearby, history' });
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

async function updateLocation(db, { user_id, lat, lng, accuracy, label = '' }) {
    if (lat == null || lng == null) return { error: 'lat and lng required (from browser Geolocation API)' };

    const { data, error } = await db.from('user_locations').upsert({
        user_id,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        accuracy: accuracy || null,
        label,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).select().single();

    if (error) return { error: error.message };
    return { updated: true, location: data };
}

async function getGroupLocations(db, { group_id, user_id }) {
    if (!group_id) return { error: 'group_id required' };

    // Get group members
    const { data: members } = await db.from('group_members')
        .select('user_id').eq('channel_id', group_id);

    if (!members?.length) return { locations: [], note: 'No members in group' };

    const memberIds = members.map(m => m.user_id);
    const { data: locations, error } = await db.from('user_locations')
        .select('*').in('user_id', memberIds);

    if (error) return { error: error.message };
    return { locations: locations || [], group_id, member_count: memberIds.length };
}

async function getNearby(db, { user_id, lat, lng, radius_km = 5 }) {
    if (lat == null || lng == null) return { error: 'lat and lng required' };

    // Haversine approximation in SQL — get nearby users
    const latF = parseFloat(lat);
    const lngF = parseFloat(lng);
    const delta = radius_km / 111.0; // ~111km per degree

    const { data, error } = await db.from('user_locations')
        .select('*')
        .gte('lat', latF - delta)
        .lte('lat', latF + delta)
        .gte('lng', lngF - delta)
        .lte('lng', lngF + delta)
        .neq('user_id', user_id);

    if (error) return { error: error.message };

    // Calculate actual distances
    const withDistance = (data || []).map(loc => ({
        ...loc,
        distance_km: haversine(latF, lngF, loc.lat, loc.lng)
    })).filter(l => l.distance_km <= radius_km).sort((a, b) => a.distance_km - b.distance_km);

    return { nearby: withDistance, radius_km, center: { lat: latF, lng: lngF } };
}

async function getHistory(db, { user_id, limit = 20 }) {
    const { data, error } = await db.from('location_history')
        .select('*').eq('user_id', user_id)
        .order('created_at', { ascending: false }).limit(limit);

    if (error) return { error: error.message };
    return { history: data || [] };
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
