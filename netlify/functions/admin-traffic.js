// Netlify Function: Admin Live Traffic Dashboard
// Returns real-time visitor data with IP, location, device, and captures

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
function getSupabase() {
    if (!supabase && supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
    return supabase;
}

// Parse User-Agent to get device/browser info
function parseUserAgent(ua) {
    if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };

    let device = 'Desktop';
    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect device type
    if (/mobile/i.test(ua)) device = 'Mobile';
    else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

    // Detect browser
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edg/i.test(ua)) browser = 'Edge';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';

    // Detect OS
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

    return { device, browser, os };
}

// Get country from IP using free IP-API service
async function getGeoLocation(ip) {
    if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip.startsWith('192.168.')) {
        return { country: 'Local', city: 'Development', countryCode: 'XX' };
    }

    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,isp`);
        const data = await response.json();

        if (data.status === 'success') {
            return {
                country: data.country || 'Unknown',
                city: data.city || 'Unknown',
                countryCode: data.countryCode || 'XX',
                isp: data.isp || 'Unknown'
            };
        }
    } catch (e) {
        console.warn('Geo lookup failed for IP:', ip, e.message);
    }

    return { country: 'Unknown', city: 'Unknown', countryCode: 'XX' };
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Only allow GET
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    const db = getSupabase();
    if (!db) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database not configured' })
        };
    }

    try {
        const params = event.queryStringParameters || {};
        const limit = Math.min(parseInt(params.limit) || 50, 100);
        const minutes = parseInt(params.minutes) || 60; // Last N minutes

        // Get recent page views
        const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

        const { data: views, error: viewsError } = await db
            .from('page_views')
            .select('*')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (viewsError) throw viewsError;

        // Get camera captures for the same period
        const { data: captures, error: capturesError } = await db
            .from('camera_captures')
            .select('*')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Build capture lookup by IP or session
        const capturesByIP = {};
        if (captures && !capturesError) {
            captures.forEach(cap => {
                const key = cap.ip_address || cap.session_id || 'unknown';
                if (!capturesByIP[key]) capturesByIP[key] = [];
                capturesByIP[key].push(cap);
            });
        }

        // Enrich views with geo, device, and captures
        const enrichedViews = [];
        const processedIPs = new Set();

        for (const view of (views || [])) {
            const ip = view.ip_address || 'unknown';

            // Get geo data (cache to avoid duplicate lookups)
            let geo;
            if (processedIPs.has(ip)) {
                geo = enrichedViews.find(v => v.ip === ip)?.geo || {};
            } else {
                geo = await getGeoLocation(ip);
                processedIPs.add(ip);
            }

            const deviceInfo = parseUserAgent(view.user_agent);
            const captureKey = ip !== 'unknown' ? ip : (view.session_id || 'unknown');
            const userCaptures = capturesByIP[captureKey] || [];

            enrichedViews.push({
                id: view.id,
                timestamp: view.created_at,
                page: view.page,
                action: view.action,
                ip: ip,
                geo: geo,
                device: deviceInfo,
                duration_ms: view.duration_ms,
                session_id: view.session_id,
                user_id: view.user_id,
                capture: userCaptures[0]?.image_url || null, // Most recent capture
                captureCount: userCaptures.length
            });
        }

        // Aggregate unique visitors
        const uniqueVisitors = new Set(enrichedViews.map(v => v.ip)).size;
        const byCountry = {};
        const byDevice = {};

        enrichedViews.forEach(v => {
            const country = v.geo?.country || 'Unknown';
            const device = v.device?.device || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;
            byDevice[device] = (byDevice[device] || 0) + 1;
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                stats: {
                    totalViews: enrichedViews.length,
                    uniqueVisitors,
                    byCountry,
                    byDevice,
                    period: `Last ${minutes} minutes`
                },
                visitors: enrichedViews
            })
        };

    } catch (error) {
        console.error('Admin traffic error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
