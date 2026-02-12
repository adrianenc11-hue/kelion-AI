// ═══ CHART GENERATOR FINANCIAL — Real market data via Alpaca ═══
const { patchProcessEnv } = require('./get-secret');

const https = require('https');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    await patchProcessEnv(); // Load vault secrets FIRST
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        return respond(503, { error: 'config_missing', message: 'ALPACA_API_KEY and ALPACA_SECRET_KEY env vars required' });
    }

    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'candlestick': return respond(200, await generateCandlestick(body, ALPACA_KEY, ALPACA_SECRET));
            case 'line': return respond(200, await generateLineChart(body, ALPACA_KEY, ALPACA_SECRET));
            case 'comparison': return respond(200, await generateComparison(body, ALPACA_KEY, ALPACA_SECRET));
            case 'heatmap': return respond(200, await generateHeatmap(ALPACA_KEY, ALPACA_SECRET));
            default: return respond(400, { error: 'Actions: candlestick, line, comparison, heatmap' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

// ═══ ALPACA DATA API REQUEST ═══
function alpacaRequest(path, key, secret) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'data.alpaca.markets',
            path: path,
            method: 'GET',
            headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Alpaca API ${res.statusCode}: ${data.substring(0, 200)}`));
                    return;
                }
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Invalid JSON from Alpaca')); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Alpaca request timeout')); });
        req.end();
    });
}

// ═══ REAL CANDLESTICK CHART ═══
async function generateCandlestick({ symbol = 'AAPL', period = '30d' }, key, secret) {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];

    const data = await alpacaRequest(
        `/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start}&end=${end}&limit=${days}&adjustment=raw&feed=iex`,
        key, secret
    );

    const bars = data.bars || [];
    if (bars.length === 0) {
        return { error: 'no_data', message: `No bar data available for ${symbol} in the requested period` };
    }

    const candles = bars.map(b => ({
        date: b.t.split('T')[0],
        open: b.o.toFixed(2),
        high: b.h.toFixed(2),
        low: b.l.toFixed(2),
        close: b.c.toFixed(2),
        volume: b.v,
        candle: b.c >= b.o ? '🟢' : '🔴'
    }));

    const closes = candles.map(c => parseFloat(c.close));
    const sma20 = closes.length >= 20
        ? (closes.slice(-20).reduce((a, b) => a + b, 0) / 20)
        : (closes.reduce((a, b) => a + b, 0) / closes.length);
    const currentPrice = closes[closes.length - 1];

    return {
        symbol, period, type: 'candlestick',
        data: candles.slice(-10),
        total_candles: candles.length,
        indicators: {
            SMA_20: sma20.toFixed(2),
            current_price: currentPrice.toFixed(2),
            trend: currentPrice > sma20 ? '📈 Above SMA (Bullish)' : '📉 Below SMA (Bearish)'
        },
        ascii_chart: candles.slice(-7).map(c => `${c.date}: ${c.candle} O:${c.open} H:${c.high} L:${c.low} C:${c.close}`).join('\n'),
        source: 'Alpaca Markets (real-time)'
    };
}

// ═══ REAL LINE CHART ═══
async function generateLineChart({ symbol = 'AAPL', period = '1y', metric = 'price' }, key, secret) {
    const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : 24;
    const start = new Date(Date.now() - months * 30 * 86400000).toISOString().split('T')[0];
    const end = new Date().toISOString().split('T')[0];

    // Use weekly bars for longer periods to stay within limits
    const timeframe = months <= 3 ? '1Day' : '1Week';
    const data = await alpacaRequest(
        `/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${timeframe}&start=${start}&end=${end}&limit=500&adjustment=raw&feed=iex`,
        key, secret
    );

    const bars = data.bars || [];
    if (bars.length === 0) {
        return { error: 'no_data', message: `No data available for ${symbol}` };
    }

    const points = bars.map(b => ({
        month: b.t.split('T')[0].substring(0, 10),
        value: b.c.toFixed(2)
    }));

    const startPrice = parseFloat(points[0].value);
    const endPrice = parseFloat(points[points.length - 1].value);

    return {
        symbol, period, metric,
        data: points,
        performance: {
            start: `$${startPrice.toFixed(2)}`,
            end: `$${endPrice.toFixed(2)}`,
            change: `${((endPrice - startPrice) / startPrice * 100).toFixed(2)}%`,
            trend: endPrice > startPrice ? '📈 Uptrend' : '📉 Downtrend'
        },
        chart_ascii: points.slice(-12).map(p => {
            const bar = '█'.repeat(Math.round(parseFloat(p.value) / endPrice * 20));
            return `${p.month}: ${bar} $${p.value}`;
        }).join('\n'),
        source: 'Alpaca Markets (real-time)'
    };
}

// ═══ REAL COMPARISON ═══
async function generateComparison({ symbols = ['AAPL', 'MSFT', 'GOOGL'], period = '1y' }, key, secret) {
    const months = period === '1m' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : period === '1y' ? 12 : 24;

    // Fetch snapshots for all symbols
    const symbolsStr = symbols.join(',');
    const snapshotData = await alpacaRequest(
        `/v2/stocks/snapshots?symbols=${encodeURIComponent(symbolsStr)}&feed=iex`,
        key, secret
    );

    // Fetch historical start prices
    const startDate = new Date(Date.now() - months * 30 * 86400000).toISOString().split('T')[0];

    const comparison = [];
    for (const sym of symbols) {
        try {
            const snapshot = snapshotData[sym];
            if (!snapshot) {
                comparison.push({ symbol: sym, error: 'No snapshot data' });
                continue;
            }

            const currentPrice = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;

            // Get historical bar for start price
            const histData = await alpacaRequest(
                `/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=1Day&start=${startDate}&limit=1&adjustment=raw&feed=iex`,
                key, secret
            );
            const startPrice = (histData.bars && histData.bars.length > 0) ? histData.bars[0].c : currentPrice;
            const returnPct = ((currentPrice - startPrice) / startPrice * 100).toFixed(2);

            comparison.push({
                symbol: sym,
                start_price: `$${startPrice.toFixed(2)}`,
                current_price: `$${currentPrice.toFixed(2)}`,
                return: `${parseFloat(returnPct) > 0 ? '+' : ''}${returnPct}%`
            });
        } catch (err) {
            comparison.push({ symbol: sym, error: err.message });
        }
    }

    comparison.sort((a, b) => parseFloat(b.return || '0') - parseFloat(a.return || '0'));
    const winner = comparison[0]?.symbol || 'N/A';

    return {
        period,
        comparison,
        winner,
        source: 'Alpaca Markets (real-time)',
        note: 'Compară performanța relativă pe aceeași perioadă'
    };
}

// ═══ REAL HEATMAP ═══
async function generateHeatmap(key, secret) {
    const sectorSymbols = {
        'Technology': ['AAPL', 'MSFT', 'NVDA', 'META'],
        'Healthcare': ['JNJ', 'UNH', 'PFE'],
        'Finance': ['JPM', 'BAC', 'GS'],
        'Energy': ['XOM', 'CVX'],
        'Consumer': ['AMZN', 'WMT']
    };

    const allSymbols = Object.values(sectorSymbols).flat();
    const symbolsStr = allSymbols.join(',');

    const snapshotData = await alpacaRequest(
        `/v2/stocks/snapshots?symbols=${encodeURIComponent(symbolsStr)}&feed=iex`,
        key, secret
    );

    const sectors = [];
    for (const [sector, syms] of Object.entries(sectorSymbols)) {
        const stocks = {};
        let totalChange = 0;
        let count = 0;

        for (const sym of syms) {
            const snap = snapshotData[sym];
            if (snap && snap.dailyBar) {
                const open = snap.dailyBar.o;
                const close = snap.dailyBar.c;
                const changePct = ((close - open) / open * 100).toFixed(1);
                stocks[sym] = `${parseFloat(changePct) >= 0 ? '+' : ''}${changePct}%`;
                totalChange += parseFloat(changePct);
                count++;
            } else {
                stocks[sym] = 'N/A';
            }
        }

        const avgChange = count > 0 ? (totalChange / count).toFixed(1) : '0.0';
        sectors.push({
            sector,
            change: `${parseFloat(avgChange) >= 0 ? '+' : ''}${avgChange}%`,
            stocks,
            color: parseFloat(avgChange) > 1 ? '🟢' : parseFloat(avgChange) > 0 ? '🟡' : '🔴'
        });
    }

    const overallChange = sectors.reduce((sum, s) => sum + parseFloat(s.change), 0) / sectors.length;

    return {
        type: 'sector_heatmap',
        market: 'S&P 500',
        sectors,
        overall: `${overallChange >= 0 ? '🟢' : '🔴'} Market ${overallChange >= 0 ? 'up' : 'down'} ${overallChange >= 0 ? '+' : ''}${overallChange.toFixed(2)}%`,
        source: 'Alpaca Markets (real-time)'
    };
}
