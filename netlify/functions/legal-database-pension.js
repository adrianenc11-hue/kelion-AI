// ═══ LEGAL DATABASE — PENSII — Legislație completă per țară ═══
// Baza de date cu legi, articole, OUG-uri, HG-uri pentru pensii

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { action, country, topic, keyword } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'search':
                return respond(200, searchLegislation(country || 'Romania', keyword || topic));
            case 'get_law':
                return respond(200, getLaw(country || 'Romania', topic));
            case 'get_rights':
                return respond(200, getPensionRights(country || 'Romania', topic));
            case 'faq':
                return respond(200, getFAQ(country || 'Romania'));
            case 'recent_changes':
                return respond(200, getRecentChanges(country || 'Romania'));
            case 'institutions':
                return respond(200, getInstitutions(country || 'Romania'));
            default:
                return respond(400, { error: 'Actions: search, get_law, get_rights, faq, recent_changes, institutions' });
        }
    } catch (err) {
        console.error('Legal DB error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return {
        statusCode: code,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: code === 200, ...data })
    };
}

// ═══════════════════════════════════════════════════════
// ROMÂNIA — LEGISLAȚIE COMPLETĂ PENSII
// ═══════════════════════════════════════════════════════

const ROMANIA_LAWS = {
    // ═══ LEGEA PRINCIPALĂ ═══
    'legea_127_2019': {
        title: 'Legea 127/2019 — Sistemul public de pensii',
        status: 'ÎN VIGOARE (cu modificări)',
        published: 'Monitorul Oficial nr. 563/2019',
        summary: 'Legea fundamentală a sistemului public de pensii din România. Înlocuiește parțial Legea 263/2010.',
        key_articles: {
            'Art. 6': 'Tipurile de pensii: limită de vârstă, anticipată, anticipată parțială, invaliditate, urmaș',
            'Art. 16': 'Vârsta standard de pensionare: 65 ani bărbați, 63 ani femei (creștere graduală)',
            'Art. 17': 'Stagiul minim de cotizare: 15 ani',
            'Art. 18': 'Stagiul complet de cotizare: 35 ani bărbați, 30 ani femei (creștere graduală)',
            'Art. 29': 'Pensie anticipată — cu cel mult 5 ani înainte de vârsta standard',
            'Art. 30': 'Pensie anticipată parțială — diminuare 0.75% per lună',
            'Art. 53-58': 'Pensie de invaliditate — grad I, II, III',
            'Art. 64': 'Revizia medicală periodică a pensiei de invaliditate',
            'Art. 86-91': 'Pensie de urmaș — 50% (1 urmaș), 75% (2), 100% (3+)',
            'Art. 95-102': 'Formularul de calcul — punctaj, valoare punct pensie',
            'Art. 96': 'Punctajul anual = Venit brut lunar / Salariul mediu brut pe economie',
            'Art. 97': 'Punctajul mediu anual = Suma punctajelor / Stagiul complet',
            'Art. 98': 'Pensie lunară = Punctaj mediu anual × Valoare punct pensie',
            'Art. 107': 'Recalcularea pensiilor — din oficiu sau la cerere',
            'Art. 131': 'Cumulul pensiei cu salariu — permis fără restricții pentru limită de vârstă',
            'Art. 137': 'Plata pensiei — lunar, prin mandat poștal sau cont bancar',
            'Art. 154': 'Contestarea deciziei de pensie — 45 zile la Tribunalul competent'
        }
    },

    // ═══ LEGEA ANTERIOARĂ (încă relevantă) ═══
    'legea_263_2010': {
        title: 'Legea 263/2010 — Sistemul unitar de pensii publice',
        status: 'PARȚIAL ÎN VIGOARE (completează Legea 127/2019)',
        summary: 'Fosta lege principală. Anumite prevederi rămân în vigoare până la implementarea completă a L127/2019.',
        key_articles: {
            'Art. 30': 'Grupele de muncă — condiții deosebite și speciale',
            'Art. 100': 'Indemnizație socială pentru pensionari — minim garantat',
            'Art. 169': 'Pensiile militare nu intră sub incidența acestei legi'
        }
    },

    // ═══ RECALCULARE ═══
    'oug_163_2020': {
        title: 'OUG 163/2020 — Recalcularea pensiilor',
        status: 'ÎN VIGOARE',
        summary: 'Recalcularea tuturor pensiilor aflate în plată conform noii formule din L127/2019.',
        key_points: [
            'Recalcularea se face din oficiu, nu trebuie cerere',
            'Se iau în calcul toate veniturile brute (sporuri, bonusuri)',
            'Dacă pensia recalculată e mai mică, rămâne cea mai mare',
            'Termen de aplicare: eșalonat'
        ]
    },

    // ═══ PENSII MILITARE ═══
    'legea_223_2015': {
        title: 'Legea 223/2015 — Pensii militare de stat',
        status: 'ÎN VIGOARE',
        summary: 'Regim special de pensii pentru: armată, poliție, SRI, SIE, SPP, administrație penitenciară.',
        key_articles: {
            'Art. 16': 'Vârsta de pensionare: variabilă pe grad și funcție',
            'Art. 28': 'Baza de calcul: media soldelor/salariilor pe ultimele 6 luni',
            'Art. 29': 'Procent: 65% din baza de calcul + 1% per an peste 25 ani',
            'Art. 30': 'Plafonare: maximum 85% din baza de calcul'
        }
    },

    // ═══ PILONUL II — Pensii private obligatorii ═══
    'legea_411_2004': {
        title: 'Legea 411/2004 — Fonduri de pensii private obligatorii (Pilon II)',
        status: 'ÎN VIGOARE',
        summary: 'Contribuție obligatorie redirecționată la fonduri private de pensii.',
        key_points: [
            'Contribuție: 3.75% din salariu brut (redirecționat din CAS)',
            'Participanți: persoane sub 35 ani (obligatoriu), 35-45 ani (opțional)',
            'Fonduri: NN Pensii, Vital, Metropolitan Life, BCR Pensii, etc.',
            'Drept de retragere: la pensionare sau moștenire'
        ]
    },

    // ═══ PILONUL III — Pensii facultative ═══
    'legea_204_2006': {
        title: 'Legea 204/2006 — Pensii facultative (Pilon III)',
        status: 'ÎN VIGOARE',
        summary: 'Contribuție voluntară suplimentară la fonduri private.',
        key_points: [
            'Contribuție: voluntară, deductibilă fiscal (până la 400 EUR/an)',
            'Poate fi plătită și de angajator',
            'Retragere: la pensionare sau după minim 90 contribuții lunare'
        ]
    },

    // ═══ GRUPE DE MUNCĂ ═══
    'hg_1284_2011': {
        title: 'HG 1284/2011 — Locuri de muncă în condiții speciale',
        status: 'ÎN VIGOARE (actualizat periodic)',
        summary: 'Lista completă a locurilor de muncă încadrate în grupe speciale.',
        work_groups: {
            'Grupa I (condiții speciale)': {
                description: 'Muncă în condiții foarte grele — risc ridicat',
                examples: ['Minerit subteran', 'Siderurgie — furnale/oțelării', 'Turnari metale grele', 'Radioactivitate', 'Producție explozivi'],
                benefit: 'Reducere vârstă pensionare: 6-13 ani, bonus punctaj x1.5'
            },
            'Grupa II (condiții deosebite)': {
                description: 'Muncă în condiții grele — risc mediu',
                examples: ['Construcții navale', 'Industria chimică', 'Sudură', 'Vopsitorii industriale', 'Muncă la înălțime'],
                benefit: 'Reducere vârstă pensionare: 2-8 ani, bonus punctaj x1.25'
            },
            'Grupa III (condiții normale)': {
                description: 'Muncă în condiții standard',
                examples: ['Birou', 'Comerț', 'Servicii', 'IT', 'Învățământ'],
                benefit: 'Fără reducere vârstă, punctaj standard x1.0'
            }
        }
    },

    // ═══ INDEMNIZAȚIA SOCIALĂ ═══
    'oug_6_2009': {
        title: 'OUG 6/2009 — Indemnizația socială pentru pensionari',
        status: 'ÎN VIGOARE',
        summary: 'Garantează un minim de pensie pentru toți pensionarii.',
        key_points: [
            'Indemnizație socială minimă: 1.281 RON (2025)',
            'Se aplică automat dacă pensia calculată e sub acest nivel',
            'Diferența este plătită de la bugetul de stat',
            'Se actualizează anual prin HG'
        ]
    },

    // ═══ CUMUL PENSIE + SALARIU ═══
    'cumul_pensie_salariu': {
        title: 'Cumulul pensiei cu salariul — Reguli',
        status: 'Reglementat prin art. 131-134 din Legea 127/2019',
        rules: [
            '✅ Pensie limită de vârstă + salariu = CUMULABIL fără restricții',
            '⚠️ Pensie anticipată/anticipată parțială + salariu = NU se cumulează (se suspendă pensia)',
            '⚠️ Pensie invaliditate grad I/II + salariu = NU se cumulează',
            '✅ Pensie invaliditate grad III + salariu = CUMULABIL',
            '✅ Pensie urmaș + salariu = CUMULABIL',
            '📌 Important: se datorează CAS și CASS pe salariu'
        ]
    }
};

// ═══ DREPTURI PENSIONARI ROMÂNIA ═══
const ROMANIA_RIGHTS = {
    transport: {
        title: 'Drepturi transport',
        rights: [
            '🚌 Transport urban gratuit — în orașul de domiciliu (hotărâre locală)',
            '🚂 6 călătorii gratuite CFR pe an (cls. II) — pensionari peste 60/65 ani',
            '🚌 Reducere 50% transport județean',
            '📌 Legitimație de transport: cerere la Casa de Pensii + decizia de pensionare'
        ]
    },
    medical: {
        title: 'Drepturi sănătate',
        rights: [
            '💊 Medicamente gratuite: lista C2 (boli cronice grave)',
            '💊 Medicamente compensate 50%/90%: listele C1',
            '🏥 Consultații gratuite în sistemul public',
            '🦷 Proteze dentare gratuite/subvenționate',
            '👓 Dispozitive medicale (ochelari, cârje, proteze) — subvenționate',
            '🏠 Internare gratuită în spitale publice',
            '📌 Condiție: plata CASS (automat la pensie > 4× minim pe economie)'
        ]
    },
    fiscal: {
        title: 'Drepturi fiscale',
        rights: [
            '📊 Impozit pe pensie: 0% până la 2.000 RON',
            '📊 Impozit pe pensie: 10% pe suma care depășește 2.000 RON',
            '🏠 Impozit clădire: reducere/scutire pentru pensionari (hotărâre locală)',
            '📌 CASS: reținut automat dacă pensia > plafonul minim'
        ]
    },
    social: {
        title: 'Ajutoare sociale',
        rights: [
            '🔥 Ajutor încălzire: GRATUIT sau subvenționat (gaz, lemne, curent)',
            '🎄 Cadouri sociale de sărbători (unele primării)',
            '🏠 Locuințe sociale — prioritate pentru pensionari cu venituri mici',
            '🍽️ Cantine sociale gratuite — pentru pensionari sub minim',
            '📌 Cerere la Direcția de Asistență Socială din localitate'
        ]
    },
    funeral: {
        title: 'Ajutor deces',
        rights: [
            '⚱️ Ajutor deces: ~6.994 RON (2025) — pentru membrul de familie',
            '⚱️ Ajutor deces: ~3.497 RON — pentru alt membru de familie',
            '📌 Cerere la Casa de Pensii, în termen de 3 ani de la deces',
            '📋 Documente: certificat deces, CI solicitant, cont bancar'
        ]
    }
};

// ═══ FAQ ROMÂNIA ═══
const ROMANIA_FAQ = [
    {
        q: 'La ce vârstă mă pensionez?',
        a: 'Bărbați: 65 ani. Femei: 63 ani (crește gradual la 63). Reduceri pentru grupe speciale (I: -6-13 ani, II: -2-8 ani).'
    },
    {
        q: 'Câți ani de muncă îmi trebuie?',
        a: 'Minim 15 ani pentru pensie. Stagiu complet: 35 ani (bărbați) / 30 ani (femei). Cu stagiu incomplet primești pensie proporțională.'
    },
    {
        q: 'Cum se calculează pensia?',
        a: 'Pensie = Punctaj mediu anual × Valoare punct pensie (2.032 RON în 2025). Punctaj anual = Salariu brut / Salariu mediu brut pe economie.'
    },
    {
        q: 'Pot lucra și primi pensie?',
        a: 'DA, pentru pensie limită de vârstă — fără restricții. NU, pentru pensie anticipată sau invaliditate grad I/II — se suspendă. DA, pentru invaliditate grad III.'
    },
    {
        q: 'Ce documente am nevoie pentru pensionare?',
        a: 'Cerere pensionare, CI, carnet muncă, adeverințe vechime, adeverințe sporuri, certificat medical (invaliditate), diploma studii, livret militar, certificate naștere copii (femei), extras cont bancar.'
    },
    {
        q: 'Când și cum se face recalcularea?',
        a: 'Din oficiu, conform OUG 163/2020. Se iau toate veniturile brute. Dacă recalcularea dă mai puțin, rămâi cu pensia mai mare. Nu trebuie să depui cerere.'
    },
    {
        q: 'Ce e pensia de urmaș?',
        a: '1 urmaș: 50% din pensia defunctului. 2 urmași: 75%. 3+: 100%. Soțul supraviețuitor: dacă are 65 ani sau invaliditate. Copil: până la 16 ani (sau 26 dacă studiază).'
    },
    {
        q: 'Am lucrat în străinătate — contează?',
        a: 'DA, dacă ai lucrat în UE. Se cumulează perioadele de asigurare conform Reg. 883/2004. Depui cerere la Casa de Pensii din România cu formularul E205/P1.'
    },
    {
        q: 'Ce e valoarea punctului de pensie?',
        a: '2.032 RON (din ianuarie 2025). Se actualizează anual prin lege. Punctul tău mediu anual × această valoare = pensia ta lunară.'
    },
    {
        q: 'Pot contesta decizia de pensie?',
        a: 'DA. Termen: 45 zile de la primirea deciziei. Unde: Tribunalul în a cărui rază teritorială domiciliezi. Ai dreptul la avocat și la expertiză contabilă.'
    },
    {
        q: 'Ce fac dacă pensia e prea mică?',
        a: 'Verifică dacă ai indemnizația socială minimă (1.281 RON/2025). Dacă ai e sub, Casa de Pensii plătește diferența. Poți cere recalculare dacă ai adeverințe de sporuri neconsiderate.'
    },
    {
        q: 'Ce e Pilonul II?',
        a: 'Fond privat obligatoriu de pensii. 3.75% din salariu se duce la un fond privat (NN, Vital, etc.). Banii sunt ai tăi, îi primești la pensionare ca sumă sau rată lunară. Se moștenesc.'
    },
    {
        q: 'Grupele de muncă mai contează?',
        a: 'DA! Grupa I: reducere 6-13 ani + bonus punctaj x1.5. Grupa II: reducere 2-8 ani + bonus x1.25. Trebuie adeverință de la angajator cu perioadele lucrate în grupe.'
    },
    {
        q: 'Transport gratuit cu pensia?',
        a: '6 călătorii CFR gratuite/an (cls. II) — pensionari peste 60 (femei) / 65 (bărbați). Transport urban gratuit — depinde de hotărârea consiliului local. Legitimație de la Casa de Pensii.'
    }
];

// ═══ MODIFICĂRI RECENTE ═══
const RECENT_CHANGES_RO = {
    last_updated: '2025-02-01',
    changes: [
        {
            date: '2025-01-01',
            title: 'Creștere valoare punct pensie',
            description: 'Valoarea punctului de pensie a crescut la 2.032 RON (de la 1.785 RON).',
            impact: 'Pensii mai mari pentru toți pensionarii.'
        },
        {
            date: '2025-01-01',
            title: 'Indemnizație socială minimă majorată',
            description: 'Indemnizația socială minimă a crescut la 1.281 RON.',
            impact: 'Pensionarii cu pensii sub acest nivel primesc diferența.'
        },
        {
            date: '2024-09-01',
            title: 'Recalculare pensii — etapa finală',
            description: 'Ultimul val de recalculări conform OUG 163/2020.',
            impact: 'Peste 4 milioane de decizii emise. Pensia rămâne cea mai mare.'
        },
        {
            date: '2024-01-01',
            title: 'Impozitare pensii — prag modificat',
            description: 'Pragul de impozitare a fost menținut la 2.000 RON.',
            impact: 'Pensii sub 2.000 RON: impozit 0%. Peste: 10% pe diferență.'
        }
    ]
};

// ═══ INSTITUȚII ═══
const INSTITUTIONS_RO = {
    cnpp: {
        name: 'Casa Națională de Pensii Publice (CNPP)',
        role: 'Autoritatea centrală pentru pensii',
        website: 'https://www.cnpp.ro',
        phone: '021-316.24.26',
        email: 'relatii.publice@cnpp.ro',
        services: ['Emitere decizii pensie', 'Recalculare', 'Informare stagiu', 'Legitimații transport']
    },
    ctp: {
        name: 'Casele Teritoriale de Pensii (CTP)',
        role: 'Sucursale județene ale CNPP',
        website: 'https://www.cnpp.ro/case-teritoriale',
        note: 'Există câte una în fiecare județ. Aici depui dosarul de pensionare.'
    },
    anaf: {
        name: 'ANAF — Agenția Națională de Administrare Fiscală',
        role: 'Calculul și colectarea contribuțiilor sociale (CAS, CASS)',
        website: 'https://www.anaf.ro',
        relevance: 'Verificare contribuții plătite, declarații fiscale'
    },
    asf: {
        name: 'ASF — Autoritatea de Supraveghere Financiară',
        role: 'Supravegherea fondurilor de pensii private (Pilon II și III)',
        website: 'https://asfromania.ro',
        relevance: 'Verificare fond de pensii privat, reclamații'
    }
};

// ═══ FUNCȚII DE CĂUTARE ═══
function searchLegislation(country, keyword) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        const kw = (keyword || '').toLowerCase();
        const results = [];

        for (const [key, law] of Object.entries(ROMANIA_LAWS)) {
            const lawStr = JSON.stringify(law).toLowerCase();
            if (lawStr.includes(kw)) {
                results.push({ law_id: key, title: law.title, status: law.status });
            }
        }

        // Search FAQ
        const faqResults = ROMANIA_FAQ.filter(f =>
            f.q.toLowerCase().includes(kw) || f.a.toLowerCase().includes(kw)
        );

        return {
            country: 'Romania',
            keyword,
            laws_found: results,
            faq_matches: faqResults,
            total: results.length + faqResults.length
        };
    }
    return { country, error: 'not_available', note: `Legislation database for ${country} is not available. Currently supported: Romania (RO).` };
}

function getLaw(country, lawId) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        const law = ROMANIA_LAWS[lawId];
        if (law) return { country: 'Romania', ...law };

        // Try to find by keyword
        const kw = (lawId || '').toLowerCase();
        for (const [key, l] of Object.entries(ROMANIA_LAWS)) {
            if (l.title.toLowerCase().includes(kw)) {
                return { country: 'Romania', law_id: key, ...l };
            }
        }
        return { error: `Law not found: ${lawId}`, available: Object.keys(ROMANIA_LAWS) };
    }
    return { country, error: 'not_available', note: `Law database for ${country} not available. Currently supported: Romania (RO).` };
}

function getPensionRights(country, category) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        if (category && ROMANIA_RIGHTS[category]) {
            return { country: 'Romania', ...ROMANIA_RIGHTS[category] };
        }
        return { country: 'Romania', categories: ROMANIA_RIGHTS };
    }
    return { country, error: 'not_available', note: `Rights database for ${country} not available. Currently supported: Romania (RO).` };
}

function getFAQ(country) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        return { country: 'Romania', faq: ROMANIA_FAQ, total: ROMANIA_FAQ.length };
    }
    return { country, error: 'not_available', note: `FAQ for ${country} not available. Currently supported: Romania (RO).` };
}

function getRecentChanges(country) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        return { country: 'Romania', ...RECENT_CHANGES_RO };
    }
    return { country, error: 'not_available', note: `Changes database for ${country} not available. Currently supported: Romania (RO).` };
}

function getInstitutions(country) {
    if (country.toLowerCase() === 'romania' || country.toLowerCase() === 'ro') {
        return { country: 'Romania', institutions: INSTITUTIONS_RO };
    }
    return { country, error: 'not_available', note: `Institutions database for ${country} not available. Currently supported: Romania (RO).` };
}
