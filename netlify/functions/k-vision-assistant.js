// K Vision Assistant - Eyes for the blind, object recognition + GPS navigation
// Uses Gemini 2.0 Flash for ultra-fast vision (preferred) or GPT-4o as fallback

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { image, mode, lat, lon, question } = JSON.parse(event.body || '{}');
        if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image URL or base64 required' }) };

        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!geminiKey && !openaiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API key configured' }) };

        // Build location context if GPS available
        let locationContext = '';
        if (lat && lon) {
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`, {
                    headers: { 'User-Agent': 'KelionAI/2.0' }
                });
                const geoData = await geoRes.json();
                if (geoData.display_name) locationContext = `\nLocație GPS: ${geoData.display_name}`;
                else locationContext = `\nCoordonate GPS: ${lat}, ${lon}`;
            } catch (e) { locationContext = `\nCoordonate GPS: ${lat}, ${lon}`; }
        }

        // System prompts per mode
        const modePrompts = {
            general: `Descrie detaliat ce vezi în imagine. Identifică obiecte, persoane, texte, culori, spații.${locationContext}`,
            blind_nav: `Ești ochii unui nevăzător. Descrie CLAR și CONCIS: 1) Ce e în fața ta 2) Obstacole/pericole 3) Direcții de mers în siguranță 4) Treceri/semafoare/borduri. Vorbește la persoana a II-a. Fii precis cu distanțele.${locationContext}`,
            facial: `Analizează fețele din imagine: estimare vârstă, gen, expresie facială, emoție dominantă. Descrie fiecare persoană separat.`,
            crowd: `Analizează mulțimea: 1) Estimare număr persoane 2) Densitate (rarefiată/medie/aglomerată) 3) Distribuție spațială 4) Activitate predominantă 5) Identifică grupuri/clustere.${locationContext}`,
            spatial: `Analizează spațiul: 1) Identifică spații libere/ocupate 2) Estimează suprafețe/dimensiuni 3) Sugerează optimizare spațiu 4) Identifică ieșiri/intrări.`,
            measure: `Fă estimări de măsurători: distanțe între obiecte, dimensiuni (înălțime, lățime), proporții. Folosește obiecte de referință (ușă=2m, masă=75cm, persoană=1.7m).`,
            text_read: `Citește și transcrie EXACT tot textul vizibil din imagine: semne, etichete, plăcuțe, ecrane.`,
            custom: question || 'Descrie ce vezi în imagine.'
        };

        const prompt = modePrompts[mode] || modePrompts.general;
        let result = '';
        let engine = '';

        if (geminiKey) {
            // Gemini 2.0 Flash Vision — ultra fast (2-4s)
            const isBase64 = image.startsWith('data:') || !image.startsWith('http');
            let parts = [{ text: prompt }];

            if (isBase64) {
                const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Data } });
            } else {
                // Fetch image and convert to base64 for Gemini
                try {
                    const imgRes = await fetch(image);
                    const imgBuffer = await imgRes.arrayBuffer();
                    const base64 = Buffer.from(imgBuffer).toString('base64');
                    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                    parts.push({ inline_data: { mime_type: contentType, data: base64 } });
                } catch (e) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: `Cannot fetch image from URL: ${e.message}` }) };
                }
            }

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { maxOutputTokens: 2000, temperature: 0.3 }
                })
            });
            const data = await res.json();
            result = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data.error || 'No analysis');
            engine = 'gemini-2.0-flash';
        } else {
            // Fallback: OpenAI GPT-4o Vision
            const OpenAI = require('openai');
            const openai = new OpenAI({ apiKey: openaiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: image } }
                    ]
                }],
                max_tokens: 2000
            });
            result = completion.choices[0]?.message?.content || 'No analysis';
            engine = 'gpt-4o-vision';
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                engine,
                mode: mode || 'general',
                analysis: result,
                location: locationContext || null,
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('Vision error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
