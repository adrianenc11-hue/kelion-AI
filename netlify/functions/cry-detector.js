// ═══ CRY DETECTOR — AI Classification via Smart Brain ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'classify': return respond(200, await classifyCry(body));
            case 'tips': return respond(200, await getTips(body));
            default: return respond(400, { error: 'Actions: classify, tips' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function callBrain(prompt) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const res = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, mode: 'medical-advisory' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Brain failed');
    return data.reply || data.answer;
}

async function classifyCry({ intensity = 'medium', duration_sec = 30, pattern = 'continuous', time_of_day = 'evening', last_fed_hours = 2, diaper_changed_hours = 1, age_months = 3, additional_signs = '' }) {
    const prompt = `Ești un expert pediatric AI. Analizează următoarele simptome ale plânsului unui bebeluș și oferă o clasificare probabilistică.

Date:
- Intensitate plâns: ${intensity}
- Durată: ${duration_sec} secunde
- Pattern: ${pattern}
- Ora zilei: ${time_of_day}
- Ultima hrănire: acum ${last_fed_hours} ore
- Scutec schimbat: acum ${diaper_changed_hours} ore
- Vârsta bebelușului: ${age_months} luni
- Semne suplimentare: ${additional_signs || 'niciuna observată'}

Returnează DOAR JSON valid:
{
  "classification": {"cause": "Cauza probabilă cu emoji", "probability": "XX%", "action": "Ce să facă părintele", "signs": "Semne de urmărit"},
  "all_possible_causes": [{"cause": "...", "probability": "XX%", "action": "...", "signs": "..."}],
  "emergency": null sau "text dacă e urgență",
  "note": "Disclaimer medical"
}

IMPORTANT: Întotdeauna include disclaimer că e o estimare orientativă și nu înlocuiește medicul.`;

    const reply = await callBrain(prompt);

    try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return {
                ...data,
                context: { intensity, duration: `${duration_sec}s`, pattern, time_of_day, last_fed: `${last_fed_hours}h ago`, age: `${age_months} luni` },
                ai_generated: true,
                engine: 'smart-brain'
            };
        }
    } catch (e) { /* fallback */ }

    return {
        classification: { cause: '⚠️ Analiză AI', probability: '—', action: reply.substring(0, 500), signs: '' },
        context: { intensity, duration: `${duration_sec}s`, pattern, time_of_day },
        note: '⚠️ Aceasta e o estimare orientativă. Încrederea părintelui este cel mai bun ghid. Consultă medicul pediatru.',
        ai_generated: true
    };
}

async function getTips({ age_months = 3, situation = 'general' }) {
    const prompt = `Oferă 5 sfaturi practice pentru un părinte cu un bebeluș de ${age_months} luni, în situația: ${situation}.
Returnează DOAR JSON: {"tips": [{"emoji": "...", "title": "...", "description": "..."}]}`;

    const reply = await callBrain(prompt);
    try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) { /* fallback */ }

    return { tips: [{ emoji: '💡', title: 'Sfat', description: reply.substring(0, 300) }] };
}
