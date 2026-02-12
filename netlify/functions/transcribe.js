// Transcribe — Whisper (OpenAI) Speech-to-Text
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { audio, language } = JSON.parse(event.body || '{}');
        if (!audio) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Audio data required (base64)' }) };

        const key = process.env.OPENAI_API_KEY;
        if (!key) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured for transcription' }) };

        // Convert base64 to blob for multipart upload
        const audioBuffer = Buffer.from(audio, 'base64');
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);

        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language || 'ro'}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n`),
            audioBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body
        });
        if (!res.ok) throw new Error(`Whisper ${res.status}`);
        const data = await res.json();

        // Log cost (fire-and-forget)
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'whisper-1', input_tokens: 1, output_tokens: 0, endpoint: 'transcribe' })
        }).catch(() => { });

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true, engine: 'whisper',
                text: data.text, model: 'whisper-1',
                language: language || 'ro'
            })
        };
    } catch (error) {
        console.error('Transcribe error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
