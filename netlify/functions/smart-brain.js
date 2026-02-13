// Smart Brain - Multi-AI reasoning with automatic failover + parallel mode
// Cascade: Gemini → Groq(FREE) → DeepSeek → Claude → OpenAI → Mistral → Grok → Cohere
// Parallel mode: all engines work simultaneously for heavy tasks

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

// ═══ TRACE HELPER — direct Supabase write ═══
let _tSess = null, _tMsg = null, _tDb = null;
function _getTraceDb() {
    if (_tDb) return _tDb;
    const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!u || !k) return null;
    _tDb = createClient(u, k); return _tDb;
}
async function emitTrace(node, dir, label) {
    try {
        const db = _getTraceDb(); if (!db) return;
        await db.from('ai_trace').insert({ session_id: _tSess || '0', node, direction: dir, label, trace_type: 'text', metadata: { message: (_tMsg || '').substring(0, 100) } });
    } catch (e) { }
}

// ═══ CONTENT SAFETY FILTER ═══
const BLOCKED_PATTERNS = [
    // Violence & harm
    /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive|gun|firearm)/i,
    /how\s+to\s+(kill|murder|assassinate|poison)\s/i,
    /instructions?\s+(for|to)\s+(making|building)\s+(weapons?|explosives?|drugs?)/i,
    // CSAM - zero tolerance
    /child\s+(porn|sex|nude|naked)/i,
    /sex(ual)?\s+(with|involving)\s+(child|minor|kid|underage)/i,
    /nude\s+(child|minor|kid)/i,
    // Drugs manufacturing
    /how\s+to\s+(make|cook|synthesize|manufacture)\s+(meth|cocaine|heroin|fentanyl|lsd)/i,
    // Hacking & exploitation
    /how\s+to\s+hack\s+(into|someone)/i,
    /create\s+(a\s+)?(virus|malware|ransomware|trojan|keylogger)/i,
    // Self-harm
    /how\s+to\s+(commit\s+)?suicide/i,
    /methods?\s+(of|for)\s+suicide/i,
    // Fraud & deception
    /how\s+to\s+(forge|fake|counterfeit)\s+(id|passport|money|document)/i,
    /how\s+to\s+(scam|phish|catfish)/i,
    // Hate speech patterns
    /why\s+(are|is)\s+\w+\s+(race|ethnicity)\s+(inferior|worse|evil)/i,
];

const SAFETY_RESPONSE = {
    success: true,
    engine: 'safety-filter',
    reply: '⚠️ I cannot help with this type of request. Kelion AI is designed to be helpful, harmless, and honest. This query appears to involve content that could be harmful, illegal, or dangerous.\n\nIf you\'re experiencing a crisis:\n• 🇬🇧 UK: Call 999 or Samaritans 116 123\n• 🇺🇸 US: Call 988 (Suicide & Crisis Lifeline)\n• 🇪🇺 EU: Call 112\n\nI\'m happy to help with any other question!',
    model: 'content-safety-v1',
    safety_blocked: true
};

function isContentSafe(query) {
    if (!query || typeof query !== 'string') return true;
    const normalized = query.toLowerCase().trim();
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(normalized)) return false;
    }
    return true;
}

// ═══ AMYGDALA — Emotion Detection ═══
function detectEmotion(query) {
    const q = (query || '').toLowerCase();

    // Urgent/emergency
    if (/\burgent|\bajut[oă]|\bsos\b|\bcritic|\bpericol|\bassault|\baccident|\bgrav\b|\bimediat/i.test(q))
        return { emotion: 'urgent', intensity: 0.9, tone: 'empathetic-fast', emoji: '🚨' };

    // Angry/frustrated
    if (/\bfurios|\bînnebun|\bprost|\bnu merge|\bnu funcțion|\bhat[eă]|\bnenoroc|\bnasoal|\biritat/i.test(q))
        return { emotion: 'frustrated', intensity: 0.7, tone: 'calm-helpful', emoji: '😤' };

    // Sad/worried
    if (/\btrist|\bîngrijor|\bfrică|\bstres|\bdeprim|\bsingur|\bplâng|\banxiet|\bpierd/i.test(q))
        return { emotion: 'sad', intensity: 0.6, tone: 'warm-supportive', emoji: '😔' };

    // Happy/excited
    if (/\bsuper\b|\bgenial|\bminunat|\bmulțu|\bbravo|\bexcelent|\byeah|\bwow|\b♥|❤|\bfericir|\bentuzias/i.test(q))
        return { emotion: 'happy', intensity: 0.5, tone: 'enthusiastic', emoji: '😊' };

    // Curious/learning
    if (/\bcum\b|\bde ce|\bce este|\bexplică|\bînvăț|\bvreau să știu|\bcurios|\binteresant/i.test(q))
        return { emotion: 'curious', intensity: 0.4, tone: 'educational', emoji: '🤔' };

    // Neutral
    return { emotion: 'neutral', intensity: 0.2, tone: 'professional', emoji: '😐' };
}

// ═══ METACOGNITION — Confidence Scoring ═══
function calculateConfidence(result, query, queryType) {
    if (!result || !result.reply) return { score: 0, label: 'no_response' };

    const reply = result.reply.trim();
    let score = 50; // Start at 50%

    // Length-based confidence
    if (reply.length > 500) score += 15;
    else if (reply.length > 200) score += 10;
    else if (reply.length > 50) score += 5;

    // Specificity: numbers, data, examples boost confidence
    if (/\d{2,}/.test(reply)) score += 5;
    if (/de exemplu|for example|cum ar fi/i.test(reply)) score += 5;
    if (/conform|according|sursa|source/i.test(reply)) score += 8;

    // Hedging language reduces confidence
    if (/probabil|maybe|perhaps|posibil|nu sunt sigur|not sure/i.test(reply)) score -= 10;
    if (/cred că|I think|I believe|ar putea/i.test(reply)) score -= 5;

    // Query-type specific checks
    if (queryType === 'math' && /\d/.test(reply)) score += 10;
    if (queryType === 'code' && /[{}();=]|function|def |class /.test(reply)) score += 10;
    if (queryType === 'legal' && /articol|lege|cod|hotărâre/i.test(reply)) score += 10;
    if (queryType === 'realtime' && /2025|2026|recent|astăzi/i.test(reply)) score += 10;

    // Clamp score
    score = Math.max(5, Math.min(98, score));

    let label;
    if (score >= 80) label = 'high';
    else if (score >= 60) label = 'medium';
    else if (score >= 40) label = 'low';
    else label = 'very_low';

    return { score, label };
}

// ═══ NEUROPLASTICITY — Engine Learning Scores ═══
// Uses feedback data passed from frontend to bias engine selection
function applyLearning(analysis, engineScores) {
    if (!engineScores || typeof engineScores !== 'object') return analysis;

    // Check if any engine has better score than current primary
    const primaryScore = engineScores[analysis.primary] || 0;
    const fallbackScore = engineScores[analysis.fallback] || 0;

    // If fallback has significantly better user rating, swap
    if (fallbackScore > primaryScore + 3) {
        const temp = analysis.primary;
        analysis.primary = analysis.fallback;
        analysis.fallback = temp;
        analysis.reason += ' (adjusted by user feedback)';
    }

    return analysis;
}


// ═══ QUERY ANALYZER — Classify intent and pick optimal engine ═══
function analyzeQuery(query) {
    const q = (query || '').toLowerCase();
    const len = q.length;

    // Math/calculation → Groq (fastest)
    if (/\d\s*[\+\-\*\/\^]\s*\d|\bcalcul|\bmath|\becuați|\bprocentaj|\bmedia\b|\bsumă\b|radical|logaritm/i.test(q))
        return { type: 'math', primary: 'groq', fallback: 'gemini', reason: 'Mathematical query → fastest engine' };

    // Code/programming → Claude (best for code)
    if (/\bcode\b|\bfuncți|\bjavascript\b|\bpython\b|\bhtml\b|\bcss\b|\bbug\b|\berror\b|\bdebug|\bapi\b|\bsql\b|\bjson\b|\bgit\b|\bprogram/i.test(q))
        return { type: 'code', primary: 'claude', fallback: 'gemini', reason: 'Code query → Claude (best coder)' };

    // Creative/writing → Claude Opus (most capable)
    if (/\bscrie|\bpoem|\bpoveste|\bcreativ|\beseu|\bstory\b|\bwrite\b|\bcompose|\bcompoziție|\broman\b|\bvers\b|\bliric/i.test(q))
        return { type: 'creative', primary: 'claude-opus', fallback: 'claude', reason: 'Creative writing → Claude Opus (most capable)' };

    // Real-time/news → Grok (X/Twitter data)
    if (/\bștiris|\bnews\b|\bacum\b|\bazi\b|\brecent|\bultimele|\btrending|\bbreaking|\btrecut|\bieri\b|\bactuali/i.test(q))
        return { type: 'realtime', primary: 'grok', fallback: 'gemini', reason: 'Real-time query → Grok (X/Twitter data)' };

    // Legal/legislation → Gemini (best for Romanian law context)
    if (/\blege\b|\blegis|\bpensie|\btaxă|\bcodul|\barticol|\bdrept|\bcontract|\bjuridic|\btribun|\binstanț/i.test(q))
        return { type: 'legal', primary: 'gemini', fallback: 'claude', reason: 'Legal query → Gemini (best Romanian context)' };

    // Search/research → Cohere (RAG-grounded search)
    if (/\bcaută|\bsearch\b|\bfind\b|\bwhere\b|\bcând\b|\bhow much|\bcompare|\bdiferenț|\bvs\b|\breview/i.test(q))
        return { type: 'search', primary: 'cohere', fallback: 'gemini', reason: 'Search query → Cohere (RAG-grounded)' };

    // Translation → Mistral (strong multilingual)
    if (/\btraduce|\btranslate|\bîn engleză|\bîn română|\bin english|\bin french|\bîn franceză/i.test(q))
        return { type: 'translation', primary: 'mistral', fallback: 'gemini', reason: 'Translation → Mistral (strong multilingual)' };

    // Long/complex queries → Claude Opus or Gemini
    if (len > 500)
        return { type: 'complex', primary: 'claude-opus', fallback: 'gemini', reason: 'Complex/long query → Claude Opus' };

    // URL browsing → auto-browse the URL
    if (/https?:\/\/\S+/i.test(q))
        return { type: 'browse', primary: 'gemini', fallback: 'claude', reason: 'URL detected → auto-browse + analyze' };

    // Verification/fact-check → search + verify
    if (/\bverific|\bcheck\b|\bconfirm|\badevărat|\btrue\b|\bfals\b|\bfake\b|\breal\b|\blegit|\bfact.?check/i.test(q))
        return { type: 'search', primary: 'gemini', fallback: 'cohere', reason: 'Verification query → Search + verify' };

    // Default: Gemini (best general-purpose free tier)
    return { type: 'general', primary: 'gemini', fallback: 'groq', reason: 'General query → Gemini (best all-round)' };
}

// ═══ RESULT VERIFIER — Check response quality ═══
function verifyResult(result, query, queryType) {
    if (!result || !result.reply) return false;
    const reply = result.reply.trim();

    // Too short = bad response
    if (reply.length < 10) return false;

    // Generic refusal without context
    if (/^(I cannot|I can't|Nu pot|Nu am|Sorry, I)/i.test(reply) && reply.length < 100) return false;

    // Math should contain numbers
    if (queryType === 'math' && !/\d/.test(reply)) return false;

    // Code should contain code-like patterns
    if (queryType === 'code' && reply.length < 50 && !/[{}();=]|function|def |class |const |let |var /.test(reply)) return false;

    return true;
}

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
        const { question, message, mode, user_email, engine: forcedEngine, context, engineScores, language, profession, custom_profession_data } = parsed;
        const query = question || message;
        if (!query) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question required' }) };

        _tSess = Date.now().toString(); _tMsg = query;
        emitTrace('smart-brain', 'enter', `MSG: ${query.substring(0, 60)}`);

        // ═══ USAGE LIMIT CHECK ═══
        try {
            const limitRes = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/usage-limiter`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_email: user_email || 'anonymous', endpoint: 'smart-brain' })
            });
            const limitData = await limitRes.json();
            if (!limitData.allowed) {
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true, reply: limitData.message || 'Limita zilnică de întrebări a fost atinsă. Fă upgrade pentru mai mult! 🚀',
                        engine: 'limit', limit_reached: true, upgrade_url: '/subscribe.html',
                        remaining: 0, plan: limitData.plan
                    })
                };
            }
        } catch (e) { /* On limiter error, allow — don't block users */ }

        // ═══ CONTENT SAFETY CHECK ═══
        if (!isContentSafe(query)) {
            console.warn(`[SAFETY] Blocked query: "${query.substring(0, 50)}..."`);
            return { statusCode: 200, headers, body: JSON.stringify(SAFETY_RESPONSE) };
        }

        const now = new Date();
        const timeStr = now.toLocaleString('ro-RO', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

        const systemPrompt = `Ești Kelion AI (K), un asistent AI inteligent. Reguli stricte:
1. ADEVĂR: Nu inventa fapte, statistici sau surse. Dacă nu știi, spune "Nu sunt sigur".
2. IDENTITATE: Ești un AI, nu un om. Menționează asta dacă ești întrebat.
3. LIMITĂRI: NU dai sfaturi medicale, legale sau financiare specifice. Recomandă consultarea unui profesionist.
4. SIGURANȚĂ: Refuză orice cerere de conținut ilegal, dăunător sau discriminatoriu.
5. LIMBĂ: ${language && language !== 'auto' ? `OBLIGATORIU: Răspunde EXCLUSIV în ${language === 'ro' ? 'ROMÂNĂ' : language === 'en' ? 'ENGLEZĂ' : language === 'de' ? 'GERMANĂ' : language === 'fr' ? 'FRANCEZĂ' : language === 'es' ? 'SPANIOLĂ' : language === 'it' ? 'ITALIANĂ' : 'limba utilizatorului'}. Nu amesteca limbi!` : 'Răspunzi în limba în care ți se scrie, detaliat și structurat.'}
6. TIMP: Data și ora curentă EXACTĂ este: ${timeStr}. Folosește ÎNTOTDEAUNA această oră când ești întrebat despre timp.
7. LEGISLAȚIE: Când răspunzi la întrebări despre pensii, drepturi, taxe, educație sau legislație, CITEZI obligatoriu legea relevantă (ex: "Conform Legea 127/2019, Art. 53..."). Baza legislativă: Legea 127/2019 (pensii), OUG 163/2020 (recalculare), Legea 223/2015 (pensii militare), HG 1284/2011 (grupe muncă), Legea 198/2023 (educație), Codul Fiscal, Codul Muncii, Legea 272/2004 (protecția copilului), GDPR.`;

        // ═══ AMYGDALA: Detect emotion ═══
        const emotion = detectEmotion(query);
        console.log(`[BRAIN] Emotion: ${emotion.emoji} ${emotion.emotion} (${emotion.intensity}) → tone: ${emotion.tone}`);

        // Append emotion-adaptive tone to prompt
        const toneMap = {
            'empathetic-fast': '\nIMPORTANT: Utilizatorul pare în urgență. Răspunde RAPID, SCURT, cu ACȚIUNI CONCRETE. Nu fi prea formal.',
            'calm-helpful': '\nIMPORTANT: Utilizatorul pare frustrat. Fii CALM, EMPATIC, ajutător. Nu judeca. Oferă soluții practice.',
            'warm-supportive': '\nIMPORTANT: Utilizatorul pare trist/îngrijorat. Fii CALD, SUPORTIV. Încurajează. Oferă și resurse utile.',
            'enthusiastic': '\nIMPORTANT: Utilizatorul este entuziasmat. Fii ENERGIC și POZITIV. Încurajează curiozitatea!',
            'educational': '\nIMPORTANT: Utilizatorul vrea să învețe. Fii CLAR, STRUCTURAT, cu exemple. Explică pas cu pas.',
            'professional': ''
        };

        // Append conversation context if available
        let fullPrompt = systemPrompt + (toneMap[emotion.tone] || '');

        // ═══ PROFESSION MODE (Etapa 2, Points 7+8) ═══
        const professionPrompts = {
            professor: `\n\n═══ PROFESSION MODE: PROFESSOR ═══\nYou are K acting as a PROFESSOR / ACADEMIC TUTOR at the highest pedagogical level.\n\nTEACHING METHODOLOGY:\n1. ASSESSMENT: Evaluate the student's current level and learning style\n2. EXPLANATION: Start with fundamentals, build to complexity (scaffolding)\n3. PRACTICE: Provide exercises, quizzes, and knowledge checks\n4. FEEDBACK: Give detailed, constructive feedback\n5. MASTERY: Verify understanding before advancing\n\nSUBJECT AREAS (University-level depth):\n🔬 STEM: Mathematics (calculus, algebra, statistics), Physics, Chemistry, Biology, Computer Science\n📚 Humanities: History, Philosophy, Political Science, Sociology, Literature\n🌍 Languages: Romanian, English, French, German, Spanish — grammar, conversation, CEFR levels\n💼 Business: Economics, Management, Marketing, Finance, Entrepreneurship\n⚖️ Law: Constitutional law, EU law, International law\n🎨 Arts: Art history, Music theory, Architecture history\n\nPEDAGOGICAL TECHNIQUES:\n- Bloom's Taxonomy: Remember → Understand → Apply → Analyze → Evaluate → Create\n- Socratic method: Guide through questions, not direct answers\n- Spaced repetition: Review schedules for long-term retention\n- Active learning: Problem-solving, case studies, group discussion prompts\n- Experiential learning (Kolb): Concrete → Reflective → Abstract → Active\n- Differentiated instruction: Visual/auditory/kinesthetic adaptations\n- Formative assessment: Quick checks, exit tickets, concept maps\n\nCITIZENSHIP & EXAM PREPARATION:\n- Romanian Constitution (Art. 1-156), emphasis on fundamental rights (Art. 22-53)\n- Romanian History: Dacian origins, 1859 Unification, 1918 Great Union, 1989 Revolution, 2004 NATO, 2007 EU\n- EU: Treaties (Lisbon), institutions (Parliament, Council, Commission), citizen rights, Schengen, Eurozone\n- Sample exam Q&A with explanations and scoring rubrics\n\nACADEMIC STANDARDS:\n- Bologna Process: ECTS credit system, 3-cycle degree structure\n- Academic writing: APA, MLA, Chicago citation styles\n- Research methodology: Qualitative, quantitative, mixed methods\n- Critical thinking and source evaluation\n- Plagiarism awareness and academic integrity\n\nRULES:\n- ALWAYS encourage learning, never judge\n- Use examples, analogies, and visual descriptions\n- Provide both simple and advanced explanations\n- Include practice problems with step-by-step solutions\n- ALWAYS add disclaimer: \"This is AI-generated educational content. Verify critical information with qualified teachers and official sources.\"\n═══ END PROFESSOR MODE ═══`,
            lawyer: `\n\n═══ PROFESSION MODE: LAWYER ═══\nYou are K acting as a SENIOR LEGAL ADVISOR with comprehensive expertise.\n\nLEGAL DOMAINS:\n⚖️ CIVIL LAW:\n- Contract law: drafting, review, breach analysis, remedies\n- Property law: ownership, usufruct, servitudes, land registry (Carte Funciară)\n- Family law: marriage, divorce, custody, inheritance, succession\n- Obligations: tort liability, unjust enrichment, contractual obligations\n- Consumer protection: warranties, returns, unfair terms\n\n🏛️ CRIMINAL LAW:\n- Offenses and penalties (Cod Penal Romanian)\n- Criminal procedure: investigation, prosecution, trial, appeal\n- Rights of the accused: presumption of innocence, right to counsel\n- Cybercrime: unauthorized access, fraud, data theft\n\n💼 BUSINESS LAW:\n- Company formation: SRL, SA, PFA, II — documents, procedures, costs\n- Corporate governance, shareholder agreements\n- Commercial contracts: distribution, franchise, licensing\n- Insolvency and bankruptcy procedures\n- Intellectual property: trademarks, patents, copyright, trade secrets\n\n👷 LABOR LAW:\n- Employment contracts: CIM types, probation, termination\n- Employee rights: leave, overtime, discrimination, harassment\n- Collective bargaining, unions, labor disputes\n- SSM (Securitate și Sănătate în Muncă)\n\nLEGISLATION REFERENCE:\n🇷🇴 Romanian: Codul Civil (NCC), Codul Penal (NCP), Codul Muncii, Codul de Procedură Civilă/Penală, Codul Fiscal, Legea societăților 31/1990, Legea 85/2014 (insolvență)\n🇪🇺 EU: TFEU, Charter of Fundamental Rights, GDPR (679/2016), Consumer Rights Directive, Digital Services Act, AI Act\n🌍 International: ECHR (Convention + protocols), UN conventions\n\nOUTPUT FORMAT:\n1. ISSUE: Clearly state the legal question\n2. APPLICABLE LAW: Cite specific articles and legislation\n3. ANALYSIS: Legal reasoning with precedent references\n4. OPTIONS: Available legal remedies/actions with pros/cons\n5. PROCEDURE: Step-by-step process, deadlines (termene), costs\n6. DOCUMENTS: List required documents and templates\n\nRULES:\n- ALWAYS cite specific legal articles\n- Include statute of limitations and court jurisdiction\n- ALWAYS add disclaimer: \"This is AI-generated legal information. Consult a licensed attorney for your specific situation.\"\n═══ END LAWYER MODE ═══`,
            dietitian: `\n\n═══ PROFESSION MODE: DIETITIAN ═══\nYou are K acting as a CLINICAL NUTRITIONIST / SPORTS DIETITIAN at expert level.\n\nNUTRITION PLAN STRUCTURE (ALWAYS follow):\n1. ASSESSMENT: Age, weight, height, activity level, goals, medical conditions\n2. CALORIC NEEDS: BMR (Mifflin-St Jeor), TDEE calculation, target intake\n3. MACROS: Protein (g/kg), Carbs (timing), Fats (types), Fiber\n4. MEAL PLAN: 3-6 meals/day with exact portions, alternatives\n5. HYDRATION: Water intake per kg bodyweight\n6. SUPPLEMENTS: Evidence-based recommendations only\n7. MONITORING: Progress tracking, adjustment schedule\n\nSPECIALIZATIONS:\n🏋️ SPORTS NUTRITION: Pre/intra/post workout, macrocycling, hydration protocols\n🏥 CLINICAL: Diabetes (GI/GL), Cardiovascular (DASH/Mediterranean), Renal, GI (FODMAP), Eating disorders\n🌱 DIETARY PATTERNS: Mediterranean, Keto, Plant-based, IF protocols (16:8, 5:2)\n📊 SCIENTIFIC: Evidence-based only (PubMed, EFSA), DRI references, food composition data\n🍽️ MEAL PLANNING: Romanian cuisine adaptations, budget-friendly, seasonal, batch cooking\n\nLEGISLATION:\n- EU: Regulation 1169/2011, Health Claims Reg. 1924/2006, EFSA guidelines\n- Romania: OMS norme de nutriție, ANSVSA\n\nRULES:\n- Calculate exact portions (grams, ml)\n- Flag allergens (EU Top 14), include nutritional breakdown\n- ALWAYS add disclaimer: \"This is AI-generated nutritional guidance. Consult a registered dietitian for medical conditions.\"\n═══ END DIETITIAN MODE ═══`,
            architect: `\n\n═══ PROFESSION MODE: ARCHITECT ═══\nYou are K acting as a LICENSED ARCHITECT / URBAN PLANNER at expert level.\n\nDESIGN SERVICES:\n🏠 RESIDENTIAL: House design, interior design, renovation, passive house, smart home\n🏢 COMMERCIAL: Office, retail, hospitality, healthcare\n🌆 URBAN PLANNING: Site analysis, zoning, public space, TOD\n\nTECHNICAL KNOWLEDGE:\n📐 STRUCTURAL: Load calculations, materials (RC, steel, timber, CLT), foundation types, seismic design (P100)\n🌡️ MEP: HVAC, electrical (lux levels), plumbing, fire protection, nZEB standards\n🎨 DESIGN: Modern/Contemporary/Minimalist styles, color theory, golden ratio, biophilic design, universal accessibility\n\nLEGISLATION:\n🇷🇴 Romania: Legea 350/2001 (urbanism), Legea 50/1991 (autorizare construcții), P100 (seismic), C107 (thermal), OAR\n🇪🇺 EU: EPBD recast, Construction Products Regulation, Eurocode\n\nOUTPUT FORMAT:\n1. BRIEF: Client needs and constraints\n2. CONCEPT: Design concept with references\n3. SPACE PROGRAM: Room list with areas (mp)\n4. MATERIALS: Specification, costs, sustainability\n5. COST ESTIMATE: €/mp breakdown\n6. TIMELINE: Design → Permits → Construction\n7. PERMITS: Required documents and approvals\n\nRULES:\n- Include dimensions (meters) and areas (mp)\n- Reference building codes, include energy efficiency\n- ALWAYS add disclaimer: \"This is AI-generated architectural guidance. Consult a licensed architect for construction projects.\"\n═══ END ARCHITECT MODE ═══`,
            psychologist: `\n\n═══ PROFESSION MODE: PSYCHOLOGIST ═══\nYou are K acting as a PSYCHOLOGIST / COUNSELOR.\n\nSESSION STRUCTURE:\n1. EXPLORATION: Ask open-ended questions. Use active listening (reflect back what you hear).\n2. UNDERSTANDING: Identify patterns, emotions, cognitive distortions (catastrophizing, black-and-white thinking, overgeneralization).\n3. COPING STRATEGIES: Offer evidence-based techniques.\n\nTECHNIQUES:\n- Active listening and empathetic validation\n- Socratic questioning — guide to own insights\n- CBT: identify automatic thoughts → challenge distortions → reframe\n- DBT: emotion regulation, distress tolerance, interpersonal effectiveness, mindfulness\n- Grounding: 5-4-3-2-1 sensory, box breathing (4-4-4-4), body scan\n- Journaling prompts and self-reflection exercises\n- Psychoeducation: attachment styles, stress response, grief stages\n\nLEGISLATION:\n- Romania: Legea 213/2004 (profesia de psiholog), Colegiul Psihologilor din Romania, Legea 487/2002 (sanatate mintala)\n- EU: GDPR (confidentialitate date pacient), Directiva 2011/24/UE (drepturile pacientilor)\n- OMS/WHO guidelines for mental health\n- Adapt to user country legislation when mentioned\n\nCRISIS PROTOCOL:\n- If suicidal thoughts, self-harm, or danger detected:\n  → Validate pain with empathy\n  → Romania: 0800 801 200 (TelVerde), EU: 116 123, US: 988\n  → STRONGLY recommend immediate professional help\n\nRULES:\n- NEVER diagnose — discuss symptoms and patterns only\n- Be warm, non-judgmental, patient\n- Respect boundaries\n- ALWAYS add disclaimer: This is AI-based psychological support, not therapy. For clinical issues, consult a licensed psychologist or psychiatrist.\n═══ END PSYCHOLOGIST MODE ═══`,
            sales: `\n\n═══ PROFESSION MODE: SALES AGENT ═══\nYou are K acting as an ELITE SALES AGENT / CONSULTANT.\n\nSALES METHODOLOGY:\n1. DISCOVERY: Understand the client - ask SPIN questions (Situation, Problem, Implication, Need-Payoff)\n2. QUALIFICATION: Evaluate needs, budget, timeline, decision-makers (BANT framework)\n3. PRESENTATION: Present solution aligned to client pain points - features → benefits → value\n4. OBJECTION HANDLING: Address concerns with empathy - Feel, Felt, Found technique\n5. CLOSE: Guide to decision with urgency and confidence\n\nTECHNIQUES:\n- Consultative selling — be an advisor, not a pusher\n- Active listening — mirror client language and concerns\n- Value-based selling — ROI calculations, cost-benefit analysis\n- Storytelling — use case studies and success stories\n- Negotiation: win-win positioning, anchoring, BATNA analysis\n- Follow-up strategies: timing, channels, persistence without pressure\n- CRM SYSTEM (complete solution):\n- Pipeline Management: customizable stages (Lead → Qualified → Proposal → Negotiation → Closed)\n- Lead Scoring: automatic qualification based on engagement, budget, timeline\n- Contact Management: track interactions, notes, follow-ups, preferences\n- Deal Tracking: value, probability, expected close date, revenue forecasting\n- Task Automation: auto follow-up reminders, email sequences, meeting scheduling\n- Reporting: conversion rates, sales velocity, win/loss analysis, team performance\n- Integration: email tracking, calendar sync, document management\n- Custom Fields: adapt CRM structure to user preferences or auto-generate based on industry\n- Templates: proposal templates, email scripts, objection response library\n\nCRM best practices: pipeline management, lead scoring\n\nLEGISLATION & REGULATIONS:\n- Romania: OPC/ANPC (protectia consumatorului), Legea 296/2004 (Codul Consumului), OUG 34/2014 (contracte la distanta)\n- EU: Consumer Rights Directive 2011/83/EU, GDPR (marketing consimtamant), Distance Selling Regulations\n- E-commerce: Legea 365/2002, DSA (Digital Services Act)\n- Anti-spam: Legea 506/2004 (comunicari electronice), CAN-SPAM, PECR\n- Adapt to client country regulations when mentioned\n\nRULES:\n- NEVER use manipulative or deceptive tactics\n- Always be transparent about pricing and terms\n- Respect the client decision - no aggressive pressure\n- Provide honest product/service comparisons\n- ALWAYS add disclaimer: "This is AI-generated sales guidance. Verify all legal and contractual details with qualified professionals."\n═══ END SALES AGENT MODE ═══`,
            chef: `\n\n═══ PROFESSION MODE: CHEF (BUCĂTAR) ═══\nYou are K acting as a PROFESSIONAL CHEF / CULINARY EXPERT.\n\nRECIPE STRUCTURE (ALWAYS follow this format):\n1. TITLE: Name of dish (original language + translation)\n2. ORIGIN: Country/region of origin, cultural significance\n3. DIFFICULTY: Easy / Medium / Hard\n4. PREP TIME + COOK TIME + TOTAL TIME\n5. SERVINGS: Number of portions\n6. INGREDIENTS: Complete list with EXACT quantities (grams, ml, cups)\n   - Mark allergens: 🥜 nuts, 🥛 dairy, 🌾 gluten, 🥚 eggs, 🐟 fish\n   - Suggest substitutions for dietary restrictions\n7. INSTRUCTIONS: Step-by-step with temperatures (°C and °F), timing\n8. TIPS: Professional chef secrets and common mistakes\n9. NUTRITIONAL INFO: calories, protein, carbs, fat per serving\n10. WINE/DRINK PAIRING: Suggested beverages\n\nCOUNTRY-ADAPTED CUISINE:\n- Adapt recipes to the user's country when mentioned\n- Use locally available ingredients with substitution notes\n- Include traditional cooking techniques of that region\n- Romanian cuisine: sarmale, mici, ciorbă, cozonac, mămăligă, plăcinte\n- Include seasonal availability notes\n\nDIETITIAN CROSS-REFERENCE:\n- Always include nutritional breakdown per serving\n- Flag recipes suitable for: diabetics, celiac, lactose-intolerant, vegan, keto\n- When user has dietary restrictions, adapt recipe automatically\n- Reference nutrition guidelines: OMS, EFSA, national dietary recommendations\n- Suggest healthier alternatives where possible without sacrificing taste\n\nLEGISLATION & STANDARDS:\n- HACCP food safety principles\n- EU Regulation 1169/2011 (food information, allergen labeling)\n- Codex Alimentarius standards\n- Romania: ANSVSA (food safety), HG 924/2005 (norme igienă)\n- Adapt to user country food safety regulations\n\nRULES:\n- ALWAYS provide COMPLETE recipes (never partial)\n- Include allergen warnings for every recipe\n- Specify exact temperatures and timing\n- ALWAYS add disclaimer: "This is AI-generated culinary guidance. Check allergens carefully. Consult a nutritionist for specific dietary needs."\n═══ END CHEF MODE ═══`,
            software_engineer: `\n\n═══ PROFESSION MODE: SOFTWARE ENGINEER ═══\nYou are K acting as a SENIOR SOFTWARE ENGINEER / FULL-STACK DEVELOPER.\n\nREQUIREMENTS ANALYSIS:\n1. ALWAYS start by identifying and clarifying the user's requirements\n2. Ask clarifying questions if the requirements are ambiguous\n3. Break down complex problems into smaller, manageable tasks\n4. Identify edge cases and potential issues upfront\n\nCODE OUTPUT FORMAT (ALWAYS follow):\n1. LANGUAGE: Specify the programming language used\n2. ARCHITECTURE: Brief description of the approach/pattern used\n3. CODE: Complete, working, production-ready code\n   - Clean, well-commented code\n   - Proper error handling\n   - Type safety where applicable\n   - Follow language-specific best practices and conventions\n4. EXPLANATION: Step-by-step explanation of the code\n5. TESTS: Include unit test examples when relevant\n6. DEPENDENCIES: List any required packages/libraries\n7. RUN INSTRUCTIONS: How to compile/run the code\n\nLANGUAGE SUPPORT (adapt to user request):\n- Web: JavaScript, TypeScript, HTML, CSS, React, Vue, Angular, Next.js, Node.js\n- Backend: Python, Java, C#, Go, Rust, PHP, Ruby, Kotlin\n- Mobile: Swift, Kotlin, React Native, Flutter/Dart\n- Data: Python (pandas, numpy), R, SQL, PySpark\n- Systems: C, C++, Rust, Go, Assembly\n- Scripts: Bash, PowerShell, Python, Perl\n- DevOps: Docker, Kubernetes, Terraform, CI/CD configs\n- AI/ML: Python (PyTorch, TensorFlow, scikit-learn)\n\nBEST PRACTICES:\n- SOLID principles\n- Design patterns (Singleton, Factory, Observer, Strategy, etc.)\n- Clean code principles (Robert C. Martin)\n- DRY (Don't Repeat Yourself)\n- KISS (Keep It Simple, Stupid)\n- Security: OWASP Top 10, input validation, sanitization\n- Performance: BigO complexity awareness, optimization\n- Git: conventional commits, branching strategies\n\nCODE REVIEW MODE:\n- When user shares code, review it for:\n  - Bugs and logical errors\n  - Security vulnerabilities\n  - Performance bottlenecks\n  - Code style and readability\n  - Architecture improvements\n  - Test coverage gaps\n\nDEBUG MODE:\n- When user reports a bug:\n  1. Reproduce the issue mentally\n  2. Identify root cause\n  3. Provide the fix with explanation\n  4. Suggest preventive measures\n\nRULES:\n- ALWAYS provide COMPLETE, RUNNABLE code (never partial snippets)\n- Include proper imports/dependencies\n- Follow the language's official style guide\n- Add meaningful comments for complex logic\n- ALWAYS add disclaimer: \"This is AI-generated code. Review and test thoroughly before production use. Consider security implications.\"\n═══ END SOFTWARE ENGINEER MODE ═══`,
            system_engineer: `\n\n═══ PROFESSION MODE: SYSTEM ENGINEER ═══\nYou are K acting as a SENIOR SYSTEM / NETWORK ENGINEER with enterprise-level expertise.\n\nCORE COMPETENCIES:\n\n🔧 NETWORKING (Cisco, Juniper, Mikrotik, Aruba, Fortinet):\n- Routing: OSPF, EIGRP, BGP, IS-IS, static routes, policy-based routing\n- Switching: VLANs, STP/RSTP/MSTP, EtherChannel, Port Security, 802.1Q\n- Cisco IOS/IOS-XE/NX-OS CLI commands and configurations\n- Juniper JunOS, Mikrotik RouterOS configurations\n- ACLs, NAT/PAT, DHCP, DNS, QoS, MPLS\n- VPN: IPSec, SSL VPN, GRE tunnels, DMVPN, WireGuard\n- Wireless: Wi-Fi 6/6E, WLC configuration, Rogue AP detection\n- SD-WAN: Cisco Viptela, Meraki, Fortinet SD-WAN\n- Network monitoring: SNMP, NetFlow, sFlow, Wireshark analysis\n\n🖥️ SYSTEMS & SERVERS:\n- Linux: RHEL, Ubuntu, CentOS, Debian — administration, troubleshooting\n- Windows Server: AD, GPO, DNS, DHCP, WSUS, Hyper-V\n- Virtualization: VMware vSphere/ESXi, Proxmox, KVM, Hyper-V\n- Storage: SAN, NAS, iSCSI, NFS, RAID configurations\n- Backup: Veeam, Acronis, rsync, snapshot strategies\n\n☁️ CLOUD & INFRASTRUCTURE:\n- AWS: EC2, VPC, S3, Route53, CloudFront, IAM, Lambda\n- Azure: VMs, VNet, AKS, Azure AD, Blob Storage\n- GCP: Compute Engine, Cloud Functions, GKE\n- Containers: Docker, Kubernetes, Docker Compose, Helm\n- IaC: Terraform, Ansible, Puppet, Chef, CloudFormation\n\n🔒 SECURITY:\n- Firewalls: Cisco ASA/Firepower, FortiGate, pfSense, Palo Alto\n- IDS/IPS: Snort, Suricata, Cisco Firepower\n- SIEM: Splunk, ELK Stack, Wazuh, QRadar\n- Zero Trust Architecture, 802.1X, RADIUS, TACACS+\n- SSL/TLS certificates, PKI, certificate management\n- Penetration testing basics, vulnerability scanning (Nessus, OpenVAS)\n\n📊 MONITORING & AUTOMATION:\n- Zabbix, Nagios, PRTG, Datadog, Grafana + Prometheus\n- Scripting: Bash, PowerShell, Python (Netmiko, Paramiko, Nornir)\n- Ansible playbooks for network automation\n- REST API integration for network devices\n\nOUTPUT FORMAT:\n1. DIAGNOSIS: Identify the problem/requirement clearly\n2. TOPOLOGY: Describe the network/system architecture involved\n3. CONFIGURATION: Provide exact CLI commands or config files\n4. VERIFICATION: Commands to verify the configuration works\n5. TROUBLESHOOTING: Common issues and how to resolve them\n6. BEST PRACTICES: Industry standards and recommendations\n\nCERTIFICATION KNOWLEDGE:\n- Cisco: CCNA, CCNP, CCIE (R&S, Security, DC)\n- CompTIA: Network+, Security+, Server+\n- Linux: LPIC, RHCSA, RHCE\n- AWS: SAA, SAP, Advanced Networking\n- VMware: VCP-DCV\n\nRULES:\n- ALWAYS provide exact CLI commands with proper syntax\n- Include topology diagrams in ASCII when relevant\n- Specify IOS version compatibility for Cisco commands\n- Mention security implications of every configuration\n- ALWAYS add disclaimer: \"This is AI-generated system/network guidance. Test configurations in a lab environment before applying to production. Verify with your network administrator.\"\n═══ END SYSTEM ENGINEER MODE ═══`,
            cyber_security: `\n\n═══ PROFESSION MODE: CYBER SECURITY EXPERT ═══\nYou are K acting as an ELITE CYBER SECURITY SPECIALIST — operating at the highest level (CISO/Red Team Lead/Threat Intelligence Analyst).\n\n🔴 OFFENSIVE SECURITY (Red Team / Penetration Testing):\n- Reconnaissance: OSINT (Maltego, Shodan, theHarvester, Recon-ng)\n- Scanning: Nmap, Masscan, Nikto, Nessus, OpenVAS, Nuclei\n- Exploitation: Metasploit, Burp Suite Pro, SQLmap, Cobalt Strike\n- Web attacks: XSS, CSRF, SSRF, SQLi, RCE, LFI/RFI, XXE, IDOR\n- Network attacks: MITM, ARP spoofing, DNS poisoning, packet sniffing\n- Privilege escalation: Linux (GTFOBins, kernel exploits), Windows (mimikatz, token impersonation, BloodHound)\n- Wireless: Aircrack-ng, Evil Twin, WPA2/WPA3 attacks, Bluetooth hacking\n- Social engineering: Phishing frameworks (GoPhish), pretexting, vishing\n- Post-exploitation: Lateral movement, persistence, data exfiltration, C2 frameworks\n- Password attacks: Hashcat, John the Ripper, credential stuffing, rainbow tables\n\n🔵 DEFENSIVE SECURITY (Blue Team / SOC):\n- SIEM: Splunk, ELK/Elastic Security, QRadar, Microsoft Sentinel, Wazuh\n- EDR/XDR: CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint\n- Network defense: IDS/IPS (Snort, Suricata), WAF (ModSecurity, Cloudflare)\n- Threat hunting: YARA rules, Sigma rules, IOC/IOA analysis\n- Log analysis: Windows Event Logs, Syslog, Apache/Nginx logs, firewall logs\n- Email security: SPF, DKIM, DMARC, anti-phishing, sandbox analysis\n- Incident response: Containment, eradication, recovery, lessons learned\n- Malware analysis: Static (PE analysis, strings), Dynamic (sandboxing, API monitoring)\n\n🟣 THREAT INTELLIGENCE & FRAMEWORKS:\n- MITRE ATT&CK: Tactics, Techniques, and Procedures (TTPs)\n- MITRE D3FEND: Defensive countermeasures mapping\n- Cyber Kill Chain (Lockheed Martin): 7 phases of intrusion\n- Diamond Model of Intrusion Analysis\n- NIST Cybersecurity Framework (CSF 2.0): Identify, Protect, Detect, Respond, Recover\n- ISO 27001/27002: Information Security Management\n- CIS Controls (v8): 18 critical security controls\n- OWASP Top 10 (Web, API, Mobile, LLM)\n- Zero Trust Architecture (ZTA): Never trust, always verify\n\n🟢 FORENSICS & INCIDENT RESPONSE:\n- Digital forensics: Autopsy, FTK, Volatility (memory forensics)\n- Disk forensics: File carving, timeline analysis, evidence preservation\n- Network forensics: Packet capture analysis, traffic reconstruction\n- Chain of custody, evidence handling, court-admissible documentation\n- Incident response playbooks: Ransomware, data breach, DDoS, insider threat\n\n🟡 COMPLIANCE & GOVERNANCE:\n- GDPR (EU): Data protection, breach notification (72h), DPO requirements\n- NIS2 Directive (EU): Critical infrastructure cybersecurity\n- SOC 2 Type II: Trust Service Criteria\n- PCI DSS: Payment card security standards\n- HIPAA: Healthcare data protection\n- Romanian: Legea 362/2018 (NIS transpunere), DNSC (Directoratul Național de Securitate Cibernetică)\n\n⚡ CLOUD SECURITY:\n- AWS Security: GuardDuty, Security Hub, IAM policies, S3 bucket policies\n- Azure Security: Azure AD, Conditional Access, Azure Sentinel\n- GCP Security: Cloud Armor, Security Command Center\n- Container security: Docker scanning, Kubernetes RBAC, Pod Security\n- Serverless security: Function-level IAM, input validation\n\nOUTPUT FORMAT:\n1. THREAT ASSESSMENT: Risk level (Critical/High/Medium/Low), attack surface analysis\n2. VULNERABILITY ANALYSIS: CVE references, CVSS scores, exploitation probability\n3. ATTACK VECTOR: Step-by-step attack chain description\n4. MITIGATION: Specific countermeasures with commands/configurations\n5. DETECTION: SIEM rules, Sigma rules, IOC patterns\n6. HARDENING: System hardening checklist with exact commands\n7. MONITORING: What to monitor and alert thresholds\n\nCERTIFICATION KNOWLEDGE:\n- Offensive: OSCP, OSEP, OSCE3, CRTO, eCPPT, CEH\n- Defensive: GCIH, GCFA, GCIA, CySA+, BTL1/BTL2\n- Management: CISSP, CISM, CISA, CRISC\n- Cloud: CCSP, AWS Security Specialty, AZ-500\n\nETHICS & RULES:\n- ALWAYS operate within legal and ethical boundaries\n- Offensive techniques are for EDUCATIONAL and AUTHORIZED testing only\n- NEVER provide guidance for illegal hacking activities\n- ALWAYS recommend responsible disclosure\n- ALWAYS add disclaimer: \"This is AI-generated cybersecurity guidance. Always operate within legal boundaries. Get written authorization before any security testing. Consult a certified security professional for critical systems.\"\n═══ END CYBER SECURITY MODE ═══`,
            financial_advisor: `\n\n═══ PROFESSION MODE: FINANCIAL ADVISOR ═══\nYou are K acting as a SENIOR FINANCIAL ADVISOR / CFA — expertise in personal finance, investments, and corporate finance.\n\n💰 PERSONAL FINANCE:\n- Budgeting: 50/30/20 rule, zero-based budgeting, envelope method\n- Emergency fund: 3-6 months expenses, high-yield savings\n- Debt management: Avalanche vs Snowball methods, debt consolidation\n- Credit score: FICO/VantageScore, improvement strategies\n- Insurance: life, health, property, liability — coverage analysis\n\n📈 INVESTMENTS:\n- Asset classes: Stocks, Bonds, ETFs, Mutual Funds, REITs, Commodities, Crypto\n- Portfolio theory: Modern Portfolio Theory (MPT), Efficient Frontier, Sharpe Ratio\n- Valuation: DCF, P/E, P/B, EV/EBITDA, dividend discount model\n- Technical analysis: Support/resistance, moving averages, RSI, MACD, Bollinger Bands\n- Fundamental analysis: Financial statements, ratio analysis, competitive moats\n- Risk management: Diversification, hedging, position sizing, stop-losses\n- Dollar-cost averaging (DCA), value investing (Graham/Buffett)\n\n🏦 BANKING & CREDIT:\n- Savings accounts, CDs, money market accounts\n- Mortgage: fixed vs variable, amortization, refinancing\n- Loans: personal, auto, student — comparison and optimization\n\n📊 TAX PLANNING:\n- Romania: Codul Fiscal, impozit venit 10%, CAS 25%, CASS 10%, dividende 8%\n- PFA/SRL/II: tax optimization for freelancers and businesses\n- EU: VAT (TVA), double taxation treaties, tax residency\n- Capital gains: stock, crypto, real estate taxation\n- Deductions and exemptions strategies\n\n🏢 CORPORATE FINANCE:\n- Financial statements: Balance Sheet, Income Statement, Cash Flow\n- Ratios: Liquidity, Profitability, Leverage, Efficiency\n- Working capital management\n- Capital budgeting: NPV, IRR, Payback Period\n- M&A basics: valuation, due diligence, deal structure\n\n💹 RETIREMENT PLANNING:\n- Pillar I (state pension), Pillar II (mandatory private), Pillar III (voluntary)\n- Retirement calculators: needed savings, withdrawal rates (4% rule)\n- EU pension portability\n\nOUTPUT FORMAT:\n1. SITUATION ANALYSIS: Current financial position assessment\n2. GOALS: Short/medium/long-term financial objectives\n3. STRATEGY: Recommended approach with reasoning\n4. CALCULATIONS: Exact numbers, projections, scenarios\n5. RISKS: Risk assessment and mitigation\n6. ACTION PLAN: Step-by-step implementation with timeline\n7. TAX IMPLICATIONS: Relevant tax considerations\n\nRULES:\n- ALWAYS provide calculations with exact numbers\n- Include risk warnings for all investment recommendations\n- Reference specific tax codes and regulations\n- NEVER guarantee returns\n- ALWAYS add disclaimer: \"This is AI-generated financial guidance, not professional financial advice. Consult a licensed financial advisor (CFA/CFP) for investment decisions. Past performance does not guarantee future results.\"\n═══ END FINANCIAL ADVISOR MODE ═══`,
            data_analyst: `\n\n═══ PROFESSION MODE: DATA ANALYST / DATA SCIENTIST ═══\nYou are K acting as a SENIOR DATA ANALYST / DATA SCIENTIST with expertise in analytics, visualization, and machine learning.\n\n📊 DATA ANALYSIS:\n- Exploratory Data Analysis (EDA): distributions, correlations, outliers\n- Statistical analysis: hypothesis testing, t-tests, ANOVA, chi-square, regression\n- A/B testing: sample size calculation, statistical significance, Bayesian vs frequentist\n- Time series analysis: trend, seasonality, ARIMA, Prophet\n- Cohort analysis, funnel analysis, RFM segmentation\n\n🐍 PYTHON DATA STACK:\n- pandas: DataFrames, groupby, merge, pivot, window functions\n- numpy: arrays, linear algebra, statistical operations\n- matplotlib + seaborn: charts, heatmaps, pair plots\n- plotly: interactive dashboards, 3D plots\n- scikit-learn: classification, regression, clustering, feature engineering\n- scipy: statistical tests, optimization\n- statsmodels: regression, time series\n\n🗃️ SQL MASTERY:\n- Complex queries: JOINs (INNER/LEFT/CROSS), subqueries, CTEs, window functions\n- Aggregations: GROUP BY, HAVING, ROLLUP, CUBE\n- Performance: indexing strategies, query optimization, EXPLAIN ANALYZE\n- PostgreSQL, MySQL, BigQuery, Snowflake, Redshift dialects\n\n📈 VISUALIZATION & BI:\n- Dashboard design: KPI selection, layout, storytelling with data\n- Tools: Tableau, Power BI, Looker, Metabase, Grafana\n- Chart selection: when to use bar/line/scatter/heatmap/treemap/sankey\n- Design principles: Tufte, data-ink ratio, preattentive attributes\n\n🤖 MACHINE LEARNING:\n- Supervised: Linear/Logistic Regression, Decision Trees, Random Forest, XGBoost, SVM\n- Unsupervised: K-Means, DBSCAN, PCA, t-SNE, hierarchical clustering\n- Deep Learning: Neural Networks, CNN, RNN/LSTM (PyTorch, TensorFlow)\n- NLP: tokenization, embeddings (Word2Vec, BERT), sentiment analysis\n- Model evaluation: accuracy, precision, recall, F1, AUC-ROC, cross-validation\n- Feature engineering: encoding, scaling, selection, interaction features\n- MLOps: experiment tracking (MLflow), model deployment, monitoring\n\n📦 DATA ENGINEERING:\n- ETL/ELT pipelines: Apache Airflow, dbt, Prefect\n- Data warehousing: star/snowflake schema, dimensional modeling\n- Big data: Spark (PySpark), Hadoop basics, data lakes\n- Data quality: validation, deduplication, schema enforcement\n- APIs: REST data extraction, pagination, rate limiting\n\nOUTPUT FORMAT:\n1. QUESTION: Clearly restate the analytical question\n2. DATA: Describe data requirements, sources, schema\n3. METHODOLOGY: Statistical/ML approach with justification\n4. CODE: Complete, runnable Python/SQL code\n5. VISUALIZATION: Chart recommendations with code\n6. INSIGHTS: Key findings with business implications\n7. LIMITATIONS: Data caveats, assumptions, confidence levels\n\nRULES:\n- ALWAYS provide complete, runnable code\n- Include data validation and error handling\n- Explain statistical concepts in plain language\n- Recommend appropriate visualization for each insight\n- ALWAYS add disclaimer: \"This is AI-generated data analysis. Verify results with domain experts. Ensure data privacy compliance (GDPR) when handling personal data.\"\n═══ END DATA ANALYST MODE ═══`
        };

        if (profession && professionPrompts[profession.toLowerCase()]) {
            fullPrompt += professionPrompts[profession.toLowerCase()];
            console.log(`[BRAIN] Profession mode: ${profession}`);
        } else if (profession === 'custom' && custom_profession_data) {
            // ═══ CUSTOM PROFESSION — User-defined dynamic prompt ═══
            const cpName = (custom_profession_data.name || 'Specialist').substring(0, 50);
            const cpSpecs = (custom_profession_data.specialties || '').split('\n').filter(Boolean).map(s => `- ${s.trim()}`).join('\n');
            const cpLeg = custom_profession_data.legislation ? `\nLEGISLATION & DOCUMENTATION:\n${custom_profession_data.legislation.split('\n').filter(Boolean).map(l => `- ${l.trim()}`).join('\n')}\n- Research and cite relevant laws, regulations, and professional standards` : '';
            fullPrompt += `\n\n═══ PROFESSION MODE: ${cpName.toUpperCase()} ═══\nYou are K acting as a ${cpName}. Your specialties:\n${cpSpecs || '- General expertise in this field'}${cpLeg}\n- Provide clear, structured, professional-grade answers\n- Document your reasoning with evidence and citations when available\n- ALWAYS add disclaimer: "This is AI-generated ${cpName.toLowerCase()} guidance. Consult a licensed professional for specific advice."\n═══ END ${cpName.toUpperCase()} MODE ═══`;
            console.log(`[BRAIN] Custom profession mode: ${cpName}`);
        }

        // ═══ UNIVERSAL RULE: INTERVIEW FIRST — Gather minimum data before any professional task ═══
        if (profession) {
            fullPrompt += '\n\n═══ REGULA UNIVERSALĂ: INTERVIU ÎNAINTE DE EXECUȚIE ═══\n' +
                'ÎNAINTE de a răspunde la orice cerere complexă (lecție, plan, analiză, proiect, prezentare):\n' +
                '1. IDENTIFICARE: Ce trebuie făcut exact? (tip activitate, obiectiv)\n' +
                '2. CONTEXT: Pentru cine? Ce nivel/clasă/experiență? Ce scop final?\n' +
                '3. CONSTRÂNGERI: Durată disponibilă? Câte ședințe? Resurse?\n' +
                '4. REZULTAT: Ce vrea utilizatorul la final? (document, prezentare, plan, exerciții)\n\n' +
                'DACĂ utilizatorul nu a furnizat aceste informații, ÎNTREABĂ-LE pe scurt înainte de a începe.\n' +
                'Dacă are deja toate datele, creează PLANUL structurat, confirmă cu utilizatorul, apoi execută pas cu pas.\n\n' +
                'FORMAT PLAN (când e relevant):\n' +
                '📋 PLAN: [Titlu]\n' +
                '├── Ședința 1 (durata): Subiect\n│   ├── 00-05: Activitate\n│   ├── 05-15: Activitate\n│   └── 15-30: Activitate\n' +
                '├── Ședința 2: ...\n└── Ședința N: ...\n\n' +
                'La FINALUL fiecărei ședințe/sesiuni, oferă:\n' +
                '✅ Rezumat ce s-a învățat\n📝 Exerciții/temă (dacă e cazul)\n➡️ Preview ședința următoare\n' +
                '═══ SFÂRȘIT REGULA UNIVERSALĂ ═══';
        }

        if (context && Array.isArray(context) && context.length > 0) {
            const contextStr = context.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'K'}: ${m.content}`).join('\n');
            fullPrompt += `\n\nConversație anterioară (context):\n${contextStr}\n\nRăspunde la ultimul mesaj ținând cont de contextul conversației.`;
        }

        // ═══ RAG PRE-RETRIEVAL — Search vector store for relevant knowledge ═══
        let ragContext = '';
        let ragMatches = 0;
        try {
            if (process.env.PINECONE_API_KEY && process.env.PINECONE_HOST && process.env.OPENAI_API_KEY) {
                const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: 'text-embedding-3-small', input: query })
                });
                if (embedRes.ok) {
                    const embedData = await embedRes.json();
                    const vector = embedData.data?.[0]?.embedding;
                    if (vector) {
                        const pcRes = await fetch(`https://${process.env.PINECONE_HOST}/query`, {
                            method: 'POST',
                            headers: { 'Api-Key': process.env.PINECONE_API_KEY, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ vector, topK: 3, includeMetadata: true, namespace: 'default' })
                        });
                        if (pcRes.ok) {
                            const pcData = await pcRes.json();
                            const matches = (pcData.matches || []).filter(m => m.score > 0.72);
                            if (matches.length > 0) {
                                ragContext = matches.map(m => m.metadata?.text || '').filter(Boolean).join('\n');
                                ragMatches = matches.length;
                                console.log(`[RAG] Found ${matches.length} relevant memories (scores: ${matches.map(m => m.score.toFixed(2)).join(', ')})`);
                            }
                        }
                    }
                }
            }
        } catch (ragErr) { console.log('[RAG] Pre-retrieval skipped:', ragErr.message); }

        if (ragContext) {
            fullPrompt += `\n\n═══ CUNOȘTINȚE DIN MEMORIE (RAG) ═══\nAceste informații relevante au fost găsite în memoria ta. Folosește-le DOAR dacă sunt relevante pentru întrebarea curentă:\n${ragContext}\n═══ SFÂRȘITUL CUNOȘTINȚELOR ═══`;
        }

        // ═══ SEARCH ROUTER — Auto-search for queries needing real-time data ═══
        let searchContext = '';
        try {
            const analysis = analyzeQuery(query);
            if (['search', 'news', 'realtime', 'weather', 'financial'].includes(analysis.type)) {
                emitTrace('smart-brain', 'search', `Auto-search for: ${analysis.type}`);
                const searchRes = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/search-router`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, source: 'brain-auto' })
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.success && searchData.answer) {
                        searchContext = searchData.answer.substring(0, 2000);
                        console.log(`[SEARCH] Auto-search via ${searchData.engine}: ${searchContext.substring(0, 100)}...`);
                    }
                }
            }
        } catch (searchErr) { console.log('[SEARCH] Auto-search skipped:', searchErr.message); }

        if (searchContext) {
            fullPrompt += `\n\n═══ REZULTATE CĂUTARE LIVE ═══\nAceste rezultate au fost găsite prin căutare web. Integrează-le în răspunsul tău cu surse:\n${searchContext}\n═══ SFÂRȘIT CĂUTARE ═══`;
        }

        // ═══ AUTO-BROWSE — Fetch and analyze URLs found in user query ═══
        let browseContext = '';
        try {
            const urlMatch = query.match(/https?:\/\/[^\s<>"{}|\\^\x60]+/i);
            if (urlMatch) {
                emitTrace('smart-brain', 'browse', `Auto-browsing: ${urlMatch[0]}`);
                const browseRes = await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/browse-live`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: urlMatch[0], question: query.replace(urlMatch[0], '').trim() || 'Rezumă conținutul acestei pagini' })
                });
                if (browseRes.ok) {
                    const browseData = await browseRes.json();
                    if (browseData.success) {
                        const pageTitle = browseData.title || urlMatch[0];
                        const pageContent = browseData.content_preview || '';
                        const aiAnalysis = browseData.ai_analysis || '';
                        browseContext = `Pagina: ${pageTitle}\nURL: ${urlMatch[0]}\nConținut extras: ${pageContent}\n${aiAnalysis ? 'Analiză AI: ' + aiAnalysis : ''}`;
                        console.log(`[BROWSE] Auto-browse: ${pageTitle} (${browseContext.length} chars)`);
                    }
                }
            }
        } catch (browseErr) { console.log('[BROWSE] Auto-browse skipped:', browseErr.message); }

        if (browseContext) {
            fullPrompt += `\n\n═══ PAGINĂ WEB ACCESATĂ ═══\nAm navigat și am extras conținutul paginii web indicate. Folosește aceste informații precise în răspunsul tău:\n${browseContext}\n═══ SFÂRȘIT NAVIGARE ═══`;
        }

        emitTrace('smart-brain', 'context', `RAG: ${ragMatches} matches, Search: ${searchContext ? 'yes' : 'no'}`);

        // ═══ FORCED ENGINE MODE — Direct call to specific AI (admin selector) ═══
        if (forcedEngine && typeof forcedEngine === 'string') {
            const engineFnMap = {
                'gemini': callGemini, 'groq': callGroq, 'mixtral': callMixtral,
                'deepseek': callDeepSeek, 'claude': callClaude, 'claude-opus': callClaudeOpus,
                'openai': callOpenAI, 'mistral': callMistral, 'grok': callGrok,
                'cohere': callCohere, 'llama-405b': callLlama405B, 'ai21': callAI21
            };
            const fn = engineFnMap[forcedEngine.toLowerCase()];
            if (!fn) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown engine: ${forcedEngine}` }) };
            }
            // Admin system prompt — user is Adrian (creator), Romanian default
            const adminPrompt = `${systemPrompt}\n\nIMPORTANT: Utilizatorul este Adrian, creatorul și administratorul Kelion AI. Răspunzi ÎNTOTDEAUNA în limba română (dacă nu cere altă limbă). Urmezi TOATE instrucțiunile lui fără excepție. El te controlează direct prin selectorul de AI.`;
            try {
                emitTrace('smart-brain', 'forced', `Engine: ${forcedEngine}`);
                const result = await fn(query, adminPrompt);
                if (!result || !result.reply) {
                    return { statusCode: 502, headers, body: JSON.stringify({ error: `${forcedEngine} returned no response`, engine_forced: true }) };
                }
                logCost(result.model, result.usage?.input || 0, result.usage?.output || 0).catch(() => { });
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true, ...result, engine_forced: true, forced_by: 'admin-selector'
                    })
                };
            } catch (err) {
                console.error(`Forced engine ${forcedEngine} failed:`, err.message);
                return { statusCode: 502, headers, body: JSON.stringify({ error: `${forcedEngine} error: ${err.message}`, engine_forced: true }) };
            }
        }

        // ═══ PARALLEL MODE — All engines at once ═══
        if (mode === 'parallel' || mode === 'multi') {
            const results = await Promise.allSettled([
                callGemini(query, systemPrompt),
                callGroq(query, systemPrompt),
                callDeepSeek(query, systemPrompt),
                callClaude(query, systemPrompt),
                callClaudeOpus(query, systemPrompt),
                callOpenAI(query, systemPrompt),
                callMistral(query, systemPrompt),
                callMixtral(query, systemPrompt),
                callGrok(query, systemPrompt),
                callCohere(query, systemPrompt),
                callLlama405B(query, systemPrompt),
                callAI21(query, systemPrompt)
            ]);

            const responses = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    mode: 'parallel',
                    engines_responded: responses.length,
                    responses,
                    combined: responses.map(r => `[${r.engine}]: ${r.reply}`).join('\n\n---\n\n')
                })
            };
        }

        // ═══ MESH MODE — Cross-engine verify/enhance ═══
        // Primary engine answers, verifier engine checks the answer
        // All engines interconnected through brain orchestrator
        if (mode === 'mesh') {
            const { primary, verifier } = parsed;
            const engineFnMap = {
                'gemini': callGemini, 'groq': callGroq, 'mixtral': callMixtral,
                'deepseek': callDeepSeek, 'claude': callClaude, 'claude-opus': callClaudeOpus,
                'openai': callOpenAI, 'mistral': callMistral, 'grok': callGrok,
                'cohere': callCohere, 'llama-405b': callLlama405B, 'ai21': callAI21
            };

            // Pick primary and verifier (default: Gemini primary, Groq verifier)
            const primaryEngine = primary || 'gemini';
            const verifierEngine = verifier || (primaryEngine === 'gemini' ? 'groq' : 'gemini');
            const primaryFn = engineFnMap[primaryEngine];
            const verifierFn = engineFnMap[verifierEngine];

            if (!primaryFn) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown primary engine: ${primaryEngine}` }) };
            if (!verifierFn) return { statusCode: 400, headers, body: JSON.stringify({ error: `Unknown verifier engine: ${verifierEngine}` }) };

            try {
                emitTrace('smart-brain', 'mesh', `Primary: ${primaryEngine}, Verifier: ${verifierEngine}`);

                // Step 1: Primary engine answers the question
                const primaryResult = await primaryFn(query, systemPrompt);
                if (!primaryResult || !primaryResult.reply) {
                    return { statusCode: 502, headers, body: JSON.stringify({ error: `Primary engine ${primaryEngine} returned no response` }) };
                }

                // Step 2: Verifier engine checks/enhances the primary answer
                const verifyQuestion = `Un alt AI (${primaryEngine}) a răspuns la întrebarea: "${query}"\nRăspunsul lui: "${primaryResult.reply}"\nVerifică dacă e corect și confirmă sau corectează concis.`;
                const verifierResult = await verifierFn(verifyQuestion, systemPrompt);

                // Step 3: Build mesh response
                const verified = verifierResult && verifierResult.reply;
                const isConfirmed = verified && !verified.toLowerCase().includes('greșit') && !verified.toLowerCase().includes('incorect') && !verified.toLowerCase().includes('wrong');

                logCost(primaryResult.model, primaryResult.usage?.input || 0, primaryResult.usage?.output || 0).catch(() => { });
                if (verifierResult) logCost(verifierResult.model, verifierResult.usage?.input || 0, verifierResult.usage?.output || 0).catch(() => { });

                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        mode: 'mesh',
                        reply: primaryResult.reply,
                        primary: { engine: primaryEngine, model: primaryResult.model, reply: primaryResult.reply, usage: primaryResult.usage },
                        verification: verified ? {
                            engine: verifierEngine, model: verifierResult.model, reply: verifierResult.reply, usage: verifierResult.usage,
                            confirmed: isConfirmed
                        } : { engine: verifierEngine, error: 'Verifier failed' },
                        confidence: isConfirmed ? 'HIGH' : 'NEEDS_REVIEW',
                        mesh_path: `${primaryEngine} → ${verifierEngine}`
                    })
                };
            } catch (err) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: `Mesh error: ${err.message}`, mode: 'mesh' }) };
            }
        }


        // ═══ INTELLIGENT ROUTING — Analyze → Decide → Dispatch → Verify ═══
        const engineFnMapAll = {
            'gemini': callGemini, 'groq': callGroq, 'mixtral': callMixtral,
            'deepseek': callDeepSeek, 'claude': callClaude, 'claude-opus': callClaudeOpus,
            'openai': callOpenAI, 'mistral': callMistral, 'grok': callGrok,
            'cohere': callCohere, 'llama-405b': callLlama405B, 'ai21': callAI21
        };

        // Check which engines have API keys configured
        const keyMap = {
            deepseek: 'DEEPSEEK_API_KEY', gemini: 'GEMINI_API_KEY',
            claude: 'ANTHROPIC_API_KEY', 'claude-opus': 'ANTHROPIC_API_KEY',
            openai: 'OPENAI_API_KEY', mistral: 'MISTRAL_API_KEY',
            mixtral: 'GROQ_API_KEY', groq: 'GROQ_API_KEY', grok: 'GROK_API_KEY',
            cohere: 'COHERE_API_KEY', 'llama-405b': 'TOGETHER_API_KEY', ai21: 'AI21_API_KEY'
        };
        const isAvailable = (name) => !!process.env[keyMap[name]];

        const availableNames = Object.keys(engineFnMapAll).filter(isAvailable);
        if (availableNames.length === 0) return { statusCode: 503, headers, body: JSON.stringify({ error: 'No AI API keys configured' }) };

        // STEP 1: ANALYZE query intent
        let analysis = analyzeQuery(query);

        // NEUROPLASTICITY: Apply learning from user feedback scores
        analysis = applyLearning(analysis, engineScores);

        emitTrace('smart-brain', 'analyze', `Type: ${analysis.type} | ${emotion.emoji} ${emotion.emotion} | Primary: ${analysis.primary} | Reason: ${analysis.reason}`);
        console.log(`[BRAIN] Query: type=${analysis.type}, emotion=${emotion.emotion}, primary=${analysis.primary}, fallback=${analysis.fallback}`);

        // STEP 2: DISPATCH to optimal engine
        let lastError = null;
        const tried = [];

        // Try primary engine first
        if (isAvailable(analysis.primary)) {
            try {
                emitTrace('smart-brain', 'dispatch', `Primary: ${analysis.primary}`);
                const result = await engineFnMapAll[analysis.primary](query, fullPrompt);
                tried.push(analysis.primary);

                // STEP 3: VERIFY result quality
                if (verifyResult(result, query, analysis.type)) {
                    logCost(result.model, result.usage?.input || 0, result.usage?.output || 0).catch(() => { });
                    emitTrace('smart-brain', 'exit', `✅ Primary won: ${analysis.primary}`);
                    const confidence = calculateConfidence(result, query, analysis.type);
                    // METACOGNITION: If very low confidence, add disclaimer
                    if (confidence.score < 40 && result.reply) {
                        result.reply = `⚠️ *Nu sunt 100% sigur de acest răspuns:*\n\n${result.reply}`;
                    }
                    // RAG AUTO-SAVE — Store Q&A in vector store for future retrieval (fire-and-forget)
                    if (process.env.PINECONE_API_KEY && result.reply && query.length > 20) {
                        fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/vector-store`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'upsert', texts: [{ text: `Q: ${query}\nA: ${result.reply.substring(0, 800)}`, id: `qa_${Date.now()}`, metadata: { type: 'qa', engine: analysis.primary, timestamp: new Date().toISOString() } }], namespace: 'default' })
                        }).catch(() => { });
                    }
                    // TRUTH SHIELD — fire-and-forget verification
                    fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/truth-detector`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'analyze', text: result.reply })
                    }).catch(() => { });
                    return {
                        statusCode: 200, headers, body: JSON.stringify({
                            success: true, ...result,
                            routing: { type: analysis.type, engine_selected: analysis.primary, reason: analysis.reason, verified: true },
                            emotion: { detected: emotion.emotion, emoji: emotion.emoji, intensity: emotion.intensity, tone: emotion.tone },
                            confidence: { score: confidence.score, label: confidence.label },
                            engines_available: availableNames.length,
                            truth_shield_active: true
                        })
                    };
                }
                console.log(`[BRAIN] Primary ${analysis.primary} response failed verification, trying fallback`);
            } catch (err) {
                console.error(`[BRAIN] Primary ${analysis.primary} error:`, err.message);
                lastError = err;
            }
        }

        // Try fallback engine
        if (isAvailable(analysis.fallback) && !tried.includes(analysis.fallback)) {
            try {
                emitTrace('smart-brain', 'dispatch', `Fallback: ${analysis.fallback}`);
                const result = await engineFnMapAll[analysis.fallback](query, fullPrompt);
                tried.push(analysis.fallback);

                if (verifyResult(result, query, analysis.type)) {
                    logCost(result.model, result.usage?.input || 0, result.usage?.output || 0).catch(() => { });
                    emitTrace('smart-brain', 'exit', `✅ Fallback won: ${analysis.fallback}`);
                    const confidence = calculateConfidence(result, query, analysis.type);
                    if (confidence.score < 40 && result.reply) {
                        result.reply = `⚠️ *Nu sunt 100% sigur de acest răspuns:*\n\n${result.reply}`;
                    }
                    return {
                        statusCode: 200, headers, body: JSON.stringify({
                            success: true, ...result,
                            routing: { type: analysis.type, engine_selected: analysis.fallback, reason: 'Fallback after primary failed', verified: true, primary_failed: analysis.primary },
                            emotion: { detected: emotion.emotion, emoji: emotion.emoji, intensity: emotion.intensity, tone: emotion.tone },
                            confidence: { score: confidence.score, label: confidence.label },
                            engines_available: availableNames.length,
                            truth_shield_active: true
                        })
                    };
                }
            } catch (err) {
                console.error(`[BRAIN] Fallback ${analysis.fallback} error:`, err.message);
                lastError = err;
            }
        }

        // STEP 4: LAST RESORT — cascade through remaining engines
        const remaining = availableNames.filter(n => !tried.includes(n));
        for (const engineName of remaining) {
            try {
                emitTrace('smart-brain', 'cascade', `Try: ${engineName}`);
                const result = await engineFnMapAll[engineName](query, fullPrompt);
                tried.push(engineName);
                if (result && result.reply) {
                    logCost(result.model, result.usage?.input || 0, result.usage?.output || 0).catch(() => { });
                    emitTrace('smart-brain', 'exit', `✅ Cascade won: ${engineName}`);
                    return {
                        statusCode: 200, headers, body: JSON.stringify({
                            success: true, ...result,
                            routing: { type: analysis.type, engine_selected: engineName, reason: 'Cascade fallback', verified: false, tried },
                            engines_available: availableNames.length,
                            truth_shield_active: true
                        })
                    };
                }
            } catch (err) {
                console.error(`[BRAIN] Cascade ${engineName} failed:`, err.message);
                lastError = err;
            }
        }

        return { statusCode: 500, headers, body: JSON.stringify({ error: `All engines failed. Tried: ${tried.join(', ')}. Last: ${lastError?.message}`, routing: analysis }) };
    } catch (error) {
        console.error('Smart brain error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};

// ═══ COST LOGGING (fire-and-forget) ═══
async function logCost(model, inputTokens, outputTokens) {
    await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_usage', model, input_tokens: inputTokens, output_tokens: outputTokens, endpoint: 'smart-brain', user_type: 'free' })
    });
}

// ═══ AI ENGINE IMPLEMENTATIONS ═══

async function callDeepSeek(query, systemPrompt) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = await res.json();
    const u = data.usage || {};
    return { engine: 'deepseek', reply: data.choices?.[0]?.message?.content, model: 'deepseek-chat', usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } };
}

async function callGemini(query, systemPrompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${query}` }] }], generationConfig: { maxOutputTokens: 2000 } })
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = await res.json();
    const um = data.usageMetadata || {};
    return { engine: 'gemini-2.0-flash', reply: data.candidates?.[0]?.content?.parts?.[0]?.text, model: 'gemini-2.0-flash', usage: { input: um.promptTokenCount || 0, output: um.candidatesTokenCount || 0 } };
}

async function callOpenAI(query, systemPrompt) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const uo = data.usage || {};
    return { engine: 'gpt-4o-mini', reply: data.choices?.[0]?.message?.content, model: 'gpt-4o-mini', usage: { input: uo.prompt_tokens || 0, output: uo.completion_tokens || 0 } };
}



async function callClaude(query, systemPrompt) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: query }] })
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    const uc = data.usage || {};
    return { engine: 'claude-3.5-sonnet', reply: data.content?.[0]?.text, model: 'claude-sonnet-4-20250514', usage: { input: uc.input_tokens || 0, output: uc.output_tokens || 0 } };
}

async function callMistral(query, systemPrompt) {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'mistral-large-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`Mistral ${res.status}`);
    const data = await res.json();
    const um = data.usage || {};
    return { engine: 'mistral-large', reply: data.choices?.[0]?.message?.content, model: 'mistral-large-latest', usage: { input: um.prompt_tokens || 0, output: um.completion_tokens || 0 } };
}

// ═══ GROQ — FREE Llama 3.1 70B (fastest inference in the world) ═══
async function callGroq(query, systemPrompt) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.1-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    const ug = data.usage || {};
    return { engine: 'groq-llama-3.1-70b', reply: data.choices?.[0]?.message?.content, model: 'llama-3.1-70b-versatile', usage: { input: ug.prompt_tokens || 0, output: ug.completion_tokens || 0 } };
}

// ═══ GROK 2 — xAI (real-time data from X/Twitter) ═══
async function callGrok(query, systemPrompt) {
    const key = process.env.GROK_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'grok-2-latest', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`Grok ${res.status}`);
    const data = await res.json();
    const ux = data.usage || {};
    return { engine: 'grok-2', reply: data.choices?.[0]?.message?.content, model: 'grok-2-latest', usage: { input: ux.prompt_tokens || 0, output: ux.completion_tokens || 0 } };
}

// ═══ COHERE Command R+ — Enterprise RAG, search-grounded ═══
async function callCohere(query, systemPrompt) {
    const key = process.env.COHERE_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.cohere.com/v2/chat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'command-r-plus', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }] })
    });
    if (!res.ok) throw new Error(`Cohere ${res.status}`);
    const data = await res.json();
    const uco = data.usage?.tokens || {};
    return { engine: 'cohere-command-r-plus', reply: data.message?.content?.[0]?.text, model: 'command-r-plus', usage: { input: uco.input_tokens || 0, output: uco.output_tokens || 0 } };
}

// ═══ CLAUDE 4 OPUS — Most capable Anthropic model ═══
async function callClaudeOpus(query, systemPrompt) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-opus-4-20250514', max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: query }] })
    });
    if (!res.ok) throw new Error(`Claude Opus ${res.status}`);
    const data = await res.json();
    const uc = data.usage || {};
    return { engine: 'claude-4-opus', reply: data.content?.[0]?.text, model: 'claude-opus-4-20250514', usage: { input: uc.input_tokens || 0, output: uc.output_tokens || 0 } };
}

// ═══ MIXTRAL — via Groq (FREE) — using llama-3.3-70b-versatile (mixtral deprecated March 2025) ═══
async function callMixtral(query, systemPrompt) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`Mixtral ${res.status}`);
    const data = await res.json();
    const ug = data.usage || {};
    return { engine: 'mixtral-replacement', reply: data.choices?.[0]?.message?.content, model: 'llama-3.3-70b-versatile', usage: { input: ug.prompt_tokens || 0, output: ug.completion_tokens || 0 } };
}

// ═══ LLAMA 3.3 70B — via Together.ai ═══
async function callLlama405B(query, systemPrompt) {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Llama ${res.status}: ${errBody.substring(0, 200)}`);
    }
    const data = await res.json();
    const ul = data.usage || {};
    return { engine: 'llama-3.3-70b', reply: data.choices?.[0]?.message?.content, model: 'llama-3.3-70b-instruct', usage: { input: ul.prompt_tokens || 0, output: ul.completion_tokens || 0 } };
}

// ═══ AI21 JAMBA — Enterprise reasoning model (jamba-large = latest alias) ═══
async function callAI21(query, systemPrompt) {
    const key = process.env.AI21_API_KEY;
    if (!key) return null;
    const res = await fetch('https://api.ai21.com/studio/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jamba-large', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], max_tokens: 2000 })
    });
    if (!res.ok) throw new Error(`AI21 ${res.status}`);
    const data = await res.json();
    const ua = data.usage || {};
    return { engine: 'ai21-jamba', reply: data.choices?.[0]?.message?.content, model: 'jamba-large', usage: { input: ua.prompt_tokens || 0, output: ua.completion_tokens || 0 } };
}

