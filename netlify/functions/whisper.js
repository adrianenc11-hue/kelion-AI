// Whisper Function - Speech to Text via OpenAI (fetch API)
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { audio } = JSON.parse(event.body || '{}');
        if (!audio) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Audio data required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        // Use fetch + FormData instead of OpenAI SDK to avoid File/toFile issues
        const FormData = require('form-data');
        const audioBuffer = Buffer.from(audio, 'base64');

        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'audio.webm', contentType: 'audio/webm' });
        form.append('model', 'whisper-1');
        form.append('language', 'ro');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Whisper API error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Whisper API error' }) };
        }

        const data = await response.json();

        // Log cost: Whisper = $0.006/min, estimate duration from buffer size (~10KB/sec for webm)
        const estMinutes = Math.max(0.1, (audioBuffer.length / 10240) / 60);
        const cost = estMinutes * 0.006;
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'whisper-1', input_tokens: Math.round(estMinutes * 60), output_tokens: 0, estimated_cost: cost, endpoint: 'whisper' })
        }).catch(() => { });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, text: data.text })
        };
    } catch (error) {
        console.error('Whisper error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
