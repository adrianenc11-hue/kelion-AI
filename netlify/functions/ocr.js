// OCR - Extract text from images using GPT-4o Vision
const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { image_url, image_base64, language } = JSON.parse(event.body || '{}');
        if (!image_url && !image_base64) return { statusCode: 400, headers, body: JSON.stringify({ error: 'image_url or image_base64 required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const lang = language || 'auto-detect';
        const imageContent = image_url
            ? { type: 'image_url', image_url: { url: image_url } }
            : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Extract ALL text from this image. Language: ${lang}. Return ONLY the extracted text, preserving the original formatting (paragraphs, lists, tables). If no text found, say "No text detected".`
                        },
                        imageContent
                    ]
                }],
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('OCR error:', err);
            return { statusCode: response.status, headers, body: JSON.stringify({ error: 'OCR API error' }) };
        }

        const data = await response.json();
        const extractedText = data.choices?.[0]?.message?.content || '';

        // Log cost
        const u = data.usage || {};
        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'log_usage', model: 'gpt-4o-mini-ocr', input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0, endpoint: 'ocr' })
        }).catch(() => { });

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                text: extractedText,
                word_count: extractedText.split(/\s+/).filter(Boolean).length,
                model: 'gpt-4o-mini'
            })
        };
    } catch (error) {
        console.error('OCR error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
