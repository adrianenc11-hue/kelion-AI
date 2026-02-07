// K Web Browser - Real web navigation, content extraction, multi-page research
const OpenAI = require('openai');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { url, action, query } = JSON.parse(event.body || '{}');

        // ═══ ACTION: BROWSE — Fetch and extract content from URL ═══
        if (action === 'browse' || url) {
            if (!url) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL required for browsing' }) };

            // Security: validate URL
            const validUrl = new URL(url);
            const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.16.'];
            if (blocked.some(b => validUrl.hostname.includes(b))) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Blocked: internal URLs not allowed' }) };

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'KelionAI/2.0 (Web Research Bot)',
                    'Accept': 'text/html,application/json,text/plain,*/*',
                    'Accept-Language': 'en-US,en;q=0.9,ro;q=0.8'
                },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) return { statusCode: 200, headers, body: JSON.stringify({ success: false, status: response.status, error: `Failed to fetch: ${response.statusText}` }) };

            const contentType = response.headers.get('content-type') || '';
            let content = '';

            if (contentType.includes('application/json')) {
                const json = await response.json();
                content = JSON.stringify(json, null, 2).substring(0, 8000);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, url, title: 'JSON Response', content: content.substring(0, 6000), content_length: content.length, fetched_at: new Date().toISOString() }) };
            } else {
                const html = await response.text();
                const title = extractTitle(html);
                content = extractText(html);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, url, title, content: content.substring(0, 6000), content_length: content.length, fetched_at: new Date().toISOString() }) };
            }
        }

        // ═══ ACTION: RESEARCH — Multi-URL deep research ═══
        if (action === 'research') {
            if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query required for research' }) };
            if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

            // Step 1: Search for relevant URLs
            const searchKey = process.env.TAVILY_API_KEY;
            let sources = [];

            if (searchKey) {
                const searchRes = await fetch('https://api.tavily.com/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: searchKey, query, max_results: 5, include_raw_content: true })
                });
                const searchData = await searchRes.json();
                sources = (searchData.results || []).map(r => ({ title: r.title, url: r.url, content: (r.raw_content || r.content || '').substring(0, 2000) }));
            } else {
                // Fallback: use Google via fetch
                const googleRes = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`, {
                    headers: { 'User-Agent': 'KelionAI/2.0' }
                }).catch(() => null);
                if (googleRes) {
                    const html = await googleRes.text();
                    const links = html.match(/https?:\/\/[^\s"<>]+/g) || [];
                    const uniqueLinks = [...new Set(links.filter(l => !l.includes('google.') && !l.includes('gstatic')))].slice(0, 3);
                    for (const link of uniqueLinks) {
                        try {
                            const pageRes = await fetch(link, { headers: { 'User-Agent': 'KelionAI/2.0' }, signal: AbortSignal.timeout(8000) });
                            const pageHtml = await pageRes.text();
                            sources.push({ title: extractTitle(pageHtml), url: link, content: extractText(pageHtml).substring(0, 2000) });
                        } catch (e) { /* skip failed pages */ }
                    }
                }
            }

            // Step 2: Synthesize with AI
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const synthesis = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a research analyst. Synthesize information from multiple sources into a comprehensive, well-structured report. Cite sources. Be thorough but readable.' },
                    { role: 'user', content: `Research query: ${query}\n\nSources:\n${sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.content}`).join('\n\n')}` }
                ],
                max_tokens: 3000
            });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, query, research: synthesis.choices[0]?.message?.content, sources_count: sources.length, sources: sources.map(s => ({ title: s.title, url: s.url })) }) };
        }

        // ═══ ACTION: EXTRACT — Extract specific data from page ═══
        if (action === 'extract') {
            if (!url || !query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL and query required for extraction' }) };
            if (!process.env.OPENAI_API_KEY) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

            const pageRes = await fetch(url, { headers: { 'User-Agent': 'KelionAI/2.0' }, signal: AbortSignal.timeout(15000) });
            const pageHtml = await pageRes.text();
            const pageText = extractText(pageHtml);

            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const extraction = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Extract the requested information from the page content. Be precise and factual.' },
                    { role: 'user', content: `Page content from ${url}:\n${pageText.substring(0, 5000)}\n\nExtract: ${query}` }
                ],
                max_tokens: 1000
            });

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, url, query, extracted: extraction.choices[0]?.message?.content }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action required: browse, research, or extract' }) };
    } catch (error) {
        console.error('Web browser error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ HTML Text Extraction Utilities ═══
function extractText(html) {
    if (!html) return '';
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function extractTitle(html) {
    if (!html) return 'Untitled';
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : 'Untitled';
}
