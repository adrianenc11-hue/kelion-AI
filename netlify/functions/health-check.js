// health-check.js — Monitoring endpoint for Kelion AI
// Returns status of all critical services

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    const results = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: 'v1.6',
        services: {}
    };

    // Check each API key exists
    const keys = {
        openai: 'OPENAI_API_KEY',
        gemini: 'GEMINI_API_KEY',
        elevenlabs: 'ELEVENLABS_API_KEY',
        supabase_url: 'SUPABASE_URL',
        supabase_key: 'SUPABASE_SERVICE_KEY',
        openweather: 'OPENWEATHER_API_KEY',
        replicate: 'REPLICATE_API_TOKEN',
        deepseek: 'DEEPSEEK_API_KEY',
        kimi: 'KIMI_API_KEY'
    };

    let failures = 0;
    for (const [name, envVar] of Object.entries(keys)) {
        const exists = !!process.env[envVar];
        results.services[name] = {
            configured: exists,
            env_var: envVar
        };
        if (!exists) failures++;
    }

    if (failures > 0) {
        results.status = 'degraded';
        results.missing_keys = failures;
    }

    return {
        statusCode: results.status === 'ok' ? 200 : 503,
        headers,
        body: JSON.stringify(results, null, 2)
    };
};
