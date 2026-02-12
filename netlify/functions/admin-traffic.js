// Netlify Function: Admin Live Traffic Dashboard
// Returns real-time visitor data with IP, location, device, and captures

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

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

// Detect if visitor is a bot/crawler
function isBot(ua) {
    if (!ua) return false;
    const botPatterns = [
        /bot/i, /crawl/i, /spider/i, /slurp/i, /baidu/i,
        /yandex/i, /bing/i, /google/i, /facebook/i, /twitter/i,
        /linkedin/i, /pinterest/i, /semrush/i, /ahrefs/i,
        /mj12bot/i, /dotbot/i, /petalbot/i, /amazonbot/i,
        /bytespider/i, /gptbot/i, /claudebot/i, /applebot/i,
        /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
        /wget/i, /curl/i, /httpie/i, /python-requests/i,
        /go-http-client/i, /java\//i, /node-fetch/i,
        /dispatch/i, /monitor/i, /uptime/i, /pingdom/i,
        /statuspage/i, /sitechecker/i
    ];
    return botPatterns.some(p => p.test(ua));
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
        await patchProcessEnv(); // Load vault secrets
        const params = event.queryStringParameters || {};
        const limit = Math.min(parseInt(params.limit) || 100, 500);
        const minutes = parseInt(params.minutes) || 1440; // Last N minutes (default 24h)

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
            const botDetected = isBot(view.user_agent);
            const captureKey = ip !== 'unknown' ? ip : (view.session_id || 'unknown');
            const userCaptures = capturesByIP[captureKey] || [];
            const meta = view.metadata || {};

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
                is_bot: botDetected,
                fingerprint: meta.fingerprint || null,
                screen: meta.screen_width ? `${meta.screen_width}x${meta.screen_height}` : null,
                language: meta.language || null,
                timezone: meta.timezone || null,
                referrer: meta.referrer || null,
                platform: meta.platform || null,
                cores: meta.cores || null,
                touch: meta.touch || false,
                capture: userCaptures[0]?.image_url || null,
                captureCount: userCaptures.length
            });
        }

        // Aggregate unique visitors
        const uniqueVisitors = new Set(enrichedViews.map(v => v.ip)).size;
        const uniqueFingerprints = new Set(enrichedViews.filter(v => v.fingerprint).map(v => v.fingerprint)).size;
        const byCountry = {};
        const byDevice = {};
        let humanCount = 0;
        let botCount = 0;

        enrichedViews.forEach(v => {
            const country = v.geo?.country || 'Unknown';
            const device = v.device?.device || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;
            byDevice[device] = (byDevice[device] || 0) + 1;
            if (v.is_bot) botCount++;
            else humanCount++;
        });

        // Count total records in period (beyond limit)
        const { count: totalInPeriod } = await db
            .from('page_views')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', since);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                stats: {
                    totalViews: totalInPeriod || enrichedViews.length,
                    displayedViews: enrichedViews.length,
                    uniqueVisitors,
                    uniqueFingerprints,
                    humanCount,
                    botCount,
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
