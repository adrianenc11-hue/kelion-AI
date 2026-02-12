// ═══ INVOICE GENERATOR — Facturi profesionale ═══
// Generare facturi cu toate câmpurile obligatorii conform legislație RO

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

        switch (action) {
            case 'generate':
                return respond(200, generateInvoice(body));
            case 'calculate_totals':
                return respond(200, calculateTotals(body.items || [], body.tva_rate || 19, body.currency || 'RON'));
            case 'validate':
                return respond(200, validateInvoice(body));
            default:
                return respond(400, { error: 'Actions: generate, calculate_totals, validate' });
        }
    } catch (err) {
        console.error('Invoice error:', err);
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

function generateInvoice(data) {
    const {
        serie = 'K', numar, data_emitere, data_scadenta,
        furnizor = {}, client = {},
        items = [], tva_rate = 19, currency = 'RON',
        observatii = '', plata_metoda = 'Transfer bancar'
    } = data;

    // Calculate totals
    const totals = calculateTotals(items, tva_rate, currency);

    // Generate invoice number if not provided
    const invoiceNumber = numar || `${serie}-${Date.now().toString().slice(-6)}`;
    const emitere = data_emitere || new Date().toISOString().split('T')[0];
    const scadenta = data_scadenta || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const invoice = {
        header: {
            serie,
            numar: invoiceNumber,
            data_emitere: emitere,
            data_scadenta: scadenta
        },
        furnizor: {
            denumire: furnizor.denumire || '[FURNIZOR]',
            cui: furnizor.cui || '[CUI]',
            reg_com: furnizor.reg_com || '[J__/____/____]',
            adresa: furnizor.adresa || '[ADRESA]',
            banca: furnizor.banca || '[BANCA]',
            iban: furnizor.iban || '[IBAN]',
            telefon: furnizor.telefon || '',
            email: furnizor.email || ''
        },
        client: {
            denumire: client.denumire || '[CLIENT]',
            cui: client.cui || '[CUI]',
            reg_com: client.reg_com || '[J__/____/____]',
            adresa: client.adresa || '[ADRESA]'
        },
        items: items.map((item, i) => ({
            nr: i + 1,
            descriere: item.descriere || `Serviciu ${i + 1}`,
            um: item.um || 'buc',
            cantitate: item.cantitate || 1,
            pret_unitar: item.pret_unitar || 0,
            valoare: (item.cantitate || 1) * (item.pret_unitar || 0)
        })),
        totals,
        observatii,
        plata: {
            metoda: plata_metoda,
            termen: scadenta
        }
    };

    // Generate text version
    invoice.text_version = formatInvoiceText(invoice);

    return invoice;
}

function calculateTotals(items, tvaRate = 19, currency = 'RON') {
    const subtotal = items.reduce((sum, item) => sum + ((item.cantitate || 1) * (item.pret_unitar || 0)), 0);
    const tva = Math.round(subtotal * (tvaRate / 100) * 100) / 100;
    const total = Math.round((subtotal + tva) * 100) / 100;

    return {
        subtotal: Math.round(subtotal * 100) / 100,
        tva_rate: `${tvaRate}%`,
        tva_valoare: tva,
        total,
        currency,
        total_text: numberToWords(total) + ` ${currency}`
    };
}

function validateInvoice(data) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!data.furnizor?.denumire) errors.push('Lipsă: Denumire furnizor');
    if (!data.furnizor?.cui) errors.push('Lipsă: CUI furnizor');
    if (!data.furnizor?.reg_com) warnings.push('Lipsă: Nr. Reg. Com. furnizor');
    if (!data.furnizor?.adresa) errors.push('Lipsă: Adresa furnizor');
    if (!data.client?.denumire) errors.push('Lipsă: Denumire client');
    if (!data.client?.cui) errors.push('Lipsă: CUI client');
    if (!data.items?.length) errors.push('Lipsă: Articole pe factură');
    if (!data.serie) warnings.push('Lipsă: Serie factură');
    if (!data.numar) warnings.push('Lipsă: Număr factură (se va genera automat)');

    // Validate CUI format
    if (data.furnizor?.cui && !/^(RO)?\d{2,10}$/.test(data.furnizor.cui.replace(/\s/g, ''))) {
        warnings.push('CUI furnizor format nestandard');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        completeness: `${Math.round(((8 - errors.length) / 8) * 100)}%`
    };
}

function formatInvoiceText(inv) {
    let lines = [];
    lines.push('═══════════════════════════════════════════════');
    lines.push(`              FACTURĂ ${inv.header.serie}-${inv.header.numar}`);
    lines.push('═══════════════════════════════════════════════');
    lines.push(`Data emitere: ${inv.header.data_emitere}    Scadentă: ${inv.header.data_scadenta}`);
    lines.push('');
    lines.push('FURNIZOR:');
    lines.push(`  ${inv.furnizor.denumire}`);
    lines.push(`  CUI: ${inv.furnizor.cui} | Reg.Com: ${inv.furnizor.reg_com}`);
    lines.push(`  ${inv.furnizor.adresa}`);
    lines.push(`  IBAN: ${inv.furnizor.iban} | Banca: ${inv.furnizor.banca}`);
    lines.push('');
    lines.push('CLIENT:');
    lines.push(`  ${inv.client.denumire}`);
    lines.push(`  CUI: ${inv.client.cui} | Reg.Com: ${inv.client.reg_com}`);
    lines.push(`  ${inv.client.adresa}`);
    lines.push('');
    lines.push('───────────────────────────────────────────────');
    lines.push('Nr | Descriere            | UM  | Cant | Preț   | Valoare');
    lines.push('───────────────────────────────────────────────');
    inv.items.forEach(item => {
        lines.push(`${String(item.nr).padStart(2)} | ${item.descriere.padEnd(20).slice(0, 20)} | ${item.um.padEnd(3)} | ${String(item.cantitate).padStart(4)} | ${String(item.pret_unitar).padStart(6)} | ${String(item.valoare).padStart(7)}`);
    });
    lines.push('───────────────────────────────────────────────');
    lines.push(`Subtotal:                              ${inv.totals.subtotal} ${inv.totals.currency}`);
    lines.push(`TVA ${inv.totals.tva_rate}:                              ${inv.totals.tva_valoare} ${inv.totals.currency}`);
    lines.push(`TOTAL:                                 ${inv.totals.total} ${inv.totals.currency}`);
    lines.push('═══════════════════════════════════════════════');
    if (inv.observatii) lines.push(`Observații: ${inv.observatii}`);
    lines.push(`Plata: ${inv.plata.metoda} | Termen: ${inv.plata.termen}`);

    return lines.join('\n');
}

function numberToWords(num) {
    if (num === 0) return 'zero';
    const units = ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
    const teens = ['zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece', 'șaptesprezece', 'optsprezece', 'nouăsprezece'];
    const tens = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];

    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);

    let result = '';
    if (intPart >= 1000) result += units[Math.floor(intPart / 1000)] + ' mii ';
    if (intPart % 1000 >= 100) result += units[Math.floor((intPart % 1000) / 100)] + ' sute ';
    const remainder = intPart % 100;
    if (remainder >= 20) {
        result += tens[Math.floor(remainder / 10)] + ' ';
        if (remainder % 10) result += 'și ' + units[remainder % 10] + ' ';
    } else if (remainder >= 10) {
        result += teens[remainder - 10] + ' ';
    } else if (remainder > 0) {
        result += units[remainder] + ' ';
    }

    if (decPart > 0) result += `și ${decPart}/100`;
    return result.trim();
}
