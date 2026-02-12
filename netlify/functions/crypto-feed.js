// ═══ CRYPTO FEED — Date crypto live via CoinGecko ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'price': return respond(200, await getCryptoPrice(body));
            case 'top': return respond(200, await getTopCryptos(body));
            case 'trending': return respond(200, await getTrending());
            case 'signals': return respond(200, await getCryptoSignals(body));
            case 'fear_greed': return respond(200, await getFearGreed());
            default: return respond(400, { error: 'Actions: price, top, trending, signals, fear_greed' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function getCryptoPrice({ coin = 'bitcoin' }) {
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`);
        const data = await res.json();
        return {
            name: data.name, symbol: data.symbol?.toUpperCase(),
            price_usd: `$${data.market_data?.current_price?.usd?.toLocaleString()}`,
            price_eur: `€${data.market_data?.current_price?.eur?.toLocaleString()}`,
            change_24h: `${data.market_data?.price_change_percentage_24h?.toFixed(2)}%`,
            change_7d: `${data.market_data?.price_change_percentage_7d?.toFixed(2)}%`,
            change_30d: `${data.market_data?.price_change_percentage_30d?.toFixed(2)}%`,
            market_cap: `$${(data.market_data?.market_cap?.usd / 1e9)?.toFixed(1)}B`,
            volume_24h: `$${(data.market_data?.total_volume?.usd / 1e9)?.toFixed(1)}B`,
            rank: `#${data.market_cap_rank}`,
            ath: `$${data.market_data?.ath?.usd?.toLocaleString()}`,
            ath_change: `${data.market_data?.ath_change_percentage?.usd?.toFixed(1)}%`,
            source: '🟢 CoinGecko (live)'
        };
    } catch (e) {
        return { error: 'CoinGecko API unavailable', coin, fallback: true };
    }
}

async function getTopCryptos({ limit = 10, currency = 'usd' }) {
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&sparkline=false&price_change_percentage=24h,7d`);
        const data = await res.json();
        return {
            top: data.map((c, i) => ({
                rank: i + 1,
                name: c.name, symbol: c.symbol?.toUpperCase(),
                price: `$${c.current_price?.toLocaleString()}`,
                change_24h: `${c.price_change_percentage_24h?.toFixed(2)}%`,
                market_cap: `$${(c.market_cap / 1e9)?.toFixed(1)}B`,
                volume: `$${(c.total_volume / 1e9)?.toFixed(1)}B`
            })),
            source: '🟢 CoinGecko (live)'
        };
    } catch (e) {
        return {
            error: 'CoinGecko API unavailable — cannot fetch live data',
            source: '❌ CoinGecko unreachable',
            retry: 'Try again in a few minutes (rate limit may apply)'
        };
    }
}

async function getTrending() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const data = await res.json();
        return {
            trending: data.coins?.slice(0, 7).map(c => ({
                name: c.item.name, symbol: c.item.symbol,
                rank: c.item.market_cap_rank,
                price_btc: c.item.price_btc?.toFixed(10),
                score: c.item.score
            })),
            source: '🟢 CoinGecko Trending'
        };
    } catch (e) { return { error: 'Trending unavailable' }; }
}

async function getCryptoSignals({ coin = 'bitcoin' }) {
    // Get real price data from CoinGecko to derive basic signals
    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.toLowerCase()}?localization=false&tickers=false&community_data=false&developer_data=false`);
        const data = await res.json();
        const md = data.market_data || {};

        const change24h = md.price_change_percentage_24h || 0;
        const change7d = md.price_change_percentage_7d || 0;
        const change30d = md.price_change_percentage_30d || 0;

        // Simple momentum score based on real price changes
        let score = 50;
        if (change24h > 5) score += 15; else if (change24h > 2) score += 8; else if (change24h < -5) score -= 15; else if (change24h < -2) score -= 8;
        if (change7d > 10) score += 10; else if (change7d < -10) score -= 10;
        if (change30d > 20) score += 5; else if (change30d < -20) score -= 5;
        score = Math.max(0, Math.min(100, score));

        return {
            coin, timestamp: new Date().toISOString(),
            signal: score >= 70 ? '🟢 BULLISH' : score >= 55 ? '🟡 SLIGHTLY BULLISH' : score >= 45 ? '⚪ NEUTRAL' : score >= 30 ? '🟠 SLIGHTLY BEARISH' : '🔴 BEARISH',
            score,
            based_on: {
                price_usd: `$${md.current_price?.usd?.toLocaleString()}`,
                change_24h: `${change24h.toFixed(2)}%`,
                change_7d: `${change7d.toFixed(2)}%`,
                change_30d: `${change30d.toFixed(2)}%`,
                market_cap_rank: data.market_cap_rank
            },
            method: 'Price momentum analysis (based on real CoinGecko data)',
            disclaimer: '⚠️ Aceasta NU este o recomandare financiară. Crypto e extrem de volatil. Nu investi mai mult decât îți permiți să pierzi.',
            source: '🟢 CoinGecko (live)'
        };
    } catch (e) {
        return { error: 'Cannot generate signals — CoinGecko unavailable', coin };
    }
}

async function getFearGreed() {
    try {
        const res = await fetch('https://api.alternative.me/fng/?limit=7');
        const data = await res.json();
        return {
            current: { value: data.data?.[0]?.value, classification: data.data?.[0]?.value_classification, timestamp: data.data?.[0]?.timestamp },
            history: data.data?.map(d => ({ date: new Date(d.timestamp * 1000).toLocaleDateString(), value: d.value, class: d.value_classification })),
            interpretation: parseInt(data.data?.[0]?.value) > 75 ? '🔴 Extreme Greed — risc de corecție' : parseInt(data.data?.[0]?.value) > 55 ? '🟡 Greed — atenție' : parseInt(data.data?.[0]?.value) > 45 ? '🟢 Neutral' : parseInt(data.data?.[0]?.value) > 25 ? '🟡 Fear — oportunitate posibilă' : '🟢 Extreme Fear — posibil moment bun de cumpărat',
            source: '🟢 Alternative.me (live)'
        };
    } catch (e) { return { error: 'Fear & Greed index unavailable', source: '❌ Alternative.me unreachable' }; }
}
