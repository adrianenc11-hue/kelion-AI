// ═══ ORDER EXECUTOR — Execuție ordine trading (Alpaca API — zero fake) ═══
const { patchProcessEnv } = require('./get-secret');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets FIRST
        const ALPACA_KEY = process.env.ALPACA_API_KEY;
        const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

        if (!ALPACA_KEY || !ALPACA_SECRET) {
            return respond(503, { error: 'config_missing', message: 'ALPACA_API_KEY and ALPACA_SECRET_KEY not configured', setup: 'Set these in Netlify env vars' });
        }

        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'buy': return respond(200, await executeOrder(body, 'buy'));
            case 'sell': return respond(200, await executeOrder(body, 'sell'));
            case 'status':
                if (!body.order_id) return respond(400, { error: 'order_id required for status' });
                return respond(200, await getOrderStatus(body));
            case 'cancel':
                if (!body.order_id) return respond(400, { error: 'order_id required for cancel' });
                return respond(200, await cancelOrder(body));
            case 'history': return respond(200, await getOrderHistory());
            default: return respond(400, { error: 'Actions: buy, sell, status, cancel, history' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

// ═══ Helper: Alpaca API ═══
async function alpacaFetch(endpoint, method = 'GET', body = null) {
    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    const ALPACA_URL = process.env.ALPACA_PAPER === 'true' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const opts = {
        method,
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${ALPACA_URL}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Alpaca ${res.status}`);
    return data;
}

// ═══ EXECUTE ORDER — Date reale ═══
async function executeOrder({ symbol, qty, type = 'market', limit_price, stop_price, time_in_force = 'day' }, side) {
    // Input validation
    if (!symbol || typeof symbol !== 'string') return { error: 'Symbol required (string)' };
    if (!qty || qty <= 0) return { error: 'Qty must be positive number' };
    if (!['market', 'limit', 'stop', 'stop_limit'].includes(type)) return { error: 'Type must be: market, limit, stop, stop_limit' };
    if (type === 'limit' && !limit_price) return { error: 'Limit price required for limit orders' };
    if (type === 'stop' && !stop_price) return { error: 'Stop price required for stop orders' };

    const orderData = { symbol: symbol.toUpperCase(), qty: String(qty), side, type, time_in_force };
    if (type === 'limit' && limit_price) orderData.limit_price = String(limit_price);
    if (type === 'stop' && stop_price) orderData.stop_price = String(stop_price);
    if (type === 'stop_limit') { orderData.limit_price = String(limit_price); orderData.stop_price = String(stop_price); }

    const data = await alpacaFetch('/v2/orders', 'POST', orderData);

    return {
        order_id: data.id,
        status: data.status,
        symbol: data.symbol,
        side: data.side,
        qty: data.qty,
        type: data.type,
        time_in_force: data.time_in_force,
        submitted_at: data.submitted_at,
        filled_at: data.filled_at,
        filled_avg_price: data.filled_avg_price,
        message: `Ordin ${side.toUpperCase()} ${qty}x ${symbol} trimis`
    };
}

// ═══ ORDER STATUS — Date reale ═══
async function getOrderStatus({ order_id }) {
    return await alpacaFetch(`/v2/orders/${order_id}`);
}

// ═══ CANCEL ORDER — Date reale ═══
async function cancelOrder({ order_id }) {
    try {
        const ALPACA_KEY = process.env.ALPACA_API_KEY;
        const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
        const ALPACA_URL = process.env.ALPACA_PAPER === 'true' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
        const res = await fetch(`${ALPACA_URL}/v2/orders/${order_id}`, {
            method: 'DELETE',
            headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
        });
        return { cancelled: res.ok, order_id, message: res.ok ? 'Ordin anulat' : 'Nu s-a putut anula' };
    } catch (err) { return { error: err.message }; }
}

// ═══ ORDER HISTORY — Date reale din Alpaca ═══
async function getOrderHistory() {
    const orders = await alpacaFetch('/v2/orders?status=all&limit=50&direction=desc');
    return {
        source: 'Alpaca Live',
        orders: (Array.isArray(orders) ? orders : []).map(o => ({
            order_id: o.id,
            symbol: o.symbol,
            side: o.side,
            qty: o.qty,
            filled_qty: o.filled_qty,
            type: o.type,
            status: o.status,
            submitted_at: o.submitted_at,
            filled_at: o.filled_at,
            filled_avg_price: o.filled_avg_price,
            limit_price: o.limit_price,
            stop_price: o.stop_price
        })),
        count: Array.isArray(orders) ? orders.length : 0
    };
}
