// Env Check - Verify all required environment variables (checks Supabase vault + process.env)
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // Logic Flow: inject all Supabase vault secrets into process.env BEFORE checking
    let vaultCount = 0;
    try {
        vaultCount = await patchProcessEnv();
    } catch (err) {
        console.warn('[env-check] Vault patch failed:', err.message);
    }

    const envVars = [
        'OPENAI_API_KEY',
        'GEMINI_API_KEY',
        'DEEPSEEK_API_KEY',
        'DEEPGRAM_API_KEY',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'OPENWEATHER_API_KEY',
        'TAVILY_API_KEY',
        'STRIPE_SECRET_KEY',
        'JWT_SECRET'
    ];

    const results = envVars.map(name => ({
        name,
        set: !!process.env[name],
        length: process.env[name] ? process.env[name].length : 0
    }));

    const configured = results.filter(r => r.set).length;
    const missing = results.filter(r => !r.set);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            configured: `${configured}/${envVars.length}`,
            vault_keys_loaded: vaultCount,
            variables: results.map(r => ({ name: r.name, status: r.set ? 'SET' : 'MISSING' })),
            missing: missing.map(r => r.name)
        })
    };
};
