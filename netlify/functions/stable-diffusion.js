// Stable Diffusion / Flux - Image generation via Replicate (alternative to DALL-E)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { prompt, model, width, height, num_outputs } = JSON.parse(event.body || '{}');
        if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt required' }) };

        const token = process.env.REPLICATE_API_TOKEN;
        if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: 'REPLICATE_API_TOKEN not configured' }) };

        // Models: 'flux' (best quality), 'sdxl' (fast), 'sd3' (Stable Diffusion 3)
        const models = {
            flux: {
                version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
                input: { prompt, width: width || 1024, height: height || 1024, num_outputs: num_outputs || 1, guidance: 3.5 }
            },
            sdxl: {
                version: '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
                input: { prompt, width: width || 1024, height: height || 1024, num_outputs: num_outputs || 1 }
            },
            sd3: {
                version: 'sd3-large',
                input: { prompt, width: width || 1024, height: height || 1024 }
            }
        };

        const selected = models[model] || models.flux;

        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ version: selected.version, input: selected.input })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Image gen error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Image generation API error' }) };
        }

        const data = await response.json();

        // Log cost
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: model || 'flux', input_tokens: prompt.length, output_tokens: 0, endpoint: 'stable-diffusion' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                prediction_id: data.id,
                status: data.status,
                model: model || 'flux',
                poll_url: `https://api.replicate.com/v1/predictions/${data.id}`,
                message: 'Image generation started. Poll prediction_id for result.'
            })
        };
    } catch (error) {
        console.error('Stable Diffusion error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
