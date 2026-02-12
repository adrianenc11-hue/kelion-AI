// TTS — Deepgram Aura Text to Speech (replaced ElevenLabs)
const { patchProcessEnv } = require('./get-secret');

// Deepgram voice model mapping
const DEEPGRAM_VOICES = {
    'default': 'aura-2-thalia-en',
    'male': 'aura-2-zeus-en',
    'female': 'aura-2-thalia-en',
    'adam': 'aura-2-zeus-en',        // Map old ElevenLabs "Adam" voice
    'rachel': 'aura-2-thalia-en'     // Map old ElevenLabs "Rachel" voice
};

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { text, voice_id } = JSON.parse(event.body || '{}');
        if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };

        const key = process.env.DEEPGRAM_API_KEY;
        if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: 'DEEPGRAM_API_KEY not configured' }) };

        // Select Deepgram voice model
        const voiceModel = DEEPGRAM_VOICES[voice_id] || DEEPGRAM_VOICES['default'];

        const res = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=mp3`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text.substring(0, 5000) })
        });
        if (!res.ok) throw new Error(`Deepgram TTS ${res.status}`);
        const buf = await res.arrayBuffer();

        // Log cost (fire-and-forget)
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'deepgram-aura', input_tokens: text.length, output_tokens: 0, endpoint: 'tts' })
        }).catch(() => { });

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true, engine: 'deepgram',
                audio: Buffer.from(buf).toString('base64'),
                format: 'mp3', model: voiceModel
            })
        };
    } catch (error) {
        console.error('TTS error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
