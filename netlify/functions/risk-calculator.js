// ═══ RISK CALCULATOR — Managementul riscului ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'position_size': return respond(200, calcPositionSize(body));
            case 'risk_reward': return respond(200, calcRiskReward(body));
            case 'portfolio_risk': return respond(200, portfolioRisk(body));
            case 'kelly': return respond(200, kellyFormula(body));
            case 'var': return respond(200, calcVaR(body));
            default: return respond(400, { error: 'Actions: position_size, risk_reward, portfolio_risk, kelly, var' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function calcPositionSize({ account_size = 10000, risk_pct = 2, entry_price, stop_loss_price }) {
    const entry = entry_price || 100;
    const stop = stop_loss_price || entry * 0.97;
    const riskPerShare = Math.abs(entry - stop);
    const riskAmount = account_size * (risk_pct / 100);
    const shares = Math.floor(riskAmount / riskPerShare);
    const totalCost = shares * entry;

    return {
        account_size: `$${account_size.toLocaleString()}`,
        risk_percentage: `${risk_pct}%`,
        risk_amount: `$${riskAmount.toFixed(2)}`,
        entry_price: `$${entry.toFixed(2)}`,
        stop_loss: `$${stop.toFixed(2)}`,
        risk_per_share: `$${riskPerShare.toFixed(2)}`,
        recommended_shares: shares,
        total_cost: `$${totalCost.toFixed(2)}`,
        portfolio_allocation: `${(totalCost / account_size * 100).toFixed(1)}%`,
        rule: `🛡️ Regula: nu risca mai mult de ${risk_pct}% din cont pe o singură tranzacție`,
        max_loss: `$${riskAmount.toFixed(2)} (worst case)`
    };
}

function calcRiskReward({ entry_price = 100, stop_loss = 97, take_profit = 105 }) {
    const risk = Math.abs(entry_price - stop_loss);
    const reward = Math.abs(take_profit - entry_price);
    const ratio = reward / risk;
    const breakeven_rate = (1 / (1 + ratio) * 100).toFixed(1);

    return {
        entry: `$${entry_price}`, stop_loss: `$${stop_loss}`, take_profit: `$${take_profit}`,
        risk: `$${risk.toFixed(2)} (${(risk / entry_price * 100).toFixed(1)}%)`,
        reward: `$${reward.toFixed(2)} (${(reward / entry_price * 100).toFixed(1)}%)`,
        ratio: `1:${ratio.toFixed(2)}`,
        quality: ratio >= 3 ? '🟢 Excelent (≥1:3)' : ratio >= 2 ? '🟢 Bun (≥1:2)' : ratio >= 1.5 ? '🟡 Acceptabil (≥1:1.5)' : '🔴 Riscant (<1:1.5)',
        breakeven_win_rate: `${breakeven_rate}% win rate necesar pentru break-even`,
        tip: ratio < 1.5 ? '⚠️ Crește take-profit sau mută stop-loss mai aproape' : '✅ Risk:Reward ratio bun'
    };
}

function portfolioRisk({ positions = [], account_size = 25000 }) {
    if (!positions.length) positions = [
        { symbol: 'AAPL', value: 4750, risk_pct: 3 },
        { symbol: 'NVDA', value: 3940, risk_pct: 5 },
        { symbol: 'MSFT', value: 4155, risk_pct: 2.5 },
        { symbol: 'META', value: 3800, risk_pct: 4 }
    ];

    const totalInvested = positions.reduce((a, p) => a + p.value, 0);
    const totalRisk = positions.reduce((a, p) => a + p.value * (p.risk_pct / 100), 0);
    const maxConcentration = Math.max(...positions.map(p => p.value / account_size * 100));

    return {
        account_size: `$${account_size.toLocaleString()}`,
        total_invested: `$${totalInvested.toLocaleString()} (${(totalInvested / account_size * 100).toFixed(1)}%)`,
        cash: `$${(account_size - totalInvested).toLocaleString()}`,
        total_risk: `$${totalRisk.toFixed(2)} (${(totalRisk / account_size * 100).toFixed(1)}% of account)`,
        max_single_position: `${maxConcentration.toFixed(1)}%`,
        positions: positions.map(p => ({
            symbol: p.symbol,
            allocation: `${(p.value / account_size * 100).toFixed(1)}%`,
            at_risk: `$${(p.value * p.risk_pct / 100).toFixed(2)}`
        })),
        health: {
            diversification: maxConcentration > 25 ? '🟡 Concentrare mare pe o poziție' : '🟢 Bună diversificare',
            risk_level: totalRisk / account_size > 0.1 ? '🔴 Risc total ridicat (>10%)' : totalRisk / account_size > 0.05 ? '🟡 Risc moderat (5-10%)' : '🟢 Risc controlat (<5%)',
            cash_reserve: (account_size - totalInvested) / account_size > 0.2 ? '🟢 Rezervă cash OK (>20%)' : '🟡 Puțin cash, atenție'
        }
    };
}

function kellyFormula({ win_rate = 60, avg_win = 500, avg_loss = 300 }) {
    const W = win_rate / 100;
    const R = avg_win / avg_loss;
    const kelly = W - ((1 - W) / R);
    const halfKelly = kelly / 2;

    return {
        win_rate: `${win_rate}%`,
        avg_win: `$${avg_win}`, avg_loss: `$${avg_loss}`,
        win_loss_ratio: `${R.toFixed(2)}:1`,
        kelly_percentage: `${(kelly * 100).toFixed(2)}%`,
        half_kelly: `${(halfKelly * 100).toFixed(2)}% (recomandat)`,
        interpretation: kelly > 0 ? `✅ Edge pozitiv — poți risca până la ${(halfKelly * 100).toFixed(1)}% per trade (Half Kelly)` : '❌ Edge negativ — nu tranzacționa cu strategia actuală!',
        example_10k: kelly > 0 ? `Pe un cont de $10,000: max $${(10000 * halfKelly).toFixed(0)} per tranzacție` : 'Nu recomandăm tranzacții',
        warning: '⚠️ Kelly full e agresiv. Folosește Half Kelly (jumătate) pentru siguranță.'
    };
}

function calcVaR({ portfolio_value = 25000, confidence = 95, period_days = 1, daily_volatility = 1.5 }) {
    const z = confidence === 99 ? 2.326 : confidence === 95 ? 1.645 : 1.282;
    const var_daily = portfolio_value * (daily_volatility / 100) * z;
    const var_period = var_daily * Math.sqrt(period_days);

    return {
        portfolio_value: `$${portfolio_value.toLocaleString()}`,
        confidence_level: `${confidence}%`,
        period: `${period_days} zile`,
        daily_volatility: `${daily_volatility}%`,
        VaR: `$${var_period.toFixed(2)}`,
        interpretation: `Cu ${confidence}% încredere, nu vei pierde mai mult de $${var_period.toFixed(2)} în ${period_days} ${period_days === 1 ? 'zi' : 'zile'}.`,
        worst_case: `$${(var_period * 1.5).toFixed(2)} (worst case scenario)`,
        tip: '💡 VaR nu surprinde evenimente extreme (Black Swan). Folosește-l ca ghid, nu ca garanție.'
    };
}
