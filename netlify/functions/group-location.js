/**
 * Group Location — Live GPS Tracking + Routing
 * For Family & Business plans
 * Actions: update_location, get_members_locations, get_route
 * Uses OSRM free API for routing
 */

const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {

            // ═══ UPDATE LOCATION ═══
            // Member sends their GPS coordinates
            case 'update_location': {
                const { email, group_id, lat, lng, accuracy, speed, heading } = body;

                if (!email || !lat || !lng) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email, lat, lng required' }) };
                }

                // Verify member belongs to a group
                let gid = group_id;
                if (!gid) {
                    const { data: member } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('email', email)
                        .eq('status', 'active')
                        .single();
                    if (!member) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a member of any group' }) };
                    }
                    gid = member.group_id;
                }

                // Upsert location (one row per member per group)
                const { error: upsertErr } = await supabase
                    .from('group_locations')
                    .upsert({
                        group_id: gid,
                        email,
                        lat,
                        lng,
                        accuracy: accuracy || null,
                        speed: speed || null,
                        heading: heading || null,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'group_id,email' });

                if (upsertErr) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: upsertErr.message }) };
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, message: 'Location updated' })
                };
            }

            // ═══ GET ALL MEMBERS' LOCATIONS ═══
            case 'get_members_locations': {
                const { email, group_id } = body;

                if (!email && !group_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email or group_id required' }) };
                }

                // Find group
                let gid = group_id;
                if (!gid) {
                    const { data: member } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('email', email)
                        .eq('status', 'active')
                        .single();
                    if (!member) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a member of any group' }) };
                    }
                    gid = member.group_id;
                }

                // Get all locations for group
                const { data: locations } = await supabase
                    .from('group_locations')
                    .select('email, lat, lng, accuracy, speed, heading, updated_at')
                    .eq('group_id', gid);

                // Get member names
                const { data: members } = await supabase
                    .from('group_members')
                    .select('email, name, role')
                    .eq('group_id', gid)
                    .eq('status', 'active');

                // Merge names with locations
                const nameMap = {};
                (members || []).forEach(m => { nameMap[m.email] = { name: m.name, role: m.role }; });

                const enriched = (locations || []).map(loc => ({
                    ...loc,
                    name: nameMap[loc.email]?.name || loc.email.split('@')[0],
                    role: nameMap[loc.email]?.role || 'member',
                    age_seconds: Math.round((Date.now() - new Date(loc.updated_at).getTime()) / 1000)
                }));

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        locations: enriched,
                        count: enriched.length
                    })
                };
            }

            // ═══ GET ROUTE BETWEEN TWO POINTS ═══
            // Uses free OSRM API
            case 'get_route': {
                const { from_lat, from_lng, to_lat, to_lng, profile } = body;

                if (!from_lat || !from_lng || !to_lat || !to_lng) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'from_lat, from_lng, to_lat, to_lng required' }) };
                }

                const routeProfile = profile || 'driving';
                const osrmUrl = `https://router.project-osrm.org/route/v1/${routeProfile}/${from_lng},${from_lat};${to_lng},${to_lat}?overview=full&geometries=geojson&steps=true`;

                const response = await fetch(osrmUrl);
                const data = await response.json();

                if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'No route found' }) };
                }

                const route = data.routes[0];
                const distanceKm = (route.distance / 1000).toFixed(1);
                const durationMin = Math.round(route.duration / 60);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        distance_km: parseFloat(distanceKm),
                        duration_minutes: durationMin,
                        duration_text: durationMin < 60
                            ? `${durationMin} min`
                            : `${Math.floor(durationMin / 60)}h ${durationMin % 60}min`,
                        geometry: route.geometry, // GeoJSON LineString for map
                        steps: route.legs[0].steps.map(s => ({
                            instruction: s.maneuver.type + (s.maneuver.modifier ? ' ' + s.maneuver.modifier : ''),
                            name: s.name,
                            distance: s.distance,
                            duration: s.duration
                        }))
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        service: 'group-location',
                        actions: ['update_location', 'get_members_locations', 'get_route']
                    })
                };
        }
    } catch (error) {
        console.error('Group location error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
