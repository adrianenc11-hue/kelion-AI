// Auto-patch ALL Netlify functions to use vault
// Adds require + await patchProcessEnv() to every function that uses process.env
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'netlify', 'functions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const SKIP = ['get-secret.js']; // Don't patch itself
const REQUIRE_LINE = "const { patchProcessEnv } = require('./get-secret');";
const PATCH_LINE = "await patchProcessEnv();";

const total = files.length;
let done = 0, patched = 0, skipped = 0, already = 0;

function bar(pct) {
    const f = Math.round(pct / 5);
    return '\u2588'.repeat(f) + '\u2591'.repeat(20 - f);
}

for (const file of files) {
    done++;
    const pct = Math.round((done / total) * 100);
    process.stdout.write('\r[' + bar(pct) + '] ' + pct + '% (' + done + '/' + total + ') ' + file.padEnd(35));

    if (SKIP.includes(file)) { skipped++; continue; }

    const filePath = path.join(dir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    // Already patched?
    if (code.includes('patchProcessEnv')) { already++; continue; }

    // Only patch files that use process.env
    if (!code.includes('process.env.')) { skipped++; continue; }

    // Step 1: Add require at top (after any initial comments)
    const lines = code.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            insertAt = i + 1;
        } else {
            break;
        }
    }
    lines.splice(insertAt, 0, REQUIRE_LINE, '');

    // Step 2: Add await patchProcessEnv() after "exports.handler = async" try {
    let code2 = lines.join('\n');
    // Find the first "try {" inside exports.handler
    const handlerMatch = code2.match(/exports\.handler\s*=\s*async[^{]*\{/);
    if (handlerMatch) {
        const handlerPos = code2.indexOf(handlerMatch[0]) + handlerMatch[0].length;
        // Find next "try {"
        const tryPos = code2.indexOf('try {', handlerPos);
        if (tryPos !== -1) {
            const afterTry = tryPos + 'try {'.length;
            code2 = code2.substring(0, afterTry) + '\n        ' + PATCH_LINE + ' // Load vault secrets' + code2.substring(afterTry);
        }
    }

    fs.writeFileSync(filePath, code2, 'utf8');
    patched++;
}

console.log('\n');
console.log('=== VAULT PATCH COMPLETE ===');
console.log('Patched: ' + patched);
console.log('Already had: ' + already);
console.log('Skipped (no env): ' + skipped);
console.log('Total files: ' + total);
