// Netlify Function: Page View Tracking
// Records user navigation, duration, and scroll behavior

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (url && key) supabase = createClient(url, key);
    }
    return supabase;
}

// Extract IP from various headers
function getClientIP(event) {
    return event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        event.headers['x-real-ip'] ||
        event.headers['client-ip'] ||
        'unknown';
}

// Parse user agent string to extract browser, OS, device info
function parseUserAgent(ua) {
    const device = {
        browser: 'Unknown',
        os: 'Unknown',
        device: 'Desktop'
    };

    if (!ua) return device;

    // Browser detection
    if (ua.includes('Edge')) device.browser = 'Edge';
    else if (ua.includes('Chrome')) device.browser = 'Chrome';
    else if (ua.includes('Firefox')) device.browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) device.browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR')) device.browser = 'Opera';

    // OS detection
    if (ua.includes('Windows NT 10')) device.os = 'Windows 10';
    else if (ua.includes('Windows NT 6.3')) device.os = 'Windows 8.1';
    else if (ua.includes('Windows NT 6.2')) device.os = 'Windows 8';
    else if (ua.includes('Windows NT 6.1')) device.os = 'Windows 7';
    else if (ua.includes('Windows')) device.os = 'Windows';
    else if (ua.includes('Mac OS X')) {
        const match = ua.match(/Mac OS X (10[._]\d+)/);
        device.os = match ? `macOS ${match[1].replace('_', '.')}` : 'macOS';
    }
    else if (ua.includes('Android')) {
        const match = ua.match(/Android ([\d.]+)/);
        device.os = match ? `Android ${match[1]}` : 'Android';
    }
    else if (ua.includes('iPhone') || ua.includes('iPad')) {
        const match = ua.match(/OS ([\d_]+)/);
        device.os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
    }
    else if (ua.includes('Linux')) device.os = 'Linux';

    // Device type detection
    if (ua.includes('Mobile') || ua.includes('Android')) device.device = 'Mobile';
    else if (ua.includes('Tablet') || ua.includes('iPad')) device.device = 'Tablet';
    else device.device = 'Desktop';

    return device;
}


exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    };

    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        await patchProcessEnv(); // Load vault secrets FIRST

        const db = getSupabase();
        if (!db) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database not configured' })
            };
        }
        // POST - Record page view event
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const {
                page,
                action,
                session_id,
                user_id,
                duration_ms,
                scroll_depth,
                metadata
            } = body;

            if (!page || !action) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'page and action are required' })
                };
            }

            const record = {
                page: page.substring(0, 100),
                action: action.substring(0, 50),
                session_id: session_id?.substring(0, 64) || null,
                user_id: user_id || null,
                duration_ms: duration_ms ? parseInt(duration_ms, 10) : null,
                scroll_depth: scroll_depth ? Math.min(100, Math.max(0, parseInt(scroll_depth, 10))) : null,
                metadata: metadata || null,
                ip_address: getClientIP(event),
                user_agent: event.headers['user-agent']?.substring(0, 500) || null
            };

            const { data, error } = await db
                .from('page_views')
                .insert(record)
                .select('id')
                .single();

            if (error) {
                console.error('Page tracking insert error:', error);
                throw error;
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, id: data?.id })
            };
        }

        // GET - Retrieve analytics with geolocation data
        if (event.httpMethod === 'GET') {
            // Fetch last 100 page views with full details
            const { data, error } = await db
                .from('page_views')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Enrich with geolocation data for each unique IP
            const uniqueIPs = [...new Set((data || []).map(row => row.ip_address))];
            const geoData = {};

            // Fetch geolocation for each IP (ipapi.co free tier: 1000 req/day)
            for (const ip of uniqueIPs) {
                if (!ip || ip === 'unknown') continue;
                try {
                    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`);
                    if (geoResponse.ok) {
                        const geo = await geoResponse.json();
                        geoData[ip] = {
                            city: geo.city,
                            region: geo.region,
                            country: geo.country_name,
                            countryCode: geo.country_code,
                            latitude: geo.latitude,
                            longitude: geo.longitude,
                            timezone: geo.timezone,
                            isp: geo.org,
                            asn: geo.asn
                        };
                    }
                } catch (err) {
                    console.error('Geolocation failed for IP %s:', ip, err.message);
                }
            }

            // Enrich each row with geo + device info
            const enrichedData = (data || []).map(row => {
                const ua = row.user_agent || '';
                const device = parseUserAgent(ua);

                return {
                    id: row.id,
                    timestamp: row.created_at,
                    page: row.page,
                    action: row.action,
                    duration_ms: row.duration_ms,
                    ip: row.ip_address,
                    geo: geoData[row.ip_address] || {},
                    device: device
                };
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: enrichedData })
            };
        }


        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Page tracking error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
