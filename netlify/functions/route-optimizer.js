// ═══ ROUTE OPTIMIZER — Google Maps Directions API ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'optimize': return respond(200, await optimizeRoute(body));
            case 'directions': return respond(200, await getDirections(body));
            case 'distance': return respond(200, await getDistance(body));
            default: return respond(400, { error: 'Actions: optimize, directions, distance' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function optimizeRoute({ origin, destination, waypoints = [], mode = 'driving', optimize_waypoints = true }) {
    if (!origin || !destination) return { error: 'origin and destination required (address or lat,lng)' };

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        // Fallback: smart-brain estimation
        return await brainFallback(origin, destination, waypoints, mode);
    }

    const fetch = (await import('node-fetch')).default;
    const params = new URLSearchParams({
        origin, destination, mode,
        key: apiKey,
        optimize: optimize_waypoints ? 'true' : 'false'
    });

    if (waypoints.length > 0) {
        const prefix = optimize_waypoints ? 'optimize:true|' : '';
        params.set('waypoints', prefix + waypoints.join('|'));
    }

    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK') return { error: `Google Maps: ${data.status}`, details: data.error_message };

    const route = data.routes[0];
    const legs = route.legs.map(leg => ({
        from: leg.start_address,
        to: leg.end_address,
        distance: leg.distance.text,
        duration: leg.duration.text,
        steps: leg.steps?.length || 0
    }));

    const totalDistance = route.legs.reduce((s, l) => s + l.distance.value, 0);
    const totalDuration = route.legs.reduce((s, l) => s + l.duration.value, 0);

    return {
        optimized: true,
        summary: route.summary,
        total_distance: `${(totalDistance / 1000).toFixed(1)} km`,
        total_duration: formatDuration(totalDuration),
        legs,
        waypoint_order: route.waypoint_order || [],
        polyline: route.overview_polyline?.points,
        mode
    };
}

async function getDirections({ origin, destination, mode = 'driving' }) {
    return await optimizeRoute({ origin, destination, mode, waypoints: [], optimize_waypoints: false });
}

async function getDistance({ origins, destinations }) {
    if (!origins || !destinations) return { error: 'origins and destinations required (arrays of addresses)' };

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return { error: 'GOOGLE_MAPS_API_KEY not configured' };

    const fetch = (await import('node-fetch')).default;
    const originsStr = Array.isArray(origins) ? origins.join('|') : origins;
    const destsStr = Array.isArray(destinations) ? destinations.join('|') : destinations;

    const params = new URLSearchParams({ origins: originsStr, destinations: destsStr, key: apiKey });
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK') return { error: `Google Maps: ${data.status}` };

    return {
        rows: data.rows.map((row, i) => ({
            origin: data.origin_addresses[i],
            distances: row.elements.map((el, j) => ({
                destination: data.destination_addresses[j],
                distance: el.distance?.text,
                duration: el.duration?.text,
                status: el.status
            }))
        }))
    };
}

async function brainFallback(origin, destination, waypoints, mode) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const prompt = `Estimate the best route from "${origin}" to "${destination}"${waypoints.length ? ` via ${waypoints.join(', ')}` : ''} by ${mode}. Provide estimated distance in km and duration. Suggest the best route with major roads/highways.
Return JSON: {"distance_km": X, "duration_minutes": X, "route_summary": "...", "suggestions": [...]}`;

    const res = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, mode: 'utility' })
    });
    const data = await res.json();

    try {
        const match = (data.reply || data.answer || '').match(/\{[\s\S]*\}/);
        if (match) return { ...JSON.parse(match[0]), estimated: true, engine: 'smart-brain', note: 'Estimation via AI. Add GOOGLE_MAPS_API_KEY for real directions.' };
    } catch (e) { /* fallback */ }

    return { route_info: data.reply || data.answer, estimated: true, note: 'Add GOOGLE_MAPS_API_KEY for precise directions' };
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m} min`;
}
