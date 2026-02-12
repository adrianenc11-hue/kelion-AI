// ═══ MAPS CONFIG — Returns Google Maps Embed API key from env ═══
const { patchProcessEnv } = require('./get-secret');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'GET only' }) };

    // Load vault secrets BEFORE reading env vars
    await patchProcessEnv();

    const key = process.env.GOOGLE_MAPS_EMBED_KEY;
    if (!key) {
        return {
            statusCode: 503,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'config_missing', message: 'GOOGLE_MAPS_EMBED_KEY env var required' })
        };
    }

    return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=3600' },
        body: JSON.stringify({ key })
    };
};
