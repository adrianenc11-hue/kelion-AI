// ═══ BABY MONITOR MODE — Monitorizare bebeluș cu AI ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'start': return respond(200, startMonitor(body));
            case 'status': return respond(200, getStatus(body));
            case 'analyze_sound': return respond(200, analyzeSound(body));
            case 'settings': return respond(200, getSettings(body));
            case 'sleep_log': return respond(200, sleepLog(body));
            default: return respond(400, { error: 'Actions: start, status, analyze_sound, settings, sleep_log' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function startMonitor({ child_name = 'bebeluș', sensitivity = 'medium' }) {
    return {
        status: '🟢 Monitor activ',
        child_name,
        sensitivity,
        features: ['🎤 Detectare sunet/plâns', '📹 Cameră continuă', '🌡️ Monitorizare zgomot ambiental', '⏰ Cronometru somn', '🔔 Alerte instant'],
        settings: { sound_threshold: sensitivity === 'high' ? 30 : sensitivity === 'medium' ? 50 : 70, video_quality: '720p (low bandwidth)', night_vision: true, alert_delay: '3 secunde' },
        tip: '📱 Ține telefonul la 1-2m de bebeluș, cu ecranul în jos pentru a reduce lumina.',
        battery_tip: '🔋 Conectează la încărcător pentru sesiuni lungi.'
    };
}

function getStatus({ _session_start, duration_min = 120 }) {
    return {
        status: '🟢 Activ',
        monitoring_duration: `${Math.floor(duration_min / 60)}h ${duration_min % 60}min`,
        events: [
            { time: '21:05', type: '😴 Adormit', note: 'Sunet redus sub prag' },
            { time: '22:30', type: '🔊 Scâncet scurt', duration: '15 sec', action: 'Auto-calmat' },
            { time: '00:15', type: '😢 Plâns detectat', duration: '2 min', alert_sent: true },
            { time: '00:20', type: '😴 Readormit', note: 'După hrănire' }
        ],
        summary: { total_sleep: '5h 12min', wake_ups: 2, longest_sleep_stretch: '2h 25min', avg_noise_level: '28 dB' }
    };
}

function analyzeSound({ decibel = 45, duration_sec = 5, pattern = 'continuous' }) {
    let classification;
    if (decibel < 30) classification = { type: '😴 Liniște', action: 'none', alert: false };
    else if (decibel < 50 && duration_sec < 10) classification = { type: '😐 Scâncet scurt', action: 'Observare', alert: false };
    else if (decibel < 60) classification = { type: '😟 Agitație', action: 'Verificare în 2 min', alert: false };
    else if (decibel < 75) classification = { type: '😢 Plâns moderat', action: 'Mergi la bebeluș', alert: true };
    else classification = { type: '😭 Plâns intens', action: 'Mergi IMEDIAT', alert: true, urgent: true };

    return {
        analysis: classification,
        decibel: `${decibel} dB`,
        duration: `${duration_sec} sec`,
        pattern,
        possible_causes: decibel >= 60 ? ['Foame (2-3h de la ultima masă?)', 'Scutec murdar', 'Dischomfort (temperatură?)', 'Nevoie de atenție', 'Colici (dacă e seara)'] : ['Vis', 'Mișcare în somn', 'Zgomot ambiental'],
        tip: decibel >= 60 ? '🍼 Verifică: scutec, foame, temperatură, ore de somn' : '✅ Normal — bebelușii fac sunete în somn'
    };
}

function getSettings() {
    return {
        sensitivity_levels: [
            { level: 'low', threshold: '70 dB', best_for: 'Bebeluși care dorm adânc, mediu zgomotos' },
            { level: 'medium', threshold: '50 dB', best_for: 'Recomandat — echilibru bun' },
            { level: 'high', threshold: '30 dB', best_for: 'Nou-născuți, părinți anxioși' }
        ],
        alert_options: ['🔔 Notificare push', '🔊 Sunet alarmă', '📳 Vibrație', '💡 Flash ecran'],
        recommended: { sensitivity: 'medium', night_vision: true, auto_record: true, alert_delay: '3 sec' }
    };
}

function sleepLog({ entries = [] }) {
    if (!entries.length) {
        return {
            template: { date: '2025-02-07', bedtime: '20:30', wake_time: '06:30', wake_ups: 2, notes: '' },
            age_recommendations: [
                { age: '0-3 luni', total: '14-17h', naps: '3-5 x 30min-2h' },
                { age: '4-6 luni', total: '12-16h', naps: '2-3 x 1-2h' },
                { age: '7-12 luni', total: '12-15h', naps: '2 x 1-2h' },
                { age: '1-2 ani', total: '11-14h', naps: '1 x 1-3h' },
                { age: '3-5 ani', total: '10-13h', naps: '0-1 x 1h' }
            ]
        };
    }
    const totalSleep = entries.reduce((acc, e) => acc + (e.sleep_hours || 0), 0);
    return { entries: entries.length, avg_sleep: `${Math.round(totalSleep / entries.length * 10) / 10}h`, avg_wakeups: Math.round(entries.reduce((a, e) => a + (e.wake_ups || 0), 0) / entries.length * 10) / 10 };
}
