// ═══ GENERATE VIDEO — Runway ML API Integration ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'generate': return respond(200, await generateVideo(body));
            case 'status': return respond(200, await checkStatus(body));
            case 'styles': return respond(200, getStyles());
            default: return respond(400, { error: 'Actions: generate, status, styles' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function generateVideo({ prompt, style = 'cinematic', duration = 4, image_url }) {
    if (!prompt) return { error: 'Prompt required' };
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) {
        // Fallback: generate video concept via smart-brain
        const fetch = (await import('node-fetch')).default;
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const brainRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: `Create a detailed video storyboard/concept for: "${prompt}". Style: ${style}. Duration: ${duration}s. Provide scene-by-scene description.`,
                mode: 'creative'
            })
        });
        const brainData = await brainRes.json();
        return {
            type: 'concept',
            prompt,
            style,
            storyboard: brainData.reply || brainData.answer,
            note: '⚠️ RUNWAY_API_KEY not configured. Showing AI concept. Add key for real video generation.',
            ai_generated: true
        };
    }

    // Real Runway ML Gen-3 Alpha API call
    const fetch = (await import('node-fetch')).default;
    const payload = {
        promptText: prompt,
        model: 'gen3a_turbo',
        duration,
        ...(image_url ? { promptImage: image_url } : {})
    };

    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-Runway-Version': '2024-11-06'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) return { error: data.error || `Runway API error: ${res.status}`, details: data };

    return {
        id: data.id,
        status: data.status || 'processing',
        prompt,
        style,
        duration,
        estimated_time: '30-60 seconds',
        note: 'Use action "status" with the id to check progress'
    };
}

async function checkStatus({ id }) {
    if (!id) return { error: 'Task id required' };
    const apiKey = process.env.RUNWAY_API_KEY;
    if (!apiKey) return { error: 'RUNWAY_API_KEY not configured' };

    const fetch = (await import('node-fetch')).default;
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' }
    });
    const data = await res.json();
    return {
        id,
        status: data.status,
        progress: data.progress || 0,
        output: data.output || null,
        failure: data.failure || null
    };
}

function getStyles() {
    return {
        styles: [
            { id: 'cinematic', name: '🎬 Cinematic', desc: 'Hollywood-quality video' },
            { id: 'artistic', name: '🎨 Artistic', desc: 'Stylized, painterly look' },
            { id: 'realistic', name: '📷 Realistic', desc: 'Photorealistic footage' },
            { id: 'anime', name: '🎌 Anime', desc: 'Japanese animation style' },
            { id: '3d', name: '🧊 3D Render', desc: '3D rendered scenes' },
            { id: 'timelapse', name: '⏰ Timelapse', desc: 'Time-lapse effect' }
        ]
    };
}
