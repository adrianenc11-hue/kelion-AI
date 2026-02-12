// ═══ WEATHER — OpenWeatherMap via Browser GPS ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    try {
        await patchProcessEnv();
        const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const action = body.action || 'current';
        const lat = body.lat || event.queryStringParameters?.lat;
        const lon = body.lon || event.queryStringParameters?.lon;

        // If no GPS coords, try IP-based geolocation
        if (!lat || !lon) {
            return respond(200, await weatherByIP(event));
        }

        switch (action) {
            case 'current': return respond(200, await getCurrentWeather(lat, lon));
            case 'forecast': return respond(200, await getForecast(lat, lon, body.days || 5));
            case 'alerts': return respond(200, await getAlerts(lat, lon));
            default: return respond(400, { error: 'Actions: current, forecast, alerts. Send lat/lon from browser GPS.' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function getCurrentWeather(lat, lon) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return { error: 'OPENWEATHER_API_KEY not configured', hint: 'Get free key at openweathermap.org' };

    const fetch = (await import('node-fetch')).default;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ro`;
    const res = await fetch(url);
    if (!res.ok) return { error: `Weather API: ${res.status}` };
    const data = await res.json();

    return {
        location: data.name,
        country: data.sys?.country,
        coordinates: { lat: parseFloat(lat), lon: parseFloat(lon) },
        temperature: Math.round(data.main?.temp),
        feels_like: Math.round(data.main?.feels_like),
        temp_min: Math.round(data.main?.temp_min),
        temp_max: Math.round(data.main?.temp_max),
        humidity: data.main?.humidity,
        pressure: data.main?.pressure,
        description: data.weather?.[0]?.description,
        icon: data.weather?.[0]?.icon,
        icon_url: `https://openweathermap.org/img/wn/${data.weather?.[0]?.icon}@2x.png`,
        wind: { speed: data.wind?.speed, direction: data.wind?.deg, gust: data.wind?.gust },
        clouds: data.clouds?.all,
        visibility: data.visibility,
        sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000).toISOString() : null,
        sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000).toISOString() : null,
        gps_source: 'browser',
        timestamp: new Date().toISOString()
    };
}

async function getForecast(lat, lon, days) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return { error: 'OPENWEATHER_API_KEY not configured' };

    const fetch = (await import('node-fetch')).default;
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ro&cnt=${days * 8}`;
    const res = await fetch(url);
    if (!res.ok) return { error: `Forecast API: ${res.status}` };
    const data = await res.json();

    // Group by day
    const byDay = {};
    (data.list || []).forEach(item => {
        const day = item.dt_txt.split(' ')[0];
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push({
            time: item.dt_txt.split(' ')[1].slice(0, 5),
            temp: Math.round(item.main.temp),
            description: item.weather?.[0]?.description,
            icon: item.weather?.[0]?.icon,
            wind: item.wind?.speed,
            rain: item.rain?.['3h'] || 0
        });
    });

    return {
        location: data.city?.name,
        country: data.city?.country,
        forecast: Object.entries(byDay).map(([date, hours]) => ({
            date,
            temp_min: Math.min(...hours.map(h => h.temp)),
            temp_max: Math.max(...hours.map(h => h.temp)),
            hours
        })),
        days: Object.keys(byDay).length
    };
}

async function getAlerts(lat, lon) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return { error: 'OPENWEATHER_API_KEY not configured' };

    const fetch = (await import('node-fetch')).default;
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&exclude=minutely,hourly,daily&lang=ro`;
    const res = await fetch(url);
    if (!res.ok) return { alerts: [], note: 'OneCall API requires subscription for alerts' };
    const data = await res.json();

    return {
        alerts: (data.alerts || []).map(a => ({
            event: a.event,
            sender: a.sender_name,
            start: new Date(a.start * 1000).toISOString(),
            end: new Date(a.end * 1000).toISOString(),
            description: a.description
        })),
        count: data.alerts?.length || 0
    };
}

async function weatherByIP(event) {
    // Extract IP from request headers for approximate location
    const ip = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || event.headers?.['client-ip'];

    if (!ip || ip === '127.0.0.1') {
        return {
            error: 'No GPS coordinates provided',
            hint: 'Send lat/lon from browser: navigator.geolocation.getCurrentPosition()',
            example: { action: 'current', lat: 44.4268, lon: 26.1025 }
        };
    }

    // Use ip-api for approximate location
    try {
        const fetch = (await import('node-fetch')).default;
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,country`);
        const geo = await geoRes.json();

        if (geo.lat && geo.lon) {
            const weather = await getCurrentWeather(geo.lat, geo.lon);
            weather.gps_source = 'ip-approximate';
            weather.ip_location = { city: geo.city, country: geo.country };
            weather.note = 'Location from IP (approximate). For precise weather, send GPS coordinates from browser.';
            return weather;
        }
    } catch (e) { /* fallback */ }

    return {
        error: 'Could not determine location',
        hint: 'Use browser Geolocation API and send lat/lon'
    };
}
