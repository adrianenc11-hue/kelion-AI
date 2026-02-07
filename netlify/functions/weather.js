// Weather Function - OpenWeatherMap API
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        let lat, lon;

        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            lat = body.lat;
            lon = body.lon;
        } else {
            lat = event.queryStringParameters?.lat;
            lon = event.queryStringParameters?.lon;
        }

        if (!lat || !lon) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'lat and lon required' }) };
        }

        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENWEATHER_API_KEY not configured' }) };
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ro`;
        const response = await fetch(url);

        if (!response.ok) {
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Weather API error' }) };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                location: data.name,
                country: data.sys?.country,
                temperature: Math.round(data.main?.temp),
                feels_like: Math.round(data.main?.feels_like),
                humidity: data.main?.humidity,
                description: data.weather?.[0]?.description,
                icon: data.weather?.[0]?.icon,
                wind_speed: data.wind?.speed
            })
        };

    } catch (error) {
        console.error('Weather error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
