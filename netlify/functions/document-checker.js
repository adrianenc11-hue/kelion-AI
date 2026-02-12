// ═══ DOCUMENT CHECKER — Verificare documente pensionare ═══
// Verifică dacă dosarul de pensionare este complet

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const { action, country, pension_type, documents_have, age, gender, work_group } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'check_completeness':
                return respond(200, checkCompleteness(country || 'Romania', pension_type || 'limita_varsta', documents_have || []));
            case 'get_checklist':
                return respond(200, getChecklist(country || 'Romania', pension_type || 'limita_varsta', { age, gender, work_group }));
            case 'get_templates':
                return respond(200, getTemplates(country || 'Romania', pension_type || 'limita_varsta'));
            case 'timeline':
                return respond(200, getTimeline(country || 'Romania', pension_type || 'limita_varsta'));
            default:
                return respond(400, { error: 'Actions: check_completeness, get_checklist, get_templates, timeline' });
        }
    } catch (err) {
        console.error('Doc checker error:', err);
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

// ═══ CHECKLIST DOCUMENTE PER TIP PENSIE ═══

const CHECKLISTS = {
    Romania: {
        limita_varsta: {
            title: 'Dosarul de pensionare — Pensie limită de vârstă',
            obligatorii: [
                { id: 'cerere', name: 'Cerere de pensionare', details: 'Formular tip de la Casa de Pensii, completat și semnat' },
                { id: 'ci', name: 'Carte de identitate (CI)', details: 'Original + copie, în termen de valabilitate' },
                { id: 'carnet_munca', name: 'Carnet de muncă', details: 'Original. Dacă s-a pierdut: adeverință reconstituire de la ITM' },
                { id: 'adeverinte_vechime', name: 'Adeverințe de vechime', details: 'De la TOȚI angajatorii la care nu apare stagiul în carnetul de muncă. Includ: perioadă, funcție, salariu.' },
                { id: 'adeverinte_sporuri', name: 'Adeverințe sporuri salariale', details: 'De la angajatori: sporuri, bonusuri, prime, ore suplimentare — SE INDE CALCUL PUNCTAJ. Foarte importante!' },
                { id: 'certificat_nastere', name: 'Certificat de naștere', details: 'Original + copie' },
                { id: 'certificat_casatorie', name: 'Certificat de căsătorie', details: 'Dacă s-a schimbat numele. Original + copie' },
                { id: 'cont_bancar', name: 'Extras cont bancar / IBAN', details: 'Cont personal pe numele solicitantului. Pensia se plătește lunar aici.' },
                { id: 'declaratie_fiscala', name: 'Declarație pe propria răspundere', details: 'Că nu realizezi venituri care exclud cumul (pentru anticipată)' }
            ],
            optionale: [
                { id: 'diploma_studii', name: 'Diplome de studii', details: 'Facultate, masterat, doctorat — perioada studiilor poate conta ca stagiu' },
                { id: 'livret_militar', name: 'Livret militar', details: 'Satisfacerea stagiului militar = perioadă asimilată stagiului de cotizare' },
                { id: 'cert_nastere_copii', name: 'Certificate naștere copii', details: 'FEMEI: perioadă creștere copil = stagiu asimilat (până la 2 ani/copil)' },
                { id: 'hotarare_handicap', name: 'Hotărâre handicap', details: 'Dacă ai persoană cu handicap în îngrijire' },
                { id: 'adeverinta_grupe', name: 'Adeverință grupe de muncă', details: 'De la angajator: perioadele lucrate în grupa I sau II. REDUCE vârsta de pensionare!' },
                { id: 'certificat_revolutionar', name: 'Certificat revoluționar', details: 'Beneficii suplimentare, indemnizație revoluționari' },
                { id: 'decizie_pensie_anterioara', name: 'Decizie pensie anterioară', details: 'Dacă ai fost pensionat anterior (invaliditate, anticipată)' }
            ],
            unde_depui: 'Casa Teritorială de Pensii din județul de domiciliu',
            termen_solutionare: '45 zile calendaristice de la depunerea dosarului complet',
            tip_important: '⚠️ ADEVERINȚELE DE SPORURI sunt cele mai importante! Fiecare spor/bonus adaugă la punctaj. Cere de la TOȚI angajatorii, chiar dacă par nesemnificative.'
        },

        anticipata: {
            title: 'Dosarul de pensionare — Pensie anticipată',
            obligatorii: [
                { id: 'cerere', name: 'Cerere de pensionare anticipată', details: 'Formular tip specificând pensie anticipată' },
                { id: 'ci', name: 'Carte de identitate', details: 'Original + copie' },
                { id: 'carnet_munca', name: 'Carnet de muncă', details: 'Original' },
                { id: 'adeverinte_vechime', name: 'Adeverințe de vechime', details: 'De la toți angajatorii' },
                { id: 'adeverinte_sporuri', name: 'Adeverințe sporuri', details: 'Sporuri, bonusuri, prime' },
                { id: 'declaratie_venituri', name: 'Declarație pe propria răspundere', details: 'Că NU realizezi venituri din activități profesionale (nu poți cumula!)' },
                { id: 'cont_bancar', name: 'Extras cont bancar / IBAN', details: 'Cont personal' }
            ],
            conditii: [
                'Stagiul complet de cotizare realizat',
                'Cu cel mult 5 ani înainte de vârsta standard',
                'NU poți lucra pe perioada pensiei anticipate (se suspendă)',
                'Pensia se diminuează cu 0.75% per lună anticipată (anticipată parțială)'
            ]
        },

        invaliditate: {
            title: 'Dosarul de pensionare — Pensie de invaliditate',
            obligatorii: [
                { id: 'cerere', name: 'Cerere de pensionare de invaliditate', details: 'Formular tip' },
                { id: 'ci', name: 'Carte de identitate', details: 'Original + copie' },
                { id: 'decizie_medicala', name: 'Decizie medicală asupra capacității de muncă', details: 'Emisă de Comisia de Expertiză Medicală. Stabilește gradul de invaliditate (I, II, III)' },
                { id: 'referat_medical', name: 'Referat medical', details: 'De la medicul specialist + medicul de familie, cu diagnosticul complet' },
                { id: 'bilete_iesire', name: 'Bilete de ieșire din spital', details: 'Ultimele internări relevante' },
                { id: 'investigatii', name: 'Rezultate investigații', details: 'Analize, RMN, CT, ecografii — toate relevante' },
                { id: 'carnet_munca', name: 'Carnet de muncă', details: 'Original' },
                { id: 'cont_bancar', name: 'Extras cont bancar / IBAN', details: 'Cont personal' }
            ],
            grade_invaliditate: {
                'Grad I': 'Pierdere TOTALĂ a capacității de muncă + necesită însoțitor permanent. Pensie: indemnizație pentu însoțitor inclusă.',
                'Grad II': 'Pierdere TOTALĂ a capacității de muncă, dar NU necesită însoților. NU poate lucra.',
                'Grad III': 'Pierdere parțială (cel puțin 50%) a capacității de muncă. POATE lucra în condiții adaptate.'
            },
            revizie: 'Revizie medicală periodică: anual sau la 2-3 ani. Dacă starea e permanentă, se poate acorda fără termen de revizuire.'
        },

        urmas: {
            title: 'Dosarul de pensionare — Pensie de urmaș',
            obligatorii: [
                { id: 'cerere', name: 'Cerere de pensie de urmaș', details: 'Formular tip' },
                { id: 'ci_solicitant', name: 'CI solicitant (urmaș)', details: 'Original + copie' },
                { id: 'certificat_deces', name: 'Certificat de deces', details: 'Al persoanei decedate. Original + copie' },
                { id: 'certificat_casatorie', name: 'Certificat de căsătorie', details: 'Dacă solicitantul e soțul supraviețuitor' },
                { id: 'certificat_nastere_copii', name: 'Certificate naștere copii', details: 'Dacă solicitantul e copilul defunctului' },
                { id: 'decizie_pensie_defunct', name: 'Decizia de pensie a defunctului', details: 'Ultima decizie de pensie a celui decedat' },
                { id: 'adeverinta_studii', name: 'Adeverință de studii (copii)', details: 'Dacă copilul are 16-26 ani și studiază' },
                { id: 'cont_bancar', name: 'Extras cont bancar / IBAN', details: 'Al solicitantului' }
            ],
            cuantum: {
                '1 urmaș': '50% din pensia defunctului',
                '2 urmași': '75% din pensia defunctului',
                '3+ urmași': '100% din pensia defunctului'
            }
        }
    }
};

// ═══ ȘABLOANE CERERI ═══
const TEMPLATES = {
    Romania: {
        cerere_pensionare: {
            title: 'Model cerere pensionare limită de vârstă',
            content: `CERERE DE PENSIONARE

Către: Casa Teritorială de Pensii _______________

Subsemnatul/a ______________________________, CNP __________________,
domiciliat/ă în ______________________________, strada _______________,
nr. ___, bl. ___, sc. ___, et. ___, ap. ___,
telefon: ________________, email: ________________,

Vă rog a-mi aproba cererea de pensionare pentru LIMITĂ DE VÂRSTĂ,
începând cu data de ________________.

Declar pe propria răspundere că:
☐ Nu realizez venituri din activități profesionale
☐ Realizez venituri din activități profesionale (cumul permis)

Anexez următoarele documente:
☐ Carte de identitate (copie)
☐ Carnet de muncă (original)
☐ Adeverințe de vechime (nr. ____ bucăți)
☐ Adeverințe sporuri salariale (nr. ____ bucăți)
☐ Certificat de naștere (copie)
☐ Certificat de căsătorie (copie)
☐ Diplome de studii (copii)
☐ Livret militar (copie)
☐ Certificate naștere copii (copii)
☐ Adeverință grupe de muncă
☐ Extras cont bancar
☐ Alte documente: ________________________

Solicit plata pensiei prin:
☐ Mandat poștal la adresa de domiciliu
☐ Virament în contul bancar IBAN: ________________________
    deschis la Banca ________________________

Data: ________________    Semnătura: ________________`
        },
        contestatie: {
            title: 'Model contestație decizie de pensie',
            content: `CONTESTAȚIE

Către: Tribunalul _______________
Secția _______________

Subsemnatul/a ______________________________, CNP __________________,
domiciliat/ă în ______________________________,

CONTEST

Decizia de pensie nr. _____________ din data de _____________,
emisă de Casa Teritorială de Pensii _______________,

prin care mi s-a stabilit pensia lunară în cuantum de _____________ RON,
în baza unui punctaj mediu anual de _____________ puncte.

MOTIVE:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

SOLICIT:
1. Anularea deciziei contestate
2. Recalcularea pensiei cu luarea în considerare a:
   - _______________________________________________
   - _______________________________________________
3. Obligarea pârâtei la plata diferențelor cuvenite

PROBE: înscrisuri, expertiză contabilă judiciară

Anexez:
☐ Decizia de pensie contestată (copie)
☐ Dovada depunerii adeverințelor
☐ Adeverințe suplimentare
☐ Alte documente relevante

Termen legal: 45 zile de la comunicarea deciziei (art. 154, Legea 127/2019)

Data: ________________    Semnătura: ________________`
        },
        cerere_recalculare: {
            title: 'Model cerere recalculare pensie',
            content: `CERERE DE RECALCULARE A PENSIEI

Către: Casa Teritorială de Pensii _______________

Subsemnatul/a ______________________________, CNP __________________,
titular al deciziei de pensie nr. _____________ din _____________,

Vă rog să dispuneți RECALCULAREA pensiei mele, având în vedere că:
☐ Am obținut adeverințe noi de sporuri salariale
☐ Am adeverințe de vechime neconsiderate anterior
☐ Am perioadă de studii neluată în calcul
☐ Am stagiu militar nevalorificat
☐ Am perioadă creștere copil nevalorificată
☐ Alt motiv: _______________________________________________

Anexez documentele justificative (nr. ____ bucăți).

Solicit recalcularea și plata diferențelor restante, conform legii.

Data: ________________    Semnătura: ________________`
        }
    }
};

// ═══ TIMELINE PENSIONARE ═══
const TIMELINES = {
    Romania: {
        limita_varsta: {
            title: 'Calendar pensionare — pas cu pas',
            steps: [
                { step: 1, name: 'Cu 6 luni înainte de pensionare', actions: ['Verifică vârsta ta standard de pensionare', 'Calculează stagiul de cotizare acumulat', 'Identifică angajatorii lipsă din carnet'] },
                { step: 2, name: 'Cu 3-4 luni înainte', actions: ['Solicită adeverințe de la toți angajatorii (sporuri, vechime)', 'Solicită adeverință grupe de muncă (dacă e cazul)', 'Verifică dacă ai carnetul de muncă (dacă nu → ITM pentru reconstituire)'] },
                { step: 3, name: 'Cu 1-2 luni înainte', actions: ['Pregătește toate documentele (originale + copii)', 'Deschide cont bancar dacă nu ai', 'Completează cererea de pensionare (o poți lua de la CTP sau online)', 'Verifică lista de documente necesare'] },
                { step: 4, name: 'La data pensionării', actions: ['Depune dosarul la Casa Teritorială de Pensii', 'Primești număr de înregistrare', 'Păstrează copia cererii cu ștampilă'] },
                { step: 5, name: '45 zile după depunere', actions: ['Primești DECIZIA de pensie', 'Verifică punctajul și cuantumul', 'Dacă nu ești de acord → ai 45 zile să contești la Tribunal'] },
                { step: 6, name: 'În prima lună după decizie', actions: ['Pensia se plătește retroactiv de la data pensionării', 'Primești prima plată + restanțele', 'Verifică extrasul de cont'] },
                { step: 7, name: 'Anual', actions: ['Indexarea pensiei (automat, prin lege)', 'Verifică talonul de pensie', 'Cere recalculare dacă ai documente noi'] }
            ]
        }
    }
};

// ═══ FUNCȚII ═══

function checkCompleteness(country, pensionType, documentsHave) {
    const checklist = CHECKLISTS.Romania?.[pensionType];
    if (!checklist) return { error: `Tip pensie necunoscut: ${pensionType}. Disponibile: ${Object.keys(CHECKLISTS.Romania).join(', ')}` };

    const obligatorii = checklist.obligatorii.map(d => d.id);
    const prezente = documentsHave.filter(d => obligatorii.includes(d));
    const lipsa = obligatorii.filter(d => !documentsHave.includes(d));
    const completeness = Math.round((prezente.length / obligatorii.length) * 100);

    const lipsaDetails = checklist.obligatorii.filter(d => lipsa.includes(d.id));

    return {
        pension_type: pensionType,
        title: checklist.title,
        completeness: `${completeness}%`,
        total_obligatorii: obligatorii.length,
        prezente: prezente.length,
        lipsa: lipsaDetails,
        status: completeness === 100 ? '✅ DOSAR COMPLET — poți depune!' : `⚠️ DOSAR INCOMPLET — lipsesc ${lipsa.length} documente obligatorii`,
        tip: checklist.tip_important || null,
        unde_depui: checklist.unde_depui || null,
        termen: checklist.termen_solutionare || null
    };
}

function getChecklist(country, pensionType, params) {
    const checklist = CHECKLISTS.Romania?.[pensionType];
    if (!checklist) return { error: `Tip: ${pensionType}. Disponibile: ${Object.keys(CHECKLISTS.Romania).join(', ')}` };

    const result = { ...checklist };

    // Extra info based on params
    if (params.gender === 'F') {
        result.nota_femei = 'Ca femeie, ai dreptul la perioadă asimilată pentru creștere copil (max 2 ani/copil). Aduce certificatele de naștere ale copiilor!';
    }
    if (params.work_group === 1 || params.work_group === 2) {
        result.nota_grupe = `Ai lucrat în grupa ${params.work_group}. Adeverința de grupe de muncă este ESENȚIALĂ — reduce vârsta de pensionare și crește punctajul!`;
    }

    return result;
}

function getTemplates(country, pensionType) {
    return {
        country: 'Romania',
        templates: TEMPLATES.Romania,
        note: 'Aceste modele sunt orientative. Formularul oficial se ridică de la Casa Teritorială de Pensii sau se descarcă de pe cnpp.ro.'
    };
}

function getTimeline(country, pensionType) {
    const timeline = TIMELINES.Romania?.[pensionType] || TIMELINES.Romania?.limita_varsta;
    return { country: 'Romania', ...timeline };
}
