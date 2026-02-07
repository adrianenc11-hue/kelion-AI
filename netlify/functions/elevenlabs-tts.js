// ElevenLabs TTS - Text to Speech
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { text, voice_id } = JSON.parse(event.body || '{}');
        if (!text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) return { statusCode: 503, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }) };

        const voiceId = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Rachel default

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
            },
            body: JSON.stringify({
                text: text.substring(0, 5000),
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 }
            })
        });

        if (!response.ok) {
            return { statusCode: response.status, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'ElevenLabs API error' }) };
        }

        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        // Log cost: ElevenLabs = $0.24 per 1K chars
        const chars = text.length;
        const cost = (chars / 1000) * 0.24;
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'elevenlabs', input_tokens: chars, output_tokens: 0, estimated_cost: cost, endpoint: 'elevenlabs-tts' })
        }).catch(() => { });

        return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, audio: base64Audio, format: 'mp3' })
        };
    } catch (error) {
        console.error('TTS error:', error);
        return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
    }
};
