// DALL-E Image Generation
// POST: { "prompt": "description", "size": "1024x1024", "quality": "hd" }

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    await patchProcessEnv(); // Load vault secrets FIRST
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'config_missing', env: 'OPENAI_API_KEY' }) };
    }

    try {
        const { prompt, size, quality, n } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required' }) };

        // Validate size for DALL-E 3
        const validSizes = ['1024x1024', '1024x1792', '1792x1024'];
        const safeSize = validSizes.includes(size) ? size : '1024x1024';


        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: prompt,
                n: n || 1,
                size: safeSize,
                quality: quality || 'standard',
                response_format: 'url'
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'DALL-E API error');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                images: data.data.map(img => ({ url: img.url, revised_prompt: img.revised_prompt }))
            })
        };
    } catch (error) {
        console.error('DALL-E error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
