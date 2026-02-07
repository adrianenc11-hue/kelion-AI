#!/usr/bin/env node
/**
 * HONEST MANUAL AUDIT - No fake passes, truth only
 * Tests each endpoint with REAL request, captures EXACT response
 */

const https = require('https');
const fs = require('fs');

const BASE = 'https://kelionai.app/.netlify/functions';

const tests = [
    { name: 'health', method: 'GET', path: '/health' },
    { name: 'realtime-token', method: 'GET', path: '/realtime-token' },
    { name: 'chat', method: 'POST', path: '/chat', body: { message: 'hi' } },
    { name: 'chat-stream', method: 'POST', path: '/chat-stream', body: { message: 'hi' } },
    { name: 'smart-brain', method: 'POST', path: '/smart-brain', body: { question: 'test' } },
    { name: 'vision-compliment', method: 'POST', path: '/vision-compliment', body: { image: null } },
    { name: 'memory-cleanup', method: 'POST', path: '/memory-cleanup', body: { dry_run: true } },
    { name: 'generate-image', method: 'POST', path: '/generate-image', body: { prompt: 'test', size: '1024x1024' } },
    { name: 'dalle', method: 'POST', path: '/dalle', body: { prompt: 'test', size: '1024x1024' } },
    { name: 'run-migration', method: 'POST', path: '/run-migration', body: { dry_run: true } },
    { name: 'whisper', method: 'POST', path: '/whisper', body: {} },
    { name: 'vision', method: 'POST', path: '/vision', body: {} }
];

async function testEndpoint(test) {
    return new Promise((resolve) => {
        const url = new URL(BASE + test.path);
        const postData = test.body ? JSON.stringify(test.body) : '';

        const options = {
            method: test.method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            },
            timeout: 15000
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    name: test.name,
                    status: res.statusCode,
                    body: data.slice(0, 500),
                    success: res.statusCode >= 200 && res.statusCode < 300
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                name: test.name,
                status: 0,
                body: err.message,
                success: false
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                name: test.name,
                status: 0,
                body: 'TIMEOUT',
                success: false
            });
        });

        if (postData) req.write(postData);
        req.end();
    });
}

(async function () {
    console.log('🔍 HONEST AUDIT - Testing all endpoints...\n');

    const results = [];
    for (const test of tests) {
        process.stdout.write(`Testing ${test.name}... `);
        const result = await testEndpoint(test);
        results.push(result);
        console.log(result.success ? '✅ ' + result.status : '❌ ' + result.status);
    }

    const summary = {
        timestamp: new Date().toISOString(),
        total: results.length,
        passing: results.filter(r => r.success).length,
        failing: results.filter(r => !r.success).length,
        results
    };

    fs.writeFileSync('honest_audit.json', JSON.stringify(summary, null, 2));
    fs.writeFileSync('honest_audit_summary.txt',
        `HONEST AUDIT ${summary.timestamp}\n` +
        `TOTAL: ${summary.total}\n` +
        `PASSING: ${summary.passing}\n` +
        `FAILING: ${summary.failing}\n\n` +
        results.map(r => `${r.success ? '✅' : '❌'} ${r.name}: ${r.status}`).join('\n')
    );

    console.log(`\n📊 FINAL: ${summary.passing}/${summary.total} passing`);
    console.log(`Saved: honest_audit.json`);

    process.exit(summary.failing > 0 ? 1 : 0);
})();
