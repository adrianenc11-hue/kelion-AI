// Fix-patch: Move patchProcessEnv() BEFORE any env reads
// Some functions read process.env BEFORE the try block where patchProcessEnv() was placed
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'netlify', 'functions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const SKIP = ['get-secret.js'];
const total = files.length;
let done = 0, fixed = 0, ok = 0, skip = 0;

function bar(pct) {
    const f = Math.round(pct / 5);
    return '\u2588'.repeat(f) + '\u2591'.repeat(20 - f);
}

for (const file of files) {
    done++;
    const pct = Math.round((done / total) * 100);
    process.stdout.write('\r[' + bar(pct) + '] ' + pct + '% (' + done + '/' + total + ') ' + file.padEnd(35));

    if (SKIP.includes(file)) { skip++; continue; }

    const filePath = path.join(dir, file);
    let code = fs.readFileSync(filePath, 'utf8');

    if (!code.includes('patchProcessEnv')) { skip++; continue; }

    // Check if env is read BEFORE patchProcessEnv call
    const handlerMatch = code.match(/exports\.handler\s*=\s*async[^{]*\{/);
    if (!handlerMatch) { ok++; continue; }

    const handlerStart = code.indexOf(handlerMatch[0]) + handlerMatch[0].length;
    const patchPos = code.indexOf('await patchProcessEnv()', handlerStart);

    if (patchPos === -1) { ok++; continue; }

    // Check for process.env reads between handler start and patchProcessEnv
    const beforePatch = code.substring(handlerStart, patchPos);

    if (!beforePatch.includes('process.env.') || beforePatch.includes('process.env.URL') || beforePatch.includes('process.env.NODE_ENV')) {
        // Only URL/NODE_ENV before patch is fine
        const envReads = beforePatch.match(/process\.env\.\w+/g) || [];
        const nonCritical = envReads.filter(e => !e.includes('URL') && !e.includes('NODE_ENV'));
        if (nonCritical.length === 0) { ok++; continue; }
    }

    // Fix: Move patchProcessEnv RIGHT after handler opening brace
    // Remove existing await patchProcessEnv line
    code = code.replace(/\n\s*await patchProcessEnv\(\);\s*\/\/[^\n]*\n/, '\n');

    // Add it right after handler opening + any CORS/OPTIONS checks
    // Find the position after the handler opens
    const afterHandler = code.indexOf(handlerMatch[0]) + handlerMatch[0].length;

    // Insert patchProcessEnv as first line of handler
    code = code.substring(0, afterHandler) +
        '\n    await patchProcessEnv(); // Load vault secrets FIRST' +
        code.substring(afterHandler);

    fs.writeFileSync(filePath, code, 'utf8');
    fixed++;
}

console.log('\n');
console.log('=== FIX-PATCH COMPLETE ===');
console.log('Fixed (moved patchProcessEnv earlier): ' + fixed);
console.log('Already OK: ' + ok);
console.log('Skipped: ' + skip);
console.log('Total: ' + total);
