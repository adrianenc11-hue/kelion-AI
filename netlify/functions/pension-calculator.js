// ═══ PENSION CALCULATOR — Calcul pensie per țară ═══
// Suportă: România (Legea 127/2019), UK (State Pension), US (Social Security), DE, FR, ES, IT

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { action, country } = body;

        switch (action) {
            case 'calculate':
                return respond(200, calculatePension(body));
            case 'check_rights':
                return respond(200, checkPensionRights(body));
            case 'documents_needed':
                return respond(200, getRequiredDocuments(body));
            case 'recalculate':
                return respond(200, recalculatePension(body));
            case 'info':
                return respond(200, getPensionInfo(country || 'Romania'));
            case 'retirement_age':
                return respond(200, getRetirementAge(body));
            case 'survivor_pension':
                return respond(200, calculateSurvivorPension(body));
            default:
                return respond(400, {
                    error: 'Action required: calculate, check_rights, documents_needed, recalculate, info, retirement_age, survivor_pension'
                });
        }

    } catch (err) {
        console.error('Pension calculator error:', err);
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

// ═══ CALCULUL PENSIEI ═══
function calculatePension(params) {
    const { country } = params;

    switch ((country || 'Romania').toLowerCase()) {
        case 'romania':
        case 'ro':
            return calculatePensionRO(params);
        case 'uk':
        case 'united kingdom':
            return calculatePensionUK(params);
        case 'us':
        case 'usa':
        case 'united states':
            return calculatePensionUS(params);
        case 'germany':
        case 'de':
        case 'deutschland':
            return calculatePensionDE(params);
        case 'france':
        case 'fr':
            return calculatePensionFR(params);
        case 'spain':
        case 'es':
            return calculatePensionES(params);
        case 'italy':
        case 'it':
            return calculatePensionIT(params);
        default:
            return { error: `Country not yet supported: ${country}. Supported: Romania, UK, US, Germany, France, Spain, Italy` };
    }
}

// ═══ ROMÂNIA — Legea 127/2019 ═══
function calculatePensionRO(params) {
    const {
        years_worked = 25,
        salary_average = 3500,
        work_group = 3,
        gender = 'M',
        birth_year = 1965
    } = params;

    // Punctaj pensie = suma punctajelor anuale / stagiu complet
    // Punctaj anual = salariu brut lunar / salariu mediu brut pe economie
    // Valoare punct pensie 2024/2025: ~2.032 RON (se actualizează anual)

    const PUNCT_PENSIE_VALOARE = 2032; // RON, valoare 2025
    const SALARIU_MEDIU_BRUT = 7567; // RON, media 2024

    // Stagiu minim de cotizare
    // Stagiu minim: 15 ani (identic M/F)
    const STAGIU_COMPLET = gender === 'F' ? 30 : 35;

    // Bonus grupe de muncă
    let grupaBonus = 1.0;
    let reducereVarsta = 0;
    switch (work_group) {
        case 1:
            grupaBonus = 1.5;
            reducereVarsta = Math.min(years_worked * 0.5, 13);
            break;
        case 2:
            grupaBonus = 1.25;
            reducereVarsta = Math.min(years_worked * 0.25, 8);
            break;
        case 3:
        default:
            grupaBonus = 1.0;
            reducereVarsta = 0;
    }

    // Calcul punctaj
    const punctajAnual = salary_average / SALARIU_MEDIU_BRUT;
    const punctajTotal = punctajAnual * years_worked * grupaBonus;
    const punctajMediu = punctajTotal / STAGIU_COMPLET;

    // Pensie lunară
    const pensieLunara = Math.round(punctajMediu * PUNCT_PENSIE_VALOARE);

    // Vârsta standard de pensionare
    const varstaStandard = gender === 'F' ? 63 : 65;
    const varstaPensionare = varstaStandard - reducereVarsta;
    const anPensionare = birth_year + varstaPensionare;

    return {
        country: 'Romania',
        legislation: 'Legea 127/2019 — Sistemul public de pensii',
        last_update: '2025-01-01',
        calculation: {
            punctaj_anual: Math.round(punctajAnual * 1000) / 1000,
            punctaj_total: Math.round(punctajTotal * 100) / 100,
            punctaj_mediu_anual: Math.round(punctajMediu * 1000) / 1000,
            valoare_punct_pensie: PUNCT_PENSIE_VALOARE,
            salariu_mediu_referinta: SALARIU_MEDIU_BRUT,
            grupa_munca: work_group,
            bonus_grupa: `x${grupaBonus}`,
            stagiu_cotizare: years_worked,
            stagiu_complet: STAGIU_COMPLET,
        },
        result: {
            pensie_lunara_estimata: pensieLunara,
            moneda: 'RON',
            varsta_pensionare: varstaPensionare,
            an_pensionare: anPensionare,
            reducere_varsta_grupa: reducereVarsta
        },
        disclaimer: '⚠️ Calculul este ESTIMATIV. Valorile reale depind de contribuțiile efective, stagiul validat și deciziile CNPP. Consultați Casa de Pensii pentru calcul oficial.',
        institution: 'Casa Națională de Pensii Publice (CNPP)',
        website: 'https://www.cnpp.ro'
    };
}

// ═══ UK — State Pension ═══
function calculatePensionUK(params) {
    const {
        years_ni = 35 // National Insurance qualifying years
    } = params;

    // New State Pension (post April 2016)
    const FULL_STATE_PENSION_WEEKLY = 221.20; // £/week for 2024/25
    const MIN_YEARS = 10;
    const FULL_YEARS = 35;

    if (years_ni < MIN_YEARS) {
        return {
            country: 'UK',
            error: `Minimum ${MIN_YEARS} qualifying years needed. You have ${years_ni}.`,
            advice: 'Consider making voluntary National Insurance contributions to reach minimum.'
        };
    }

    const qualifyingYears = Math.min(years_ni, FULL_YEARS);
    const weeklyPension = (qualifyingYears / FULL_YEARS) * FULL_STATE_PENSION_WEEKLY;
    const monthlyPension = weeklyPension * 52 / 12;
    const annualPension = weeklyPension * 52;

    return {
        country: 'United Kingdom',
        legislation: 'State Pension Act 2014 — New State Pension',
        last_update: '2024-04-06',
        calculation: {
            qualifying_years: qualifyingYears,
            full_pension_years: FULL_YEARS,
            percentage: Math.round((qualifyingYears / FULL_YEARS) * 100)
        },
        result: {
            pension_weekly: Math.round(weeklyPension * 100) / 100,
            pension_monthly: Math.round(monthlyPension * 100) / 100,
            pension_annual: Math.round(annualPension * 100) / 100,
            currency: 'GBP',
            state_pension_age: 66, // Rising to 67 by 2028, 68 by 2046
        },
        additional_benefits: [
            'Pension Credit (if income below threshold)',
            'Winter Fuel Payment (£100-300/year)',
            'Free bus pass',
            'Free TV licence (75+, Pension Credit)',
            'Cold Weather Payment (£25/week in cold spells)'
        ],
        disclaimer: '⚠️ Estimate only. Check your actual NI record at gov.uk/check-state-pension',
        institution: 'Department for Work and Pensions (DWP)',
        website: 'https://www.gov.uk/state-pension'
    };
}

// ═══ USA — Social Security ═══
function calculatePensionUS(params) {
    const {
        years_worked = 35,
        average_monthly_earnings = 5000, // AIME
        early_retirement = false
    } = params;

    // Social Security benefit calculation (simplified PIA formula 2024)
    const AIME = average_monthly_earnings;

    // PIA bend points (2024)
    const BEND1 = 1174;
    const BEND2 = 7078;

    let PIA = 0;
    if (AIME <= BEND1) {
        PIA = AIME * 0.90;
    } else if (AIME <= BEND2) {
        PIA = BEND1 * 0.90 + (AIME - BEND1) * 0.32;
    } else {
        PIA = BEND1 * 0.90 + (BEND2 - BEND1) * 0.32 + (AIME - BEND2) * 0.15;
    }

    // Full Retirement Age for birth year 1960+
    const FRA = 67;
    const earlyAge = 62;

    // Early retirement reduction: 5/9% per month for first 36 months, 5/12% after
    let monthlyBenefit = PIA;
    if (early_retirement) {
        const monthsEarly = (FRA - earlyAge) * 12; // 60 months
        const reduction36 = Math.min(monthsEarly, 36) * (5 / 900);
        const reductionExtra = Math.max(0, monthsEarly - 36) * (5 / 1200);
        monthlyBenefit = PIA * (1 - reduction36 - reductionExtra);
    }

    return {
        country: 'United States',
        legislation: 'Social Security Act — Title II (OASI)',
        last_update: '2024-01-01',
        calculation: {
            AIME: AIME,
            PIA: Math.round(PIA * 100) / 100,
            bend_point_1: BEND1,
            bend_point_2: BEND2,
            work_credits: Math.min(years_worked * 4, 40) + '/40 credits'
        },
        result: {
            monthly_benefit: Math.round(monthlyBenefit),
            annual_benefit: Math.round(monthlyBenefit * 12),
            currency: 'USD',
            full_retirement_age: FRA,
            early_retirement_age: earlyAge,
            early_retirement_applied: early_retirement,
            reduction_if_early: early_retirement ? `${Math.round((1 - monthlyBenefit / PIA) * 100)}%` : 'N/A'
        },
        additional_benefits: [
            'Medicare (at 65)',
            'Supplemental Security Income (SSI) if low income',
            'Spousal benefits (up to 50% of spouse PIA)',
            'Survivor benefits'
        ],
        disclaimer: '⚠️ Estimate only. Create my Social Security account at ssa.gov for personalized estimate.',
        institution: 'Social Security Administration (SSA)',
        website: 'https://www.ssa.gov'
    };
}

// ═══ GERMANIA — Deutsche Rentenversicherung ═══
function calculatePensionDE(params) {
    const {
        years_worked = 35,
        entgeltpunkte = 1.0, // Earning points per year (1.0 = average earner)
        birth_year = 1964
    } = params;

    // Rentenwert (pension point value) 2024: €39.32 (West), €39.32 (East - unified)
    const RENTENWERT = 39.32;
    const ZUGANGSFAKTOR = 1.0; // No reduction at regular retirement age
    const RENTENART_FAKTOR = 1.0; // Old-age pension

    const totalPoints = entgeltpunkte * years_worked;
    const monthlyPension = totalPoints * ZUGANGSFAKTOR * RENTENART_FAKTOR * RENTENWERT;

    return {
        country: 'Germany',
        legislation: 'Sozialgesetzbuch VI (SGB VI) — Gesetzliche Rentenversicherung',
        last_update: '2024-07-01',
        calculation: {
            entgeltpunkte_per_year: entgeltpunkte,
            total_entgeltpunkte: Math.round(totalPoints * 100) / 100,
            rentenwert: RENTENWERT,
            zugangsfaktor: ZUGANGSFAKTOR,
            formula: 'EP × ZF × RAF × aRW'
        },
        result: {
            monthly_pension: Math.round(monthlyPension * 100) / 100,
            annual_pension: Math.round(monthlyPension * 12 * 100) / 100,
            currency: 'EUR',
            regular_retirement_age: birth_year >= 1964 ? 67 : 65 + Math.max(0, (birth_year - 1947) * 2 / 12),
        },
        additional_options: [
            'Riester-Rente (state-subsidized private pension)',
            'Rürup-Rente (Basisrente)',
            'Betriebliche Altersversorgung (company pension)',
            'Grundrente (basic pension supplement for low earners, 33+ years)'
        ],
        disclaimer: '⚠️ Schätzung. Für eine genaue Berechnung kontaktieren Sie die Deutsche Rentenversicherung.',
        institution: 'Deutsche Rentenversicherung',
        website: 'https://www.deutsche-rentenversicherung.de'
    };
}

// ═══ FRANȚA — CNAV ═══
function calculatePensionFR(params) {
    const {
        salary_average_25best = 3000, // salaire annuel moyen des 25 meilleures années
        trimestres = 168, // quarters worked
        birth_year = 1965
    } = params;

    const TRIMESTRES_REQUIS = birth_year >= 1973 ? 172 : 168;
    const TAUX_PLEIN = 0.50; // Maximum rate

    const taux = trimestres >= TRIMESTRES_REQUIS ? TAUX_PLEIN :
        TAUX_PLEIN - ((TRIMESTRES_REQUIS - trimestres) * 0.00625);

    const pensionMensuelle = (salary_average_25best * taux * Math.min(trimestres, TRIMESTRES_REQUIS)) / TRIMESTRES_REQUIS / 12;

    return {
        country: 'France',
        legislation: 'Code de la sécurité sociale — Régime général',
        last_update: '2024-01-01',
        calculation: {
            salaire_annuel_moyen: salary_average_25best,
            trimestres_valides: trimestres,
            trimestres_requis: TRIMESTRES_REQUIS,
            taux: Math.round(taux * 10000) / 100 + '%'
        },
        result: {
            pension_mensuelle: Math.round(pensionMensuelle),
            pension_annuelle: Math.round(pensionMensuelle * 12),
            currency: 'EUR',
            age_legal: birth_year >= 1968 ? 64 : 62,
        },
        disclaimer: '⚠️ Estimation. Consultez votre relevé de carrière sur lassuranceretraite.fr',
        institution: 'CNAV (Caisse Nationale d\'Assurance Vieillesse)',
        website: 'https://www.lassuranceretraite.fr'
    };
}

// ═══ SPANIA — Seguridad Social ═══
function calculatePensionES(params) {
    const {
        years_contributed = 36,
        base_reguladora = 2500,
        birth_year = 1960
    } = params;

    // Percentage based on years contributed
    let percentage;
    if (years_contributed < 15) {
        return { country: 'Spain', error: 'Minimum 15 years of contributions required.' };
    } else if (years_contributed <= 15) {
        percentage = 50;
    } else {
        percentage = 50 + Math.min((years_contributed - 15) * 1.9, 50);
    }

    const pensionMensual = base_reguladora * (percentage / 100);

    return {
        country: 'Spain',
        legislation: 'Ley General de la Seguridad Social',
        last_update: '2024-01-01',
        result: {
            pension_mensual: Math.round(pensionMensual),
            currency: 'EUR',
            porcentaje_aplicado: percentage + '%',
            edad_jubilacion: years_contributed >= 38.5 ? 65 : 66 + (birth_year >= 1964 ? 1 : 0),
        },
        institution: 'INSS (Instituto Nacional de la Seguridad Social)',
        website: 'https://www.seg-social.es'
    };
}

// ═══ ITALIA — INPS ═══
function calculatePensionIT(params) {
    const {
        years_contributed = 35,
        average_salary = 2500
    } = params;

    // Simplified retributivo/contributivo mix
    const coefficient = 0.02 * Math.min(years_contributed, 40); // max 80%
    const pensioneMensile = average_salary * coefficient;

    return {
        country: 'Italy',
        legislation: 'INPS — Sistema pensionistico italiano',
        last_update: '2024-01-01',
        result: {
            pensione_mensile: Math.round(pensioneMensile),
            currency: 'EUR',
            coefficiente: Math.round(coefficient * 100) + '%',
            eta_pensionamento: 67, // Pensione di vecchiaia
        },
        opzioni: [
            'Pensione anticipata (42 anni e 10 mesi uomini, 41 anni e 10 mesi donne)',
            'Quota 103 (62 anni + 41 anni contributi, fino al 2025)',
            'Opzione donna (58-59 anni + 35 anni contributi)',
            'APE Sociale (63 anni, categorie specifiche)'
        ],
        institution: 'INPS (Istituto Nazionale della Previdenza Sociale)',
        website: 'https://www.inps.it'
    };
}

// ═══ VERIFICARE DREPTURI ═══
function checkPensionRights(params) {
    const { country, years_worked, age, gender, work_group } = params;
    const c = (country || 'Romania').toLowerCase();

    const rights = [];

    if (c === 'romania' || c === 'ro') {
        const varstaStandard = gender === 'F' ? 63 : 65;
        const stagiuMinim = 15;
        const stagiuComplet = gender === 'F' ? 30 : 35;

        if (years_worked >= stagiuMinim) rights.push('✅ Stagiu minim de cotizare atins (15 ani)');
        else rights.push(`❌ Stagiu minim neîndeplinit: ${years_worked}/${stagiuMinim} ani`);

        if (years_worked >= stagiuComplet) rights.push(`✅ Stagiu complet de cotizare atins (${stagiuComplet} ani)`);
        else rights.push(`⚠️ Stagiu incomplet: ${years_worked}/${stagiuComplet} ani — pensie proporțională`);

        if (age >= varstaStandard) rights.push(`✅ Vârstă standard de pensionare atinsă (${varstaStandard})`);
        else rights.push(`⏳ Mai sunt ${varstaStandard - age} ani până la vârsta standard (${varstaStandard})`);

        if (work_group === 1 || work_group === 2) {
            rights.push(`🔧 Grupa ${work_group} de muncă — drept la reducere vârstă pensionare`);
        }

        rights.push('📋 Drept la recalculare (dacă nu s-a făcut cu noua lege)');
        rights.push('🚌 Bilet transport gratuit (după pensionare)');
        rights.push('💊 Medicamente compensate/gratuite');
    }

    return {
        country: country || 'Romania',
        rights,
        disclaimer: '⚠️ Verificare orientativă. Consultați Casa de Pensii pentru evaluare oficială.'
    };
}

// ═══ DOCUMENTE NECESARE ═══
function getRequiredDocuments(params) {
    const c = (params.country || 'Romania').toLowerCase();

    if (c === 'romania' || c === 'ro') {
        return {
            country: 'Romania',
            documents: [
                '📄 Cerere de pensionare (formular tipizat CNPP)',
                '🆔 Carte de identitate (copie + original)',
                '📋 Carnet de muncă (original)',
                '📑 Adeverințe de vechime (de la fiecare angajator)',
                '📊 Adeverințe de sporuri (pentru recalculare)',
                '🏥 Certificat medical (dacă este cazul — invaliditate)',
                '🎓 Diploma de studii (pentru stagiu asimilat)',
                '⚔️ Livret militar (pentru stagiu asimilat)',
                '👶 Certificate naștere copii (pentru femei — stagiu asimilat)',
                '💍 Certificat căsătorie (dacă s-a schimbat numele)',
                '🏦 Extras cont bancar (pentru virament pensie)',
                '📝 Declarație pe propria răspundere (perioadele fără acte)'
            ],
            where_to_submit: 'Casa Teritorială de Pensii din județul de domiciliu',
            deadline: 'Se depune cu cel puțin 30 de zile înainte de data pensionării',
            website: 'https://www.cnpp.ro'
        };
    }

    return {
        country: params.country,
        note: 'Document list for this country will be added. Contact local pension authority.',
    };
}

// ═══ VÂRSTA DE PENSIONARE ═══
function getRetirementAge(params) {
    const { country, gender, birth_year, work_group } = params;
    const c = (country || 'Romania').toLowerCase();

    const ages = {
        'romania': { M: 65, F: 63 },
        'ro': { M: 65, F: 63 },
        'uk': { M: 66, F: 66 },
        'us': { M: 67, F: 67 },
        'usa': { M: 67, F: 67 },
        'germany': { M: 67, F: 67 },
        'de': { M: 67, F: 67 },
        'france': { M: 64, F: 64 },
        'fr': { M: 64, F: 64 },
        'spain': { M: 66, F: 66 },
        'es': { M: 66, F: 66 },
        'italy': { M: 67, F: 67 },
        'it': { M: 67, F: 67 },
    };

    const countryAges = ages[c] || { M: 65, F: 65 };
    const g = (gender || 'M').toUpperCase();
    const standardAge = countryAges[g] || 65;

    return {
        country: country || 'Romania',
        gender: g,
        standard_retirement_age: standardAge,
        birth_year: birth_year,
        estimated_retirement_year: birth_year ? birth_year + standardAge : null,
        note: work_group && work_group < 3 ?
            `Grupa ${work_group} de muncă permite pensionare anticipată` :
            'Fără reducere de vârstă'
    };
}

// ═══ PENSIE DE URMAȘ ═══
function calculateSurvivorPension(params) {
    const { country, deceased_pension, num_survivors, survivor_type } = params;
    const c = (country || 'Romania').toLowerCase();

    if (c === 'romania' || c === 'ro') {
        let percentage;
        switch (num_survivors || 1) {
            case 1: percentage = 50; break;
            case 2: percentage = 75; break;
            default: percentage = 100; break;
        }

        const pension = Math.round((deceased_pension || 2000) * percentage / 100);

        return {
            country: 'Romania',
            legislation: 'Legea 127/2019, art. 86-91',
            survivor_type: survivor_type || 'soț/soție supraviețuitor',
            deceased_pension: deceased_pension || 2000,
            percentage_applied: percentage + '%',
            survivor_pension: pension,
            currency: 'RON',
            conditions: [
                'Soțul supraviețuitor: vârsta de 65 ani SAU invaliditate',
                'Copil: până la 16 ani (sau 26 dacă urmează studii)',
                'Termenul de depunere: 30 zile de la deces'
            ],
            disclaimer: '⚠️ Consultați CNPP pentru evaluare individuală.'
        };
    }

    return { country: country, note: 'Survivor pension calculation varies by country.' };
}

// ═══ INFORMAȚII GENERALE ═══
function getPensionInfo(country) {
    const info = {
        'Romania': {
            system: 'Sistem public de pensii — pilon I (obligatoriu) + pilon II (privat obligatoriu) + pilon III (facultativ)',
            authority: 'Casa Națională de Pensii Publice (CNPP)',
            website: 'https://www.cnpp.ro',
            phone: '021-316.24.26',
            key_laws: [
                'Legea 127/2019 — Sistemul public de pensii',
                'Legea 263/2010 (anterior)',
                'OUG 163/2020 — Recalculare',
                'Legea 223/2015 — Pensii militare',
                'Legea 411/2004 — Fonduri de pensii private (pilon II)'
            ],
            pension_types: [
                'Pensie pentru limită de vârstă',
                'Pensie anticipată',
                'Pensie anticipată parțială',
                'Pensie de invaliditate (grad I, II, III)',
                'Pensie de urmaș'
            ],
            valoare_punct_pensie: '2.032 RON (2025)',
            salariu_mediu: '7.567 RON brut (2024)'
        },
    };

    return info[country] || { country, note: 'Info will be expanded. Check local pension authority.' };
}

// ═══ RECALCULARE PENSIE ═══
function recalculatePension(params) {
    const { country, current_pension, new_documents, additional_years, additional_salary_average } = params;
    const c = (country || 'Romania').toLowerCase();

    if (c === 'romania' || c === 'ro') {
        const PUNCT_PENSIE_VALOARE = 2032;
        const SALARIU_MEDIU_BRUT = 7567;

        // Calculate additional points from new documents
        let additionalPoints = 0;
        if (additional_years && additional_salary_average) {
            const punctajAnualNou = additional_salary_average / SALARIU_MEDIU_BRUT;
            additionalPoints = punctajAnualNou * additional_years;
        }

        const differenceRON = Math.round(additionalPoints * PUNCT_PENSIE_VALOARE / 35);
        const newPension = (current_pension || 0) + differenceRON;

        return {
            country: 'Romania',
            action: 'recalculare',
            current_pension: current_pension || 0,
            additional_points: Math.round(additionalPoints * 1000) / 1000,
            difference: differenceRON,
            new_pension_estimated: newPension,
            currency: 'RON',
            new_documents: new_documents || [],
            steps: [
                '1. Obține adeverințe noi de la angajatori (sporuri, vechime)',
                '2. Depune cerere de recalculare la Casa Teritorială de Pensii',
                '3. Anexează documentele noi (adeverințe sporuri, vechime, grupe muncă)',
                '4. Termen soluționare: 45 zile calendaristice',
                '5. Dacă nu ești de acord cu decizia → contestație la Tribunal (45 zile)'
            ],
            disclaimer: '⚠️ Calculul este ESTIMATIV. Recalcularea oficială se face de CNPP pe baza documentelor depuse.'
        };
    }

    return { country: country, note: 'Recalculation varies by country. Contact local pension authority.' };
}
