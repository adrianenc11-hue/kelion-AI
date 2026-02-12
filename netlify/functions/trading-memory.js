// ═══ TRADING MEMORY — Trade logging, pattern learning, accuracy tracking ═══
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

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
        const db = getDB();
        if (!db) return respond(503, { error: 'Supabase not configured' });

        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'log_trade': return respond(200, await logTrade(db, body));
            case 'close_trade': return respond(200, await closeTrade(db, body));
            case 'log_signal': return respond(200, await logSignal(db, body));
            case 'get_stats': return respond(200, await getStats(db, body));
            case 'get_patterns': return respond(200, await getPatterns(db, body));
            case 'learn': return respond(200, await analyzeAndLearn(db));
            case 'get_config': return respond(200, await getConfig(db));
            case 'set_config': return respond(200, await setConfig(db, body));
            case 'get_trades': return respond(200, await getTrades(db, body));
            case 'get_open_trades': return respond(200, await getOpenTrades(db));
            default: return respond(400, { error: 'Actions: log_trade, close_trade, log_signal, get_stats, get_patterns, learn, get_config, set_config, get_trades, get_open_trades' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

// ═══ LOG TRADE — Record new trade ═══
async function logTrade(db, { symbol, side, qty, entry_price, order_id, strategy, confidence, signals_used, ai_reasoning, classic_signals, ai_signals, market_conditions }) {
    const { data, error } = await db.from('bot_trade_log').insert({
        symbol, side, qty, entry_price, order_id, strategy, confidence,
        signals_used: signals_used || {}, ai_reasoning,
        classic_signals: classic_signals || {}, ai_signals: ai_signals || {},
        market_conditions: market_conditions || {}, status: 'open'
    }).select().single();
    if (error) throw new Error(error.message);
    return { trade_id: data.id, message: `Trade logged: ${side} ${qty}x ${symbol}` };
}

// ═══ CLOSE TRADE — Record exit and calculate P&L ═══
async function closeTrade(db, { trade_id, exit_price, lesson_learned }) {
    const { data: trade, error: fetchErr } = await db.from('bot_trade_log')
        .select('*').eq('id', trade_id).single();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!trade) throw new Error('Trade not found');

    const pnl = trade.side === 'buy'
        ? (exit_price - trade.entry_price) * trade.qty
        : (trade.entry_price - exit_price) * trade.qty;
    const pnl_pct = ((pnl / (trade.entry_price * trade.qty)) * 100);
    const duration = (Date.now() - new Date(trade.opened_at).getTime()) / 60000;

    const { error } = await db.from('bot_trade_log').update({
        exit_price, pnl, pnl_pct, status: 'closed',
        closed_at: new Date().toISOString(),
        duration_minutes: Math.round(duration),
        lesson_learned: lesson_learned || (pnl > 0 ? 'Profitable trade' : 'Loss — review signals')
    }).eq('id', trade_id);
    if (error) throw new Error(error.message);

    return { trade_id, pnl: pnl.toFixed(2), pnl_pct: pnl_pct.toFixed(2), duration_minutes: Math.round(duration) };
}

// ═══ LOG SIGNAL — Record generated signal ═══
async function logSignal(db, { symbol, signal_type, source, confidence, data: signalData, price_at_signal, acted_on }) {
    const { error } = await db.from('bot_signals').insert({
        symbol, signal_type, source, confidence,
        data: signalData || {}, price_at_signal, acted_on: acted_on || false
    });
    if (error) throw new Error(error.message);
    return { message: `Signal logged: ${signal_type} ${symbol} from ${source}` };
}

// ═══ GET STATS — Trading performance stats ═══
async function getStats(db, { period = '30d' }) {
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, 'all': 36500 };
    const days = daysMap[period] || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: trades } = await db.from('bot_trade_log')
        .select('*').eq('status', 'closed').gte('opened_at', since)
        .order('opened_at', { ascending: false });

    if (!trades || !trades.length) return { period, total_trades: 0, message: 'No closed trades in period' };

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const totalPnL = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const maxWin = wins.length ? Math.max(...wins.map(t => t.pnl)) : 0;
    const maxLoss = losses.length ? Math.min(...losses.map(t => t.pnl)) : 0;

    // Calculate max drawdown
    let peak = 0, maxDD = 0, equity = 0;
    for (const t of trades.reverse()) {
        equity += t.pnl || 0;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDD) maxDD = dd;
    }

    // Strategy breakdown
    const byStrategy = {};
    trades.forEach(t => {
        const s = t.strategy || 'unknown';
        if (!byStrategy[s]) byStrategy[s] = { trades: 0, wins: 0, pnl: 0 };
        byStrategy[s].trades++;
        if (t.pnl > 0) byStrategy[s].wins++;
        byStrategy[s].pnl += t.pnl || 0;
    });
    Object.keys(byStrategy).forEach(s => {
        byStrategy[s].win_rate = ((byStrategy[s].wins / byStrategy[s].trades) * 100).toFixed(1) + '%';
        byStrategy[s].pnl = byStrategy[s].pnl.toFixed(2);
    });

    return {
        period,
        total_trades: trades.length,
        wins: wins.length,
        losses: losses.length,
        win_rate: ((wins.length / trades.length) * 100).toFixed(1) + '%',
        total_pnl: `$${totalPnL.toFixed(2)}`,
        avg_win: `$${avgWin.toFixed(2)}`,
        avg_loss: `$${avgLoss.toFixed(2)}`,
        max_win: `$${maxWin.toFixed(2)}`,
        max_loss: `$${maxLoss.toFixed(2)}`,
        max_drawdown: `$${maxDD.toFixed(2)}`,
        profit_factor: avgLoss !== 0 ? (Math.abs(avgWin / avgLoss)).toFixed(2) : '∞',
        by_strategy: byStrategy
    };
}

// ═══ GET PATTERNS — Learned patterns ═══
async function getPatterns(db, { symbol, pattern_type }) {
    let query = db.from('bot_patterns').select('*').order('win_rate', { ascending: false });
    if (symbol) query = query.eq('symbol', symbol);
    if (pattern_type) query = query.eq('pattern_type', pattern_type);
    const { data, error } = await query.limit(50);
    if (error) throw new Error(error.message);
    return { patterns: data || [], count: data?.length || 0 };
}

// ═══ ANALYZE & LEARN — Crunch data to find patterns ═══
async function analyzeAndLearn(db) {
    const { data: trades } = await db.from('bot_trade_log')
        .select('*').eq('status', 'closed').order('opened_at', { ascending: false }).limit(500);

    if (!trades || trades.length < 5) return { message: 'Need at least 5 closed trades to learn', trades_available: trades?.length || 0 };

    const learnings = [];

    // 1. Strategy performance per symbol
    const stratSymbol = {};
    trades.forEach(t => {
        const key = `${t.strategy || 'unknown'}__${t.symbol}`;
        if (!stratSymbol[key]) stratSymbol[key] = { wins: 0, total: 0, pnl: 0, losses: [] };
        stratSymbol[key].total++;
        if (t.pnl > 0) stratSymbol[key].wins++;
        stratSymbol[key].pnl += t.pnl || 0;
        if (t.pnl < 0) stratSymbol[key].losses.push(t.pnl);
    });

    for (const [key, stats] of Object.entries(stratSymbol)) {
        const [strategy, symbol] = key.split('__');
        const winRate = (stats.wins / stats.total) * 100;
        const avgLoss = stats.losses.length ? stats.losses.reduce((a, b) => a + b, 0) / stats.losses.length : 0;
        const maxDD = stats.losses.length ? Math.min(...stats.losses) : 0;

        // Weight adjustment: boost strategies with >60% win rate, reduce <40%
        let weightAdj = 0;
        if (winRate >= 70) weightAdj = 10;
        else if (winRate >= 60) weightAdj = 5;
        else if (winRate < 40) weightAdj = -10;
        else if (winRate < 30) weightAdj = -20;

        await db.from('bot_patterns').upsert({
            pattern_type: 'strategy_performance',
            symbol, strategy,
            total_trades: stats.total,
            win_rate: winRate,
            avg_profit_pct: stats.pnl / stats.total,
            avg_loss_pct: avgLoss,
            max_drawdown_pct: maxDD,
            weight_adjustment: weightAdj,
            confidence_level: Math.min(95, 30 + stats.total * 3),
            data: { pnl_total: stats.pnl, wins: stats.wins },
            last_updated: new Date().toISOString()
        }, { onConflict: 'pattern_type,symbol,strategy' });

        learnings.push(`${strategy}/${symbol}: ${winRate.toFixed(0)}% win (${stats.total} trades), weight adj: ${weightAdj > 0 ? '+' : ''}${weightAdj}`);
    }

    // 2. Time-of-day patterns
    const byHour = {};
    trades.forEach(t => {
        const h = new Date(t.opened_at).getUTCHours();
        if (!byHour[h]) byHour[h] = { wins: 0, total: 0 };
        byHour[h].total++;
        if (t.pnl > 0) byHour[h].wins++;
    });
    let bestHour = 0, bestHourRate = 0;
    for (const [h, s] of Object.entries(byHour)) {
        const rate = s.wins / s.total;
        if (rate > bestHourRate && s.total >= 3) { bestHourRate = rate; bestHour = h; }
    }

    // 3. Signal accuracy
    const { data: signals } = await db.from('bot_signals')
        .select('source, was_correct').not('was_correct', 'is', null).limit(1000);

    const sigAccuracy = {};
    if (signals) {
        signals.forEach(s => {
            if (!sigAccuracy[s.source]) sigAccuracy[s.source] = { correct: 0, total: 0 };
            sigAccuracy[s.source].total++;
            if (s.was_correct) sigAccuracy[s.source].correct++;
        });
    }

    return {
        trades_analyzed: trades.length,
        learnings,
        best_trading_hour: `${bestHour}:00 UTC (${(bestHourRate * 100).toFixed(0)}% win rate)`,
        signal_accuracy: Object.fromEntries(
            Object.entries(sigAccuracy).map(([k, v]) => [k, `${((v.correct / v.total) * 100).toFixed(0)}% (${v.total} signals)`])
        ),
        message: `Analyzed ${trades.length} trades, updated ${learnings.length} patterns`
    };
}

// ═══ GET/SET CONFIG ═══
async function getConfig(db) {
    const { data } = await db.from('bot_config').select('key, value');
    const config = {};
    (data || []).forEach(r => config[r.key] = r.value);
    return { config };
}

async function setConfig(db, { key, value }) {
    if (!key) throw new Error('Config key required');
    const { error } = await db.from('bot_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
    return { message: `Config '${key}' updated`, key, value };
}

// ═══ GET TRADES ═══
async function getTrades(db, { status = 'all', limit: lim = 50 }) {
    let query = db.from('bot_trade_log').select('*').order('opened_at', { ascending: false }).limit(lim);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { trades: data || [], count: data?.length || 0 };
}

async function getOpenTrades(db) {
    const { data, error } = await db.from('bot_trade_log')
        .select('*').eq('status', 'open').order('opened_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { open_trades: data || [], count: data?.length || 0 };
}
