// ═══ TRADING ALERTS — Notificări email trading (RO pentru admin) ═══
const { patchProcessEnv } = require('./get-secret');

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'trade_alert': return respond(200, await sendTradeAlert(body));
            case 'signal_alert': return respond(200, await sendSignalAlert(body));
            case 'daily_summary': return respond(200, await sendDailySummary(body));
            case 'morning_report': return respond(200, await sendMorningReport(body));
            case 'weekly_report': return respond(200, await sendWeeklyReport(body));
            case 'error_alert': return respond(200, await sendErrorAlert(body));
            case 'trailing_stop_alert': return respond(200, await sendTrailingStopAlert(body));
            default: return respond(400, { error: 'Actions: trade_alert, signal_alert, daily_summary, morning_report, weekly_report, error_alert, trailing_stop_alert' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@kelionai.app';

async function sendEmail(subject, htmlBody, type = 'info') {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) return { sent: false, reason: 'RESEND_API_KEY not configured' };

    const colors = {
        trade: { bg: '#0d2818', border: '#00ff88', icon: '💰' },
        signal: { bg: '#1a1a2e', border: '#00e5ff', icon: '📊' },
        error: { bg: '#2d1b1b', border: '#ff4444', icon: '🚨' },
        summary: { bg: '#1a1a2e', border: '#9b59b6', icon: '📋' },
        trailing: { bg: '#2d2a1b', border: '#ffaa00', icon: '🔄' },
        info: { bg: '#1b2d2d', border: '#00e5ff', icon: '📢' }
    };
    const style = colors[type] || colors.info;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:30px 20px;">
  <div style="text-align:center;margin-bottom:16px;">
    <span style="font-size:24px;">${style.icon}</span>
    <span style="color:#00e5ff;font-size:16px;font-weight:600;margin-left:8px;">Kelion Trading Bot</span>
  </div>
  <div style="background:${style.bg};border:1px solid ${style.border};border-radius:10px;padding:20px;">
    <h2 style="color:#fff;font-size:16px;margin:0 0 12px;">${subject}</h2>
    <div style="color:#ccc;font-size:13px;line-height:1.6;">${htmlBody}</div>
  </div>
  <div style="text-align:center;margin-top:16px;color:#444;font-size:10px;">© ${new Date().getFullYear()} Kelion AI Trading Bot</div>
</div></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Kelion Trading <onboarding@resend.dev>',
            to: [ADMIN_EMAIL], subject: `[KelionBot] ${subject}`, html
        })
    });

    return { sent: res.ok, email_id: res.ok ? (await res.json()).id : null };
}

// ═══ Alertă tranzacție executată ═══
async function sendTradeAlert({ symbol, side, qty, price, strategy, confidence, order_id }) {
    const emoji = side === 'buy' ? '🟢 CUMPĂRARE' : '🔴 VÂNZARE';
    return sendEmail(
        `${emoji} ${qty}x ${symbol} @ $${price}`,
        `<p><strong>${emoji}</strong> ${qty} acțiuni <strong>${symbol}</strong></p>
        <p>💲 Preț: <strong>$${price}</strong></p>
        <p>📊 Strategie: ${strategy || 'combinată'} | Încredere: ${confidence || 'N/A'}%</p>
        <p>🔑 ID Ordin: ${order_id || 'în așteptare'}</p>
        <p style="color:#888;font-size:11px;">⏰ ${new Date().toISOString()}</p>`,
        'trade'
    );
}

// ═══ Alertă semnal puternic detectat ═══
async function sendSignalAlert({ symbol, signal, confidence, indicators }) {
    const signalRo = signal === 'BUY' ? 'CUMPĂRARE' : signal === 'SELL' ? 'VÂNZARE' : signal;
    return sendEmail(
        `📊 Semnal puternic ${signalRo}: ${symbol} (${confidence}%)`,
        `<p>Simbol: <strong>${symbol}</strong> → <strong>${signalRo}</strong></p>
        <p>Încredere: <strong>${confidence}%</strong></p>
        <p>Indicatori: ${indicators || 'vezi dashboard'}</p>`,
        'signal'
    );
}

// ═══ Rezumat zilnic — simplu, clar ═══
async function sendDailySummary({ date, total_pnl, trades_count, wins, losses, win_rate, positions_open, equity, symbols_detail, observations, recommendations }) {
    const pnl = parseFloat(String(total_pnl || 0).replace('$', ''));
    const gained = pnl >= 0 ? pnl.toFixed(2) : '0.00';
    const lost = pnl < 0 ? Math.abs(pnl).toFixed(2) : '0.00';

    let symbolLines = '';
    if (symbols_detail && typeof symbols_detail === 'object') {
        Object.entries(symbols_detail).forEach(([sym, info]) => {
            symbolLines += `<p style="margin:4px 0;">• <strong>${sym}</strong>: ${info.buys || 0} cumpărări, ${info.sells || 0} vânzări</p>`;
        });
    }

    return sendEmail(
        `📋 Raport ${date || new Date().toISOString().slice(0, 10)}`,
        `<div style="font-size:16px;line-height:2.2;">
        <p>✅ <strong>Câștigat azi = <span style="color:#00ff88">$${gained}</span></strong></p>
        <p>❌ <strong>Pierdut azi = <span style="color:#ff4444">$${lost}</span></strong></p>
        <p>💰 <strong>Fond real = <span style="color:#00e5ff">$${equity || 'N/A'}</span></strong></p>
        <hr style="border-color:#333;margin:10px 0">
        <p style="font-size:13px;">📊 Tranzacții: ${trades_count || 0} total (${wins || 0} câștigate / ${losses || 0} pierdute) — rată ${win_rate || '0'}%</p>
        ${symbolLines ? '<p style="font-size:13px;"><strong>Pe simbol:</strong></p>' + symbolLines : ''}
        ${observations ? '<hr style="border-color:#333;margin:10px 0"><p style="font-size:13px;">🧠 <strong>Am observat:</strong> ' + observations + '</p>' : ''}
        ${recommendations ? '<p style="font-size:13px;">💡 <strong>Recomand:</strong> ' + recommendations + '</p>' : ''}
        </div>`,
        'summary'
    );
}

// ═══ Alertă eroare ═══
async function sendErrorAlert({ error_message, context }) {
    return sendEmail(
        `🚨 Eroare Bot`,
        `<p style="color:#ff4444;"><strong>${error_message}</strong></p>
        <p>Context: ${context || 'Ciclu engine'}</p>
        <p style="color:#888;">⏰ ${new Date().toISOString()}</p>`,
        'error'
    );
}

// ═══ Alertă trailing stop ajustat ═══
async function sendTrailingStopAlert({ symbol, old_stop, new_stop, pnl_pct }) {
    return sendEmail(
        `🔄 Trailing Stop: ${symbol}`,
        `<p>Simbol: <strong>${symbol}</strong></p>
        <p>Stop vechi: $${old_stop} → Stop nou: <strong>$${new_stop}</strong></p>
        <p>P&L nerealizat: ${pnl_pct}</p>`,
        'trailing'
    );
}

// ═══ Raport dimineață — 5 min înainte de deschiderea pieței ═══
async function sendMorningReport({ subject, data }) {
    const d = data || {};
    const grad = d.graduation || {};
    return sendEmail(
        subject || '☀️ Raport Dimineață',
        `<table style="width:100%;color:#ccc;font-size:13px;">
         <tr><td>⏰ Piața se deschide în:</td><td style="text-align:right;color:#00ff88"><strong>${d.market_opens_in || '5 min'}</strong></td></tr>
         <tr><td>💰 Capital:</td><td style="text-align:right">${d.equity || 'N/A'}</td></tr>
         <tr><td>💵 Putere de cumpărare:</td><td style="text-align:right">${d.buying_power || 'N/A'}</td></tr>
         <tr><td>📂 Poziții deschise:</td><td style="text-align:right">${d.open_positions || 0}</td></tr>
         <tr><td>🤖 Bot:</td><td style="text-align:right">${d.bot_enabled ? '✅ Activ' : '❌ Dezactivat'} (${d.mode || 'paper'})</td></tr>
         <tr><td>📋 Watchlist:</td><td style="text-align:right">${(d.watchlist || []).slice(0, 8).join(', ')}</td></tr>
         </table>
         <hr style="border-color:#333;margin:12px 0">
         <p style="font-size:12px;color:#888;"><strong>Status Paper→Live:</strong> ${grad.ready ? '✅ Pregătit!' : '❌ Nu e pregătit'}<br>
         Rată succes: ${grad.win_rate || 'N/A'} | P&L: ${grad.total_pnl || 'N/A'} | Zile profitabile: ${grad.profitable_days || 'N/A'}</p>
         <hr style="border-color:#333;margin:12px 0">
         <p style="font-size:12px;color:#00e5ff;"><strong>🧠 Ce am observat:</strong> ${d.observations || 'Analizez piața...'}</p>
         <p style="font-size:12px;color:#ffaa00;"><strong>💡 Recomandări:</strong> ${d.recommendations || 'Se acumulează date pentru recomandări.'}</p>`,
        'info'
    );
}

// ═══ Raport săptămânal de performanță ═══
async function sendWeeklyReport({ subject, data }) {
    const d = data || {};
    const grad = d.paper_to_live || {};
    return sendEmail(
        subject || '📊 Raport Săptămânal',
        `<table style="width:100%;color:#ccc;font-size:13px;">
         <tr><td>📅 Perioadă:</td><td style="text-align:right">${d.period || 'Ultimele 7 zile'}</td></tr>
         <tr><td>📊 Total tranzacții:</td><td style="text-align:right">${d.total_trades || 0} (${d.closed_trades || 0} închise, ${d.open_trades || 0} deschise)</td></tr>
         <tr><td>📈 P&L:</td><td style="text-align:right;color:${parseFloat(String(d.total_pnl).replace('$', '')) >= 0 ? '#00ff88' : '#ff4444'}"><strong>${d.total_pnl || '$0.00'}</strong></td></tr>
         <tr><td>🎯 Rată succes:</td><td style="text-align:right">${d.win_rate || '0%'}</td></tr>
         <tr><td>🏆 Cea mai bună tranzacție:</td><td style="text-align:right;color:#00ff88">${d.best_trade || 'N/A'}</td></tr>
         <tr><td>💀 Cea mai slabă tranzacție:</td><td style="text-align:right;color:#ff4444">${d.worst_trade || 'N/A'}</td></tr>
         <tr><td>💰 Capital:</td><td style="text-align:right">${d.equity || 'N/A'}</td></tr>
         </table>
         <hr style="border-color:#333;margin:12px 0">
         <p style="font-size:12px;color:#00e5ff;"><strong>🧠 Ce am învățat săptămâna asta:</strong> ${d.lessons_learned || 'Se analizează pattern-urile...'}</p>
         <p style="font-size:12px;color:#ffaa00;"><strong>💡 Recomandări:</strong> ${d.recommendations || 'Continuăm monitorizarea.'}</p>
         <hr style="border-color:#333;margin:12px 0">
         <p style="font-size:12px;color:#888;"><strong>Paper→Live:</strong> ${grad.ready ? '✅ PREGĂTIT pentru trading real!' : '❌ Mai avem nevoie de date'}<br>
         ${grad.recommendation || ''}</p>`,
        'summary'
    );
}
