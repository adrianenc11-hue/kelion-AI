// Clean audit — no output overlap, sequential results, progress bar
const API = 'https://kelionai.app/.netlify/functions';

const tests = [
    { name: 'Vault Health', url: `${API}/get-secret`, method: 'POST', body: { action: 'health' }, expect: 'vault_keys' },
    { name: 'Health Endpoint', url: `${API}/health`, expect: 'json' },
    { name: 'Env Check', url: `${API}/env-check`, expect: 'json' },
    { name: 'Chat (real Q)', url: `${API}/chat`, method: 'POST', body: { message: 'What is 2+2?' }, expect: 'response' },
    { name: 'Smart Brain', url: `${API}/smart-brain`, method: 'POST', body: { question: 'Capital of France?' }, expect: 'response' },
    { name: 'Web Search', url: `${API}/web-search`, method: 'POST', body: { query: 'weather London' }, expect: 'no500' },
    { name: 'Weather (GPS)', url: `${API}/weather?lat=51.5074&lon=-0.1278`, expect: 'json' },
    { name: 'Chat 400 test', url: `${API}/chat`, method: 'POST', body: {}, expect: '400' },
    { name: 'SmartBrain 400', url: `${API}/smart-brain`, method: 'POST', body: {}, expect: '400' },
    { name: 'DALLE 400 test', url: `${API}/dalle`, method: 'POST', body: {}, expect: '400' },
    { name: 'Whisper 400', url: `${API}/whisper`, method: 'POST', body: {}, expect: '400' },
    { name: 'Vision 400', url: `${API}/vision`, method: 'POST', body: {}, expect: '400' },
    { name: 'TTS endpoint', url: `${API}/elevenlabs-tts`, method: 'POST', body: {}, expect: 'no500' },
    { name: 'Free Trial', url: `${API}/free-trial`, method: 'POST', body: { action: 'check' }, expect: 'no500' },
    { name: 'Stripe Checkout', url: `${API}/stripe-checkout`, method: 'POST', body: {}, expect: 'no500' },
    { name: 'Page Tracking', url: `${API}/page-tracking`, method: 'POST', body: { page: '/' }, expect: 'no500' },
];

function bar(pct) {
    const f = Math.round(pct / 5);
    return '\u2588'.repeat(f) + '\u2591'.repeat(20 - f);
}

async function run() {
    const total = tests.length;
    let done = 0, pass = 0, fail = 0;
    const report = [];

    for (const t of tests) {
        done++;
        const pct = Math.round((done / total) * 100);
        process.stdout.write('\r[' + bar(pct) + '] ' + pct + '% (' + done + '/' + total + ') ' + t.name.padEnd(20));

        let status = 'FAIL', detail = '', ms = 0;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            const opts = { method: t.method || 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal };
            if (t.body) opts.body = JSON.stringify(t.body);

            const start = Date.now();
            const r = await fetch(t.url, opts);
            ms = Date.now() - start;
            clearTimeout(timer);
            const txt = await r.text();

            if (t.expect === '400') {
                status = (r.status === 400) ? 'PASS' : 'FAIL';
                detail = 'Expected 400, got ' + r.status;
            } else if (t.expect === 'no500') {
                status = (r.status < 500 || r.status === 503) ? 'PASS' : 'FAIL';
                detail = r.status + ': ' + txt.substring(0, 80);
            } else {
                status = (r.status >= 200 && r.status < 500) ? 'PASS' : 'FAIL';
                detail = r.status + ': ' + txt.substring(0, 80);
            }
        } catch (e) {
            status = 'FAIL';
            detail = 'TIMEOUT/ERROR: ' + (e.message || 'unknown').substring(0, 60);
        }

        if (status === 'PASS') pass++; else fail++;
        report.push({ name: t.name, status, ms, detail });
    }

    // Clean results - printed AFTER progress bar completes
    console.log('\n');
    console.log('====================================');
    console.log('  REZULTATE AUDIT LIVE');
    console.log('====================================');
    for (const r of report) {
        const icon = r.status === 'PASS' ? 'v' : 'X';
        console.log('[' + icon + '] ' + r.name.padEnd(20) + '(' + r.ms + 'ms) ' + r.detail);
    }
    console.log('====================================');
    console.log('TOTAL: ' + pass + ' PASS / ' + fail + ' FAIL (din ' + total + ')');
    console.log('====================================');
}

run().catch(e => console.error('FATAL:', e.message));
