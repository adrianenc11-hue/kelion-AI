// ═══ TRADING BOT ENGINE — Core brain: indicators + AI + auto-decisions ═══
// Evaluates market, generates signals, decides & executes trades autonomously
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

const ALPACA_DATA = 'https://data.alpaca.markets';
const ALPACA_TRADE = () => process.env.ALPACA_PAPER === 'true' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';

let _db = null;
function getDB() {
    if (_db) return _db;
    const u = process.env.SUPABASE_URL, k = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!u || !k) return null;
    _db = createClient(u, k);
    return _db;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const KEY = process.env.ALPACA_API_KEY;
        const SECRET = process.env.ALPACA_SECRET_KEY;
        if (!KEY || !SECRET) return respond(503, { error: 'ALPACA_API_KEY not configured' });

        const db = getDB();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'evaluate': return respond(200, await evaluateMarket(KEY, SECRET, db, body));
            case 'execute_cycle': return respond(200, await executeCycle(KEY, SECRET, db));
            case 'status': return respond(200, await botStatus(KEY, SECRET, db));
            case 'trailing_check': return respond(200, await trailingStopCheck(KEY, SECRET, db));
            case 'analyze_symbol': return respond(200, await analyzeSymbol(KEY, SECRET, db, body.symbol || 'AAPL'));
            case 'auto_learn': return respond(200, await autoLearn(db, KEY, SECRET));
            case 'load_memories': return respond(200, await loadAllMemories(db));
            case 'circuit_breaker': return respond(200, await circuitBreakerCheck(db));
            case 'paper_live_check': return respond(200, await paperToLiveCheck(db));
            case 'dynamic_watchlist': return respond(200, await dynamicWatchlistScan(KEY, SECRET, (await loadConfig(db)).watchlist?.symbols || ['AAPL', 'MSFT', 'NVDA']));
            case 'weekly_report': return respond(200, await generateWeeklyReport(db, KEY, SECRET));
            default: return respond(400, { error: 'Actions: evaluate, execute_cycle, status, trailing_check, analyze_symbol, auto_learn, load_memories, circuit_breaker, paper_live_check, dynamic_watchlist, weekly_report' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

// ═══════════════════════════════════════════════════
// FULL EXECUTION CYCLE — Called by scheduler
// ═══════════════════════════════════════════════════
async function executeCycle(key, secret, db) {
    const runStart = Date.now();
    let runId = null;

    // Log run start
    if (db) {
        const { data } = await db.from('bot_runs').insert({ status: 'running', market_status: await getMarketStatus(key, secret) }).select().single();
        if (data) runId = data.id;
    }

    try {
        // Check if bot is enabled
        const config = await loadConfig(db);
        if (!config.bot_enabled?.enabled) {
            if (db && runId) await db.from('bot_runs').update({ status: 'skipped', summary: 'Bot disabled', finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart }).eq('id', runId);
            return { status: 'skipped', reason: 'Bot is disabled' };
        }

        // Check market hours
        const mktStatus = await getMarketStatus(key, secret);
        if (config.schedule?.market_hours_only && mktStatus !== 'open') {
            if (db && runId) await db.from('bot_runs').update({ status: 'skipped', summary: `Market ${mktStatus}`, market_status: mktStatus, finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart }).eq('id', runId);
            return { status: 'skipped', reason: `Market is ${mktStatus}` };
        }

        // Circuit breaker — stop if daily loss exceeds limit
        const cbCheck = await circuitBreakerCheck(db);
        if (!cbCheck.safe) {
            if (db && runId) await db.from('bot_runs').update({ status: 'skipped', summary: cbCheck.reason, finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart }).eq('id', runId);
            return { status: 'circuit_breaker', reason: cbCheck.reason, daily_pnl: cbCheck.daily_pnl };
        }

        // Dynamic watchlist — merge config + top movers
        const baseSymbols = config.watchlist?.symbols || ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'];
        const dynamicList = await dynamicWatchlistScan(key, secret, baseSymbols);
        const symbols = dynamicList.symbols;
        const riskSettings = config.risk_settings || {};
        const weights = config.weights || { rsi: 15, macd: 15, ema: 12, bollinger: 10, volume: 8, ai: 15, candle: 12, regime: 8, vwap_obv: 5 };

        // Load learned weight adjustments
        const adjustedWeights = await getAdjustedWeights(db, weights);

        // Get account info
        const account = await alpacaFetch('/v2/account', key, secret);
        const buyingPower = parseFloat(account.buying_power || 0);
        const portfolioValue = parseFloat(account.portfolio_value || 0);

        // Evaluate each symbol
        const results = [];
        let tradesExecuted = 0;
        let signalsGenerated = 0;

        for (const symbol of symbols) {
            try {
                const analysis = await analyzeSymbol(key, secret, db, symbol, adjustedWeights);
                signalsGenerated++;

                // Log signal
                if (db) {
                    await db.from('bot_signals').insert({
                        symbol, signal_type: analysis.decision, source: 'combined',
                        confidence: analysis.confidence, data: analysis,
                        price_at_signal: analysis.price, acted_on: false
                    });
                }

                // Decision gate
                const minConfidence = riskSettings.min_confidence || 65;
                const maxDailyTrades = riskSettings.max_daily_trades || 10;

                if (analysis.confidence >= minConfidence && tradesExecuted < maxDailyTrades) {
                    if (analysis.decision === 'BUY') {
                        // Per-symbol protection checks
                        const [earnCheck, corrCheck, gapCheck] = await Promise.all([
                            earningsCheck(symbol),
                            correlationCheck(key, secret, symbol),
                            preMarketGapCheck(key, secret, symbol)
                        ]);
                        if (!earnCheck.safe) { results.push({ symbol, action: 'SKIP', reason: earnCheck.reason }); continue; }
                        if (!corrCheck.safe) { results.push({ symbol, action: 'SKIP', reason: corrCheck.reason }); continue; }
                        if (!gapCheck.safe) { results.push({ symbol, action: 'SKIP', reason: gapCheck.reason }); continue; }

                        // Kelly criterion position sizing
                        const maxPositionValue = await getKellySize(db, portfolioValue, riskSettings.max_position_pct || 5);
                        const qty = Math.floor(maxPositionValue / analysis.price);
                        if (qty > 0 && buyingPower >= qty * analysis.price) {
                            const order = await executeTrade(key, secret, db, {
                                symbol, side: 'buy', qty, price: analysis.price,
                                strategy: analysis.top_strategy, confidence: analysis.confidence,
                                classic_signals: analysis.classic, ai_signals: analysis.ai,
                                stop_loss_pct: riskSettings.stop_loss_pct || 5,
                                take_profit_pct: riskSettings.take_profit_pct || 10
                            });
                            results.push({ symbol, action: 'BUY', qty, ...order });
                            tradesExecuted++;
                        }
                    } else if (analysis.decision === 'SELL') {
                        // Check if we have this position
                        const positions = await alpacaFetch('/v2/positions', key, secret);
                        const pos = (Array.isArray(positions) ? positions : []).find(p => p.symbol === symbol);
                        if (pos) {
                            const order = await executeTrade(key, secret, db, {
                                symbol, side: 'sell', qty: parseInt(pos.qty),
                                price: analysis.price, strategy: analysis.top_strategy,
                                confidence: analysis.confidence,
                                classic_signals: analysis.classic, ai_signals: analysis.ai
                            });
                            results.push({ symbol, action: 'SELL', qty: pos.qty, ...order });
                            tradesExecuted++;
                        }
                    } else {
                        results.push({ symbol, action: 'HOLD', confidence: analysis.confidence, reason: analysis.summary });
                    }
                } else {
                    results.push({ symbol, action: 'SKIP', confidence: analysis.confidence, reason: analysis.confidence < minConfidence ? 'Low confidence' : 'Max daily trades reached' });
                }
            } catch (err) {
                results.push({ symbol, action: 'ERROR', error: err.message });
            }
        }

        // Trailing stop check
        await trailingStopCheck(key, secret, db);

        // Complete run log
        const summary = `Checked ${symbols.length} symbols, ${signalsGenerated} signals, ${tradesExecuted} trades`;
        if (db && runId) {
            await db.from('bot_runs').update({
                status: 'completed', symbols_checked: symbols.length,
                signals_generated: signalsGenerated, trades_executed: tradesExecuted,
                summary, finished_at: new Date().toISOString(),
                duration_ms: Date.now() - runStart
            }).eq('id', runId);
        }

        return { status: 'completed', results, summary, duration_ms: Date.now() - runStart };

    } catch (err) {
        if (db && runId) await db.from('bot_runs').update({ status: 'error', errors: [{ message: err.message }], finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart }).eq('id', runId);
        throw err;
    }
}

// ═══════════════════════════════════════════════════
// ANALYZE SYMBOL — Full technical + AI analysis
// ═══════════════════════════════════════════════════
async function analyzeSymbol(key, secret, db, symbol, weights) {
    if (!weights) weights = { rsi: 15, macd: 15, ema: 12, bollinger: 10, volume: 8, ai: 15, candle: 12, regime: 8, vwap_obv: 5 };

    // Fetch 60 days of daily bars
    const bars = await fetchBars(symbol, '1Day', 60, key, secret);
    if (!bars || bars.length < 20) return { symbol, decision: 'HOLD', confidence: 0, reason: 'Insufficient data' };

    const closes = bars.map(b => b.c);
    const opens = bars.map(b => b.o);
    const volumes = bars.map(b => b.v);
    const highs = bars.map(b => b.h);
    const lows = bars.map(b => b.l);
    const currentPrice = closes[closes.length - 1];

    // ═══ CLASSIC INDICATORS ═══
    const rsi = calcRSI(closes, 14);
    const macd = calcMACD(closes);
    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const ema50 = calcEMA(closes, 50);
    const bollinger = calcBollinger(closes, 20, 2);
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / avgVolume;
    const atr = calcATR(highs, lows, closes, 14);

    // ═══ SIGNALS ═══
    const signals = {};
    let totalScore = 0;
    let totalWeight = 0;

    // RSI Signal
    const rsiSignal = rsi < 30 ? 'BUY' : rsi > 70 ? 'SELL' : 'HOLD';
    const rsiStrength = rsi < 20 ? 90 : rsi < 30 ? 70 : rsi > 80 ? 90 : rsi > 70 ? 70 : 50;
    signals.rsi = { value: rsi.toFixed(1), signal: rsiSignal, strength: rsiStrength };
    totalScore += (rsiSignal === 'BUY' ? rsiStrength : rsiSignal === 'SELL' ? -rsiStrength : 0) * (weights.rsi / 100);
    totalWeight += weights.rsi;

    // MACD Signal
    const macdSignal = macd.histogram > 0 && macd.histogram > macd.prevHistogram ? 'BUY' :
        macd.histogram < 0 && macd.histogram < macd.prevHistogram ? 'SELL' : 'HOLD';
    const macdStrength = Math.min(90, Math.abs(macd.histogram) * 100 + 50);
    signals.macd = { value: macd.histogram.toFixed(4), signal: macdSignal, strength: macdStrength, line: macd.macdLine.toFixed(4), signalLine: macd.signalLine.toFixed(4) };
    totalScore += (macdSignal === 'BUY' ? macdStrength : macdSignal === 'SELL' ? -macdStrength : 0) * (weights.macd / 100);
    totalWeight += weights.macd;

    // EMA Crossover Signal
    const emaSignal = ema9[ema9.length - 1] > ema21[ema21.length - 1] && ema21[ema21.length - 1] > ema50[ema50.length - 1] ? 'BUY' :
        ema9[ema9.length - 1] < ema21[ema21.length - 1] && ema21[ema21.length - 1] < ema50[ema50.length - 1] ? 'SELL' : 'HOLD';
    const emaStrength = Math.min(85, Math.abs(ema9[ema9.length - 1] - ema21[ema21.length - 1]) / currentPrice * 10000 + 40);
    signals.ema = { signal: emaSignal, strength: emaStrength, ema9: ema9[ema9.length - 1].toFixed(2), ema21: ema21[ema21.length - 1].toFixed(2), ema50: ema50[ema50.length - 1].toFixed(2) };
    totalScore += (emaSignal === 'BUY' ? emaStrength : emaSignal === 'SELL' ? -emaStrength : 0) * (weights.ema / 100);
    totalWeight += weights.ema;

    // Bollinger Band Signal
    const bbSignal = currentPrice <= bollinger.lower ? 'BUY' : currentPrice >= bollinger.upper ? 'SELL' : 'HOLD';
    const bbWidth = (bollinger.upper - bollinger.lower) / bollinger.middle;
    const bbStrength = currentPrice <= bollinger.lower ? Math.min(85, 50 + (bollinger.lower - currentPrice) / atr * 30) :
        currentPrice >= bollinger.upper ? Math.min(85, 50 + (currentPrice - bollinger.upper) / atr * 30) : 40;
    signals.bollinger = { signal: bbSignal, strength: bbStrength, upper: bollinger.upper.toFixed(2), middle: bollinger.middle.toFixed(2), lower: bollinger.lower.toFixed(2), width: bbWidth.toFixed(4) };
    totalScore += (bbSignal === 'BUY' ? bbStrength : bbSignal === 'SELL' ? -bbStrength : 0) * (weights.bollinger / 100);
    totalWeight += weights.bollinger;

    // Volume Signal
    const volSignal = volumeRatio > 1.5 ? (closes[closes.length - 1] > closes[closes.length - 2] ? 'BUY' : 'SELL') : 'HOLD';
    const volStrength = Math.min(80, volumeRatio * 30 + 20);
    signals.volume = { signal: volSignal, strength: volStrength, ratio: volumeRatio.toFixed(2), current: currentVolume, avg20: Math.round(avgVolume) };
    totalScore += (volSignal === 'BUY' ? volStrength : volSignal === 'SELL' ? -volStrength : 0) * (weights.volume / 100);
    totalWeight += weights.volume;

    // ═══ CANDLESTICK PATTERNS ═══
    const candleResult = detectCandlePatterns(opens, highs, lows, closes);
    signals.candle = { signal: candleResult.signal, strength: candleResult.strength, patterns: candleResult.patterns.map(p => p.name) };
    totalScore += (candleResult.signal === 'BUY' ? candleResult.strength : candleResult.signal === 'SELL' ? -candleResult.strength : 0) * ((weights.candle || 12) / 100);
    totalWeight += (weights.candle || 12);

    // ═══ MARKET REGIME ═══
    const regime = detectMarketRegime(closes, atr, volumes);
    const regimeSignal = regime.regime === 'trending' ? (regime.direction === 'up' ? 'BUY' : 'SELL') : 'HOLD';
    const regimeStrength = regime.confidence;
    signals.regime = { signal: regimeSignal, strength: regimeStrength, ...regime };
    totalScore += (regimeSignal === 'BUY' ? regimeStrength : regimeSignal === 'SELL' ? -regimeStrength : 0) * ((weights.regime || 8) / 100);
    totalWeight += (weights.regime || 8);

    // ═══ VWAP + OBV ═══
    const vwap = calcVWAP(highs, lows, closes, volumes);
    const obv = calcOBV(closes, volumes);
    const vwapSignal = currentPrice > vwap && obv.trend === 'rising' ? 'BUY' : currentPrice < vwap && obv.trend === 'falling' ? 'SELL' : 'HOLD';
    const vwapStrength = Math.min(80, 50 + Math.abs(currentPrice - vwap) / atr * 15);
    signals.vwap_obv = { signal: vwapSignal, strength: vwapStrength, vwap: vwap.toFixed(2), obv_trend: obv.trend, price_vs_vwap: currentPrice > vwap ? 'above' : 'below' };
    totalScore += (vwapSignal === 'BUY' ? vwapStrength : vwapSignal === 'SELL' ? -vwapStrength : 0) * ((weights.vwap_obv || 5) / 100);
    totalWeight += (weights.vwap_obv || 5);

    // ═══ AI ANALYSIS ═══
    let aiResult = { signal: 'HOLD', strength: 50, reasoning: 'AI analysis not available' };
    try {
        const aiPrompt = `You are a quantitative trading analyst. Analyze this stock data and give a trading signal.

Symbol: ${symbol} | Price: $${currentPrice}
RSI(14): ${rsi.toFixed(1)} | MACD Histogram: ${macd.histogram.toFixed(4)}
EMA9: $${ema9[ema9.length - 1].toFixed(2)} | EMA21: $${ema21[ema21.length - 1].toFixed(2)} | EMA50: $${ema50[ema50.length - 1].toFixed(2)}
Bollinger: Lower=$${bollinger.lower.toFixed(2)} Mid=$${bollinger.middle.toFixed(2)} Upper=$${bollinger.upper.toFixed(2)}
Volume ratio (vs 20d avg): ${volumeRatio.toFixed(2)}x
ATR(14): $${atr.toFixed(2)}
Last 5 closes: ${closes.slice(-5).map(c => '$' + c.toFixed(2)).join(', ')}

Classic signals: RSI=${rsiSignal}, MACD=${macdSignal}, EMA=${emaSignal}, Bollinger=${bbSignal}, Volume=${volSignal}

Respond ONLY in this exact JSON format, nothing else:
{"signal": "BUY" or "SELL" or "HOLD", "confidence": 0-100, "reasoning": "brief explanation", "risk_level": "low" or "medium" or "high", "target_price": number, "stop_loss": number}`;

        const URL = process.env.URL || 'https://kelionai.app';
        const aiRes = await fetch(`${URL}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: aiPrompt, mode: 'cascade' })
        });

        if (aiRes.ok) {
            const aiData = await aiRes.json();
            const aiText = aiData.reply || '';
            // Extract JSON from AI response
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                aiResult = {
                    signal: parsed.signal || 'HOLD',
                    strength: parsed.confidence || 50,
                    reasoning: parsed.reasoning || '',
                    risk_level: parsed.risk_level || 'medium',
                    target_price: parsed.target_price,
                    stop_loss: parsed.stop_loss
                };
            }
        }
    } catch (aiErr) {
        aiResult.reasoning = `AI error: ${aiErr.message}`;
    }

    signals.ai = aiResult;
    totalScore += (aiResult.signal === 'BUY' ? aiResult.strength : aiResult.signal === 'SELL' ? -aiResult.strength : 0) * (weights.ai / 100);
    totalWeight += weights.ai;

    // ═══ COMBINED DECISION ═══
    const normalizedScore = totalWeight > 0 ? totalScore / (totalWeight / 100) : 0;
    let confidence = Math.abs(normalizedScore);
    const decision = normalizedScore > 10 ? 'BUY' : normalizedScore < -10 ? 'SELL' : 'HOLD';

    // Multi-Timeframe confirmation
    let mtfDetail = 'skipped';
    if (decision !== 'HOLD') {
        try {
            const mtf = await multiTimeframeConfirm(key, secret, symbol, decision);
            confidence = Math.max(0, Math.min(100, confidence + mtf.adjustment));
            mtfDetail = mtf.detail;
        } catch (e) { mtfDetail = 'error: ' + e.message; }
    }

    // Regime-based confidence adjustment
    if (regime.regime === 'volatile') confidence = Math.max(0, confidence - 10);

    // Find dominant strategy
    const signalKeys = Object.keys(signals);
    const topStrategy = signalKeys.reduce((best, k) => signals[k].strength > (signals[best]?.strength || 0) && signals[k].signal === decision ? k : best, signalKeys[0]);

    const summary = `${symbol} $${currentPrice} → ${decision} (${confidence.toFixed(0)}% conf) | RSI:${rsiSignal} MACD:${macdSignal} EMA:${emaSignal} BB:${bbSignal} Vol:${volSignal} AI:${aiResult.signal} Candle:${candleResult.signal} Regime:${regime.regime} VWAP:${vwapSignal} MTF:${mtfDetail}`;

    return {
        symbol, price: currentPrice, decision, confidence,
        score: normalizedScore.toFixed(1), top_strategy: topStrategy,
        summary, classic: signals, ai: aiResult, regime: regime.regime,
        candle_patterns: candleResult.patterns.map(p => p.name),
        mtf: mtfDetail,
        atr: atr.toFixed(2), volume_ratio: volumeRatio.toFixed(2),
        weights_used: weights
    };
}

// ═══ EVALUATE MARKET — Analyze without executing ═══
async function evaluateMarket(key, secret, db, body) {
    const config = await loadConfig(db);
    const symbols = body.symbols || config.watchlist?.symbols || ['AAPL', 'MSFT', 'NVDA'];
    const weights = await getAdjustedWeights(db, config.weights);

    const results = [];
    for (const symbol of symbols.slice(0, 10)) {
        try {
            results.push(await analyzeSymbol(key, secret, db, symbol, weights));
        } catch (err) {
            results.push({ symbol, error: err.message });
        }
    }

    return {
        evaluated: results.length,
        results,
        weights_used: weights,
        timestamp: new Date().toISOString()
    };
}

// ═══ EXECUTE TRADE — Place order + log ═══
async function executeTrade(key, secret, db, { symbol, side, qty, price, strategy, confidence, classic_signals, ai_signals, stop_loss_pct, take_profit_pct }) {
    // Place main order
    const orderData = { symbol, qty: String(qty), side, type: 'market', time_in_force: 'day' };
    const order = await alpacaFetch('/v2/orders', key, secret, 'POST', orderData);

    // Place stop-loss if buying
    if (side === 'buy' && stop_loss_pct) {
        const stopPrice = (price * (1 - stop_loss_pct / 100)).toFixed(2);
        try {
            await alpacaFetch('/v2/orders', key, secret, 'POST', {
                symbol, qty: String(qty), side: 'sell', type: 'stop',
                stop_price: stopPrice, time_in_force: 'gtc'
            });
        } catch (e) { /* Stop-loss optional */ }
    }

    // Log trade
    if (db) {
        await db.from('bot_trade_log').insert({
            symbol, side, qty, entry_price: price, order_id: order.id,
            strategy, confidence, classic_signals: classic_signals || {},
            ai_signals: ai_signals || {}, status: 'open',
            market_conditions: { stop_loss_pct, take_profit_pct }
        });
    }

    return { order_id: order.id, status: order.status, message: `${side.toUpperCase()} ${qty}x ${symbol} @ ~$${price}` };
}

// ═══ TRAILING STOP — Adjust stops for open positions ═══
async function trailingStopCheck(key, secret, db) {
    const config = await loadConfig(db);
    const trailingPct = config.risk_settings?.trailing_stop_pct || 3;

    const positions = await alpacaFetch('/v2/positions', key, secret);
    if (!Array.isArray(positions) || !positions.length) return { message: 'No open positions', adjustments: [] };

    const adjustments = [];
    const orders = await alpacaFetch('/v2/orders?status=open', key, secret);
    const stopOrders = (Array.isArray(orders) ? orders : []).filter(o => o.type === 'stop' && o.side === 'sell');

    for (const pos of positions) {
        const currentPrice = parseFloat(pos.current_price);
        const entryPrice = parseFloat(pos.avg_entry_price);
        const unrealizedPnlPct = parseFloat(pos.unrealized_plpct || 0) * 100;

        // Calculate ideal stop
        const idealStop = currentPrice * (1 - trailingPct / 100);

        // Find existing stop for this symbol
        const existingStop = stopOrders.find(o => o.symbol === pos.symbol);
        const existingStopPrice = existingStop ? parseFloat(existingStop.stop_price) : entryPrice * 0.95;

        // Only move stop UP, never down
        if (idealStop > existingStopPrice) {
            // Cancel old stop
            if (existingStop) {
                try { await alpacaFetch(`/v2/orders/${existingStop.id}`, key, secret, 'DELETE'); } catch (e) { /* ok */ }
            }
            // Place new stop
            try {
                await alpacaFetch('/v2/orders', key, secret, 'POST', {
                    symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'stop',
                    stop_price: idealStop.toFixed(2), time_in_force: 'gtc'
                });
                adjustments.push({ symbol: pos.symbol, old_stop: existingStopPrice.toFixed(2), new_stop: idealStop.toFixed(2), pnl_pct: unrealizedPnlPct.toFixed(1) + '%' });
            } catch (e) {
                adjustments.push({ symbol: pos.symbol, error: e.message });
            }
        }

        // Check take profit
        const takeProfitPct = config.risk_settings?.take_profit_pct || 10;
        if (unrealizedPnlPct >= takeProfitPct) {
            try {
                await alpacaFetch('/v2/orders', key, secret, 'POST', {
                    symbol: pos.symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day'
                });
                adjustments.push({ symbol: pos.symbol, action: 'TAKE_PROFIT', pnl_pct: unrealizedPnlPct.toFixed(1) + '%' });

                // Close trade in memory
                if (db) {
                    const { data: openTrade } = await db.from('bot_trade_log')
                        .select('id').eq('symbol', pos.symbol).eq('status', 'open')
                        .order('opened_at', { ascending: false }).limit(1).single();
                    if (openTrade) {
                        const pnl = (currentPrice - entryPrice) * parseInt(pos.qty);
                        await db.from('bot_trade_log').update({
                            exit_price: currentPrice, pnl, pnl_pct: unrealizedPnlPct,
                            status: 'closed', closed_at: new Date().toISOString(),
                            lesson_learned: 'Take profit target hit'
                        }).eq('id', openTrade.id);
                    }
                }
            } catch (e) {
                adjustments.push({ symbol: pos.symbol, action: 'TAKE_PROFIT_FAILED', error: e.message });
            }
        }
    }

    return { positions_checked: positions.length, adjustments };
}

// ═══ BOT STATUS ═══
async function botStatus(key, secret, db) {
    const config = await loadConfig(db);
    const account = await alpacaFetch('/v2/account', key, secret);
    const positions = await alpacaFetch('/v2/positions', key, secret);
    const mktStatus = await getMarketStatus(key, secret);

    let recentRuns = [];
    let todayTrades = 0;
    if (db) {
        const { data: runs } = await db.from('bot_runs').select('*').order('started_at', { ascending: false }).limit(5);
        recentRuns = runs || [];
        const today = new Date().toISOString().slice(0, 10);
        const { data: trades } = await db.from('bot_trade_log').select('id').gte('opened_at', today);
        todayTrades = trades?.length || 0;
    }

    return {
        bot_enabled: config.bot_enabled?.enabled || false,
        mode: config.bot_enabled?.mode || 'paper',
        market: mktStatus,
        account: {
            equity: `$${parseFloat(account.equity || 0).toLocaleString()}`,
            buying_power: `$${parseFloat(account.buying_power || 0).toLocaleString()}`,
            daily_pnl: `$${parseFloat(account.equity || 0) - parseFloat(account.last_equity || 0)}`
        },
        open_positions: (Array.isArray(positions) ? positions : []).length,
        today_trades: todayTrades,
        recent_runs: recentRuns.map(r => ({ status: r.status, trades: r.trades_executed, time: r.started_at, summary: r.summary })),
        watchlist: config.watchlist?.symbols || [],
        strategies: config.strategies || {},
        risk_settings: config.risk_settings || {}
    };
}

// ═══════════════════════════════════════════════════
// TECHNICAL INDICATORS (pure math, real data)
// ═══════════════════════════════════════════════════
function calcEMA(prices, period) {
    const k = 2 / (period + 1);
    const ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    return ema;
}

function calcRSI(prices, period = 14) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) gains += d; else losses -= d;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period + 1; i < prices.length; i++) {
        const d = prices[i] - prices[i - 1];
        avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
        avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    }
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calcMACD(prices) {
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calcEMA(macdLine.slice(26), 9);
    const macdIdx = macdLine.length - 1;
    const sigIdx = signalLine.length - 1;
    return {
        macdLine: macdLine[macdIdx],
        signalLine: signalLine[sigIdx],
        histogram: macdLine[macdIdx] - signalLine[sigIdx],
        prevHistogram: macdLine[macdIdx - 1] - signalLine[sigIdx - 1]
    };
}

function calcBollinger(prices, period = 20, mult = 2) {
    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
    return { upper: middle + mult * stdDev, middle, lower: middle - mult * stdDev };
}

function calcATR(highs, lows, closes, period = 14) {
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
        trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
    }
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) atr = (atr * (period - 1) + trs[i]) / period;
    return atr;
}

// ═══════════════════════════════════════════════════
// CANDLESTICK PATTERN RECOGNITION
// ═══════════════════════════════════════════════════
function detectCandlePatterns(opens, highs, lows, closes) {
    const patterns = [];
    const len = closes.length;
    if (len < 3) return { patterns, signal: 'HOLD', strength: 50 };

    const i = len - 1;
    const body = Math.abs(closes[i] - opens[i]);
    const upperWick = highs[i] - Math.max(opens[i], closes[i]);
    const lowerWick = Math.min(opens[i], closes[i]) - lows[i];
    const range = highs[i] - lows[i];
    const isBullish = closes[i] > opens[i];
    const prevBody = Math.abs(closes[i - 1] - opens[i - 1]);
    const prevBullish = closes[i - 1] > opens[i - 1];

    // Doji
    if (body < range * 0.1 && range > 0) patterns.push({ name: 'Doji', type: 'reversal', strength: 60 });
    // Hammer
    if (lowerWick > body * 2 && upperWick < body * 0.5 && body > 0)
        patterns.push({ name: 'Hammer', type: 'bullish', strength: 70 });
    // Shooting Star
    if (upperWick > body * 2 && lowerWick < body * 0.5 && body > 0)
        patterns.push({ name: 'Shooting Star', type: 'bearish', strength: 70 });
    // Bullish Engulfing
    if (isBullish && !prevBullish && opens[i] <= closes[i - 1] && closes[i] >= opens[i - 1] && body > prevBody)
        patterns.push({ name: 'Bullish Engulfing', type: 'bullish', strength: 75 });
    // Bearish Engulfing
    if (!isBullish && prevBullish && opens[i] >= closes[i - 1] && closes[i] <= opens[i - 1] && body > prevBody)
        patterns.push({ name: 'Bearish Engulfing', type: 'bearish', strength: 75 });
    // Three White Soldiers
    if (closes[i] > closes[i - 1] && closes[i - 1] > closes[i - 2] && closes[i] > opens[i] && closes[i - 1] > opens[i - 1] && closes[i - 2] > opens[i - 2])
        patterns.push({ name: 'Three White Soldiers', type: 'bullish', strength: 80 });
    // Three Black Crows
    if (closes[i] < closes[i - 1] && closes[i - 1] < closes[i - 2] && closes[i] < opens[i] && closes[i - 1] < opens[i - 1] && closes[i - 2] < opens[i - 2])
        patterns.push({ name: 'Three Black Crows', type: 'bearish', strength: 80 });
    // Morning Star
    if (!prevBullish && body > prevBody * 2 && isBullish && Math.abs(closes[i - 1] - opens[i - 1]) < range * 0.3)
        patterns.push({ name: 'Morning Star', type: 'bullish', strength: 78 });
    // Evening Star
    if (prevBullish && body > prevBody * 2 && !isBullish && Math.abs(closes[i - 1] - opens[i - 1]) < range * 0.3)
        patterns.push({ name: 'Evening Star', type: 'bearish', strength: 78 });

    let bullishScore = 0, bearishScore = 0;
    patterns.forEach(p => { if (p.type === 'bullish') bullishScore += p.strength; else if (p.type === 'bearish') bearishScore += p.strength; });
    const signal = bullishScore > bearishScore + 20 ? 'BUY' : bearishScore > bullishScore + 20 ? 'SELL' : 'HOLD';
    return { patterns, signal, strength: Math.min(90, Math.max(bullishScore, bearishScore)) || 50 };
}

// ═══════════════════════════════════════════════════
// VWAP + OBV — Institutional volume indicators
// ═══════════════════════════════════════════════════
function calcVWAP(highs, lows, closes, volumes) {
    let cumVolPrice = 0, cumVol = 0;
    for (let i = 0; i < closes.length; i++) {
        const tp = (highs[i] + lows[i] + closes[i]) / 3;
        cumVolPrice += tp * volumes[i];
        cumVol += volumes[i];
    }
    return cumVol > 0 ? cumVolPrice / cumVol : closes[closes.length - 1];
}

function calcOBV(closes, volumes) {
    const obv = [0];
    for (let i = 1; i < closes.length; i++) {
        if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i]);
        else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i]);
        else obv.push(obv[i - 1]);
    }
    const recent = obv.slice(-5);
    const older = obv.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    return { value: obv[obv.length - 1], trend: recentAvg > olderAvg ? 'rising' : 'falling' };
}

// ═══════════════════════════════════════════════════
// MARKET REGIME DETECTION — trending/ranging/volatile
// ═══════════════════════════════════════════════════
function detectMarketRegime(closes, atr, volumes) {
    const len = closes.length;
    if (len < 20) return { regime: 'unknown', confidence: 0 };

    const ema9 = calcEMA(closes, 9);
    const ema21 = calcEMA(closes, 21);
    const emaAligned = (ema9[len - 1] > ema21[len - 1] && ema9[len - 2] > ema21[len - 2] && ema9[len - 3] > ema21[len - 3]) ||
        (ema9[len - 1] < ema21[len - 1] && ema9[len - 2] < ema21[len - 2] && ema9[len - 3] < ema21[len - 3]);

    // Volatility spike check
    const recentChanges = [];
    for (let i = Math.max(1, len - 14); i < len; i++) recentChanges.push(Math.abs(closes[i] - closes[i - 1]));
    const avgChange = recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length;
    const currentChange = recentChanges[recentChanges.length - 1];
    const volRatio = currentChange / (avgChange || 1);

    const bb = calcBollinger(closes, 20, 2);
    const bbWidth = (bb.upper - bb.lower) / bb.middle;

    if (volRatio > 2) return { regime: 'volatile', confidence: 80, atr_ratio: volRatio.toFixed(2), action: 'widen_stops_reduce_size' };
    if (emaAligned && bbWidth > 0.05) return { regime: 'trending', confidence: 75, direction: ema9[len - 1] > ema21[len - 1] ? 'up' : 'down', action: 'use_trend_following' };
    return { regime: 'ranging', confidence: 70, bb_width: bbWidth.toFixed(4), action: 'use_mean_reversion' };
}

// ═══════════════════════════════════════════════════
// MULTI-TIMEFRAME CONFIRMATION
// ═══════════════════════════════════════════════════
async function multiTimeframeConfirm(key, secret, symbol, dailySignal) {
    let agreement = 0, total = 0;

    try {
        const h1Bars = await fetchBars(symbol, '1Hour', 30, key, secret);
        if (h1Bars && h1Bars.length >= 14) {
            const h1Rsi = calcRSI(h1Bars.map(b => b.c), 14);
            const h1Signal = h1Rsi < 35 ? 'BUY' : h1Rsi > 65 ? 'SELL' : 'HOLD';
            total++;
            if (h1Signal === dailySignal) agreement++;
        }
    } catch (e) { /* skip */ }

    try {
        const wkBars = await fetchBars(symbol, '1Week', 20, key, secret);
        if (wkBars && wkBars.length >= 14) {
            const wkCloses = wkBars.map(b => b.c);
            const wkRsi = calcRSI(wkCloses, 14);
            const wkEma9 = calcEMA(wkCloses, 9);
            const wkEma21 = calcEMA(wkCloses, 21);
            const wkSignal = wkRsi < 40 && wkEma9[wkEma9.length - 1] > wkEma21[wkEma21.length - 1] ? 'BUY' :
                wkRsi > 60 && wkEma9[wkEma9.length - 1] < wkEma21[wkEma21.length - 1] ? 'SELL' : 'HOLD';
            total++;
            if (wkSignal === dailySignal) agreement++;
        }
    } catch (e) { /* skip */ }

    if (total === 0) return { adjustment: 0, detail: 'No MTF data' };
    const ratio = agreement / total;
    return { adjustment: ratio >= 0.8 ? 15 : ratio >= 0.5 ? 0 : -10, agreement, total, detail: `${agreement}/${total} TFs agree` };
}

// ═══════════════════════════════════════════════════
// KELLY CRITERION POSITION SIZING
// ═══════════════════════════════════════════════════
function kellyPositionSize(winRate, avgWin, avgLoss, portfolioValue, maxPct) {
    if (avgLoss === 0 || winRate <= 0) return portfolioValue * (maxPct / 100) * 0.5;
    const w = winRate / 100;
    const r = Math.abs(avgWin / avgLoss);
    const kelly = w - (1 - w) / r;
    const halfKelly = Math.max(0.01, Math.min(maxPct / 100, kelly / 2));
    return portfolioValue * halfKelly;
}

async function getKellySize(db, portfolioValue, maxPct) {
    if (!db) return portfolioValue * (maxPct / 100);
    try {
        const { data: patterns } = await db.from('bot_patterns')
            .select('win_rate, avg_profit_pct, avg_loss_pct')
            .eq('pattern_type', 'strategy_performance').limit(20);
        if (!patterns || patterns.length < 3) return portfolioValue * (maxPct / 100);
        const avgWinRate = patterns.reduce((s, p) => s + (p.win_rate || 50), 0) / patterns.length;
        const avgWin = patterns.reduce((s, p) => s + Math.abs(p.avg_profit_pct || 1), 0) / patterns.length;
        const avgLoss = patterns.reduce((s, p) => s + Math.abs(p.avg_loss_pct || 1), 0) / patterns.length;
        return kellyPositionSize(avgWinRate, avgWin, avgLoss, portfolioValue, maxPct);
    } catch (e) { return portfolioValue * (maxPct / 100); }
}

// ═══════════════════════════════════════════════════
// CIRCUIT BREAKER — Stop trading if daily loss exceeds limit
// ═══════════════════════════════════════════════════
async function circuitBreakerCheck(db) {
    if (!db) return { safe: true, reason: 'No DB' };
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayTrades } = await db.from('bot_trade_log')
        .select('pnl').gte('opened_at', today).not('pnl', 'is', null);
    const dailyPnL = (todayTrades || []).reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const maxDailyLoss = -500;
    if (dailyPnL < maxDailyLoss) {
        return { safe: false, daily_pnl: dailyPnL, reason: `Daily loss $${dailyPnL.toFixed(2)} exceeds limit $${maxDailyLoss}` };
    }
    return { safe: true, daily_pnl: dailyPnL };
}

// ═══════════════════════════════════════════════════
// EARNINGS CALENDAR SKIP — Don't trade near earnings
// ═══════════════════════════════════════════════════
async function earningsCheck(symbol) {
    try {
        const finnhubKey = process.env.FINNHUB_API_KEY;
        if (!finnhubKey) return { safe: true, reason: 'No Finnhub key' };
        const now = new Date();
        const future = new Date(now.getTime() + 48 * 3600000);
        const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${now.toISOString().slice(0, 10)}&to=${future.toISOString().slice(0, 10)}&symbol=${symbol}&token=${finnhubKey}`);
        if (!res.ok) return { safe: true, reason: 'Finnhub API error' };
        const data = await res.json();
        const hasEarnings = (data.earningsCalendar || []).some(e => e.symbol === symbol);
        return { safe: !hasEarnings, reason: hasEarnings ? `${symbol} earnings within 48h` : 'No earnings soon' };
    } catch (e) { return { safe: true, reason: 'Earnings check error' }; }
}

// ═══════════════════════════════════════════════════
// CORRELATION PROTECTION — Max 3 positions per sector
// ═══════════════════════════════════════════════════
async function correlationCheck(key, secret, symbol) {
    const sectorMap = {
        'AAPL': 'tech', 'MSFT': 'tech', 'GOOGL': 'tech', 'AMZN': 'tech', 'NVDA': 'tech', 'META': 'tech', 'TSLA': 'tech',
        'JPM': 'finance', 'BAC': 'finance', 'GS': 'finance', 'V': 'finance', 'MA': 'finance',
        'JNJ': 'health', 'UNH': 'health', 'PFE': 'health', 'ABBV': 'health',
        'XOM': 'energy', 'CVX': 'energy', 'COP': 'energy',
        'PG': 'consumer', 'KO': 'consumer', 'PEP': 'consumer', 'WMT': 'consumer'
    };
    const sector = sectorMap[symbol] || 'other';
    try {
        const positions = await alpacaFetch('/v2/positions', key, secret);
        const posArray = Array.isArray(positions) ? positions : [];
        const sectorCount = posArray.filter(p => (sectorMap[p.symbol] || 'other') === sector).length;
        if (sectorCount >= 3) return { safe: false, sector, count: sectorCount, reason: `Already ${sectorCount} positions in ${sector} sector` };
        return { safe: true, sector, count: sectorCount };
    } catch (e) { return { safe: true, reason: 'Position check error' }; }
}

// ═══════════════════════════════════════════════════
// PRE-MARKET GAP CHECK — Avoid >3% gaps
// ═══════════════════════════════════════════════════
async function preMarketGapCheck(key, secret, symbol) {
    try {
        const dailyBars = await fetchBars(symbol, '1Day', 2, key, secret);
        if (!dailyBars || dailyBars.length < 2) return { safe: true, reason: 'Insufficient data' };
        const prevClose = dailyBars[dailyBars.length - 2].c;
        const todayOpen = dailyBars[dailyBars.length - 1].o;
        const gapPct = ((todayOpen - prevClose) / prevClose) * 100;
        if (Math.abs(gapPct) > 3) return { safe: false, gap_pct: gapPct.toFixed(2), reason: `${symbol} gapped ${gapPct.toFixed(1)}%` };
        return { safe: true, gap_pct: gapPct.toFixed(2) };
    } catch (e) { return { safe: true, reason: 'Gap check error' }; }
}

// ═══════════════════════════════════════════════════
// DYNAMIC WATCHLIST — Config + top movers
// ═══════════════════════════════════════════════════
async function dynamicWatchlistScan(key, secret, existingWatchlist) {
    try {
        const res = await fetch(`${ALPACA_DATA}/v1beta1/screener/stocks/most-actives?by=volume&top=20`, {
            headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }
        });
        if (!res.ok) return { symbols: existingWatchlist, source: 'fallback' };
        const data = await res.json();
        const topMovers = (data.most_actives || [])
            .filter(s => s.trade_count > 1000 && s.price > 10 && s.price < 500)
            .map(s => s.symbol).slice(0, 10);
        const combined = [...new Set([...existingWatchlist, ...topMovers])].slice(0, 15);
        return { symbols: combined, new_additions: topMovers.filter(s => !existingWatchlist.includes(s)), source: 'dynamic' };
    } catch (e) { return { symbols: existingWatchlist, source: 'fallback', error: e.message }; }
}

// ═══════════════════════════════════════════════════
// PAPER → LIVE AUTO-GRADUATE
// ═══════════════════════════════════════════════════
async function paperToLiveCheck(db) {
    if (!db) return { ready: false, reason: 'No DB' };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: trades } = await db.from('bot_trade_log')
        .select('pnl, opened_at').gte('opened_at', thirtyDaysAgo).not('pnl', 'is', null);
    if (!trades || trades.length < 20) return { ready: false, reason: `Need 20+ trades, have ${trades?.length || 0}` };
    const wins = trades.filter(t => parseFloat(t.pnl || 0) > 0).length;
    const winRate = (wins / trades.length) * 100;
    const totalPnL = trades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const byDay = {};
    trades.forEach(t => { const d = t.opened_at?.slice(0, 10); if (d) byDay[d] = (byDay[d] || 0) + parseFloat(t.pnl || 0); });
    const profDays = Object.values(byDay).filter(v => v > 0).length;
    const totalDays = Object.keys(byDay).length;
    const ready = winRate >= 55 && totalPnL > 0 && profDays >= totalDays * 0.6;
    return {
        ready, win_rate: winRate.toFixed(1) + '%', total_pnl: '$' + totalPnL.toFixed(2),
        profitable_days: `${profDays}/${totalDays}`, trades_count: trades.length,
        recommendation: ready ? 'Paper performance strong — consider live with half-Kelly' :
            `Not ready — need WR≥55% (${winRate.toFixed(0)}%), positive P&L ($${totalPnL.toFixed(2)}), ≥60% profitable days (${profDays}/${totalDays})`
    };
}

// ═══════════════════════════════════════════════════
// WEEKLY PERFORMANCE REPORT
// ═══════════════════════════════════════════════════
async function generateWeeklyReport(db, key, secret) {
    if (!db) return { error: 'No DB' };
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: trades } = await db.from('bot_trade_log').select('*').gte('opened_at', weekAgo);
    const totalTrades = trades?.length || 0;
    const closed = (trades || []).filter(t => t.status === 'closed');
    const totalPnL = closed.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);
    const wins = closed.filter(t => parseFloat(t.pnl || 0) > 0).length;
    const winRate = closed.length ? (wins / closed.length * 100) : 0;
    let account = {};
    try { account = await alpacaFetch('/v2/account', key, secret); } catch (e) { account = { error: e.message }; }
    const graduation = await paperToLiveCheck(db);
    const sorted = closed.sort((a, b) => parseFloat(b.pnl || 0) - parseFloat(a.pnl || 0));
    return {
        period: 'Last 7 days', total_trades: totalTrades, closed_trades: closed.length,
        open_trades: totalTrades - closed.length, win_rate: winRate.toFixed(1) + '%',
        total_pnl: '$' + totalPnL.toFixed(2),
        best_trade: sorted[0] ? `${sorted[0].symbol} +$${parseFloat(sorted[0].pnl).toFixed(2)}` : 'N/A',
        worst_trade: sorted[sorted.length - 1] ? `${sorted[sorted.length - 1].symbol} $${parseFloat(sorted[sorted.length - 1].pnl).toFixed(2)}` : 'N/A',
        equity: account.equity ? `$${parseFloat(account.equity).toLocaleString()}` : 'N/A',
        paper_to_live: graduation, generated_at: new Date().toISOString()
    };
}

// ═══ HELPERS ═══
async function alpacaFetch(endpoint, key, secret, method = 'GET', body = null) {
    const base = endpoint.startsWith('/v2/orders') || endpoint.startsWith('/v2/account') || endpoint.startsWith('/v2/positions') || endpoint.startsWith('/v2/clock')
        ? ALPACA_TRADE() : ALPACA_DATA;
    const opts = { method, headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${base}${endpoint}`, opts);
    if (method === 'DELETE' && res.status === 204) return { deleted: true };
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Alpaca ${res.status}`);
    return data;
}

async function fetchBars(symbol, timeframe, limit, key, secret) {
    const res = await fetch(`${ALPACA_DATA}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&limit=${limit}&feed=iex`, {
        headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }
    });
    const data = await res.json();
    return data.bars || [];
}

async function getMarketStatus(key, secret) {
    try {
        const clock = await alpacaFetch('/v2/clock', key, secret);
        return clock.is_open ? 'open' : 'closed';
    } catch { return 'unknown'; }
}

async function loadConfig(db) {
    if (!db) return {};
    const { data } = await db.from('bot_config').select('key, value');
    const config = {};
    (data || []).forEach(r => config[r.key] = r.value);
    return config;
}

async function getAdjustedWeights(db, baseWeights) {
    if (!db) return baseWeights;
    const { data: patterns } = await db.from('bot_patterns')
        .select('strategy, weight_adjustment')
        .eq('pattern_type', 'strategy_performance').limit(20);

    const adjusted = { ...baseWeights };
    if (patterns) {
        patterns.forEach(p => {
            if (adjusted[p.strategy] !== undefined) {
                adjusted[p.strategy] = Math.max(0, Math.min(50, adjusted[p.strategy] + (p.weight_adjustment || 0)));
            }
        });
    }
    return adjusted;
}

// ═══════════════════════════════════════════════════
// AUTO-LEARNING — Neural Feedback Loop
// Analyzes past trades, learns what works, adjusts strategy weights
// ═══════════════════════════════════════════════════

async function autoLearn(db, key, secret) {
    if (!db) return { learned: false, reason: 'No database' };

    const results = { learned: false, adjustments: [], patterns_saved: 0, analysis: {} };

    try {
        // 1. Get recent closed trades (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: trades } = await db.from('bot_trade_log')
            .select('*')
            .gte('created_at', thirtyDaysAgo)
            .not('pnl', 'is', null)
            .order('created_at', { ascending: false })
            .limit(200);

        if (!trades || trades.length < 5) {
            return { learned: false, reason: `Need 5+ closed trades, have ${trades?.length || 0}` };
        }

        // 2. Analyze performance by strategy
        const byStrategy = {};
        let totalPnL = 0, wins = 0, losses = 0;

        trades.forEach(t => {
            const strategy = t.strategy || 'unknown';
            if (!byStrategy[strategy]) byStrategy[strategy] = { trades: 0, wins: 0, pnl: 0, avg_confidence: 0 };

            byStrategy[strategy].trades++;
            byStrategy[strategy].pnl += parseFloat(t.pnl || 0);
            byStrategy[strategy].avg_confidence += parseFloat(t.confidence || 50);
            totalPnL += parseFloat(t.pnl || 0);

            if (parseFloat(t.pnl || 0) > 0) { wins++; byStrategy[strategy].wins++; }
            else losses++;
        });

        // Normalize averages
        Object.values(byStrategy).forEach(s => {
            s.avg_confidence = Math.round(s.avg_confidence / s.trades);
            s.win_rate = Math.round((s.wins / s.trades) * 100);
            s.avg_pnl = Math.round(s.pnl / s.trades * 100) / 100;
        });

        results.analysis = {
            total_trades: trades.length,
            win_rate: Math.round((wins / trades.length) * 100),
            total_pnl: Math.round(totalPnL * 100) / 100,
            by_strategy: byStrategy
        };

        // 3. Generate weight adjustments based on performance
        const adjustments = [];
        for (const [strategy, stats] of Object.entries(byStrategy)) {
            if (stats.trades < 3) continue; // Need minimum data

            let adjustment = 0;

            // Strategy winning > 60%? Increase weight
            if (stats.win_rate >= 60) {
                adjustment = Math.min(5, Math.round((stats.win_rate - 50) / 10));
            }
            // Strategy losing > 60%? Decrease weight
            else if (stats.win_rate < 40) {
                adjustment = Math.max(-5, -Math.round((50 - stats.win_rate) / 10));
            }

            // Factor in P&L magnitude
            if (stats.avg_pnl > 50) adjustment += 2;
            else if (stats.avg_pnl < -50) adjustment -= 2;

            // Clamp
            adjustment = Math.max(-5, Math.min(5, adjustment));

            if (adjustment !== 0) {
                adjustments.push({ strategy, adjustment, reason: `Win rate: ${stats.win_rate}%, Avg P&L: $${stats.avg_pnl}` });

                // Save to bot_patterns for getAdjustedWeights to pick up
                await db.from('bot_patterns').upsert({
                    strategy,
                    pattern_type: 'strategy_performance',
                    weight_adjustment: adjustment,
                    data: { win_rate: stats.win_rate, trades: stats.trades, avg_pnl: stats.avg_pnl },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'strategy,pattern_type' });

                results.patterns_saved++;
            }
        }

        // 4. Detect market condition patterns
        const recentSignals = trades.slice(0, 20);
        const avgConfidence = Math.round(recentSignals.reduce((s, t) => s + parseFloat(t.confidence || 50), 0) / recentSignals.length);

        // If recent confidence is too high but losing, bot is overconfident
        if (avgConfidence > 75 && wins / trades.length < 0.45) {
            await db.from('bot_patterns').upsert({
                strategy: 'confidence_calibration',
                pattern_type: 'bias_correction',
                weight_adjustment: -5,
                data: { avg_confidence: avgConfidence, win_rate: Math.round(wins / trades.length * 100), note: 'Overconfidence detected — reducing signal sensitivity' },
                updated_at: new Date().toISOString()
            }, { onConflict: 'strategy,pattern_type' });
            results.patterns_saved++;
        }

        // 5. Log the learning session
        await db.from('bot_learning_log').insert({
            trades_analyzed: trades.length,
            adjustments: JSON.stringify(adjustments),
            analysis: JSON.stringify(results.analysis),
            patterns_saved: results.patterns_saved,
            learned_at: new Date().toISOString()
        }).catch(() => { }); // Table may not exist yet

        results.learned = true;
        results.adjustments = adjustments;
        return results;

    } catch (err) {
        console.error('Auto-learn error:', err.message);
        return { learned: false, error: err.message };
    }
}

// ═══ LOAD ALL MEMORIES — Full memory state for brain ═══
async function loadAllMemories(db) {
    if (!db) return { memories: {} };

    const memories = {};

    // Trading history summary
    const { data: recentTrades } = await db.from('bot_trade_log')
        .select('symbol, side, qty, price, pnl, strategy, confidence, created_at')
        .order('created_at', { ascending: false }).limit(50);
    memories.recent_trades = recentTrades || [];

    // Strategy performance patterns
    const { data: patterns } = await db.from('bot_patterns')
        .select('*').eq('pattern_type', 'strategy_performance');
    memories.strategy_patterns = patterns || [];

    // Bot config
    const config = await loadConfig(db);
    memories.config = config;

    // Current positions
    try {
        const key = process.env.ALPACA_KEY_ID || process.env.ALPACA_API_KEY;
        const secret = process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET;
        if (key && secret) {
            const positions = await alpacaFetch('/v2/positions', key, secret);
            memories.open_positions = Array.isArray(positions) ? positions : [];
            const account = await alpacaFetch('/v2/account', key, secret);
            memories.account = {
                equity: account.equity,
                buying_power: account.buying_power,
                portfolio_value: account.portfolio_value,
                cash: account.cash,
                day_trade_count: account.daytrade_count
            };
        }
    } catch (e) { memories.account_error = e.message; }

    // Learning log
    const { data: learning } = await db.from('bot_learning_log')
        .select('*').order('learned_at', { ascending: false }).limit(5);
    memories.learning_history = learning || [];

    return { memories, loaded_at: new Date().toISOString() };
}
