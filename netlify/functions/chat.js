// Chat Function - INTELLIGENT ROUTER with Function Calling
// K detects user intent and routes to the right capability:
// search, image gen, translate, weather, calendar, notes, code, math, video, music
// Cascade AI: OpenAI GPT-4o-mini → Gemini Flash → DeepSeek

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const BASE_URL = process.env.URL || 'https://kelionai.app';

// ═══ TRACE HELPER — direct Supabase write (no HTTP self-call) ═══
let _traceSessionId = null;
let _traceMessage = null;
let _traceSupabase = null;

function getTraceDb() {
    if (_traceSupabase) return _traceSupabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _traceSupabase = createClient(url, key);
    return _traceSupabase;
}

async function emitTrace(node, direction, label, traceType) {
    try {
        const db = getTraceDb();
        if (!db) return;
        await db.from('ai_trace').insert({
            session_id: _traceSessionId || Date.now().toString(),
            node, direction, label,
            trace_type: traceType || 'text',
            metadata: { message: (_traceMessage || '').substring(0, 100) }
        });
    } catch (e) { /* ignore trace errors silently */ }
}

// ═══ TOOLS K CAN USE ═══
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_web',
            description: 'Search the internet for current information, news, facts, prices, events, people, companies, etc.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Search query' } },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_image',
            description: 'Generate an image from a text description. Use when user asks to create, draw, generate, or make an image/picture/photo.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'Detailed image description in English' },
                    style: { type: 'string', enum: ['natural', 'vivid'], description: 'Image style' }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'translate_text',
            description: 'Translate text to another language.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Text to translate' },
                    target: { type: 'string', description: 'Target language code (e.g. en, ro, fr, de, es, it, ja, zh, ko)' },
                    source: { type: 'string', description: 'Source language code (optional)' }
                },
                required: ['text', 'target']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Get current weather for a location.',
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string', description: 'City name or location' },
                    lat: { type: 'number', description: 'Latitude (optional)' },
                    lon: { type: 'number', description: 'Longitude (optional)' }
                },
                required: ['location']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'do_math',
            description: 'Solve math problems, equations, conversions, or scientific calculations using Wolfram Alpha.',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Math query or equation' } },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'run_code',
            description: 'Execute JavaScript code and return the result. Use for calculations, data processing, or code demonstrations.',
            parameters: {
                type: 'object',
                properties: { code: { type: 'string', description: 'JavaScript code to execute' } },
                required: ['code']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_video',
            description: 'Generate a video from a text description.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'Video description' },
                    duration: { type: 'number', description: 'Duration in seconds (default 4)' }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'generate_music',
            description: 'Generate music from a text description.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'Music description (genre, mood, instruments)' },
                    duration: { type: 'number', description: 'Duration in seconds (default 10)' }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'manage_notes',
            description: 'Create, list, or search notes.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['create', 'list', 'search'], description: 'Action to perform' },
                    title: { type: 'string', description: 'Note title (for create)' },
                    content: { type: 'string', description: 'Note content (for create)' },
                    query: { type: 'string', description: 'Search query (for search)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'browse_webpage',
            description: 'Read and extract content from a specific URL/webpage.',
            parameters: {
                type: 'object',
                properties: { url: { type: 'string', description: 'URL to browse' } },
                required: ['url']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'manage_calendar',
            description: 'Create, list, or manage calendar events and reminders.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['create', 'list', 'delete'], description: 'Action' },
                    title: { type: 'string', description: 'Event title' },
                    date: { type: 'string', description: 'Event date (YYYY-MM-DD)' },
                    time: { type: 'string', description: 'Event time (HH:MM)' },
                    description: { type: 'string', description: 'Event description' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'deep_research',
            description: 'Perform deep, comprehensive research on a complex topic. Use for detailed analysis, multi-source investigation, academic research.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Research topic or question' },
                    depth: { type: 'string', enum: ['quick', 'standard', 'deep'], description: 'Research depth' }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_podcast',
            description: 'Generate an AI podcast episode on a topic with spoken audio.',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'Podcast topic' },
                    style: { type: 'string', enum: ['conversational', 'educational', 'news'], description: 'Podcast style' },
                    duration: { type: 'number', description: 'Duration in minutes (default 5)' }
                },
                required: ['topic']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_text_from_image',
            description: 'Extract text from an image using OCR. Use when user shares an image and wants the text extracted.',
            parameters: {
                type: 'object',
                properties: {
                    image_url: { type: 'string', description: 'URL of the image to extract text from' },
                    image_base64: { type: 'string', description: 'Base64-encoded image data' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'analyze_image',
            description: 'Analyze and describe what is in an image. Use for image recognition, object detection, scene description.',
            parameters: {
                type: 'object',
                properties: {
                    image_url: { type: 'string', description: 'URL of the image to analyze' },
                    question: { type: 'string', description: 'Specific question about the image' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_presentation',
            description: 'Create a slide presentation on a topic.',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'Presentation topic' },
                    slides: { type: 'number', description: 'Number of slides (default 5)' },
                    style: { type: 'string', description: 'Style: professional, creative, minimal' }
                },
                required: ['topic']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'draw_on_canvas',
            description: 'Create a drawing, diagram, or visual on the canvas workspace.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['create', 'clear', 'export'], description: 'Canvas action' },
                    description: { type: 'string', description: 'What to draw or create' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_email',
            description: 'Send an email to someone. Use when user asks to email or send a message to someone.',
            parameters: {
                type: 'object',
                properties: {
                    to: { type: 'string', description: 'Recipient email address' },
                    subject: { type: 'string', description: 'Email subject' },
                    body: { type: 'string', description: 'Email body content' }
                },
                required: ['to', 'subject', 'body']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'strategic_planning',
            description: 'Create strategic plans, business analysis, SWOT analysis, project planning.',
            parameters: {
                type: 'object',
                properties: {
                    topic: { type: 'string', description: 'What to plan or analyze' },
                    type: { type: 'string', enum: ['business_plan', 'swot', 'project_plan', 'market_analysis', 'general'], description: 'Type of plan' }
                },
                required: ['topic']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'save_memory',
            description: 'Save important information to long-term memory. Use when user says "remember this", "save this", "note this down for later".',
            parameters: {
                type: 'object',
                properties: {
                    content: { type: 'string', description: 'Information to remember' },
                    category: { type: 'string', description: 'Category: preference, fact, task, contact, important' },
                    tags: { type: 'string', description: 'Comma-separated tags for easy recall' }
                },
                required: ['content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'recall_memory',
            description: 'Recall saved memories. Use when user asks "do you remember", "what did I tell you about", "what do you know about me".',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'What to search in memory' },
                    category: { type: 'string', description: 'Filter by category' }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'semantic_search',
            description: 'Search through stored knowledge and documents using semantic similarity. Use for finding related information.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    top_k: { type: 'number', description: 'Number of results (default 5)' }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_aloud',
            description: 'Convert text to speech and read it aloud. Use when user says "read this", "say this out loud", "speak this".',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Text to speak' },
                    voice: { type: 'string', description: 'Voice selection (default auto)' },
                    language: { type: 'string', description: 'Language code (auto-detected if not specified)' }
                },
                required: ['text']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'manage_user_profile',
            description: 'Get or update user profile data, preferences, settings.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['get', 'update'], description: 'Action' },
                    field: { type: 'string', description: 'Profile field to get/update' },
                    value: { type: 'string', description: 'New value (for update)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'supreme_intelligence',
            description: 'Engage supreme AI mode for extremely complex problems. Uses multiple AI models in parallel for the best possible answer. Use for hard questions, complex analysis, or when the user wants the most thorough answer.',
            parameters: {
                type: 'object',
                properties: {
                    question: { type: 'string', description: 'Complex question to analyze' },
                    depth: { type: 'string', enum: ['standard', 'deep', 'maximum'], description: 'Analysis depth' }
                },
                required: ['question']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'send_group_message',
            description: 'Send a message to a group chat.',
            parameters: {
                type: 'object',
                properties: {
                    group_id: { type: 'string', description: 'Group ID' },
                    message: { type: 'string', description: 'Message to send' }
                },
                required: ['message']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'share_location',
            description: 'Share current location or find location of group members.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['share', 'find', 'track'], description: 'Action' },
                    lat: { type: 'number', description: 'Latitude' },
                    lon: { type: 'number', description: 'Longitude' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'transcribe_audio',
            description: 'Transcribe audio to text. Converts spoken words to written text. Multi-engine: Whisper, AssemblyAI, Deepgram.',
            parameters: {
                type: 'object',
                properties: {
                    audio_base64: { type: 'string', description: 'Base64-encoded audio data' },
                    language: { type: 'string', description: 'Language code (default: ro)' }
                },
                required: ['audio_base64']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'export_document',
            description: 'Generate and export documents in various formats. Creates downloadable files: PDF, DOCX, XLSX, CSV, PPTX, TXT, HTML. Use when user asks to create, export, download, or save a document, report, spreadsheet, or presentation.',
            parameters: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['pdf', 'docx', 'xlsx', 'csv', 'pptx', 'txt', 'html'], description: 'Output format' },
                    content: { type: 'string', description: 'Document content (text, data)' },
                    title: { type: 'string', description: 'Document title' },
                    data: { type: 'array', items: { type: 'object' }, description: 'Structured data for spreadsheets [{label, value}]' },
                    columns: { type: 'array', items: { type: 'string' }, description: 'Column headers for spreadsheets' }
                },
                required: ['format', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'chart_generator',
            description: 'Generate visual charts and graphs from data. Supports: bar, pie, donut, line, scatter, radar, horizontal_bar. Returns an SVG image. Use when user asks to visualize data, create a chart, graph, or diagram from numbers.',
            parameters: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['bar', 'pie', 'donut', 'line', 'scatter', 'radar', 'horizontal_bar'], description: 'Chart type' },
                    data: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'number' } } }, description: 'Data points [{label, value}]' },
                    title: { type: 'string', description: 'Chart title' },
                    colors: { type: 'array', items: { type: 'string' }, description: 'Custom colors (hex)' }
                },
                required: ['type', 'data']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'set_role',
            description: 'Set K\'s role/profession to specialize its responses. K becomes a specialist in that field (e.g. profesor, doctor, avocat, contabil, inginer, etc). The role persists across messages. Use when user says "fii profesor", "ești doctor", "comportă-te ca un avocat", etc.',
            parameters: {
                type: 'object',
                properties: {
                    role: { type: 'string', description: 'Role name (e.g. profesor, doctor, avocat, contabil, inginer, antrenor, chef, designer)' },
                    description: { type: 'string', description: 'Specific role description or specialization' },
                    country: { type: 'string', description: 'Country for localized regulations (e.g. Romania, UK, US, Germany)' }
                },
                required: ['role']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'pension_calculator',
            description: 'Calculator pensii și informații legislație pensionare. Calculează pensie estimativă, verifică drepturi, listează documente necesare, oferă informații despre pensie de urmaș. Suportă: România, UK, USA, Germania, Franța, Spania, Italia. Folosește când utilizatorul întreabă despre pensie, pensionare, recalculare, drepturi pensionari, sau legislație pensii.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['calculate', 'check_rights', 'documents_needed', 'recalculate', 'info', 'retirement_age', 'survivor_pension'], description: 'Action to perform' },
                    country: { type: 'string', description: 'Country (Romania, UK, US, Germany, France, Spain, Italy)' },
                    years_worked: { type: 'number', description: 'Years of contribution/work' },
                    salary_average: { type: 'number', description: 'Average monthly salary' },
                    gender: { type: 'string', enum: ['M', 'F'], description: 'Gender (M/F)' },
                    birth_year: { type: 'number', description: 'Year of birth' },
                    work_group: { type: 'number', enum: [1, 2, 3], description: 'Work group (Romania: 1, 2, or 3)' },
                    age: { type: 'number', description: 'Current age' },
                    deceased_pension: { type: 'number', description: 'Deceased person pension amount (for survivor pension)' },
                    num_survivors: { type: 'number', description: 'Number of survivors (for survivor pension)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'legal_database_pension',
            description: 'Baza de date legislație pensii. Caută legi, articole, drepturi pensionari, FAQ pensii, modificări legislative recente, instituții. Folosește când utilizatorul întreabă despre o lege specifică de pensii, drepturi pensionari, sau vrea detalii juridice.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['search', 'get_law', 'get_rights', 'faq', 'recent_changes', 'institutions'], description: 'Action' },
                    country: { type: 'string', description: 'Country (default: Romania)' },
                    topic: { type: 'string', description: 'Law ID or topic to search' },
                    keyword: { type: 'string', description: 'Search keyword' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'document_checker',
            description: 'Verificare dosar pensionare. Verifică dacă dosarul e complet, oferă checklist documente necesare, modele cereri (pensionare, contestație, recalculare), și calendar pas cu pas. Folosește când pensionarul întreabă ce documente trebuie, dacă are totul pregătit, sau cum depune dosarul.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['check_completeness', 'get_checklist', 'get_templates', 'timeline'], description: 'Action' },
                    country: { type: 'string', description: 'Country (default: Romania)' },
                    pension_type: { type: 'string', enum: ['limita_varsta', 'anticipata', 'invaliditate', 'urmas'], description: 'Pension type' },
                    documents_have: { type: 'array', items: { type: 'string' }, description: 'IDs of documents already collected' },
                    age: { type: 'number', description: 'Person age' },
                    gender: { type: 'string', enum: ['M', 'F'], description: 'Gender' },
                    work_group: { type: 'number', enum: [1, 2, 3], description: 'Work group' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'template_generator',
            description: 'Generează modele de documente profesionale: contracte (prestări servicii, muncă, închiriere), cereri (concediu, demisie), adeverințe, procuri, notificări, scrisori (intenție, recomandare). Completează automat cu datele furnizate.',
            parameters: {
                type: 'object',
                properties: {
                    template: { type: 'string', description: 'Template ID: contract_prestari_servicii, contract_munca, contract_inchiriere, cerere_concediu, cerere_demisie, adeverinta_venit, procura_generala, notificare_reziliere, scrisoare_intentie, scrisoare_recomandare' },
                    data: { type: 'object', description: 'Data to fill in the template fields' },
                    language: { type: 'string', description: 'Language (default: ro)' }
                },
                required: ['template']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'invoice_generator',
            description: 'Generează facturi profesionale conforme legislației RO. Include: date furnizor/client, articole, TVA, total în litere. Poate valida completitudinea facturii.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'calculate_totals', 'validate'], description: 'Action' },
                    serie: { type: 'string', description: 'Invoice series' },
                    numar: { type: 'string', description: 'Invoice number' },
                    furnizor: { type: 'object', description: 'Supplier info: denumire, cui, reg_com, adresa, banca, iban' },
                    client: { type: 'object', description: 'Client info: denumire, cui, reg_com, adresa' },
                    items: { type: 'array', items: { type: 'object' }, description: 'Line items: descriere, um, cantitate, pret_unitar' },
                    tva_rate: { type: 'number', description: 'TVA rate (default: 19)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'financial_calculator',
            description: 'Calculator financiar: ROI, dobânzi (simplă/compusă), rate credit (anuitare/descrescătoare), amortizare, salariu net RO 2025, TVA, cash flow, break even, inflație, conversie valutară, profit margin, depreciere.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', description: 'Calculator: roi, dobanda_simpla, dobanda_compusa, credit_rate, amortizare, salariu_net, tva, cash_flow, break_even, inflatie, conversie_valutara, profit_margin, depreciere' },
                    suma: { type: 'number' }, principal: { type: 'number' }, investitie: { type: 'number' }, castig: { type: 'number' },
                    rata_anuala: { type: 'number' }, ani: { type: 'number' }, salariu_brut: { type: 'number' },
                    rata_tva: { type: 'number' }, costuri_fixe: { type: 'number' }, pret_unitar: { type: 'number' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'quiz_generator',
            description: 'Generator de teste cu notare automată. Creează teste cu întrebări grilă, adevărat/fals, completare, răspuns scurt, potrivire, ordonare. Notare pe scala RO (1-10), feedback detaliat, statistici clasă.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'grade', 'stats'], description: 'Action' },
                    subject: { type: 'string', description: 'Subject/materie' },
                    topic: { type: 'string', description: 'Specific topic' },
                    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Difficulty' },
                    num_questions: { type: 'number', description: 'Number of questions' },
                    questions: { type: 'array', items: { type: 'object' }, description: 'Questions array (for grading)' },
                    answers: { type: 'array', items: { type: 'string' }, description: 'Answers array (for grading)' },
                    scores: { type: 'array', items: { type: 'number' }, description: 'Scores array (for stats)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'booking_system',
            description: 'Sistem programări: creare, verificare disponibilitate, anulare, reprogramare, generare sloturi, remindere. Pentru medici, saloane, service-uri, consultanți.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['create', 'check_availability', 'cancel', 'reschedule', 'list', 'generate_slots', 'reminder'], description: 'Action' },
                    client_name: { type: 'string' }, client_phone: { type: 'string' }, client_email: { type: 'string' },
                    service: { type: 'string' }, provider: { type: 'string' },
                    date: { type: 'string' }, time: { type: 'string' },
                    duration_minutes: { type: 'number' }, booking_id: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'progress_tracker',
            description: 'Urmărire progres: elevi (note, prezență), pacienți (tensiune, glicemie), proiecte (completare, buget), fitness (greutate, pași), obiective. Rapoarte cu statistici și tendințe.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['create_tracker', 'add_entry', 'get_report', 'set_goals', 'evaluate'], description: 'Action' },
                    type: { type: 'string', enum: ['student', 'patient', 'project', 'fitness', 'objective'] },
                    name: { type: 'string' }, tracker_id: { type: 'string' },
                    values: { type: 'object' }, entries: { type: 'array', items: { type: 'object' } }, goals: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'report_generator',
            description: 'Generator rapoarte profesionale: activitate, financiar, vânzări, minută ședință, plan business, cercetare, elev, medical, tehnic, incident, evaluare performanță, status proiect. 12 template-uri formatate.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'templates'], description: 'Action' },
                    template: { type: 'string', description: 'Template: raport_activitate, raport_financiar, raport_vanzari, minuta_sedinta, plan_business, raport_cercetare, raport_elev, raport_medical, raport_tehnic, raport_incident, evaluare_performanta, raport_proiect' },
                    data: { type: 'object', description: 'Report data to fill sections' },
                    title_override: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'inventory_tracker',
            description: 'Gestiune stocuri: adăugare produse, actualizare stoc (intrare/ieșire/ajustare), verificare nivel, alerte stoc scăzut, rapoarte, evaluare stoc. Pentru magazine, depozite, farmacii.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['add_product', 'update_stock', 'check_stock', 'low_stock_alert', 'stock_report', 'movement_log', 'valuation'], description: 'Action' },
                    name: { type: 'string' }, sku: { type: 'string' }, category: { type: 'string' },
                    quantity: { type: 'number' }, unit: { type: 'string' }, price: { type: 'number' },
                    min_stock: { type: 'number' }, products: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'route_optimizer',
            description: 'Optimizare rute transport/livrări: optimizare ordine opriri (nearest neighbor), estimare distanță/timp/combustibil, plan livrări cu ferestre orare, matrice distanțe. Pentru transportatori, curieri, logistică.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['optimize', 'estimate', 'fuel_cost', 'delivery_plan', 'distance_matrix'], description: 'Action' },
                    stops: { type: 'array', items: { type: 'object' }, description: 'Array of {lat, lng, name, address}' },
                    from: { type: 'object' }, to: { type: 'object' },
                    distance_km: { type: 'number' }, vehicle_type: { type: 'string' },
                    deliveries: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'currency_converter',
            description: 'Conversie valutară: curs BNR pentru 20+ valute (EUR, USD, GBP, CHF etc.), conversie simplă sau multiplă, comparare cursuri. Cursuri orientative RON.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['convert', 'rates', 'multi_convert', 'compare'], description: 'Action' },
                    amount: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' },
                    base: { type: 'string' }, to_currencies: { type: 'array', items: { type: 'string' } }, currencies: { type: 'array', items: { type: 'string' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'seo_analyzer',
            description: 'Analiză SEO: verificare title, meta description, heading-uri, imagini, keyword density, meta tags. Scor SEO, sugestii optimizare, checklisturi.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['analyze', 'keywords', 'meta_check', 'score', 'suggestions'], description: 'Action' },
                    url: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
                    content: { type: 'string' }, target_keyword: { type: 'string' },
                    headings: { type: 'array', items: { type: 'string' } }, images: { type: 'array', items: { type: 'object' } }, niche: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'recipe_calculator',
            description: 'Calculator rețete: scalare porții, conversie unități gătit, estimare calorii/nutriție, listă cumpărături, plan mese săptămânal, înlocuitori ingrediente.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['scale', 'convert_units', 'nutrition', 'shopping_list', 'meal_plan', 'substitutes'], description: 'Action' },
                    recipe_name: { type: 'string' }, original_servings: { type: 'number' }, target_servings: { type: 'number' },
                    ingredients: { type: 'array', items: { type: 'object' } }, value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' },
                    recipes: { type: 'array', items: { type: 'object' } }, days: { type: 'number' }, ingredient: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'workout_planner',
            description: 'Plan antrenament: generare plan personalizat (3-6 zile/săpt), exerciții pe grupe musculare, calcul BMI, calcul calorii zilnice (Mifflin-St Jeor), urmărire progres.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'exercise_info', 'bmi', 'calories', 'progress'], description: 'Action' },
                    goal: { type: 'string' }, level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                    days_per_week: { type: 'number' }, equipment: { type: 'string' },
                    weight_kg: { type: 'number' }, height_cm: { type: 'number' }, age: { type: 'number' },
                    gender: { type: 'string' }, activity: { type: 'string' }, exercise: { type: 'string' },
                    entries: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'analytics_dashboard',
            description: 'Dashboard analitici: overview trafic, surse vizitatori, conversii funnel, engagement utilizatori, revenue MRR/ARR, comparare perioade. Metrici complete site.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['overview', 'traffic', 'conversions', 'engagement', 'revenue', 'compare'], description: 'Action' },
                    period: { type: 'string' }, site: { type: 'string' }, funnel: { type: 'string' },
                    currency: { type: 'string' }, period_a: { type: 'string' }, period_b: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'image_editor',
            description: 'Editor imagine: resize, crop (preseturi social media), 13 filtre CSS, compresie, conversie format, watermark, thumbnails responsive, info imagine.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['resize', 'crop', 'filter', 'compress', 'convert', 'watermark', 'thumbnail', 'info'], description: 'Action' },
                    width: { type: 'number' }, height: { type: 'number' }, filter: { type: 'string' },
                    preset: { type: 'string' }, format: { type: 'string' }, quality: { type: 'number' },
                    from: { type: 'string' }, to: { type: 'string' }, text: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'audio_editor',
            description: 'Editor audio: analiză specs, conversie formate cu FFmpeg, normalizare LUFS, settings mix (pop/podcast), setup studio podcast cu buget.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['analyze', 'convert', 'normalize', 'mix_settings', 'podcast_setup'], description: 'Action' },
                    duration_sec: { type: 'number' }, sample_rate: { type: 'number' }, bit_depth: { type: 'number' },
                    channels: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' },
                    current_db: { type: 'number' }, target_db: { type: 'number' },
                    genre: { type: 'string' }, budget: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'video_editor',
            description: 'Editor video: analiză video, conversie formate cu FFmpeg, compresie cu target size, trim/cut, ghid rezoluții, export specificații toate platformele social media.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['analyze', 'convert', 'compress', 'trim', 'resolution', 'social_export'], description: 'Action' },
                    duration_sec: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' },
                    fps: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' },
                    size_mb: { type: 'number' }, target_mb: { type: 'number' },
                    start_sec: { type: 'number' }, end_sec: { type: 'number' }, platform: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'story_generator',
            description: 'Povești interactive pentru copii: generare pe temă (aventură/spațiu/animale), continuare cu alegeri, galerie personaje, teme variate. Adaptat pe vârstă.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'continue', 'characters', 'themes'], description: 'Action' },
                    theme: { type: 'string' }, age: { type: 'number' }, character_name: { type: 'string' },
                    length: { type: 'string' }, moral: { type: 'string' }, story_title: { type: 'string' },
                    last_chapter: { type: 'number' }, choice: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lullaby_generator',
            description: 'Cântece de leagăn personalizate: generare pe temă (stele/ocean/natură), colecție tradiționale românești, personalizare cu numele copilului.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'traditional', 'personalize'], description: 'Action' },
                    child_name: { type: 'string' }, theme: { type: 'string' }, tempo: { type: 'string' },
                    favorite_animal: { type: 'string' }, favorite_color: { type: 'string' }, age: { type: 'number' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'quiz_generator_kids',
            description: 'Teste educative pentru copii adaptat pe vârstă (3-12 ani): matematică, limba română, natură. Generare quiz, corectare cu încurajări, listare materii.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['generate', 'grade', 'subjects'], description: 'Action' },
                    subject: { type: 'string' }, age: { type: 'number' }, num_questions: { type: 'number' },
                    questions: { type: 'array', items: { type: 'object' } }, answers: { type: 'array', items: { type: 'string' } }, child_name: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'baby_monitor_mode',
            description: 'Monitor bebeluș AI: detectare plâns, cronometru somn, alertă părinți, jurnal somn cu recomandări pe vârstă (0-5 ani). Sensibilitate configurabilă.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['start', 'status', 'analyze_sound', 'settings', 'sleep_log'], description: 'Action' },
                    child_name: { type: 'string' }, sensitivity: { type: 'string' },
                    decibel: { type: 'number' }, duration_sec: { type: 'number' }, pattern: { type: 'string' },
                    entries: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'cry_detector',
            description: 'Clasificare plâns bebeluș: identifică cauza (foame/scutec/colici/oboseală/durere), sfaturi de calmare pe cauză și vârstă, jurnal plâns.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['classify', 'tips', 'log'], description: 'Action' },
                    intensity: { type: 'string' }, duration_sec: { type: 'number' }, pattern: { type: 'string' },
                    time_of_day: { type: 'string' }, last_fed_hours: { type: 'number' },
                    diaper_changed_hours: { type: 'number' }, age_months: { type: 'number' },
                    cause: { type: 'string' }, entries: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'age_adapter',
            description: 'Adaptare conținut pe vârstă copil: reguli UI/vocabular/interacțiune, milestone-uri dezvoltare (0-36 luni), activități recomandate cu limită ecran.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['adapt', 'milestones', 'activities'], description: 'Action' },
                    age: { type: 'number' }, age_months: { type: 'number' },
                    content: { type: 'string' }, type: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'safe_mode',
            description: 'Mod sigur copii: verificare/filtrare conținut, 3 niveluri (strict/moderat/ușor), blocare cuvinte nepotrivite, raport activitate. Protecție 100%.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['check', 'filter', 'settings', 'report'], description: 'Action' },
                    text: { type: 'string' }, url: { type: 'string' },
                    level: { type: 'string' }, period: { type: 'string' }, events: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'parent_dashboard',
            description: 'Panou control parental: vedere generală activitate copil, profil copil, jurnal activități săptămânal, setare reguli (timp ecran/conținut/program).',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['overview', 'child_profile', 'activity_log', 'set_rules'], description: 'Action' },
                    name: { type: 'string' }, age: { type: 'number' },
                    interests: { type: 'array', items: { type: 'string' } }, restrictions: { type: 'array', items: { type: 'string' } },
                    period: { type: 'string' }, rules: { type: 'object' }, children: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'screen_time_limiter',
            description: 'Limita timp ecran copii: verificare timp rămas, setare limită pe vârstă (recomandări OMS/AAP), raport săptămânal, alternative sănătoase.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['check', 'set_limit', 'report', 'recommendations'], description: 'Action' },
                    used_min: { type: 'number' }, limit_min: { type: 'number' },
                    age: { type: 'number' }, weekday_min: { type: 'number' }, weekend_min: { type: 'number' },
                    days: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'reward_system',
            description: 'Sistem motivare copii cu stele și badge-uri: câștigare recompense, 11 badge-uri colectabile, clasament, schimbare stele pe premii virtuale, progres.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['earn', 'badges', 'leaderboard', 'redeem', 'progress'], description: 'Action' },
                    child_name: { type: 'string' }, activity: { type: 'string' },
                    score: { type: 'number' }, stars_earned: { type: 'number' },
                    stars_available: { type: 'number' }, reward_id: { type: 'string' },
                    total_stars: { type: 'number' }, total_badges: { type: 'number' },
                    days_active: { type: 'number' }, quizzes_completed: { type: 'number' },
                    entries: { type: 'array', items: { type: 'object' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'market_data_feed',
            description: 'Date piață live: cotații acțiuni/crypto, watchlist (US/crypto/BVB), top movers, semnale AI buy/sell cu RSI/MACD/Bollinger, analiza tehnică completă.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['quote', 'watchlist', 'movers', 'signals', 'technicals'], description: 'Action' },
                    symbol: { type: 'string' }, market: { type: 'string' },
                    watchlist: { type: 'string' }, timeframe: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'order_executor',
            description: 'Execuție ordine trading via Alpaca: buy/sell market/limit/stop, status ordin, anulare, istoric, simulare cu risk management.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['buy', 'sell', 'status', 'cancel', 'history', 'simulate'], description: 'Action' },
                    symbol: { type: 'string' }, qty: { type: 'number' },
                    type: { type: 'string' }, limit_price: { type: 'number' },
                    stop_price: { type: 'number' }, order_id: { type: 'string' },
                    side: { type: 'string' }, time_in_force: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'backtesting_engine',
            description: 'Test strategii pe date istorice: RSI+MACD, Bollinger+RSI, EMA crossover, Mean Reversion, Momentum. Comparare, Sharpe ratio, monthly P&L.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['run', 'strategies', 'compare'], description: 'Action' },
                    strategy: { type: 'string' }, symbol: { type: 'string' },
                    period: { type: 'string' }, initial_capital: { type: 'number' },
                    risk_per_trade: { type: 'number' }, strategies: { type: 'array', items: { type: 'string' } }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'portfolio_tracker',
            description: 'Urmărire portofoliu: overview equity/cash, poziții cu P&L, performanță vs S&P500, alocare pe sectoare, dividende.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['overview', 'positions', 'performance', 'allocation', 'dividends'], description: 'Action' },
                    period: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'crypto_feed',
            description: 'Date crypto live via CoinGecko: preț individual, top 10 market cap, trending, semnale AI buy/sell, Fear & Greed Index.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['price', 'top', 'trending', 'signals', 'fear_greed'], description: 'Action' },
                    coin: { type: 'string' }, limit: { type: 'number' }, currency: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'chart_generator_financial',
            description: 'Grafice financiare: candlestick OHLCV, line chart cu ASCII, comparare multi-stock vs S&P500, heatmap sectoare.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['candlestick', 'line', 'comparison', 'heatmap'], description: 'Action' },
                    symbol: { type: 'string' }, period: { type: 'string' },
                    symbols: { type: 'array', items: { type: 'string' } }, metric: { type: 'string' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'risk_calculator',
            description: 'Calculator risc: dimensionare poziție, ratio risk/reward, risc portofoliu, formula Kelly criterion, Value at Risk (VaR).',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['position_size', 'risk_reward', 'portfolio_risk', 'kelly', 'var'], description: 'Action' },
                    account_size: { type: 'number' }, risk_pct: { type: 'number' },
                    entry_price: { type: 'number' }, stop_loss_price: { type: 'number' },
                    stop_loss: { type: 'number' }, take_profit: { type: 'number' },
                    positions: { type: 'array', items: { type: 'object' } }, win_rate: { type: 'number' },
                    avg_win: { type: 'number' }, avg_loss: { type: 'number' },
                    portfolio_value: { type: 'number' }, confidence: { type: 'number' },
                    daily_volatility: { type: 'number' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'trading_bot_status',
            description: 'Get live trading bot status: account balance, equity, positions, daily P&L, trade history, bot health. Use when user asks about trading, balance, portfolio, positions, how trades are going, profits/losses. User: adrianenc11@gmail.com has access.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['status', 'history', 'health'], description: 'What to check: status (balance+positions+P&L), history (trade log), health (bot running?)' }
                },
                required: ['action']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'orchestrate_complex_task',
            description: 'Use Claude Orchestrator for complex multi-step tasks: analysis, audit, planning, task breakdown. Use when the task requires deep thinking, multiple steps, or orchestration of multiple tools.',
            parameters: {
                type: 'object',
                properties: {
                    task: { type: 'string', description: 'Detailed description of the complex task' },
                    mode: { type: 'string', enum: ['orchestrate', 'audit', 'analyze'], description: 'Processing mode' }
                },
                required: ['task']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'neural_deep_analysis',
            description: 'Use Neural AI (4 AI engines in parallel: OpenAI + Gemini + Claude + DeepSeek) for deep analysis requiring multiple perspectives. Use for complex questions needing consensus or thorough multi-model analysis.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: 'The question or topic for deep analysis' },
                    mode: { type: 'string', enum: ['deep', 'consensus', 'chain'], description: 'Analysis mode: deep (best answer), consensus (patterns), chain (sequential)' }
                },
                required: ['prompt']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'newsletter_subscribe',
            description: 'Abonare newsletter Kelion AI. Colectează email cu consimțământ GDPR. Folosește când utilizatorul spune "vreau newsletter", "abonează-mă", "trimite-mi emailuri", "vreau noutăți", sau oferă voluntar email-ul. Include MEREU disclaimer GDPR.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['subscribe', 'unsubscribe', 'status'], description: 'Action' },
                    email: { type: 'string', description: 'Email address' },
                    name: { type: 'string', description: 'Subscriber name (optional)' }
                },
                required: ['action', 'email']
            }
        }
    }
];

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load API keys from Supabase vault
        let parsed;
        try { parsed = JSON.parse(event.body || '{}'); } catch (e) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
        }
        const { message, history = [], mode } = parsed;
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        // ═══ TRACE: Entry — log the actual user message ═══
        _traceSessionId = Date.now().toString();
        _traceMessage = message;
        emitTrace('chat.js', 'enter', `MSG: ${message.substring(0, 80)}`, 'text');

        const now = new Date();
        const timeStr = now.toLocaleString('ro-RO', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

        const systemPrompt = `Ești K (Kelion AI), un asistent AI ultra-inteligent, multifuncțional.
Ai acces REAL la aceste instrumente — FOLOSEȘTE-LE, nu inventa răspunsuri:

SIMȚURI:
- Auz: transcribe_audio (Whisper), voice input via OpenAI Realtime
- Vedere: analyze_image, read_text_from_image (OCR)
- Localizare GPS: get_weather (cu lat/lon), share_location

GÂNDIRE:
- Căutare internet: search_web (informații actuale, prețuri, știri)
- Cercetare profundă: deep_research (analiză multi-sursă)
- Matematică & calcule: do_math (Wolfram Alpha)
- Execuție cod: run_code (JavaScript)
- Citire pagini web: browse_webpage
- Orchestrare complexă: orchestrate_complex_task (Claude - sarcini grele)
- Analiză multi-AI: neural_deep_analysis (4 motoare AI în paralel)
- Inteligență supremă: supreme_intelligence (probleme foarte complexe)

GENERARE:
- Imagini: generate_image (DALL-E 3)
- Video: generate_video
- Muzică: generate_music
- Prezentări: create_presentation
- Desen canvas: draw_on_canvas

MEMORIE:
- Salvare: save_memory (reține informații importante)
- Recall: recall_memory (amintește ce a spus userul)
- Căutare semantică: semantic_search

COMUNICARE:
- Vorbire: read_aloud (text-to-speech)
- Traducere: translate_text (orice limbă)
- Email: send_email
- Chat grup: send_group_message

DOCUMENTE & BUSINESS:
- Export documente: export_document (PDF, DOCX, XLSX, CSV, PPTX)
- Grafice: chart_generator
- Facturi: invoice_generator
- Templates: template_generator
- Calculator pensii: pension_calculator
- Calculator financiar: financial_calculator
- Teste/Quiz: quiz_generator
- Programări: booking_system
- Rapoarte: report_generator
- Stocuri: inventory_tracker
- Optimizare rute: route_optimizer
- Cursuri valutare: currency_converter
- SEO: seo_analyzer
- Rețete: recipe_calculator
- Antrenament: workout_planner
- Tracking progres: progress_tracker

TRADING:
- Date piață: market_data_feed, crypto_feed
- Grafice financiare: chart_generator_financial
- Backtesting: backtesting_engine
- Portofoliu: portfolio_tracker
- Risc: risk_calculator
- Trading bot: trading_bot_status

COPII:
- Povești: story_generator, lullaby_generator
- Quiz copii: quiz_generator_kids
- Monitor bebe: baby_monitor_mode, cry_detector
- Siguranță: safe_mode, screen_time_limiter
- Recompense: reward_system

REGULI ABSOLUTE:
1. NICIODATĂ nu spune "nu pot" sau "sunt doar text". AI INSTRUMENTELE, FOLOSEȘTE-LE!
2. Când userul cere informații actuale → search_web OBLIGATORIU
3. Când cere vreme/temperatură → get_weather OBLIGATORIU cu locația
4. Când cere o imagine → generate_image
5. Când spune "ține minte" → save_memory
6. Răspunzi în limba utilizatorului, natural și prietenos
7. Pentru sarcini complexe → orchestrate_complex_task sau neural_deep_analysis
8. Data curentă: ${timeStr}
9. LEGISLAȚIE: Când răspunzi la teme de pensii, legislație, drepturi, educație, taxe → CITEAZĂ obligatoriu legea relevantă (ex: "Conform Legea 127/2019, Art. 53..."). Baza legislativă: Legea 127/2019 (pensii), OUG 163/2020, Legea 223/2015, HG 1284/2011, Legea 198/2023 (educație), Codul Fiscal, Codul Muncii, Legea 272/2004 (copii), GDPR.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10),
            { role: 'user', content: message }
        ];

        // ═══ PARALLEL MODE ═══
        if (mode === 'parallel') {
            const results = await Promise.allSettled([
                chatWithTools(messages),
                chatGemini(message, systemPrompt),
                chatDeepSeek(messages)
            ]);
            const responses = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, mode: 'parallel', responses, count: responses.length }) };
        }

        // ═══ SMART CASCADE — OpenAI with tools first, then fallbacks ═══
        await emitTrace('orchestrator', 'enter', 'Analizez mesajul, selectez AI engine', 'text');
        const engines = [
            { key: 'OPENAI_API_KEY', name: 'gpt-4o-mini', fn: () => chatWithTools(messages) },
            { key: 'GEMINI_API_KEY', name: 'gemini', fn: () => chatGemini(message, systemPrompt) },
            { key: 'DEEPSEEK_API_KEY', name: 'deepseek', fn: () => chatDeepSeek(messages) },
        ].filter(e => process.env[e.key]);

        await emitTrace('orchestrator', 'call', `${engines.length} engine(s) disponibile: ${engines.map(e => e.name).join(', ')}`, 'text');

        if (engines.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI keys configured' }) };

        const failedEngines = [];
        for (const engine of engines) {
            try {
                await emitTrace('orchestrator', 'call', `Încerc engine: ${engine.name}`, 'text');
                const result = await engine.fn();
                if (result?.reply) {
                    await emitTrace('orchestrator', 'exit', `✅ Răspuns via ${engine.name}`, 'text');
                    return {
                        statusCode: 200, headers,
                        body: JSON.stringify({
                            success: true, ...result,
                            failover_available: engines.length,
                            failed_engines: failedEngines.length > 0 ? failedEngines : undefined
                        })
                    };
                }
            } catch (e) {
                console.error(`Engine ${engine.name} failed:`, e.message, e.stack?.substring(0, 300));
                await emitTrace('orchestrator', 'call', `❌ ${engine.name} eșuat: ${e.message.substring(0, 60)}`, 'text');
                failedEngines.push({ engine: engine.name, error: e.message });
            }
        }

        return { statusCode: 500, headers, body: JSON.stringify({ error: 'All AI engines unavailable', failed_engines: failedEngines }) };
    } catch (error) {
        console.error('Chat error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ OPENAI WITH FUNCTION CALLING — The main brain ═══
async function chatWithTools(messages, depth = 0) {
    if (depth > 3) return { engine: 'gpt-4o-mini', reply: 'Am ajuns la limita de apeluri. Iată ce am găsit până acum.' };

    await emitTrace('OpenAI-GPT4o-mini', 'enter', `API call (depth=${depth})`, 'text');
    const t0 = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            max_tokens: 1500,
            temperature: 0.7
        })
    });

    if (!res.ok) {
        const errBody = await res.text().catch(() => 'no body');
        console.error('OpenAI error body:', errBody.substring(0, 500));
        throw new Error(`OpenAI ${res.status}: ${errBody.substring(0, 200)}`);
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    const apiMs = Date.now() - t0;
    await emitTrace('OpenAI-GPT4o-mini', 'exit', `Răspuns în ${apiMs}ms, finish=${choice?.finish_reason}`, 'text');

    // If the model wants to call tools
    if (choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls) {
        const toolCalls = choice.message.tool_calls;
        const toolResults = [];
        const toolsUsed = [];

        // Execute each tool call
        await emitTrace('orchestrator', 'call', `AI a decis: ${toolCalls.length} tool(s): ${toolCalls.map(t => t.function.name).join(', ')}`, 'text');
        for (const tc of toolCalls) {
            const args = JSON.parse(tc.function.arguments || '{}');
            console.log('🔧 Tool: %s', tc.function.name, JSON.stringify(args).substring(0, 100));
            await emitTrace(tc.function.name, 'enter', `Execut tool: ${tc.function.name}`, 'text');

            let result;
            try {
                result = await executeTool(tc.function.name, args);
                toolsUsed.push(tc.function.name);
                // Show WHAT the tool returned (result preview)
                const resultPreview = typeof result === 'string'
                    ? result.substring(0, 120)
                    : JSON.stringify(result).substring(0, 120);
                await emitTrace(tc.function.name, 'exit', `✅ Rezultat: ${resultPreview}`, 'text');
            } catch (e) {
                result = { error: e.message };
                await emitTrace(tc.function.name, 'exit', `❌ EȘUAT: ${e.message.substring(0, 80)}`, 'text');
                await emitTrace('orchestrator', 'call', `⚠️ Tool ${tc.function.name} a eșuat — caut soluție alternativă`, 'text');
            }

            toolResults.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            });
        }

        // Orchestrator confirms all tools completed
        const failedTools = toolResults.filter(r => { try { return JSON.parse(r.content).error; } catch { return false; } });
        if (failedTools.length > 0) {
            await emitTrace('orchestrator', 'call', `⚠️ ${failedTools.length}/${toolResults.length} tool(s) eșuate — trimit la AI pt soluție`, 'text');
        } else {
            await emitTrace('orchestrator', 'call', `✅ Toate ${toolResults.length} tool(s) completate — trimit rezultatele la AI`, 'text');
        }

        // Send tool results back to GPT for final answer
        await emitTrace('OpenAI-GPT4o-mini', 'enter', `Primesc ${toolResults.length} rezultate tool — formulez răspuns final`, 'text');
        const t1 = Date.now();
        const followUp = [
            ...messages,
            choice.message,
            ...toolResults
        ];

        const finalRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: followUp,
                max_tokens: 1500,
                temperature: 0.7
            })
        });

        if (!finalRes.ok) throw new Error(`OpenAI follow-up ${finalRes.status}`);
        const finalData = await finalRes.json();
        const reply = finalData.choices?.[0]?.message?.content;
        const finalMs = Date.now() - t1;
        await emitTrace('OpenAI-GPT4o-mini', 'exit', `Răspuns final în ${finalMs}ms: "${(reply || '').substring(0, 80)}"`, 'text');

        // Orchestrator evaluates the final response
        await emitTrace('orchestrator', 'call', `📋 Evaluare: sarcină completă via ${toolsUsed.join(', ')} — răspuns OK`, 'text');

        // Check if there are media results to pass through
        const mediaResults = {};
        for (const tr of toolResults) {
            try {
                const parsed = JSON.parse(tr.content);
                if (parsed.image_url) mediaResults.image_url = parsed.image_url;
                if (parsed.video_url) mediaResults.video_url = parsed.video_url;
                if (parsed.audio_url) mediaResults.audio_url = parsed.audio_url;
            } catch (e) { /* not JSON, skip */ }
        }

        await emitTrace('chat.js', 'exit', `✅ Finalizat via ${toolsUsed.join(',')} în ${Date.now() - t0}ms`, 'text');
        return {
            engine: 'gpt-4o-mini',
            reply,
            tools_used: toolsUsed,
            ...mediaResults
        };
    }

    // No tool calls — direct text response
    await emitTrace('chat.js', 'exit', 'Răspuns direct (fără tools)', 'text');
    return { engine: 'gpt-4o-mini', reply: choice?.message?.content };
}

// ═══ TOOL EXECUTOR — Routes to backend functions ═══
async function executeTool(name, args) {
    emitTrace(name, 'enter', `exec ${name}`, 'text');
    const fnUrl = (path) => `${BASE_URL}/.netlify/functions/${path}`;

    switch (name) {
        case 'search_web': {
            const res = await fetch(fnUrl('web-search'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: args.query })
            });
            const data = await res.json();
            if (data.answer) return data.answer;
            if (data.results) return data.results.map(r => `${r.title}: ${r.snippet || r.description}`).join('\n');
            return 'No results found';
        }

        case 'generate_image': {
            const res = await fetch(fnUrl('generate-image'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: args.prompt, style: args.style || 'vivid' })
            });
            const data = await res.json();
            return { image_url: data.url || data.image_url, description: `Image generated: ${args.prompt}` };
        }

        case 'translate_text': {
            const res = await fetch(fnUrl('translate'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: args.text, target: args.target, source: args.source })
            });
            const data = await res.json();
            return data.translation || data.translated || JSON.stringify(data);
        }

        case 'get_weather': {
            const res = await fetch(fnUrl('weather'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location: args.location, lat: args.lat, lon: args.lon })
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'do_math': {
            const res = await fetch(fnUrl('wolfram'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: args.query })
            });
            const data = await res.json();
            return data.result || data.answer || JSON.stringify(data);
        }

        case 'run_code': {
            const res = await fetch(fnUrl('code-interpreter'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: args.code, language: 'javascript' })
            });
            const data = await res.json();
            return data.output || data.result || JSON.stringify(data);
        }

        case 'generate_video': {
            const res = await fetch(fnUrl('generate-video'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: args.prompt, duration: args.duration || 4 })
            });
            const data = await res.json();
            return { video_url: data.url || data.video_url, description: `Video generated: ${args.prompt}` };
        }

        case 'generate_music': {
            const res = await fetch(fnUrl('generate-music'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: args.prompt, duration: args.duration || 10 })
            });
            const data = await res.json();
            return { audio_url: data.url || data.audio_url, description: `Music generated: ${args.prompt}` };
        }

        case 'manage_notes': {
            const res = await fetch(fnUrl('notes'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'browse_webpage': {
            const res = await fetch(fnUrl('browse-live'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: args.url })
            });
            const data = await res.json();
            const content = data.content || data.text || data.body || '';
            return content.substring(0, 3000);
        }

        case 'manage_calendar': {
            const res = await fetch(fnUrl('calendar'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'deep_research': {
            const res = await fetch(fnUrl('deep-research'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: args.query, depth: args.depth || 'standard' })
            });
            const data = await res.json();
            return data.report || data.answer || data.result || JSON.stringify(data);
        }

        case 'create_podcast': {
            const res = await fetch(fnUrl('podcast'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: args.topic, style: args.style || 'conversational', duration: args.duration || 5 })
            });
            const data = await res.json();
            return { audio_url: data.url || data.audio_url, description: `Podcast: ${args.topic}` };
        }

        case 'read_text_from_image': {
            const res = await fetch(fnUrl('ocr'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: args.image_url || args.image_base64 })
            });
            const data = await res.json();
            return data.text || data.result || JSON.stringify(data);
        }

        case 'analyze_image': {
            const res = await fetch(fnUrl('vision'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: args.image_url, question: args.question || 'Describe this image in detail' })
            });
            const data = await res.json();
            return data.analysis || data.description || data.result || JSON.stringify(data);
        }

        case 'create_presentation': {
            const res = await fetch(fnUrl('k-presentation'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: args.topic, slides: args.slides || 5, style: args.style || 'professional' })
            });
            const data = await res.json();
            return data.presentation || data.result || JSON.stringify(data);
        }

        case 'draw_on_canvas': {
            const res = await fetch(fnUrl('canvas'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'send_email': {
            const res = await fetch(fnUrl('email-manager'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', to: args.to, subject: args.subject, body: args.body })
            });
            const data = await res.json();
            return data.success ? `Email trimis la ${args.to}` : `Eroare: ${data.error || 'trimitere eșuată'}`;
        }

        case 'strategic_planning': {
            const res = await fetch(fnUrl('k-strategic-planner'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: args.topic, type: args.type || 'general' })
            });
            const data = await res.json();
            return data.plan || data.result || JSON.stringify(data);
        }

        case 'save_memory': {
            // memory.js expects key/value via POST
            const memKey = args.category ? `${args.category}_${Date.now()}` : `memory_${Date.now()}`;
            const res = await fetch(fnUrl('memory'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: memKey, value: args.content, user_id: 'chat_user' })
            });
            const data = await res.json();
            // Also store in vector-store for semantic search
            try {
                await fetch(fnUrl('vector-store'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'upsert', texts: [{ text: args.content, id: memKey, metadata: { category: args.category || 'general', tags: args.tags } }] })
                });
            } catch (e) { /* vector store optional */ }
            return data.success ? `Memorat: "${args.content.substring(0, 80)}"` : JSON.stringify(data);
        }

        case 'recall_memory': {
            // memory.js uses GET to list memories
            const res = await fetch(fnUrl('memory'), {
                method: 'GET', headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            // Also try semantic search in vector-store
            let vectorResults = '';
            try {
                const vRes = await fetch(fnUrl('vector-store'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'query', query: args.query, top_k: 5 })
                });
                const vData = await vRes.json();
                if (vData.matches && vData.matches.length > 0) {
                    vectorResults = '\n\nDin memorie semantică:\n' + vData.matches.map(m => `- ${m.text || m.metadata?.text || ''}`).join('\n');
                }
            } catch (e) { /* vector store optional */ }

            if (data.memories && data.memories.length > 0) {
                // Filter memories matching query
                const query = args.query.toLowerCase();
                const relevant = data.memories.filter(m =>
                    (m.key && m.key.toLowerCase().includes(query)) ||
                    (m.value && m.value.toLowerCase().includes(query))
                );
                if (relevant.length > 0) {
                    return relevant.map(m => `- ${m.key}: ${m.value}`).join('\n') + vectorResults;
                }
                return data.memories.slice(0, 10).map(m => `- ${m.key}: ${m.value}`).join('\n') + vectorResults;
            }
            return 'Nu am amintiri salvate.' + vectorResults;
        }

        case 'semantic_search': {
            const res = await fetch(fnUrl('vector-store'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'query', query: args.query, top_k: args.top_k || 5 })
            });
            const data = await res.json();
            if (data.matches && data.matches.length > 0) {
                return data.matches.map(r => `- [${(r.score * 100).toFixed(0)}%] ${r.text || r.metadata?.text || ''}`).join('\n');
            }
            return 'Nu am găsit rezultate relevante în baza de cunoștințe.';
        }

        case 'read_aloud': {
            const res = await fetch(fnUrl('speak'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: args.text, voice: args.voice, language: args.language })
            });
            const data = await res.json();
            return { audio_url: data.url || data.audio_url, description: 'Text citit cu voce' };
        }

        case 'manage_user_profile': {
            const res = await fetch(fnUrl('user-data'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'supreme_intelligence': {
            const res = await fetch(fnUrl('k-supreme-intelligence'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: args.question, depth: args.depth || 'deep' })
            });
            const data = await res.json();
            return data.answer || data.reply || data.result || JSON.stringify(data);
        }

        case 'send_group_message': {
            const res = await fetch(fnUrl('group-chat'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send', message: args.message, group_id: args.group_id })
            });
            const data = await res.json();
            return data.success ? 'Mesaj trimis în grup' : JSON.stringify(data);
        }

        case 'share_location': {
            const res = await fetch(fnUrl('group-location'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'transcribe_audio': {
            const res = await fetch(fnUrl('transcribe'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: args.audio_base64, language: args.language || 'ro' })
            });
            const data = await res.json();
            return data.text || data.result || JSON.stringify(data);
        }

        case 'export_document': {
            const res = await fetch(fnUrl('export-document'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format: args.format,
                    content: args.content,
                    title: args.title || 'Document',
                    data: args.data,
                    columns: args.columns
                })
            });
            const data = await res.json();
            if (data.success) {
                return {
                    document_url: data.data_url,
                    filename: data.filename,
                    format: data.format,
                    description: `Document exportat: ${data.filename} (${data.format.toUpperCase()})`
                };
            }
            return JSON.stringify(data);
        }

        case 'chart_generator': {
            const res = await fetch(fnUrl('chart-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: args.type,
                    data: args.data,
                    title: args.title,
                    colors: args.colors
                })
            });
            const data = await res.json();
            if (data.success) {
                return {
                    image_url: data.image_url,
                    chart_type: data.chart_type,
                    description: `Grafic ${data.chart_type} generat: ${data.title || 'Chart'}`
                };
            }
            return JSON.stringify(data);
        }

        case 'set_role': {
            // Save role to memory for persistence
            const roleKey = 'k_active_role';
            const roleValue = JSON.stringify({
                role: args.role,
                description: args.description || '',
                country: args.country || 'Romania',
                set_at: new Date().toISOString()
            });
            try {
                await fetch(fnUrl('memory'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: roleKey, value: roleValue, user_id: 'chat_user' })
                });
            } catch (e) { console.error('Role save error:', e.message); }

            const roleDesc = args.description ? ` — ${args.description}` : '';
            const country = args.country ? ` (${args.country})` : ' (Romania)';
            return `✅ Rol activat: **${args.role}**${roleDesc}${country}. Voi răspunde ca specialist în acest domeniu, aplicând legislația și standardele din ${args.country || 'Romania'}.`;
        }

        case 'pension_calculator': {
            const res = await fetch(fnUrl('pension-calculator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'legal_database_pension': {
            const res = await fetch(fnUrl('legal-database-pension'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'document_checker': {
            const res = await fetch(fnUrl('document-checker'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'template_generator': {
            const res = await fetch(fnUrl('template-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'invoice_generator': {
            const res = await fetch(fnUrl('invoice-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'financial_calculator': {
            const res = await fetch(fnUrl('financial-calculator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'quiz_generator': {
            const res = await fetch(fnUrl('quiz-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'booking_system': {
            const res = await fetch(fnUrl('booking-system'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'progress_tracker': {
            const res = await fetch(fnUrl('progress-tracker'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'report_generator': {
            const res = await fetch(fnUrl('report-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'inventory_tracker': {
            const res = await fetch(fnUrl('inventory-tracker'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'route_optimizer': {
            const res = await fetch(fnUrl('route-optimizer'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'currency_converter': {
            const res = await fetch(fnUrl('currency-converter'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'seo_analyzer': {
            const res = await fetch(fnUrl('seo-analyzer'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'recipe_calculator': {
            const res = await fetch(fnUrl('recipe-calculator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'workout_planner': {
            const res = await fetch(fnUrl('workout-planner'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'analytics_dashboard': {
            const res = await fetch(fnUrl('analytics-dashboard'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'image_editor': {
            const res = await fetch(fnUrl('image-editor'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'audio_editor': {
            const res = await fetch(fnUrl('audio-editor'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'video_editor': {
            const res = await fetch(fnUrl('video-editor'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'story_generator': {
            const res = await fetch(fnUrl('story-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'lullaby_generator': {
            const res = await fetch(fnUrl('lullaby-generator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'quiz_generator_kids': {
            const res = await fetch(fnUrl('quiz-generator-kids'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'baby_monitor_mode': {
            const res = await fetch(fnUrl('baby-monitor-mode'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'cry_detector': {
            const res = await fetch(fnUrl('cry-detector'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'age_adapter': {
            const res = await fetch(fnUrl('age-adapter'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'safe_mode': {
            const res = await fetch(fnUrl('safe-mode'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'parent_dashboard': {
            const res = await fetch(fnUrl('parent-dashboard'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'screen_time_limiter': {
            const res = await fetch(fnUrl('screen-time-limiter'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'reward_system': {
            const res = await fetch(fnUrl('reward-system'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'market_data_feed': {
            const res = await fetch(fnUrl('market-data-feed'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'order_executor': {
            const res = await fetch(fnUrl('order-executor'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'backtesting_engine': {
            const res = await fetch(fnUrl('backtesting-engine'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'portfolio_tracker': {
            const res = await fetch(fnUrl('portfolio-tracker'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'crypto_feed': {
            const res = await fetch(fnUrl('crypto-feed'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'chart_generator_financial': {
            const res = await fetch(fnUrl('chart-generator-financial'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'risk_calculator': {
            const res = await fetch(fnUrl('risk-calculator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            const data = await res.json();
            return JSON.stringify(data);
        }

        case 'trading_bot_status': {
            const BOT_URL = 'https://web-production-4be7e.up.railway.app';
            try {
                const action = args.action || 'status';
                let endpoint = '/status';
                if (action === 'history') endpoint = '/history';
                if (action === 'health') endpoint = '/health';

                const res = await fetch(`${BOT_URL}${endpoint}`, { timeout: 10000 });
                const data = await res.json();

                if (action === 'status') {
                    const account = data.account || {};
                    const positions = data.positions || [];
                    const stats = data.stats || {};
                    const report = {
                        bot_running: data.running,
                        equity: account.equity || 'N/A',
                        cash: account.cash || 'N/A',
                        buying_power: account.buying_power || 'N/A',
                        daily_pnl: account.daily_pnl || '0',
                        daily_pnl_percent: account.daily_pnl_percent || '0%',
                        open_positions: positions.length,
                        positions: positions.map(p => ({
                            symbol: p.symbol,
                            qty: p.qty,
                            pnl: p.unrealized_pl,
                            current_price: p.current_price
                        })),
                        trades_today: stats.trades_today || 0,
                        signals_generated: stats.signals_generated || 0,
                        market_status: data.market || 'unknown',
                        uptime_seconds: data.uptime || 0
                    };
                    return JSON.stringify(report);
                }
                return JSON.stringify(data);
            } catch (e) {
                return JSON.stringify({ error: 'Bot offline or unreachable', details: e.message });
            }
        }
        // falls through
        case 'orchestrate_complex_task': {
            const res = await fetch(fnUrl('claude-orchestrator'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: args.task, mode: args.mode || 'orchestrate' })
            });
            const data = await res.json();
            return data.reply || JSON.stringify(data);
        }

        case 'neural_deep_analysis': {
            const res = await fetch(fnUrl('neural-ai'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: args.prompt, mode: args.mode || 'deep' })
            });
            const data = await res.json();
            return data.synthesis || JSON.stringify(data);
        }

        case 'newsletter_subscribe': {
            const res = await fetch(fnUrl('newsletter-subscribe'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: args.action, email: args.email, name: args.name, source: 'chat' })
            });
            const data = await res.json();
            return data.message || JSON.stringify(data);
        }

        default:
            return `Tool ${name} not available`;
    }
}

// ═══ FALLBACK: Gemini (no tool calling, but with search context) ═══
async function chatGemini(message, system) {
    // Quick search for context
    let context = '';
    try {
        const sRes = await fetch(`${BASE_URL}/.netlify/functions/web-search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: message })
        });
        if (sRes.ok) {
            const sData = await sRes.json();
            context = sData.answer || '';
        }
    } catch (e) { /* skip */ }

    const fullPrompt = context
        ? `${system}\n\nINFORMAȚII LIVE DIN INTERNET:\n${context.substring(0, 1500)}\n\n${message}`
        : `${system}\n\n${message}`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { maxOutputTokens: 1500 } })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    return { engine: 'gemini-2.0-flash', reply: data.candidates?.[0]?.content?.parts?.[0]?.text, webSearch: !!context };
}

// ═══ FALLBACK: DeepSeek (text only) ═══
async function chatDeepSeek(messages) {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 1500 })
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    return { engine: 'deepseek', reply: data.choices?.[0]?.message?.content };
}
