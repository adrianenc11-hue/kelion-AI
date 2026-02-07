// Audio Podcast Generator - Create podcast-style audio from text/docs (like NotebookLM)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { text, topic, style, language } = JSON.parse(event.body || '{}');
        if (!text && !topic) return { statusCode: 400, headers, body: JSON.stringify({ error: 'text or topic required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const lang = language || 'Romanian';
        const podcastStyle = style || 'conversational'; // conversational, educational, news, storytelling

        // Step 1: Generate podcast script from content
        const scriptRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'system',
                    content: `Create a podcast script in ${lang}. Style: ${podcastStyle}.
Format: A natural monologue explaining the topic clearly and engagingly.
Rules:
- Start with a greeting and topic introduction
- Use conversational language, not robotic
- Include interesting facts and examples
- End with a summary and sign-off
- Keep it 2-3 minutes of speaking time (about 400-600 words)
- Language: ${lang}`
                }, {
                    role: 'user',
                    content: text ? `Create a podcast episode about this content:\n\n${text.substring(0, 8000)}` : `Create a podcast episode about: ${topic}`
                }],
                max_tokens: 2000
            })
        });

        if (!scriptRes.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Script generation failed' }) };

        const scriptData = await scriptRes.json();
        const script = scriptData.choices?.[0]?.message?.content || '';

        // Step 2: Convert to audio via OpenAI TTS
        const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'tts-1',
                input: script.substring(0, 4096), // TTS limit
                voice: 'onyx', // Deep, warm voice for podcasts
                response_format: 'mp3'
            })
        });

        if (!ttsRes.ok) {
            // Return script only if TTS fails
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    script,
                    audio: null,
                    message: 'Script generated but TTS failed. Try ElevenLabs for better voice quality.',
                    word_count: script.split(/\s+/).length
                })
            };
        }

        const audioBuffer = await ttsRes.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        // Log cost
        const u = scriptData.usage || {};
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'podcast-gen', input_tokens: u.prompt_tokens || 0, output_tokens: (u.completion_tokens || 0) + script.length, endpoint: 'podcast' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                script,
                audio: base64Audio,
                format: 'mp3',
                word_count: script.split(/\s+/).length,
                estimated_duration_seconds: Math.round(script.split(/\s+/).length / 2.5), // ~150 wpm
                style: podcastStyle,
                language: lang
            })
        };
    } catch (error) {
        console.error('Podcast error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
