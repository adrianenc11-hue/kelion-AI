// ═══ MARKET DATA FEED — Date piață REALE (Alpaca + CoinGecko — zero fake) ═══
const { patchProcessEnv } = require('./get-secret');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

const ALPACA_DATA_URL = 'https://data.alpaca.markets';

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv(); // Load vault secrets FIRST
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'quote': return respond(200, await getQuote(body));
            case 'watchlist': return respond(200, await getWatchlist(body));
            case 'movers': return respond(200, await getMovers());
            case 'technicals': return respond(200, await getTechnicals(body));
            default: return respond(400, { error: 'Actions: quote, watchlist, movers, technicals' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

// ═══ Helper: Alpaca Data API ═══
async function alpacaData(endpoint) {
    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    if (!ALPACA_KEY || !ALPACA_SECRET) throw new Error('ALPACA_API_KEY not configured');
    const res = await fetch(`${ALPACA_DATA_URL}${endpoint}`, {
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Alpaca Data ${res.status}: ${txt}`);
    }
    return res.json();
}

// ═══ QUOTE — Date reale: Alpaca pentru stocks, CoinGecko pentru crypto ═══
async function getQuote({ symbol = 'AAPL', market = 'stocks' }) {
    if (!symbol) return { error: 'Symbol required' };

    if (market === 'crypto') {
        // CoinGecko — free, no API key needed
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(symbol.toLowerCase())}&vs_currencies=usd,eur&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const data = await res.json();
        const coin = data[symbol.toLowerCase()];
        if (!coin) return { error: `Coin '${symbol}' not found on CoinGecko`, hint: 'Use CoinGecko ID: bitcoin, ethereum, solana, etc.' };
        return {
            symbol, market: 'crypto', source: 'CoinGecko Live',
            price_usd: coin.usd,
            price_eur: coin.eur,
            change_24h_pct: coin.usd_24h_change,
            market_cap: coin.usd_market_cap,
            volume_24h: coin.usd_24h_vol
        };
    }

    // Stocks — Alpaca Data API
    if (!process.env.ALPACA_API_KEY) return { error: 'ALPACA_API_KEY not configured for stock quotes' };

    const data = await alpacaData(`/v2/stocks/${encodeURIComponent(symbol.toUpperCase())}/snapshot`);
    return {
        symbol: symbol.toUpperCase(), market: 'stocks', source: 'Alpaca Live',
        price: data.latestTrade?.p || data.minuteBar?.c,
        open: data.dailyBar?.o,
        high: data.dailyBar?.h,
        low: data.dailyBar?.l,
        close: data.dailyBar?.c,
        volume: data.dailyBar?.v,
        prev_close: data.prevDailyBar?.c,
        change_pct: data.dailyBar?.c && data.prevDailyBar?.c
            ? ((data.dailyBar.c - data.prevDailyBar.c) / data.prevDailyBar.c * 100)
            : null,
        timestamp: data.latestTrade?.t
    };
}

// ═══ WATCHLIST — Date reale din Alpaca snapshots ═══
async function getWatchlist({ watchlist = 'default' }) {
    const symbols = {
        default: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'META', 'AMZN', 'GOOGL'],
        tech: ['AAPL', 'MSFT', 'NVDA', 'META', 'GOOGL', 'CRM', 'ADBE'],
        crypto: ['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple']
    };

    const list = symbols[watchlist] || symbols.default;

    if (watchlist === 'crypto') {
        // CoinGecko batch
        const ids = list.join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
        const data = await res.json();
        return {
            watchlist, source: 'CoinGecko Live',
            stocks: list.map(id => ({
                symbol: id,
                price: data[id]?.usd || null,
                change_24h_pct: data[id]?.usd_24h_change || null,
                market_cap: data[id]?.usd_market_cap || null
            }))
        };
    }

    // Stocks — Alpaca snapshots
    if (!process.env.ALPACA_API_KEY) return { error: 'ALPACA_API_KEY not configured', watchlist };

    const symbolsStr = list.join(',');
    const data = await alpacaData(`/v2/stocks/snapshots?symbols=${symbolsStr}`);
    return {
        watchlist, source: 'Alpaca Live',
        stocks: list.map(sym => {
            const snap = data[sym];
            if (!snap) return { symbol: sym, error: 'No data' };
            return {
                symbol: sym,
                price: snap.latestTrade?.p || snap.minuteBar?.c,
                open: snap.dailyBar?.o,
                high: snap.dailyBar?.h,
                low: snap.dailyBar?.l,
                close: snap.dailyBar?.c,
                volume: snap.dailyBar?.v,
                prev_close: snap.prevDailyBar?.c,
                change_pct: snap.dailyBar?.c && snap.prevDailyBar?.c
                    ? ((snap.dailyBar.c - snap.prevDailyBar.c) / snap.prevDailyBar.c * 100)
                    : null
            };
        })
    };
}

// ═══ MOVERS — Top movers reale din Alpaca ═══
async function getMovers() {
    if (!process.env.ALPACA_API_KEY) return { error: 'ALPACA_API_KEY not configured for movers' };

    try {
        // Alpaca movers endpoint
        const [gainers, losers] = await Promise.all([
            alpacaData('/v1beta1/screener/stocks/movers?top=5'),
            alpacaData('/v1beta1/screener/stocks/movers?top=5')
        ]);

        return {
            source: 'Alpaca Live',
            top_gainers: (gainers.gainers || []).map(m => ({
                symbol: m.symbol, change_pct: m.percent_change, price: m.price, volume: m.volume
            })),
            top_losers: (losers.losers || []).map(m => ({
                symbol: m.symbol, change_pct: m.percent_change, price: m.price, volume: m.volume
            }))
        };
    } catch (e) {
        // Fallback: get snapshots of popular stocks and sort by change
        const symbols = 'AAPL,TSLA,NVDA,MSFT,META,AMZN,GOOGL,AMD,NFLX,CRM';
        const data = await alpacaData(`/v2/stocks/snapshots?symbols=${symbols}`);
        const sorted = Object.entries(data)
            .map(([sym, snap]) => ({
                symbol: sym,
                price: snap.dailyBar?.c,
                change_pct: snap.dailyBar?.c && snap.prevDailyBar?.c
                    ? ((snap.dailyBar.c - snap.prevDailyBar.c) / snap.prevDailyBar.c * 100) : 0
            }))
            .sort((a, b) => b.change_pct - a.change_pct);

        return {
            source: 'Alpaca Snapshots',
            top_gainers: sorted.slice(0, 3),
            top_losers: sorted.slice(-3).reverse()
        };
    }
}

// ═══ TECHNICALS — Calculat din date reale Alpaca bars ═══
async function getTechnicals({ symbol = 'AAPL', timeframe = '1Day', limit = 50 }) {
    if (!process.env.ALPACA_API_KEY) return { error: 'ALPACA_API_KEY not configured for technicals' };
    if (!symbol) return { error: 'Symbol required' };

    const data = await alpacaData(`/v2/stocks/${encodeURIComponent(symbol.toUpperCase())}/bars?timeframe=${timeframe}&limit=${limit}`);
    const bars = data.bars || [];

    if (bars.length < 20) return { symbol, error: 'Not enough data for technical analysis', bars_available: bars.length };

    const closes = bars.map(b => b.c);
    const volumes = bars.map(b => b.v);
    const currentPrice = closes[closes.length - 1];

    // SMA calculations
    const sma = (arr, period) => {
        if (arr.length < period) return null;
        const slice = arr.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    };

    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);

    // EMA calculations
    const ema = (arr, period) => {
        if (arr.length < period) return null;
        const k = 2 / (period + 1);
        let e = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < arr.length; i++) {
            e = arr[i] * k + e * (1 - k);
        }
        return e;
    };

    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);

    // RSI
    let gains = 0, losses = 0;
    const period = Math.min(14, closes.length - 1);
    for (let i = closes.length - period; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
    const rsi = 100 - (100 / (1 + rs));

    // MACD (proper calculation)
    const macdLine = (ema12 && ema26) ? ema12 - ema26 : null;

    // Volume average
    const avgVolume = sma(volumes, 20);
    const volumeRatio = avgVolume > 0 ? volumes[volumes.length - 1] / avgVolume : 1;

    // Bollinger Bands
    const bb_sma = sma20;
    let bb_std = 0;
    if (closes.length >= 20) {
        const last20 = closes.slice(-20);
        const mean = last20.reduce((a, b) => a + b, 0) / 20;
        bb_std = Math.sqrt(last20.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / 20);
    }

    return {
        symbol: symbol.toUpperCase(), source: 'Alpaca Live (calculated)',
        current_price: currentPrice,
        bars_used: bars.length,
        indicators: {
            RSI_14: { value: Math.round(rsi * 100) / 100, signal: rsi < 30 ? 'Oversold (BUY)' : rsi > 70 ? 'Overbought (SELL)' : 'Neutral' },
            SMA_20: { value: sma20 ? Math.round(sma20 * 100) / 100 : null, signal: sma20 ? (currentPrice > sma20 ? 'Above (BUY)' : 'Below (SELL)') : 'N/A' },
            SMA_50: { value: sma50 ? Math.round(sma50 * 100) / 100 : null, signal: sma50 ? (currentPrice > sma50 ? 'Above (BUY)' : 'Below (SELL)') : 'N/A' },
            EMA_12: { value: ema12 ? Math.round(ema12 * 100) / 100 : null },
            EMA_26: { value: ema26 ? Math.round(ema26 * 100) / 100 : null },
            MACD: { value: macdLine ? Math.round(macdLine * 1000) / 1000 : null, signal: macdLine > 0 ? 'Bullish' : 'Bearish' },
            Bollinger: {
                upper: bb_sma && bb_std ? Math.round((bb_sma + 2 * bb_std) * 100) / 100 : null,
                middle: bb_sma ? Math.round(bb_sma * 100) / 100 : null,
                lower: bb_sma && bb_std ? Math.round((bb_sma - 2 * bb_std) * 100) / 100 : null
            },
            Volume: { current: volumes[volumes.length - 1], avg_20: avgVolume ? Math.round(avgVolume) : null, ratio: Math.round(volumeRatio * 100) / 100 }
        },
        summary: {
            buy_signals: (rsi < 30 ? 1 : 0) + (currentPrice > (sma20 || 0) ? 1 : 0) + (currentPrice > (sma50 || 0) ? 1 : 0) + (macdLine > 0 ? 1 : 0),
            sell_signals: (rsi > 70 ? 1 : 0) + (currentPrice < (sma20 || Infinity) ? 1 : 0) + (currentPrice < (sma50 || Infinity) ? 1 : 0) + (macdLine < 0 ? 1 : 0)
        }
    };
}
