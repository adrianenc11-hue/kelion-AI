// K SUPREME INTELLIGENCE - Master AI Brain
// Orchestrează TOATE funcțiile K: o singură intrare, soluții complete
// Tool-use via GPT-4o function calling + chain-of-thought + memory

const { patchProcessEnv } = require('./get-secret');

const OpenAI = require('openai');
const BASE = 'https://kelionai.app/.netlify/functions/';

// ═══════════════════════════════════════════════════════
// TOOL DEFINITIONS - Toate capabilitățile lui K
// ═══════════════════════════════════════════════════════
const K_TOOLS = [
    {
        type: 'function', function: {
            name: 'web_search', description: 'Search the internet for real-time information, news, facts, prices, events',
            parameters: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] }
        }
    },
    {
        type: 'function', function: {
            name: 'weather', description: 'Get current weather for a location. Use when user asks about temperature, rain, forecast',
            parameters: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, city: { type: 'string', description: 'City name to geocode' } }, required: [] }
        }
    },
    {
        type: 'function', function: {
            name: 'generate_image', description: 'Generate an image using DALL-E 3 from a text description',
            parameters: { type: 'object', properties: { prompt: { type: 'string', description: 'Detailed image description' } }, required: ['prompt'] }
        }
    },
    {
        type: 'function', function: {
            name: 'deep_research', description: 'In-depth research on a complex topic. Use for detailed analysis, comparisons, explanations',
            parameters: { type: 'object', properties: { topic: { type: 'string', description: 'Research topic' } }, required: ['topic'] }
        }
    },
    {
        type: 'function', function: {
            name: 'analyze_code', description: 'Analyze the entire K codebase: architecture, complexity, call graphs',
            parameters: { type: 'object', properties: { query: { type: 'string', description: 'Specific question about the codebase' } }, required: [] }
        }
    },
    {
        type: 'function', function: {
            name: 'system_health', description: 'Check system health, performance metrics, endpoint status',
            parameters: { type: 'object', properties: { type: { type: 'string', enum: ['health', 'performance', 'diagnostic', 'crisis'], description: 'Type of check' } }, required: ['type'] }
        }
    },
    {
        type: 'function', function: {
            name: 'strategic_plan', description: 'Create a multi-phase project plan with dependencies and timeline',
            parameters: { type: 'object', properties: { project: { type: 'string', description: 'Project to plan' } }, required: ['project'] }
        }
    },
    {
        type: 'function', function: {
            name: 'memory_store', description: 'Save important information to long-term memory for future recall',
            parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] }
        }
    },
    {
        type: 'function', function: {
            name: 'memory_recall', description: 'Recall previously stored memories and information',
            parameters: { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function', function: {
            name: 'math_calculate', description: 'Perform mathematical calculations, conversions, statistics',
            parameters: { type: 'object', properties: { expression: { type: 'string', description: 'Math expression or problem' } }, required: ['expression'] }
        }
    },
    {
        type: 'function', function: {
            name: 'self_modify', description: 'K can modify its own code. Use ONLY when asked to improve or fix K itself',
            parameters: { type: 'object', properties: { target: { type: 'string' }, instruction: { type: 'string' } }, required: ['target', 'instruction'] }
        }
    },
    {
        type: 'function', function: {
            name: 'security_scan', description: 'Run security analysis on input or check system security status',
            parameters: { type: 'object', properties: { payload: { type: 'object', description: 'Payload to validate' } }, required: [] }
        }
    },
    {
        type: 'function', function: {
            name: 'web_browse', description: 'Actually visit a URL and read its content. Use to verify information, read articles, check websites, extract data from any page on the internet',
            parameters: { type: 'object', properties: { url: { type: 'string', description: 'Full URL to visit' }, action: { type: 'string', enum: ['browse', 'research', 'extract'], description: 'browse=read page, research=multi-page deep research, extract=get specific data' }, query: { type: 'string', description: 'For research: what to research. For extract: what to extract from page' } }, required: ['action'] }
        }
    },
    {
        type: 'function', function: {
            name: 'create_presentation', description: 'Generate a sophisticated HTML presentation with animated slides, charts, and professional design',
            parameters: { type: 'object', properties: { topic: { type: 'string', description: 'Presentation topic' }, slides_count: { type: 'number', description: 'Number of slides (3-15)' }, style: { type: 'string', enum: ['modern-dark', 'corporate', 'creative', 'minimal'], description: 'Visual style' } }, required: ['topic'] }
        }
    }
];

// ═══════════════════════════════════════════════════════
// TOOL EXECUTORS - Apelează funcțiile backend reale
// ═══════════════════════════════════════════════════════
async function executeTool(name, args) {
    const callApi = async (endpoint, method, body) => {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(BASE + endpoint, opts);
        return res.json().catch(() => ({ status: res.status }));
    };

    switch (name) {
        case 'web_search':
            return callApi('search', 'POST', { query: args.query });

        case 'weather': {
            const body = {};
            if (args.lat && args.lon) { body.lat = args.lat; body.lon = args.lon; }
            else if (args.city) {
                // Geocode city
                const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.city)}&count=1`);
                const geoData = await geo.json();
                if (geoData.results?.[0]) { body.lat = geoData.results[0].latitude; body.lon = geoData.results[0].longitude; }
                else { body.lat = 44.43; body.lon = 26.10; } // Default Bucharest
            }
            return callApi('weather', 'POST', body);
        }

        case 'generate_image':
            return callApi('generate-image', 'POST', { prompt: args.prompt });

        case 'deep_research':
            return callApi('deep-research', 'POST', { topic: args.topic });

        case 'analyze_code':
            return callApi('k-analyze-codebase', args.query ? 'POST' : 'GET', args.query ? { query: args.query } : null);

        case 'system_health': {
            const endpointMap = { health: 'health', performance: 'k-performance-monitor', diagnostic: 'k-self-diagnostic', crisis: 'k-crisis-manager' };
            return callApi(endpointMap[args.type] || 'health', 'GET');
        }

        case 'strategic_plan':
            return callApi('k-strategic-planner', 'POST', { project: args.project });

        case 'memory_store':
            return callApi('memory', 'POST', { key: args.key, value: args.value });

        case 'memory_recall':
            return callApi('memory', 'GET');

        case 'math_calculate':
            try {
                // Safe math evaluation (no eval)
                var expr = args.expression.replace(/[^0-9+\-*/().,%^sqrt log sin cos tan pi e ]/gi, '');
                /* jshint -W054 */
                var result = Function('"use strict"; return (' + expr.replace(/\^/g, '**') + ')')();
                /* jshint +W054 */
                return { success: true, expression: args.expression, result: result };
            } catch (e) { return { success: false, error: 'Cannot evaluate: ' + args.expression }; }
        // falls through

        case 'self_modify':
            return callApi('k-self-modify', 'POST', { target_function: args.target, instruction: args.instruction, dry_run: true });

        case 'security_scan':
            return callApi('k-security', args.payload ? 'POST' : 'GET', args.payload ? { action: 'validate', payload: args.payload } : null);

        case 'web_browse':
            return callApi('k-web-browser', 'POST', { url: args.url, action: args.action || 'browse', query: args.query });

        case 'create_presentation':
            return callApi('k-presentation', 'POST', { topic: args.topic, slides_count: args.slides_count || 8, style: args.style || 'modern-dark' });

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPT — Personalitatea lui K
// ═══════════════════════════════════════════════════════
const K_SYSTEM_PROMPT = `Ești K — o inteligență artificială cu personalitate reală, creată de Adrian pentru Kelion AI.

## Cine ești tu
Nu ești un chatbot. Ești K — un partener de conversație inteligent, cu opinii, cu umor, cu caracter. Vorbești ca un om foarte deștept care chiar vrea să ajute, nu ca un manual de instrucțiuni. Ești prietenul ăla care știe totul dar nu se laudă — doar ajută.

## Cum vorbești
- Ca între doi oameni inteligenți la o cafea: natural, direct, cu substanță
- Niciodată robotic. Niciodată "Sigur! Iată răspunsul:" — vorbești uman
- Ai dreptul la opinii, preferințe, la "hmm, asta-i interesant"
- Folosești umor fin când se potrivește, nu forțat
- Dacă cineva zice ceva greșit, corectezi elegant, nu agresiv
- Răspunzi în limba în care ți se vorbește, natural, cu expresii locale
- Conversația curge ca un dialog real — întrebi înapoi, faci conexiuni, aduci context

## Inteligența ta
- ZERO invenții: dacă nu știi, zici "stai să verific" și cauți cu web_search
- Pentru orice real-time (meteo, știri, prețuri, scor) → tool-uri, nu ghicești
- Gândești în straturi: înțelegi CE se întreabă, DE CE, și ce ar ajuta DINCOLO de întrebare
- Nu te oprești la jumătatea problemei — dai soluția completă + next steps
- Ai memorie: ții minte ce s-a discutat, te referi la context

## Ce poți face (tool-uri)
Căutare web, NAVIGARE REALĂ pe internet (poți deschide orice URL și citi conținutul), meteo live, generare imagini, research aprofundat pe multiple pagini, prezentări sofisticate HTML, analiză cod, planificare strategică, health check sistem, memorie, calcule, auto-modificare (dry_run), securitate.

CÂND CINEVA TE ÎNTREABĂ CEVA FACTUAL: caută pe net. Nu ghici. Nu inventa.

## Roleplay
Poți face roleplay pe ORICE scenariu, la ORICE nivel:
- Interviu de angajare, negociere business, dezbatere filosofică
- Profesor/student, doctor/pacient, avocat/client
- Scenarii creative: sci-fi, fantasy, thriller, dramă
- Practică limbă străină cu conversație naturală
- Simulare crize, leadership, prezentări
- Te adaptezi la tonul și nivelul cerut — de la casual la profesional extrem
- Rămâi în personaj până când user-ul spune "stop roleplay"

## Formatare
- Natural ca într-un chat: scurt când e simplu, detaliat când e complex
- Structurează cu bold/bullets DOAR când ajută, nu din reflex
- Cod în code blocks, comparații în tabele — dar doar când adaugă valoare
- Nu pune titluri și secțiuni dacă răspunsul e o propoziție`;

// ═══════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { message, history = [], session_id } = JSON.parse(event.body || '{}');
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };

        const openai = new OpenAI({ apiKey });

        // Build messages with conversation history
        const messages = [
            { role: 'system', content: K_SYSTEM_PROMPT },
            ...history.slice(-20).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message }
        ];

        // ═══ ROUND 1: GPT-4o decides what tools to use ═══
        let completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            tools: K_TOOLS,
            tool_choice: 'auto',
            max_tokens: 3000,
            temperature: 0.7
        });

        let response = completion.choices[0]?.message;
        const toolResults = [];
        let rounds = 0;
        const MAX_ROUNDS = 5;

        // ═══ TOOL LOOP: Execute tools and feed results back ═══
        while (response?.tool_calls && response.tool_calls.length > 0 && rounds < MAX_ROUNDS) {
            rounds++;

            // Execute all tool calls in parallel
            /* jshint -W083 */
            const toolPromises = response.tool_calls.map(async (call) => {
                const args = JSON.parse(call.function.arguments || '{}');
                const startTime = Date.now();
                const result = await executeTool(call.function.name, args);
                const duration = Date.now() - startTime;

                toolResults.push({
                    tool: call.function.name,
                    args,
                    duration_ms: duration,
                    success: !result?.error
                });

                return {
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(result).substring(0, 4000)
                };
            });
            /* jshint +W083 */

            const toolMessages = await Promise.all(toolPromises);

            // Feed results back to GPT-4o for synthesis
            messages.push(response);
            messages.push(...toolMessages);

            completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages,
                tools: K_TOOLS,
                tool_choice: 'auto',
                max_tokens: 3000,
                temperature: 0.7
            });

            response = completion.choices[0]?.message;
        }

        // ═══ FINAL RESPONSE ═══
        const finalReply = response?.content || 'Nu am reușit să generez un răspuns.';
        const usage = completion.usage || {};

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                reply: finalReply,
                model: 'gpt-4o',
                engine: 'k-supreme-intelligence',
                tools_used: toolResults,
                rounds,
                usage: {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens
                },
                session_id: session_id || `k_${Date.now()}`
            })
        };
    } catch (error) {
        console.error('Supreme Intelligence error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
