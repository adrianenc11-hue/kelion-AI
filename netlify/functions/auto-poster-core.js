// ═══ AUTO-POSTER CORE — Shared logic for cron + HTTP API ═══
// Used by: auto-poster.js (cron), auto-poster-api.js (HTTP)
//
// ═══ LOGIC FLOW / FILMUL LOGIC ═══
// 1. TRIGGER (Cron/HTTP) -> Initialize
// 2. TOPIC SELECTION -> Rotate based on day/hour to cover all demographics
// 3. SEARCH AI (FACT CHECK) -> Retrieve real data from legal sources (Search Router)
// 4. GENERATION AI (CREATIVE) -> Draft content using real facts (Smart Brain)
// 5. PUBLISH -> Push to Social Media APIs (Facebook/Instagram/TikTok)
// 6. LOG -> Save result to Database (Supabase)

const SITE_URL = 'kelionai.app';

// ═══ 30+ SUBIECTE ROTATIVE — Pensionari + Salariați + Tineri ═══
const TOPICS = [
    // --- PENSIONARI ---
    { id: 'documente', title: '📋 Ce documente îți trebuie la pensionare?', tags: '#pensie #documente', lege: 'Legea 127/2019, Art. 104', varsta: '55-80' },
    { id: 'varsta', title: '📅 La ce vârstă te pensionezi?', tags: '#pensionare #vârstă', lege: 'Legea 127/2019, Art. 53', varsta: '45-80' },
    { id: 'drepturi_transport', title: '🚌 Transport gratuit pentru pensionari', tags: '#pensionari #transport', lege: 'Legea 118/1990', varsta: '60-80' },
    { id: 'recalculare', title: '📊 Recalcularea pensiilor — Ce trebuie să știi', tags: '#recalculare #pensie', lege: 'OUG 163/2020', varsta: '55-80' },
    { id: 'contestare', title: '⚖️ Cum contești decizia de pensie', tags: '#contestare #drepturi', lege: 'Legea 127/2019, Art. 154', varsta: '55-80' },
    { id: 'grupe_munca', title: '⛏️ Grupe de muncă — reduceri la pensionare', tags: '#grupe #muncă', lege: 'HG 1284/2011, Legea 127/2019 Art. 55', varsta: '35-65' },
    { id: 'pensie_urmas', title: '🕊️ Pensia de urmaș — cine are dreptul?', tags: '#urmaș #pensie', lege: 'Legea 127/2019, Art. 81-86', varsta: '30-80' },
    { id: 'pensie_militara', title: '🪖 Pensii militare — Legea 223/2015', tags: '#militar #pensie', lege: 'Legea 223/2015', varsta: '40-70' },
    { id: 'pilon2', title: '🏦 Pilonul II — Pensie privată obligatorie', tags: '#pilon2 #privat', lege: 'Legea 411/2004', varsta: '25-55' },
    { id: 'pilon3', title: '💰 Pilonul III — Pensie facultativă + avantaje fiscale', tags: '#pilon3 #economii', lege: 'Legea 204/2006', varsta: '25-55' },
    { id: 'drepturi_medical', title: '🏥 Medicamente gratuite pentru pensionari', tags: '#medicamente #pensionari', lege: 'Legea 95/2006', varsta: '60-80' },
    { id: 'cumul', title: '💼 Poți munci și cu pensie? Da!', tags: '#muncă #cumul #pensie', lege: 'Legea 127/2019, Art. 6', varsta: '55-70' },
    { id: 'indemnizatie_sociala', title: '📌 Indemnizația socială minimă garantată', tags: '#indemnizație #minimă', lege: 'OUG 6/2009', varsta: '60-80' },
    { id: 'transfer_ue', title: '🇪🇺 Pensie din mai multe țări UE', tags: '#UE #transfer #pensie', lege: 'Reg. (CE) 883/2004', varsta: '30-70' },
    { id: 'bilet_tratament', title: '🏖️ Bilete de tratament gratuite', tags: '#tratament #balnear', lege: 'Legea 263/2010, OUG 43/2024', varsta: '60-80' },
    { id: 'ajutor_deces', title: '⚱️ Ajutorul de deces — cum se obține', tags: '#ajutor #deces', lege: 'Legea 127/2019, Art. 129-132', varsta: '30-80' },
    { id: 'indexare', title: '📈 Indexarea pensiilor — când și cât cresc', tags: '#indexare #majorare', lege: 'Legea 127/2019, Art. 90', varsta: '55-80' },
    { id: 'certificat_viata', title: '📜 Certificatul de viață — ce e și când trebuie', tags: '#certificat #diaspora', lege: 'CNPP Norme', varsta: '60-80' },

    // --- SALARIAȚI ---
    { id: 'contributii_salariu', title: '💸 Cât plătești lunar la pensie din salariu?', tags: '#CAS #contribuții #salariu', lege: 'Codul Fiscal Art. 138, CAS 25%', varsta: '20-55' },
    { id: 'punct_pensie', title: '📐 Ce e punctul de pensie și cum îl calculezi', tags: '#punct #calcul #pensie', lege: 'Legea 127/2019, Art. 95-96', varsta: '35-65' },
    { id: 'stagiu_cotizare', title: '⏰ Stagiul de cotizare — câți ani trebuie?', tags: '#stagiu #cotizare #ani', lege: 'Legea 127/2019, Art. 52-54', varsta: '25-65' },
    { id: 'pilon2_salariati', title: '🏦 Verifică-ți fondul Pilon II — Cum și unde?', tags: '#pilon2 #verificare #fond', lege: 'Legea 411/2004, ASF', varsta: '20-45' },
    { id: 'planificare_pensie', title: '🎯 Ai 30 ani? Deja e timpul să-ți planifici pensia!', tags: '#planificare #tânăr #pensie', lege: 'Legea 204/2006, Legea 411/2004', varsta: '25-40' },
    { id: 'grupe_salariati', title: '⚠️ Lucrezi în condiții speciale? Ai drept la pensie mai devreme!', tags: '#grupe #condiții #speciale', lege: 'HG 1284/2011, Legea 127/2019 Art. 55-56', varsta: '30-55' },
    { id: 'concediu_maternitate', title: '🤱 Concediul maternal contează la pensie!', tags: '#maternitate #stagiu #pensie', lege: 'OUG 158/2005, Legea 127/2019 Art. 48', varsta: '25-45' },
    { id: 'freelancer_pensie', title: '💻 Freelancer/PFA? Cum îți asiguri pensia', tags: '#PFA #freelancer #CAS', lege: 'Codul Fiscal Art. 148, BASS declarație', varsta: '20-50' },
    { id: 'it_deductibil', title: '🖥️ Lucrezi în IT? Scutirea fiscală NU afectează pensia!', tags: '#IT #scutire #impozit', lege: 'OUG 79/2023, Codul Fiscal Art. 60', varsta: '20-45' },
    { id: 'diaspora_pensie', title: '✈️ Lucrezi în străinătate? Pensia ta din România contează!', tags: '#diaspora #UE #transfer', lege: 'Reg. (CE) 883/2004, Legea 127/2019', varsta: '25-55' },
    { id: 'pensie_anticipata_info', title: '⏩ Pensia anticipată — cu cât se reduce și merită?', tags: '#anticipată #reducere #calcul', lege: 'Legea 127/2019, Art. 58-59', varsta: '50-65' },
    { id: 'adeverinte_sporuri', title: '📄 Adeverințele de sporuri — AURUL dosarului de pensie', tags: '#adeverințe #sporuri #angajator', lege: 'HG 257/2011, Legea 127/2019', varsta: '40-65' },

    // --- ELEVI / STUDENȚI / TINERI (0-25 ani) ---
    { id: 'drepturi_elev', title: '📚 Drepturile tale ca elev — ce NU au voie profesorii!', tags: '#elev #drepturi #școală', lege: 'Legea Educației 198/2023, Art. 7-12', varsta: '12-18' },
    { id: 'burse_scolare', title: '🎓 Burse școlare 2025 — cine primește și cât?', tags: '#burse #elev #bani', lege: 'Legea 198/2023, HG 1.064/2023', varsta: '10-18' },
    { id: 'bac_pregatire', title: '📝 BAC 2025 — Materii, calendar, sfaturi de la K', tags: '#BAC #examen #pregătire', lege: 'OMEN 4.831/2024, Legea 198/2023', varsta: '16-19' },
    { id: 'bullying_lege', title: '🛡️ Bullying la școală? LEGEA te protejează!', tags: '#bullying #protecție #elev', lege: 'Legea 221/2019 anti-bullying, Legea 198/2023', varsta: '10-18' },
    { id: 'transport_elevi', title: '🚌 Transport GRATUIT pentru elevi — cum obții?', tags: '#transport #gratuit #elev', lege: 'Legea 198/2023, Art. 15, OUG transport școlar', varsta: '10-18' },
    { id: 'educatie_speciala', title: '♿ Educație pentru copii cu nevoi speciale — drepturi', tags: '#CES #incluziune #drepturi', lege: 'Legea 198/2023, Cap. V, OMEN orientare CES', varsta: '6-18' },
    { id: 'student_job', title: '💼 Student și muncești? Ce drepturi ai conform legii!', tags: '#student #muncă #drepturi', lege: 'Codul Muncii Art. 13, Legea 72/2007 studenți', varsta: '16-25' },
    { id: 'formare_profesionala', title: '🔧 Școala profesională — alternativa SMART la liceu!', tags: '#profesional #meserie #ucenicie', lege: 'Legea 198/2023, învățământ dual, Legea 279/2005', varsta: '14-19' },
    { id: 'erasmus_tineri', title: '🌍 Erasmus+ pentru elevi și studenți — cum aplici GRATIS?', tags: '#Erasmus #mobilitate #UE', lege: 'Regulament UE Erasmus+ 2021-2027', varsta: '14-25' },
    { id: 'digital_skills', title: '💻 Competențe digitale obligatorii — ce înveți la școală?', tags: '#digital #informatică #competențe', lege: 'Legea 198/2023, curriculum digital', varsta: '10-18' },
    { id: 'educatie_financiara', title: '💰 Educație financiară la școală — ce e bine să știi!', tags: '#financiar #economie #adolescent', lege: 'Legea 198/2023, educație financiară opțional', varsta: '14-25' },
    { id: 'orientare_cariera', title: '🎯 Nu știi ce meserie să alegi? K te ajută!', tags: '#carieră #orientare #vocație', lege: 'Legea 198/2023, consiliere și orientare', varsta: '14-25' },

    // --- PREVENȚIE & EDUCAȚIE SOCIALĂ (tineri) ---
    { id: 'anti_droguri', title: '🚫 Drogurile distrug vieți — Faptele REALE pe care trebuie să le știi', tags: '#antidrog #prevenție #sănătate', lege: 'Legea 143/2000 anti-droguri, Legea 272/2004', varsta: '12-25' },
    { id: 'anti_alcool', title: '🍷 Alcoolul sub 18 ani e ILEGAL — Ce riscuri reale ai?', tags: '#alcool #minor #sănătate', lege: 'Legea 61/1991, OG 26/2000, Codul Penal Art. 384', varsta: '12-18' },
    { id: 'siguranta_online', title: '🔒 Siguranța ta online — Ce NU trebuie să postezi NICIODATĂ', tags: '#online #siguranță #cyber', lege: 'GDPR, Legea 272/2004, Legea 506/2004 date personale', varsta: '10-18' },
    { id: 'sanatate_mintala', title: '🧠 Nu ești singur! Cum ceri ajutor când te simți rău', tags: '#sănătate #mintală #ajutor', lege: 'Legea 487/2002 sănătate mintală, Telefonul Copilului 116.111', varsta: '12-25' },
    { id: 'alimentatie_sanatoasa', title: '🥗 Mâncarea sănătoasă — combustibilul creierului tău!', tags: '#nutriție #sănătate #elev', lege: 'OG 44/2016 cantina școlară, Legea 123/2008', varsta: '10-18' },
    { id: 'sport_beneficii', title: '⚽ Sportul te face mai deștept — Știința spune DA!', tags: '#sport #sănătate #mișcare', lege: 'Legea 198/2023 Ed. fizică, Legea 69/2000 educație fizică', varsta: '10-18' },
    { id: 'social_media_responsabil', title: '📱 Folosești TikTok/Insta? Fii SMART, nu victimă!', tags: '#socialmedia #responsabil #digital', lege: 'GDPR Art. 8, Legea 272/2004, DSA (Digital Services Act)', varsta: '12-18' },
    { id: 'voluntariat_tineri', title: '🤝 Voluntariatul — CV-ul tău secret! Unde și cum?', tags: '#voluntariat #tineri #experiență', lege: 'Legea 78/2014 voluntariat', varsta: '14-25' }
];

// ═══ STILURI DE POSTARE — FORMAT LUX, ÎNALTĂ CLASĂ ═══
const POST_STYLES = [
    {
        name: 'intrebare_lux',
        prompt: (title) => `Creează o postare PREMIUM și ELEGANTĂ legată de: "${title}".
Începe cu o întrebare intrigantă, sofisticată.
Ton: profesionist de top, ca un consultant exclusiv.
Design vizual: folosește separatoare elegante (─── sau ◆), spațiere aerisită.
Structură: Întrebare puternică → Răspuns expert cu date concrete (cifre, lege) → CTA rafinat.
Max 300 chars. 2-3 emoji sofisticați (🏛️ ⚖️ 💎 📊). La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'tip_exclusiv',
        prompt: (title) => `Scrie un "✦ SFAT EXCLUSIV" despre: "${title}".
Format premium: "✦ SFAT EXCLUSIV ───\n[sfat expert, formulat elegant]\n───"
Ton: ca un advisor privat care oferă informații privilegiate.
Folosește limbaj sofisticat dar accesibil.
Max 300 chars. Emoji premium: ✦ 📋 🏛️. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'mit_premium',
        prompt: (title) => `Scrie o postare elegantă "ADEVĂR vs FICȚIUNE" despre: "${title}".
Format: "◆ FICȚIUNE: [mit comun, formulat cu finețe]\n◆ ADEVĂRUL: [realitatea cu cifre exacte și referință legală]"
Ton: autoritar dar cald, ca un expert reputat.
Design: clean, aerisit, cu separatoare vizuale elegante.
Max 320 chars. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'poveste_eleganta',
        prompt: (title) => `Scrie o MICRO-POVESTE elegantă (3 propoziții) despre: "${title}".
Stil narativ premium, ca într-o revistă de top.
Ex: "Doamna Elena, 62 ani, nu știa că legislația îi oferă acest drept. După consultarea cu K, a descoperit că..."
Personaje cu demnitate, poveste inspirațională.
Max 320 chars. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'quiz_sofisticat',
        prompt: (title) => `Scrie un QUIZ elegant despre: "${title}".
Format: "◆ TEST DE CUNOȘTINȚE ───\n[întrebare inteligentă]\n\nA) ... B) ... C) ...\n\n───\n✦ Răspuns: [explicație concisă și profesionistă]"
Fă-l provocator intelectual, nu trivial.
Max 350 chars. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'cifra_impresionanta',
        prompt: (title) => `Începe cu o STATISTICĂ IMPRESIONANTĂ legată de: "${title}".
Format premium: "◆ [CIFRA PUTERNICĂ] ───\n[context și explicație elegantă]\n[ce acțiune trebuie luată]"
Cifra REALĂ din legislație/statistici oficiale.
Ton: jurnalism de investigație premium.
Max 300 chars. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'ghid_premium',
        prompt: (title) => `Scrie un GHID RAPID premium (3 pași) despre: "${title}".
Format: "✦ GHID EXPERT ───\n➊ ...\n➋ ...\n➌ ...\n───"
Pași formulați profesionist, acționabili imediat.
Ca un document de consultanță de top.
Max 320 chars. La final: 🌐 ${SITE_URL}`
    },
    {
        name: 'comparatie_eleganta',
        prompt: (title) => `Scrie o ANALIZĂ COMPARATIVĂ elegantă despre: "${title}".
Compară "ÎNAINTE ◆ DUPĂ" sau "România ◆ UE" sau "Fără K ◆ Cu K".
Format vizual premium cu ◆ și ───.
Ton: raport analitic de top, date concrete.
Max 300 chars. La final: 🌐 ${SITE_URL}`
    }
];

// ═══ HELPERS ═══
function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
}

function respond(code, data) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };
    return { statusCode: code, headers, body: JSON.stringify(data, null, 2) };
}

// ═══ GENERARE AI POST — Stil lux cu date REALE verificate ═══
// LOGIC STEP 3 & 4 (The 2 AIs): Search Router (Facts) -> Smart Brain (Creation)
async function generateAIPost(topic) {
    const styleIndex = (getDayOfYear() + topic.id.length) % POST_STYLES.length;
    const style = POST_STYLES[styleIndex];

    console.log(`🎨 Post style: ${style.name} for topic: ${topic.id}`);

    // STEP 1: Căutare REALĂ — obține date verificate din surse reale
    let realFacts = '';
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const searchRes = await fetch(`${baseUrl}/.netlify/functions/search-router`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `${topic.title} ${topic.lege} România legislație actuală`,
                source: 'auto-poster'
            })
        });
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.success && searchData.answer) {
                realFacts = searchData.answer.substring(0, 1500);
                console.log(`📚 Real facts found via ${searchData.engine}: ${realFacts.substring(0, 100)}...`);
            }
        }
    } catch (e) {
        // Soft fail on search - we use topic data as fallback
        console.log('Search skipped:', e.message);
    }

    // STEP 2: Generare post cu date REALE
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const aiRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: style.prompt(topic.title),
                system: `Ești K, expert PREMIUM legislație România. Generezi postări de ÎNALTĂ CLASĂ, elegant formatate.

⚠️ REGULA #1 ABSOLUTĂ: ZERO INFORMAȚII INVENTATE!
- Folosești DOAR date reale, verificate, din legislație oficială
- Citezi EXACT articolul de lege: ${topic.lege}
- Cifrele TREBUIE să fie din surse oficiale (INS, CNPP, MFP, Monitorul Oficial)
- Dacă nu ești sigur de o cifră, NU o include
- FIECARE afirmație trebuie să poată fi verificată

${realFacts ? `\n═══ DATE REALE VERIFICATE DIN CĂUTARE ═══\nFolosește ACESTE informații reale pentru postare:\n${realFacts}\n═══ SFÂRȘIT DATE REALE ═══\n` : ''}

AUDIENȚĂ TARGET: ${topic.varsta} ani
${parseInt(topic.varsta) < 18 ? `⚠️ REGULI STRICTE PENTRU MINORI (COPPA/GDPR Art.8/Legea 272/2004):
- Conținut 100% EDUCATIV, adaptat vârstei ${topic.varsta} ani
- TON: Ca un profesor cool dar responsabil
- ZERO manipulare comercială, ZERO date personale
- Focus pe DREPTURI și OPORTUNITĂȚI` : parseInt(topic.varsta) < 40 ? 'TON PENTRU TINERI: Modern, elegant, sofisticat dar accesibil.' : parseInt(topic.varsta) >= 55 ? 'TON PENTRU SENIORI: Respectuos, cald, premium. Ca un consultant de încredere.' : 'TON PENTRU ADULȚI: Profesionist premium, informații concrete.'}

STIL PREMIUM:
- Format vizual elegant cu ◆, ✦, ─── 
- Ton sofisticat, de consultant exclusiv
- Spațiere aerisită, design clean
- Citează EXACT legea: ${topic.lege}
- SURSELE trebuie să fie reale (Wikipedia, legislatie.just.ro, gov.ro)

INTERDICȚII ABSOLUTE: Cifre inventate, statistici false, promisiuni nerealizabile, informații neverificate${parseInt(topic.varsta) < 18 ? ', conținut inadecvat minorilor' : ''}`,
                model: 'auto',
                max_tokens: 500
            })
        });

        if (aiRes.ok) {
            const data = await aiRes.json();
            const text = (data.reply || data.response || data.text || data.content || '').trim();
            if (text.length > 20) {
                return text.includes(SITE_URL) ? text : text + `\n\n🌐 ${SITE_URL}`;
            }
        }
    } catch (e) {
        console.error('AI generate error:', e.message);
    }

    // Fallback static — tot cu date reale din topic (dacă AI pică)
    return `✦ ${topic.title}\n\n───\nConform ${topic.lege}, legislația română garantează acest drept.\nAflă detaliile complete de la K, consultantul tău AI expert.\n───\n\n💬 Verifică-ți drepturile acum!\n🌐 ${SITE_URL}`;
}

// ═══ POST PE FACEBOOK ═══
async function postToFacebook(message, topic) {
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const PAGE_ID = process.env.META_PAGE_ID;

    if (!PAGE_TOKEN || !PAGE_ID) {
        return { posted: false, error: 'META_PAGE_ACCESS_TOKEN sau META_PAGE_ID lipsesc din env vars' };
    }

    try {
        const params = new URLSearchParams({
            message: message,
            access_token: PAGE_TOKEN
        });

        const res = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/feed`, {
            method: 'POST',
            body: params
        });
        const data = await res.json();

        if (data.error) {
            console.error('❌ FB post error:', data.error.message);
            return { posted: false, error: data.error.message };
        }

        console.log('✅ FB post:', data.id);
        return { posted: true, post_id: data.id, topic: topic.id };
    } catch (err) {
        return { posted: false, error: err.message };
    }
}

// ═══ POST PE INSTAGRAM ═══
async function postToInstagram(message, topic) {
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    const IG_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!PAGE_TOKEN || !IG_ACCOUNT_ID) {
        return { posted: false, error: 'META_PAGE_ACCESS_TOKEN sau INSTAGRAM_BUSINESS_ACCOUNT_ID lipsesc. Instagram posting necesită cont Business conectat la FB Page.' };
    }

    try {
        // Instagram necesită o imagine. Pentru funcția text-only întoarcem un status de "ready"
        console.log('📸 IG post ready (needs image):', topic.title);
        return {
            posted: false,
            ready: true,
            topic: topic.id,
            note: 'Instagram necesită imagine pt postare. Setează INSTAGRAM_BUSINESS_ACCOUNT_ID după conectarea cu FB Page.',
            message_preview: message.slice(0, 100)
        };
    } catch (err) {
        return { posted: false, error: err.message };
    }
}

// ═══ POST PE TIKTOK ═══
async function postToTikTok(message, topic) {
    const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
    const OPEN_ID = process.env.TIKTOK_OPEN_ID;

    if (!ACCESS_TOKEN || !OPEN_ID) {
        return {
            posted: false,
            ready: true,
            topic: topic.id,
            note: 'TIKTOK_ACCESS_TOKEN și TIKTOK_OPEN_ID lipsesc.',
            message_preview: message.slice(0, 100)
        };
    }

    try {
        const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                post_info: {
                    title: message.slice(0, 150),
                    description: `${topic.tags} #KelionAI #pensii #legislatie`,
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_comment: false,
                    auto_add_music: true
                },
                source_info: {
                    source: 'PULL_FROM_URL',
                    photo_cover_index: 0,
                    photo_images: [`https://kelionai.app/api/social-card?text=${encodeURIComponent(message.slice(0, 200))}&topic=${topic.id}`]
                },
                media_type: 'PHOTO'
            })
        });

        const data = await initRes.json();
        if (data.error?.code) {
            console.error('❌ TikTok post error:', data.error.message);
            return { posted: false, error: data.error.message, topic: topic.id };
        }

        console.log('✅ TikTok post initiated:', data.data?.publish_id);
        return { posted: true, publish_id: data.data?.publish_id, topic: topic.id, platform: 'tiktok' };
    } catch (err) {
        console.error('❌ TikTok error:', err.message);
        return { posted: false, error: err.message, topic: topic.id };
    }
}

// ═══ AUTO POST — Alege subiect rotativ, generează AI, postează ═══
async function autoPost(platform) {
    const results = { timestamp: new Date().toISOString(), posts: [] };

    const dayOfYear = getDayOfYear();
    const hour = new Date().getUTCHours();
    // Dimineața = index par, seara = index impar
    const topicIndex = (dayOfYear * 2 + (hour >= 12 ? 1 : 0)) % TOPICS.length;
    const topic = TOPICS[topicIndex];

    console.log(`📝 Auto-post: Topic "${topic.title}" (index ${topicIndex})`);

    // LOGIC STEP 3 & 4 Call
    const postContent = await generateAIPost(topic);

    // LOGIC STEP 5: Push to Socials
    if (platform === 'all' || platform === 'facebook') {
        const fbResult = await postToFacebook(postContent, topic);
        results.posts.push({ platform: 'facebook', ...fbResult });
    }

    if (platform === 'all' || platform === 'instagram') {
        const igResult = await postToInstagram(postContent, topic);
        results.posts.push({ platform: 'instagram', ...igResult });
    }

    if (platform === 'all' || platform === 'tiktok') {
        const ttResult = await postToTikTok(postContent, topic);
        results.posts.push({ platform: 'tiktok', ...ttResult });
    }

    // LOGIC STEP 6: Log
    await logAutoPost(results);
    return results;
}

// ═══ STATUS ═══
function getStatus() {
    const dayOfYear = getDayOfYear();
    const hour = new Date().getUTCHours();
    const morningIndex = (dayOfYear * 2) % TOPICS.length;
    const eveningIndex = (dayOfYear * 2 + 1) % TOPICS.length;

    return {
        service: 'Kelion AI Auto-Poster',
        schedule: '2x pe zi: 09:00 și 18:00 UTC',
        schedule_cron: '0 9,18 * * *',
        today: {
            date: new Date().toISOString().split('T')[0],
            morning_topic: TOPICS[morningIndex],
            evening_topic: TOPICS[eveningIndex],
            current_hour_utc: hour,
            next_post: hour < 9 ? '09:00 UTC' : hour < 18 ? '18:00 UTC' : 'mâine 09:00 UTC'
        },
        platforms: {
            facebook: {
                configured: !!(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID),
                needs: ['META_PAGE_ACCESS_TOKEN', 'META_PAGE_ID']
            },
            instagram: {
                configured: !!process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
                needs: ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'META_PAGE_ACCESS_TOKEN'],
                note: 'Necesită cont Business conectat la FB Page'
            },
            tiktok: {
                configured: !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_OPEN_ID),
                needs: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_OPEN_ID'],
                account: '@kelion_ai_expert'
            }
        },
        total_topics: TOPICS.length,
        rotation: `Fiecare subiect apare la ~${Math.ceil(TOPICS.length / 2)} zile`
    };
}

// ═══ PREVIEW NEXT POST ═══
async function previewNext() {
    const dayOfYear = getDayOfYear();
    const hour = new Date().getUTCHours();
    const topicIndex = (dayOfYear * 2 + (hour >= 12 ? 1 : 0)) % TOPICS.length;
    const topic = TOPICS[topicIndex];

    const postContent = await generateAIPost(topic);
    return {
        topic: topic,
        post_preview: postContent,
        character_count: postContent.length,
        would_post_to: ['facebook', 'instagram', 'tiktok'],
        note: 'Aceasta este o previzualizare. Folosește action=post_now pentru a posta manual.'
    };
}

// ═══ POST NOW — Manual trigger ═══
async function postNow(platform, topicId) {
    const topic = topicId
        ? TOPICS.find(t => t.id === topicId) || TOPICS[0]
        : TOPICS[Math.floor(Math.random() * TOPICS.length)];

    const postContent = await generateAIPost(topic);
    const results = { manual: true, timestamp: new Date().toISOString(), posts: [] };

    if (platform === 'all' || platform === 'facebook') {
        results.posts.push({ platform: 'facebook', ...(await postToFacebook(postContent, topic)) });
    }
    if (platform === 'all' || platform === 'instagram') {
        results.posts.push({ platform: 'instagram', ...(await postToInstagram(postContent, topic)) });
    }
    if (platform === 'all' || platform === 'tiktok') {
        results.posts.push({ platform: 'tiktok', ...(await postToTikTok(postContent, topic)) });
    }

    await logAutoPost(results);
    return results;
}

// ═══ LOG ÎN SUPABASE ═══
async function logAutoPost(results) {
    try {
        // Dynamic import to avoid crash if module missing
        let createClient;
        try {
            createClient = require('@supabase/supabase-js').createClient;
        } catch (e) { console.warn('Supabase module missing, skipping log'); return; }

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const db = createClient(url, key);
        await db.from('auto_posts_log').insert({
            results: JSON.stringify(results),
            posted_at: new Date().toISOString(),
            topics: results.posts?.map(p => p.topic).join(',') || 'unknown'
        }).catch(e => console.log('Log insert skipped:', e.message));
    } catch (e) {
        console.log('Supabase log skipped:', e.message);
    }
}

// ═══ HANDLER — Netlify treats every .js in functions/ as a serverless function ═══
const { patchProcessEnv } = require('./get-secret');

const handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        let result;
        switch (body.action) {
            case 'status': result = getStatus(); break;
            case 'preview': result = await previewNext(); break;
            case 'post_now': result = await postNow(body.platform || 'all', body.topic_id); break;
            case 'auto_post': result = await autoPost(body.platform || 'all'); break;
            default: result = { actions: ['status', 'preview', 'post_now', 'auto_post'], note: 'Use auto-poster.js (cron) or auto-poster-api.js (HTTP) for normal operations' };
        }
        return { statusCode: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, ...result }) };
    } catch (err) {
        return { statusCode: 500, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: err.message }) };
    }
};

// ═══ EXPORTS — handler for Netlify + shared functions for require() ═══
module.exports = {
    handler,
    TOPICS,
    POST_STYLES,
    SITE_URL,
    getDayOfYear,
    respond,
    generateAIPost,
    postToFacebook,
    postToInstagram,
    postToTikTok,
    autoPost,
    getStatus,
    previewNext,
    postNow,
    logAutoPost
};
