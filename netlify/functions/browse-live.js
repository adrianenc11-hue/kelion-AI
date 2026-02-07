// Browse Live - Scrape and analyze web pages in real-time (like Perplexity)
exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { url, question } = JSON.parse(event.body || '{}');
        if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required' }) };

        // Validate URL (prevent SSRF)
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Only HTTP/HTTPS URLs allowed' }) };
        }
        if (parsed.hostname === 'localhost' || parsed.hostname.startsWith('192.168') || parsed.hostname.startsWith('10.') || parsed.hostname === '127.0.0.1') {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Internal URLs blocked for security' }) };
        }

        // Fetch the page
        const pageRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; KelionAI/1.0; +https://kelionai.app)',
                'Accept': 'text/html,application/xhtml+xml,text/plain'
            },
            signal: AbortSignal.timeout(10000)
        });

        if (!pageRes.ok) {
            return { statusCode: 502, headers, body: JSON.stringify({ error: `Failed to fetch page: ${pageRes.status}` }) };
        }

        const html = await pageRes.text();

        // Extract text content (strip HTML tags)
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 10000); // Limit to 10K chars

        // Extract title
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : url;

        // Extract meta description
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const description = metaMatch ? metaMatch[1] : '';

        // If question provided, analyze with AI
        let aiAnalysis = null;
        if (question && process.env.OPENAI_API_KEY) {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{
                        role: 'system',
                        content: 'Analizează conținutul paginii web și răspunde la întrebarea utilizatorului. Citează informații specifice din text. Fii precis și util.'
                    }, {
                        role: 'user',
                        content: `URL: ${url}\nTitlu: ${title}\n\nConținut pagină:\n${textContent}\n\nÎntrebarea mea: ${question}`
                    }],
                    max_tokens: 2000
                })
            });
            if (aiRes.ok) {
                const aiData = await aiRes.json();
                aiAnalysis = aiData.choices?.[0]?.message?.content;
            }
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({
                success: true,
                url,
                title,
                description,
                content_preview: textContent.substring(0, 500),
                content_length: textContent.length,
                ai_analysis: aiAnalysis,
                follow_up_suggestions: [
                    '📋 Rezumă toată pagina',
                    '🔍 Caută informații specifice',
                    '🌐 Traduce conținutul',
                    '📊 Extrage datele structurate'
                ]
            })
        };
    } catch (error) {
        console.error('Browse error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
