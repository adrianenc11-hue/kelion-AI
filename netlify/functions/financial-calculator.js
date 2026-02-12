// ═══ FINANCIAL CALCULATOR — Calcule financiare profesionale ═══
// ROI, dobânzi, amortizare, cash flow, rate credit, TVA, salariu net

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        const calculators = {
            'roi': calcROI,
            'dobanda_simpla': calcDobandasimpla,
            'dobanda_compusa': calcDobandaCompusa,
            'credit_rate': calcCreditRate,
            'amortizare': calcAmortizare,
            'salariu_net': calcSalariuNet,
            'tva': calcTVA,
            'cash_flow': calcCashFlow,
            'break_even': calcBreakEven,
            'inflatie': calcInflatie,
            'conversie_valutara': calcConversie,
            'profit_margin': calcProfitMargin,
            'depreciere': calcDepreciere
        };

        const calc = calculators[action];
        if (!calc) return respond(400, { error: `Actions: ${Object.keys(calculators).join(', ')}` });
        return respond(200, calc(body));
    } catch (err) {
        console.error('Financial calc error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

function r2(n) { return Math.round(n * 100) / 100; }

// ═══ ROI ═══
function calcROI({ investitie, castig }) {
    const profit = castig - investitie;
    const roi = (profit / investitie) * 100;
    return {
        calculator: 'ROI (Return on Investment)',
        investitie, castig, profit: r2(profit),
        roi: `${r2(roi)}%`,
        interpretare: roi > 0 ? `✅ Investiție profitabilă — câștigi ${r2(roi)}% pe fiecare RON investit` : `❌ Investiție neprofitabilă — pierzi ${r2(Math.abs(roi))}%`
    };
}

// ═══ DOBÂNDĂ SIMPLĂ ═══
function calcDobandasimpla({ principal, rata_anuala, ani }) {
    const dobanda = principal * (rata_anuala / 100) * ani;
    return {
        calculator: 'Dobândă simplă',
        principal, rata_anuala: `${rata_anuala}%`, ani,
        dobanda: r2(dobanda),
        total: r2(principal + dobanda),
        formula: `D = P × r × t = ${principal} × ${rata_anuala / 100} × ${ani} = ${r2(dobanda)}`
    };
}

// ═══ DOBÂNDĂ COMPUSĂ ═══
function calcDobandaCompusa({ principal, rata_anuala, ani, compuneri_pe_an = 12 }) {
    const total = principal * Math.pow(1 + (rata_anuala / 100) / compuneri_pe_an, compuneri_pe_an * ani);
    const dobanda = total - principal;
    return {
        calculator: 'Dobândă compusă',
        principal, rata_anuala: `${rata_anuala}%`, ani, compuneri_pe_an,
        dobanda: r2(dobanda), total: r2(total),
        multiplicator: `x${r2(total / principal)}`
    };
}

// ═══ RATE CREDIT ═══
function calcCreditRate({ suma, rata_anuala, ani, tip = 'anuitate' }) {
    const luni = ani * 12;
    const r = (rata_anuala / 100) / 12;

    if (tip === 'anuitate') {
        const rata_lunara = suma * r * Math.pow(1 + r, luni) / (Math.pow(1 + r, luni) - 1);
        const total = rata_lunara * luni;
        const primele_6 = [];
        let sold = suma;
        for (let i = 1; i <= Math.min(6, luni); i++) {
            const dob = sold * r;
            const principal_luna = rata_lunara - dob;
            sold -= principal_luna;
            primele_6.push({ luna: i, rata: r2(rata_lunara), dobanda: r2(dob), principal: r2(principal_luna), sold_ramas: r2(Math.max(0, sold)) });
        }
        return {
            calculator: 'Rate credit — Anuitățe (rate egale)',
            suma_imprumutata: suma, dobanda_anuala: `${rata_anuala}%`, durata: `${ani} ani (${luni} luni)`,
            rata_lunara: r2(rata_lunara), total_rambursat: r2(total), cost_credit: r2(total - suma),
            dae_estimat: `~${r2(rata_anuala + 1)}%`,
            primele_6_rate: primele_6
        };
    } else {
        // Rate descrescătoare
        const principal_lunar = suma / luni;
        const prima_rata = principal_lunar + suma * r;
        const ultima_rata = principal_lunar + principal_lunar * r;
        let total = 0;
        for (let i = 0; i < luni; i++) {
            total += principal_lunar + (suma - principal_lunar * i) * r;
        }
        return {
            calculator: 'Rate credit — Descrescătoare',
            suma_imprumutata: suma, dobanda_anuala: `${rata_anuala}%`, durata: `${ani} ani`,
            prima_rata: r2(prima_rata), ultima_rata: r2(ultima_rata),
            total_rambursat: r2(total), cost_credit: r2(total - suma)
        };
    }
}

// ═══ AMORTIZARE ═══
function calcAmortizare({ valoare, ani, metoda = 'liniara', valoare_reziduala = 0 }) {
    const baza = valoare - valoare_reziduala;
    if (metoda === 'liniara') {
        const anual = baza / ani;
        const tabel = [];
        for (let i = 1; i <= ani; i++) {
            tabel.push({ an: i, amortizare: r2(anual), valoare_neta: r2(valoare - anual * i) });
        }
        return { calculator: 'Amortizare liniară', valoare, ani, amortizare_anuala: r2(anual), tabel };
    } else {
        // Degresivă
        const rata = 1 / ani;
        const coef = metoda === 'degresiva' ? 2 : 1.5;
        const tabel = [];
        let val = valoare;
        for (let i = 1; i <= ani; i++) {
            const amort = r2(Math.max(val * rata * coef, baza / ani));
            val -= amort;
            tabel.push({ an: i, amortizare: amort, valoare_neta: r2(Math.max(0, val)) });
        }
        return { calculator: 'Amortizare degresivă', valoare, ani, tabel };
    }
}

// ═══ SALARIU NET ROMANIA ═══
function calcSalariuNet({ salariu_brut, deducere_personala = true, persoane_intretinere = 0 }) {
    // 2025 Romania rates
    const cas = r2(salariu_brut * 0.25);  // CAS 25%
    const cass = r2(salariu_brut * 0.10); // CASS 10%

    // Deducere personală
    let dp = 0;
    if (deducere_personala && salariu_brut <= 2000) {
        dp = 300;
    } else if (deducere_personala && salariu_brut <= 3600) {
        dp = Math.round(300 - (salariu_brut - 2000) * 0.1875);
    }
    dp += persoane_intretinere * 100;

    const baza_impozit = Math.max(0, salariu_brut - cas - cass - dp);
    const impozit = r2(baza_impozit * 0.10); // 10% impozit venit

    const net = r2(salariu_brut - cas - cass - impozit);
    const cost_angajator = r2(salariu_brut * 1.0225); // 2.25% CAM

    return {
        calculator: 'Salariu net România (2025)',
        salariu_brut,
        retineri: {
            CAS_25: cas,
            CASS_10: cass,
            deducere_personala: dp,
            baza_impozabila: r2(baza_impozit),
            impozit_10: impozit
        },
        salariu_net: net,
        cost_total_angajator: cost_angajator,
        procent_retinut: `${r2((1 - net / salariu_brut) * 100)}%`,
        nota: 'Calcul orientativ. Valori exacte depind de situația individuală.'
    };
}

// ═══ TVA ═══
function calcTVA({ suma, rata_tva = 19, directie = 'adauga' }) {
    if (directie === 'adauga') {
        const tva = r2(suma * rata_tva / 100);
        return { calculator: 'TVA', suma_fara_tva: suma, tva: tva, total_cu_tva: r2(suma + tva), rata: `${rata_tva}%` };
    } else {
        const fara_tva = r2(suma / (1 + rata_tva / 100));
        const tva = r2(suma - fara_tva);
        return { calculator: 'TVA (extragere)', suma_cu_tva: suma, tva: tva, suma_fara_tva: fara_tva, rata: `${rata_tva}%` };
    }
}

// ═══ CASH FLOW ═══
function calcCashFlow({ incasari = [], cheltuieli = [], sold_initial = 0 }) {
    let sold = sold_initial;
    const fluxuri = [];
    const maxLen = Math.max(incasari.length, cheltuieli.length);
    let total_incasari = 0, total_cheltuieli = 0;

    for (let i = 0; i < maxLen; i++) {
        const inc = incasari[i] || 0;
        const chelt = cheltuieli[i] || 0;
        sold += inc - chelt;
        total_incasari += inc;
        total_cheltuieli += chelt;
        fluxuri.push({ luna: i + 1, incasari: inc, cheltuieli: chelt, flux_net: r2(inc - chelt), sold: r2(sold) });
    }

    return {
        calculator: 'Cash Flow',
        sold_initial, total_incasari: r2(total_incasari), total_cheltuieli: r2(total_cheltuieli),
        profit_net: r2(total_incasari - total_cheltuieli), sold_final: r2(sold),
        fluxuri,
        status: sold > 0 ? '✅ Cash flow pozitiv' : '❌ Cash flow negativ — atenție!'
    };
}

// ═══ BREAK EVEN ═══
function calcBreakEven({ costuri_fixe, pret_unitar, cost_variabil_unitar }) {
    const contributie = pret_unitar - cost_variabil_unitar;
    const bep_unitati = Math.ceil(costuri_fixe / contributie);
    const bep_valoare = r2(bep_unitati * pret_unitar);
    return {
        calculator: 'Break Even Point (Punct de echilibru)',
        costuri_fixe, pret_unitar, cost_variabil_unitar,
        contributie_marginala: r2(contributie),
        bep_unitati, bep_valoare,
        interpretare: `Trebuie să vinzi minim ${bep_unitati} unități (${bep_valoare} RON) pentru a acoperi costurile.`
    };
}

// ═══ INFLAȚIE ═══
function calcInflatie({ suma, rata_inflatie, ani }) {
    const viitoare = suma * Math.pow(1 + rata_inflatie / 100, ani);
    const reala = suma / Math.pow(1 + rata_inflatie / 100, ani);
    return {
        calculator: 'Efectul inflației',
        suma_prezenta: suma, rata_anuala: `${rata_inflatie}%`, ani,
        valoare_viitoare_equivalenta: r2(viitoare),
        putere_cumparare_reala: r2(reala),
        pierdere: `${r2((1 - reala / suma) * 100)}%`,
        interpretare: `${suma} RON de azi vor valora cât ${r2(reala)} RON peste ${ani} ani (pierdere ${r2((1 - reala / suma) * 100)}%).`
    };
}

// ═══ CONVERSIE VALUTARĂ ═══
function calcConversie({ suma, din, in: toward, curs }) {
    if (!curs) return { error: 'Specifică cursul de schimb (ex: curs: 4.97 pentru 1 EUR = 4.97 RON)' };
    const rezultat = r2(suma * curs);
    return { calculator: 'Conversie valutară', suma, din, toward, curs, rezultat: `${rezultat} ${toward}` };
}

// ═══ PROFIT MARGIN ═══
function calcProfitMargin({ venituri, costuri }) {
    const profit = venituri - costuri;
    const margin = (profit / venituri) * 100;
    return {
        calculator: 'Profit Margin',
        venituri, costuri, profit: r2(profit),
        marja: `${r2(margin)}%`,
        status: margin > 20 ? '✅ Marjă excelentă' : margin > 10 ? '🟡 Marjă acceptabilă' : '❌ Marjă scăzută'
    };
}

// ═══ DEPRECIERE ═══
function calcDepreciere({ valoare_initiala, rata_depreciere, ani }) {
    const tabel = [];
    let val = valoare_initiala;
    for (let i = 1; i <= ani; i++) {
        const dep = r2(val * rata_depreciere / 100);
        val = r2(val - dep);
        tabel.push({ an: i, depreciere: dep, valoare_ramasa: val });
    }
    return {
        calculator: 'Depreciere (procent fix)',
        valoare_initiala, rata: `${rata_depreciere}%/an`, ani,
        valoare_finala: val,
        pierdere_totala: r2(valoare_initiala - val),
        tabel
    };
}
