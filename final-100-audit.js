#!/usr/bin/env node
// FINAL 100% AUDIT - All endpoints must return 200 with proper payloads

const https = require('https');
const fs = require('fs');

const tests = [
    { name: 'health', method: 'GET', path: '/.netlify/functions/health' },
    { name: 'realtime-token', method: 'GET', path: '/.netlify/functions/realtime-token' },
    { name: 'chat', method: 'POST', path: '/.netlify/functions/chat', body: { message: 'hi' } },
    { name: 'chat-stream', method: 'POST', path: '/.netlify/functions/chat-stream', body: { message: 'hi' } },
    { name: 'smart-brain', method: 'POST', path: '/.netlify/functions/smart-brain', body: { question: 'test', requireVerification: false } },
    { name: 'vision-compliment', method: 'POST', path: '/.netlify/functions/vision-compliment', body: { image: null } },
    { name: 'memory-cleanup', method: 'POST', path: '/.netlify/functions/memory-cleanup', body: {} },
    { name: 'generate-image', method: 'POST', path: '/.netlify/functions/generate-image', body: { prompt: 'test', size: '1024x1024' } },
    { name: 'dalle', method: 'POST', path: '/.netlify/functions/dalle', body: { prompt: 'test', size: '1024x1024' } },
    { name: 'run-migration', method: 'POST', path: '/.netlify/functions/run-migration', body: { dry_run: true } },
    // These WILL fail with 400 unless we send real data - that's EXPECTED
    { name: 'whisper', method: 'POST', path: '/.netlify/functions/whisper', body: {} },
    { name: 'vision', method: 'POST', path: '/.netlify/functions/vision', body: {} }
];

async function test(t) {
    return new Promise((resolve) => {
        const url = new URL('https://kelionai.app' + t.path);
        const data = t.body ? JSON.stringify(t.body) : '';

        const req = https.request(url, {
            method: t.method,
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
            timeout: 20000
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => resolve({
                name: t.name,
                status: res.statusCode,
                pass: res.statusCode >= 200 && res.statusCode < 300,
                body: body.slice(0, 200)
            }));
        });
        req.on('error', e => resolve({ name: t.name, status: 0, pass: false, body: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ name: t.name, status: 0, pass: false, body: 'TIMEOUT' }); });
        if (data) req.write(data);
        req.end();
    });
}

(async () => {
    console.log('🔍 FINAL 100% AUDIT\n');
    const results = [];
    for (const t of tests) {
        process.stdout.write(`${t.name}... `);
        const r = await test(t);
        results.push(r);
        console.log(r.pass ? `✅ ${r.status}` : `❌ ${r.status}`);
    }

    const pass = results.filter(r => r.pass).length;
    const total = results.length;

    fs.writeFileSync('final_100_audit.txt',
        `FINAL AUDIT\n` +
        `PASS: ${pass}/${total}\n\n` +
        results.map(r => `${r.pass ? '✅' : '❌'} ${r.name}: ${r.status}`).join('\n')
    );

    console.log(`\n📊 ${pass}/${total} passing`);
    process.exit(pass === total ? 0 : 1);
})();
