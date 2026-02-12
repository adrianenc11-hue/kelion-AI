// ═══ BACKTESTING ENGINE — Test strategii pe date REALE Alpaca ═══
const { patchProcessEnv } = require('./get-secret');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const ALPACA_DATA = 'https://data.alpaca.markets';

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv(); // Load vault secrets FIRST
        const ALPACA_KEY = process.env.ALPACA_API_KEY;
        const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

        if (!ALPACA_KEY || !ALPACA_SECRET) {
            return respond(503, { error: 'config_missing', message: 'ALPACA_API_KEY required for backtesting' });
        }

        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'run': return respond(200, await runBacktest(body, ALPACA_KEY, ALPACA_SECRET));
            case 'strategies': return respond(200, getStrategies());
            default: return respond(400, { error: 'Actions: run, strategies' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

// ═══ Helper: fetch Alpaca bars ═══
async function fetchBars(symbol, timeframe = '1Day', limit = 252, key, secret) {
    const res = await fetch(`${ALPACA_DATA}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${timeframe}&limit=${limit}`, {
        headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }
    });
    if (!res.ok) throw new Error(`Alpaca bars ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.bars || [];
}

// ═══ Technical indicator helpers ═══
function calcEMA(prices, period) {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    const emas = [prices.slice(0, period).reduce((a, b) => a + b, 0) / period];
    for (let i = period; i < prices.length; i++) {
        emas.push(prices[i] * k + emas[emas.length - 1] * (1 - k));
    }
    return emas;
}

function calcRSI(prices, period = 14) {
    const rsis = [];
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period && i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) avgGain += diff; else avgLoss -= diff;
    }
    avgGain /= period;
    avgLoss /= period;
    rsis.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
        rsis.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
    return rsis;
}

// ═══ BACKTEST — Date reale Alpaca, strategii calculate pe bars ═══
async function runBacktest({ strategy = 'rsi_macd', symbol = 'AAPL', period = '1y', initial_capital = 10000, risk_per_trade = 2 }, key, secret) {
    if (initial_capital <= 0) return { error: 'initial_capital must be positive' };
    if (risk_per_trade <= 0 || risk_per_trade > 100) return { error: 'risk_per_trade must be 1-100' };

    const limit = period === '1m' ? 22 : period === '3m' ? 66 : period === '6m' ? 132 : period === '1y' ? 252 : 252;
    const bars = await fetchBars(symbol.toUpperCase(), '1Day', limit, key, secret);

    if (bars.length < 26) return { error: `Not enough data for ${symbol}: got ${bars.length} bars, need 26+` };

    const closes = bars.map(b => b.c);
    const timestamps = bars.map(b => b.t);

    // Run strategy on real data
    let capital = initial_capital;
    let position = 0;
    let entryPrice = 0;
    const trades = [];
    let wins = 0, losses = 0;
    let peak = capital;
    let maxDrawdown = 0;
    const equityCurve = [capital];

    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const rsiValues = calcRSI(closes, 14);

    // Strategy starting point (after indicators warm up)
    const startIdx = 26;

    for (let i = startIdx; i < closes.length; i++) {
        const price = closes[i];
        const rsiIdx = i - 15; // RSI offset (period+1 warmup)
        const emaIdx = i - 26; // EMA26 offset
        const rsi = rsiIdx >= 0 && rsiIdx < rsiValues.length ? rsiValues[rsiIdx] : 50;
        const ema12v = emaIdx >= 0 && emaIdx < ema12.length ? ema12[emaIdx] : price;
        const ema26v = emaIdx >= 0 && emaIdx < ema26.length ? ema26[emaIdx] : price;

        let signal = 'HOLD';

        if (strategy === 'rsi_macd') {
            const macd = ema12v - ema26v;
            if (rsi < 35 && macd > 0) signal = 'BUY';
            else if (rsi > 65 && macd < 0) signal = 'SELL';
        } else if (strategy === 'ema_crossover') {
            if (ema12v > ema26v && (emaIdx > 0 && ema12[emaIdx - 1] <= ema26[emaIdx - 1])) signal = 'BUY';
            else if (ema12v < ema26v && (emaIdx > 0 && ema12[emaIdx - 1] >= ema26[emaIdx - 1])) signal = 'SELL';
        } else if (strategy === 'momentum') {
            if (rsi > 50 && price > ema26v) signal = 'BUY';
            else if (rsi < 50 && price < ema26v) signal = 'SELL';
        } else {
            // Default: RSI only
            if (rsi < 30) signal = 'BUY';
            else if (rsi > 70) signal = 'SELL';
        }

        // Execute signals
        if (signal === 'BUY' && position === 0) {
            const riskAmount = capital * (risk_per_trade / 100);
            const qty = Math.floor(riskAmount / (price * 0.03)); // 3% stop loss
            if (qty > 0 && capital >= price * qty) {
                position = qty;
                entryPrice = price;
                capital -= price * qty;
            }
        } else if (signal === 'SELL' && position > 0) {
            const exitValue = position * price;
            const pnl = exitValue - (position * entryPrice);
            capital += exitValue;
            trades.push({
                entry_date: timestamps[i - Math.min(5, i - startIdx)] || null,
                exit_date: timestamps[i],
                symbol, side: 'SELL',
                qty: position, entry_price: entryPrice, exit_price: price,
                pnl: pnl, pnl_pct: (pnl / (position * entryPrice) * 100)
            });
            if (pnl > 0) wins++; else losses++;
            position = 0;
            entryPrice = 0;
        }

        // Track equity
        const equity = capital + (position * price);
        equityCurve.push(equity);
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Close any open position at last price
    if (position > 0) {
        const lastPrice = closes[closes.length - 1];
        capital += position * lastPrice;
        const pnl = position * (lastPrice - entryPrice);
        trades.push({ symbol, side: 'CLOSE', qty: position, entry_price: entryPrice, exit_price: lastPrice, pnl });
        if (pnl > 0) wins++; else losses++;
    }

    const totalPnL = capital - initial_capital;
    const totalReturn = (totalPnL / initial_capital * 100);

    // Daily returns for Sharpe
    const dailyReturns = [];
    for (let i = 1; i < equityCurve.length; i++) {
        if (equityCurve[i - 1] > 0) dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
    }
    const avgRet = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 1 ? Math.sqrt(dailyReturns.reduce((s, r) => s + Math.pow(r - avgRet, 2), 0) / (dailyReturns.length - 1)) : 0;
    const sharpe = stdDev > 0 ? (avgRet / stdDev) * Math.sqrt(252) : 0;

    return {
        source: 'Alpaca Historical Data',
        strategy: strategy, symbol: symbol.toUpperCase(), period, bars_used: bars.length,
        initial_capital, final_capital: Math.round(capital * 100) / 100,
        results: {
            total_return_pct: Math.round(totalReturn * 100) / 100,
            total_pnl: Math.round(totalPnL * 100) / 100,
            total_trades: trades.length,
            winning_trades: wins,
            losing_trades: losses,
            win_rate_pct: trades.length > 0 ? Math.round(wins / trades.length * 10000) / 100 : 0,
            max_drawdown_pct: Math.round(maxDrawdown * 10000) / 100,
            sharpe_ratio: Math.round(sharpe * 100) / 100
        },
        trades: trades.slice(-20),
        disclaimer: 'Performanța trecută nu garantează rezultate viitoare.'
    };
}

function getStrategies() {
    return {
        strategies: [
            { id: 'rsi_macd', name: 'RSI + MACD', description: 'Buy: RSI<35 + MACD>0 | Sell: RSI>65 + MACD<0' },
            { id: 'ema_crossover', name: 'EMA 12/26 Crossover', description: 'Buy: EMA12 crosses above EMA26 | Sell: opposite' },
            { id: 'momentum', name: 'Momentum', description: 'Buy: RSI>50 + price > EMA26 | Sell: opposite' }
        ]
    };
}
