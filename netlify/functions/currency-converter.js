// ═══ CURRENCY CONVERTER — Conversie valutară ═══
// Cursuri BNR, conversii, istoric

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Cursuri de referință (actualizate periodic, pot fi înlocuite cu API BNR live)
const RATES_RON = {
    EUR: 4.9770, USD: 4.5800, GBP: 5.7900, CHF: 5.1200,
    HUF: 0.01253, PLN: 1.1550, CZK: 0.1960, BGN: 2.5450,
    SEK: 0.4350, NOK: 0.4180, DKK: 0.6680, CAD: 3.3200,
    AUD: 2.9800, JPY: 0.0305, CNY: 0.6300, TRY: 0.1290,
    MDL: 0.2530, UAH: 0.1100, RSD: 0.0425, HRK: 0.6600
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            case 'convert':
                return respond(200, convert(body));
            case 'rates':
                return respond(200, getRates(body));
            case 'multi_convert':
                return respond(200, multiConvert(body));
            case 'compare':
                return respond(200, compareRates(body));
            default:
                return respond(400, { error: 'Actions: convert, rates, multi_convert, compare' });
        }
    } catch (err) {
        return respond(500, { error: err.message });
    }
};

function respond(code, data) {
    return { statusCode: code, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: code === 200, ...data }) };
}

function convert({ amount = 1, from = 'EUR', to = 'RON' }) {
    from = from.toUpperCase();
    to = to.toUpperCase();

    let result;
    if (to === 'RON') {
        result = amount * (RATES_RON[from] || 1);
    } else if (from === 'RON') {
        result = amount / (RATES_RON[to] || 1);
    } else {
        const inRON = amount * (RATES_RON[from] || 1);
        result = inRON / (RATES_RON[to] || 1);
    }

    return {
        amount, from, to,
        rate: Math.round(result / amount * 10000) / 10000,
        result: Math.round(result * 100) / 100,
        formatted: `${amount} ${from} = ${Math.round(result * 100) / 100} ${to}`,
        source: 'Cursuri BNR referință',
        note: 'Cursuri orientative, verifică BNR.ro pentru curs oficial'
    };
}

function getRates({ base = 'RON' }) {
    base = base.toUpperCase();

    if (base === 'RON') {
        return {
            base: 'RON',
            rates: Object.entries(RATES_RON).map(([currency, rate]) => ({
                currency,
                buy: Math.round(rate * 0.98 * 10000) / 10000,
                sell: rate,
                reference: rate
            })),
            source: 'BNR referință',
            last_update: new Date().toISOString().split('T')[0]
        };
    }

    const baseRate = RATES_RON[base] || 1;
    const rates = {};
    rates['RON'] = Math.round(1 / baseRate * 10000) / 10000;
    Object.entries(RATES_RON).forEach(([cur, rate]) => {
        if (cur !== base) rates[cur] = Math.round(rate / baseRate * 10000) / 10000;
    });

    return { base, rates, source: 'Calculat din cursuri BNR' };
}

function multiConvert({ amount = 1, from = 'EUR', to_currencies = ['RON', 'USD', 'GBP', 'CHF'] }) {
    return {
        amount,
        from: from.toUpperCase(),
        conversions: to_currencies.map(to => convert({ amount, from, to }))
    };
}

function compareRates({ currencies = ['EUR', 'USD', 'GBP', 'CHF'] }) {
    return {
        base: 'RON',
        comparison: currencies.map(cur => ({
            currency: cur,
            rate: RATES_RON[cur.toUpperCase()] || 0,
            for_100_ron: Math.round(100 / (RATES_RON[cur.toUpperCase()] || 1) * 100) / 100,
            for_100_foreign: Math.round(100 * (RATES_RON[cur.toUpperCase()] || 1) * 100) / 100
        }))
    };
}
