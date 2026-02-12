// ═══ PORTFOLIO TRACKER — Date REALE Alpaca (zero fake) ═══
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
            case 'overview': return respond(200, await getOverview());
            case 'positions': return respond(200, await getPositions());
            case 'performance': return respond(200, await getPerformance(body));
            case 'allocation': return respond(200, await getAllocation());
            case 'dividends': return respond(200, await getDividends());
            default: return respond(400, { error: 'Actions: overview, positions, performance, allocation, dividends' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

// ═══ Helper: Alpaca API call ═══
async function alpacaFetch(endpoint) {
    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    const ALPACA_URL = process.env.ALPACA_PAPER === 'true' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    const res = await fetch(`${ALPACA_URL}${endpoint}`, {
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
    });
    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Alpaca API ${res.status}: ${errBody}`);
    }
    return res.json();
}

// ═══ OVERVIEW — Date reale din Alpaca ═══
async function getOverview() {
    const acc = await alpacaFetch('/v2/account');
    const equity = parseFloat(acc.equity);
    const lastEquity = parseFloat(acc.last_equity);
    const dailyPnl = equity - lastEquity;
    const dailyPnlPct = lastEquity > 0 ? (dailyPnl / lastEquity * 100) : 0;

    return {
        source: 'Alpaca Live',
        data: {
            equity: equity,
            cash: parseFloat(acc.cash),
            buying_power: parseFloat(acc.buying_power),
            portfolio_value: parseFloat(acc.portfolio_value || acc.equity),
            daily_pnl: dailyPnl,
            daily_pnl_pct: dailyPnlPct,
            status: acc.status,
            currency: acc.currency,
            pattern_day_trader: acc.pattern_day_trader,
            trading_blocked: acc.trading_blocked,
            account_blocked: acc.account_blocked
        }
    };
}

// ═══ POSITIONS — Date reale din Alpaca ═══
async function getPositions() {
    const positions = await alpacaFetch('/v2/positions');
    return {
        source: 'Alpaca Live',
        data: {
            positions: positions.map(p => ({
                symbol: p.symbol,
                qty: parseFloat(p.qty),
                side: p.side,
                avg_entry_price: parseFloat(p.avg_entry_price),
                current_price: parseFloat(p.current_price),
                market_value: parseFloat(p.market_value),
                unrealized_pl: parseFloat(p.unrealized_pl),
                unrealized_plpc: parseFloat(p.unrealized_plpc),
                change_today: parseFloat(p.change_today)
            })),
            count: positions.length
        }
    };
}

// ═══ PERFORMANCE — Calculat din Alpaca portfolio history ═══
async function getPerformance({ period = '1M' }) {
    try {
        const history = await alpacaFetch(`/v2/account/portfolio/history?period=${period}&timeframe=1D`);
        const timestamps = history.timestamp || [];
        const equities = history.equity || [];
        const profitLoss = history.profit_loss || [];
        const profitLossPct = history.profit_loss_pct || [];

        if (equities.length < 2) {
            return { source: 'Alpaca Live', data: null, message: 'Not enough data for this period' };
        }

        const startEquity = equities[0];
        const endEquity = equities[equities.length - 1];
        const totalReturn = startEquity > 0 ? ((endEquity - startEquity) / startEquity * 100) : 0;

        // Calculate max drawdown
        let peak = equities[0];
        let maxDrawdown = 0;
        for (const eq of equities) {
            if (eq > peak) peak = eq;
            const dd = (peak - eq) / peak;
            if (dd > maxDrawdown) maxDrawdown = dd;
        }

        // Calculate daily returns for Sharpe ratio
        const dailyReturns = [];
        for (let i = 1; i < equities.length; i++) {
            if (equities[i - 1] > 0) {
                dailyReturns.push((equities[i] - equities[i - 1]) / equities[i - 1]);
            }
        }
        const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
        const stdDev = dailyReturns.length > 1 ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1)) : 0;
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        return {
            source: 'Alpaca Live',
            data: {
                period: period,
                start_equity: startEquity,
                end_equity: endEquity,
                total_return_pct: totalReturn,
                total_pnl: endEquity - startEquity,
                max_drawdown_pct: maxDrawdown * 100,
                sharpe_ratio: sharpeRatio,
                data_points: equities.length,
                timestamps: timestamps,
                equities: equities,
                profit_loss: profitLoss,
                profit_loss_pct: profitLossPct
            }
        };
    } catch (e) {
        return { source: 'Alpaca', error: e.message, data: null };
    }
}

// ═══ ALLOCATION — Calculat din pozițiile reale ═══
async function getAllocation() {
    const positions = await alpacaFetch('/v2/positions');
    const acc = await alpacaFetch('/v2/account');
    const totalEquity = parseFloat(acc.equity);
    const cash = parseFloat(acc.cash);

    const bySymbol = positions.map(p => ({
        symbol: p.symbol,
        market_value: parseFloat(p.market_value),
        percentage: totalEquity > 0 ? (parseFloat(p.market_value) / totalEquity * 100) : 0,
        asset_class: p.asset_class
    }));

    const cashPct = totalEquity > 0 ? (cash / totalEquity * 100) : 0;

    // Group by asset class
    const byClass = {};
    for (const p of positions) {
        const cls = p.asset_class || 'unknown';
        if (!byClass[cls]) byClass[cls] = { value: 0, count: 0 };
        byClass[cls].value += parseFloat(p.market_value);
        byClass[cls].count++;
    }

    return {
        source: 'Alpaca Live',
        data: {
            total_equity: totalEquity,
            cash: cash,
            cash_pct: cashPct,
            by_symbol: bySymbol,
            by_asset_class: Object.entries(byClass).map(([cls, d]) => ({
                class: cls,
                value: d.value,
                percentage: totalEquity > 0 ? (d.value / totalEquity * 100) : 0,
                positions: d.count
            })),
            invested: totalEquity - cash,
            invested_pct: totalEquity > 0 ? ((totalEquity - cash) / totalEquity * 100) : 0
        }
    };
}

// ═══ DIVIDENDS — Din activitatea reală Alpaca ═══
async function getDividends() {
    try {
        const activities = await alpacaFetch('/v2/account/activities/DIV');
        return {
            source: 'Alpaca Live',
            data: {
                dividends: (Array.isArray(activities) ? activities : []).slice(0, 50).map(a => ({
                    symbol: a.symbol,
                    amount: parseFloat(a.net_amount || a.qty),
                    date: a.date || a.transaction_time,
                    status: a.status
                })),
                count: Array.isArray(activities) ? activities.length : 0
            }
        };
    } catch (e) {
        // Alpaca may return 404 if no dividend activity
        return { source: 'Alpaca Live', data: { dividends: [], count: 0 }, note: 'No dividend activity found' };
    }
}
