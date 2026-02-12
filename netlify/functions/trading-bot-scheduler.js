console.log('[trading-bot-scheduler] Module loading started...');
// ═══ TRADING BOT SCHEDULER — Cron job: runs every 5 min during market hours ═══
// Netlify Scheduled Function — calls trading-bot-engine to evaluate & execute
// Features: daily morning email, market awareness (5 min pre-open), weekly report
let patchProcessEnv;
try {
    patchProcessEnv = require('./get-secret').patchProcessEnv;
    console.log('[trading-bot-scheduler] get-secret loaded OK');
} catch (e) {
    console.error('[trading-bot-scheduler] get-secret FAILED:', e.message);
    patchProcessEnv = async () => 0;
}


const botCycle = async (event) => {
    const start = Date.now();
    console.log(`[TradingBot] Cron triggered at ${new Date().toISOString()}`);

    try {
        await patchProcessEnv();
        const URL = process.env.URL || 'https://kelionai.app';

        // 1. Run full evaluation + execution cycle
        const cycleRes = await fetch(`${URL}/.netlify/functions/trading-bot-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'execute_cycle' })
        });
        const cycleData = await cycleRes.json();
        console.log(`[TradingBot] Cycle result:`, cycleData.status, cycleData.summary || '');

        // 2. If trades were executed, send alerts
        if (cycleData.results) {
            const trades = cycleData.results.filter(r => r.action === 'BUY' || r.action === 'SELL');
            for (const trade of trades) {
                try {
                    await fetch(`${URL}/.netlify/functions/trading-alerts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'trade_alert',
                            symbol: trade.symbol,
                            side: trade.action.toLowerCase(),
                            qty: trade.qty,
                            price: trade.price || 'market',
                            strategy: trade.strategy,
                            confidence: trade.confidence,
                            order_id: trade.order_id
                        })
                    });
                } catch (alertErr) {
                    console.error(`[TradingBot] Alert failed for ${trade.symbol}:`, alertErr.message);
                }
            }
        }

        // 3. Run learning cycle every 20 runs (~100 min)
        const runCount = cycleData.run_count || 0;
        if (runCount % 20 === 0 && runCount > 0) {
            try {
                await fetch(`${URL}/.netlify/functions/trading-memory`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'learn' })
                });
                console.log('[TradingBot] Learning cycle completed');
            } catch (learnErr) {
                console.error('[TradingBot] Learning failed:', learnErr.message);
            }
        }

        // 4. MULTI-MARKET AWARENESS — Notificări la deschiderea/închiderea fiecărei piețe
        const now = new Date();
        const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const estHour = estNow.getHours();
        const estMin = estNow.getMinutes();
        const estDay = estNow.getDay(); // 0=Sun, 6=Sat
        const estTime = estHour * 60 + estMin; // minutes since midnight EST

        // Market schedules in EST minutes (Mon-Fri only)
        const MARKETS = [
            { name: 'London (LSE)', openMin: 3 * 60, closeMin: 11 * 60 + 30, emoji: '🇬🇧' },
            { name: 'Frankfurt (XETRA)', openMin: 2 * 60, closeMin: 11 * 60 + 30, emoji: '🇩🇪' },
            { name: 'US (NYSE/NASDAQ)', openMin: 9 * 60 + 30, closeMin: 16 * 60, emoji: '🇺🇸' },
            { name: 'Tokyo (TSE)', openMin: 19 * 60, closeMin: 25 * 60, emoji: '🇯🇵' }, // crosses midnight
        ];

        // Only weekdays
        if (estDay >= 1 && estDay <= 5) {
            for (const market of MARKETS) {
                // Market OPEN notification (within 5 min window)
                if (estTime >= market.openMin && estTime <= market.openMin + 4) {
                    try {
                        await fetch(`${URL}/.netlify/functions/trading-alerts`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'signal_alert',
                                symbol: market.name,
                                signal: 'MARKET_OPEN',
                                confidence: 100,
                                indicators: `${market.emoji} Sunt live pe piața ${market.name}`
                            })
                        });
                        console.log(`[TradingBot] ${market.emoji} LIVE pe ${market.name}`);
                    } catch (e) { console.error(`[TradingBot] Open notify failed for ${market.name}:`, e.message); }
                }
            }
        }

        // 5. EOD CLOSE — La închiderea pieței US (3:55 PM EST)
        // Închide toate pozițiile, generează raport pe piețe, salvează în DB, trimite email
        if (estHour === 15 && estMin >= 55) {
            console.log('[TradingBot] 🔔 Închidere piață — EOD Close triggered');
            const { createClient } = require('@supabase/supabase-js');
            const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY);

            try {
                // A. Get all open positions
                const positionsRes = await fetch(`${URL}/.netlify/functions/trading-bot-engine`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'status' })
                });
                const statusData = await positionsRes.json();

                // B. Close all positions via Alpaca
                const ALPACA_KEY = process.env.ALPACA_API_KEY;
                const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
                const ALPACA_URL = process.env.ALPACA_PAPER === 'true' ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';

                let closedPositions = [];
                try {
                    // Close all positions at once
                    await fetch(`${ALPACA_URL}/v2/positions?cancel_orders=true`, {
                        method: 'DELETE',
                        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
                    });
                    console.log('[TradingBot] Toate pozițiile închise');

                    // Wait a moment for orders to fill
                    await new Promise(r => setTimeout(r, 3000));

                    // Get today's closed orders for the report
                    const ordersRes = await fetch(`${ALPACA_URL}/v2/orders?status=closed&limit=50&direction=desc`, {
                        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
                    });
                    const todaysOrders = await ordersRes.json();
                    closedPositions = Array.isArray(todaysOrders) ? todaysOrders : [];
                } catch (closeErr) {
                    console.error('[TradingBot] Eroare la închidere poziții:', closeErr.message);
                }

                // C. Get performance stats
                const statsRes = await fetch(`${URL}/.netlify/functions/trading-memory`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'get_stats', period: '1d' })
                });
                const stats = await statsRes.json();

                // D. Get account state after closeout
                const accountRes = await fetch(`${ALPACA_URL}/v2/account`, {
                    headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET }
                });
                const account = await accountRes.json();

                // E. Build per-symbol report sorted by market
                const symbolReport = {};
                closedPositions.forEach(order => {
                    const sym = order.symbol || 'UNKNOWN';
                    if (!symbolReport[sym]) symbolReport[sym] = { buys: 0, sells: 0, total_qty: 0, avg_price: 0, orders: [] };
                    symbolReport[sym].orders.push({
                        side: order.side, qty: order.filled_qty || order.qty,
                        price: order.filled_avg_price, status: order.status,
                        time: order.filled_at || order.submitted_at
                    });
                    if (order.side === 'buy') symbolReport[sym].buys++;
                    else symbolReport[sym].sells++;
                });

                // F. Save daily report to DB
                const reportData = {
                    report_date: now.toISOString().slice(0, 10),
                    market: 'US_STOCKS',
                    mode: process.env.ALPACA_PAPER === 'true' ? 'paper' : 'live',
                    total_pnl: stats.total_pnl || '$0.00',
                    total_trades: stats.total_trades || 0,
                    wins: stats.wins || 0,
                    losses: stats.losses || 0,
                    win_rate: stats.win_rate || '0%',
                    equity: account.equity || '0',
                    buying_power: account.buying_power || '0',
                    symbols_traded: Object.keys(symbolReport),
                    per_symbol: symbolReport,
                    positions_closed: closedPositions.length,
                    observations: stats.observations || null,
                    recommendations: stats.recommendations || null,
                    created_at: now.toISOString()
                };

                await db.from('bot_daily_reports').upsert(reportData, { onConflict: 'report_date,market' }).then(() => {
                    console.log('[TradingBot] Raport zilnic salvat în DB');
                }).catch(dbErr => {
                    console.error('[TradingBot] Eroare salvare raport:', dbErr.message);
                });

                // G. Send daily summary email (in Romanian)
                await fetch(`${URL}/.netlify/functions/trading-alerts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'daily_summary',
                        date: now.toISOString().slice(0, 10),
                        total_pnl: stats.total_pnl,
                        trades_count: stats.total_trades,
                        wins: stats.wins, losses: stats.losses,
                        win_rate: stats.win_rate?.replace('%', ''),
                        positions_open: 0, // All closed at EOD
                        equity: account.equity
                    })
                });
                console.log('[TradingBot] Rezumat zilnic trimis pe email');

            } catch (sumErr) {
                console.error('[TradingBot] EOD close failed:', sumErr.message);
            }

            // Also run auto_learn at end of day
            try {
                await fetch(`${URL}/.netlify/functions/trading-bot-engine`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'auto_learn' })
                });
                console.log('[TradingBot] Învățare automată de sfârșit de zi completă');
            } catch (learnErr) {
                console.error('[TradingBot] Auto-learn failed:', learnErr.message);
            }
        }

        // 6. Weekly report — Saturday morning
        if (estDay === 6 && estHour === 9 && estMin >= 0 && estMin <= 9) {
            try {
                const weeklyRes = await fetch(`${URL}/.netlify/functions/trading-bot-engine`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'weekly_report' })
                });
                const weeklyData = await weeklyRes.json();

                await fetch(`${URL}/.netlify/functions/trading-alerts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'weekly_report',
                        subject: `📊 Weekly Report — ${now.toISOString().slice(0, 10)}`,
                        data: weeklyData
                    })
                });
                console.log('[TradingBot] Weekly report sent');
            } catch (weekErr) {
                console.error('[TradingBot] Weekly report failed:', weekErr.message);
            }
        }

        console.log(`[TradingBot] Complete in ${Date.now() - start}ms`);
        return { statusCode: 200 };

    } catch (err) {
        console.error('[TradingBot] Fatal error:', err.message);

        // Send error alert
        try {
            const URL = process.env.URL || 'https://kelionai.app';
            await fetch(`${URL}/.netlify/functions/trading-alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'error_alert', error_message: err.message, context: 'Scheduled cycle' })
            });
        } catch (alertErr) { /* can't do more */ }

        return { statusCode: 500 };
    }
};

// Handler: responds to HTTP health-checks + cron triggers
const mainHandler = async (event) => {
    // HTTP health check (audit)
    if (event.httpMethod) {
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, type: 'trading-bot-scheduler', schedule: '@every 5m', status: 'active' })
        };
    }
    // Scheduled invocation — run trading cycle
    return botCycle(event);
};

// Standard handler — Netlify cron config is in netlify.toml
exports.handler = mainHandler;


