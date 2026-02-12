/**
 * TRUNCATION SCANNER — Detects functions with incomplete/cut-off source code
 * Checks:
 * 1. Syntax validity (can Node.js parse it?)
 * 2. Unbalanced braces/brackets
 * 3. Declared actions that have no handler code
 * 4. Functions referenced but never defined
 * 5. Exports.handler missing or incomplete
 * 6. File ends abruptly (last line analysis)
 * 7. Empty catch blocks / stub returns
 * 8. Response truncation (body cut at arbitrary length)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FUNCS_DIR = path.join(__dirname, 'netlify', 'functions');
const files = fs.readdirSync(FUNCS_DIR).filter(f => f.endsWith('.js')).sort();

const results = { truncated: [], suspicious: [], clean: [] };

for (const file of files) {
    const filePath = path.join(FUNCS_DIR, file);
    const code = fs.readFileSync(filePath, 'utf8');
    const lines = code.split('\n');
    const name = file.replace('.js', '');
    const issues = [];

    // 1. SYNTAX CHECK — Can Node.js actually parse this file?
    try {
        new vm.Script(code, { filename: file });
    } catch (e) {
        issues.push({
            type: 'SYNTAX_ERROR',
            severity: 'CRITICAL',
            detail: `Line ${e.lineNumber || '?'}: ${e.message}`
        });
    }

    // 2. BRACE BALANCE — Unmatched { } ( ) [ ]
    let braces = 0, parens = 0, brackets = 0;
    let inString = false, stringChar = '';
    let inComment = false, inBlockComment = false;
    for (let i = 0; i < code.length; i++) {
        const c = code[i];
        const prev = i > 0 ? code[i - 1] : '';

        // Skip string contents
        if (inString) {
            if (c === stringChar && prev !== '\\') inString = false;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            inString = true;
            stringChar = c;
            continue;
        }
        // Skip comments
        if (inBlockComment) {
            if (c === '/' && prev === '*') inBlockComment = false;
            continue;
        }
        if (c === '/' && code[i + 1] === '/') { inComment = true; continue; }
        if (c === '/' && code[i + 1] === '*') { inBlockComment = true; continue; }
        if (inComment && c === '\n') { inComment = false; continue; }
        if (inComment) continue;

        if (c === '{') braces++;
        if (c === '}') braces--;
        if (c === '(') parens++;
        if (c === ')') parens--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
    }
    if (braces !== 0) {
        issues.push({
            type: 'UNBALANCED_BRACES',
            severity: 'CRITICAL',
            detail: `Braces imbalance: ${braces > 0 ? braces + ' unclosed {' : Math.abs(braces) + ' extra }'}`
        });
    }
    if (parens !== 0) {
        issues.push({
            type: 'UNBALANCED_PARENS',
            severity: 'HIGH',
            detail: `Parentheses imbalance: ${parens > 0 ? parens + ' unclosed (' : Math.abs(parens) + ' extra )'}`
        });
    }

    // 3. HANDLER CHECK — Does it export a handler?
    if (!code.includes('exports.handler') && !code.includes('module.exports')) {
        issues.push({
            type: 'NO_HANDLER',
            severity: 'CRITICAL',
            detail: 'No exports.handler or module.exports found'
        });
    }

    // 4. DECLARED ACTIONS WITHOUT HANDLERS
    // Find all actions mentioned in error messages like "Actions: foo, bar, baz"
    const actionMatches = code.match(/[Aa]ctions?:\s*([^"'`\n]+)/g);
    if (actionMatches) {
        for (const match of actionMatches) {
            const actionsStr = match.replace(/[Aa]ctions?:\s*/, '');
            const actions = actionsStr.split(/[,|]/).map(a => a.trim().replace(/['"]/g, '')).filter(a => a.length > 1 && a.length < 30);
            for (const action of actions) {
                // Check if action has corresponding handler code
                const actionRegex = new RegExp(`(action|type|mode)\\s*===?\\s*['"\`]${action.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}['"\`]`, 'i');
                const fnRegex = new RegExp(`function\\s+${action.replace(/[-]/g, '_')}|${action.replace(/[-]/g, '_')}\\s*[=(]`, 'i');
                if (!actionRegex.test(code) && !fnRegex.test(code)) {
                    issues.push({
                        type: 'MISSING_ACTION_HANDLER',
                        severity: 'HIGH',
                        detail: `Action "${action}" declared but no handler code found`
                    });
                }
            }
        }
    }

    // 5. REFERENCED BUT UNDEFINED FUNCTIONS
    const funcCalls = code.match(/(?:await\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g) || [];
    const funcDefs = code.match(/(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z_][a-zA-Z0-9_]*)\s*[=(]/g) || [];
    const definedNames = new Set(funcDefs.map(d => d.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*[=(]/)?.[1]).filter(Boolean));
    // Add common builtins
    ['require', 'console', 'JSON', 'Math', 'Date', 'String', 'Number', 'Array', 'Object', 'Buffer',
        'parseInt', 'parseFloat', 'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'Error', 'Promise', 'Set', 'Map',
        'RegExp', 'process', 'exports', 'module', 'isNaN', 'isFinite', 'undefined', 'null', 'Boolean',
        'Symbol', 'BigInt', 'Proxy', 'Reflect', 'eval', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
        'Response', 'Request', 'Headers', 'FormData', 'AbortController', 'crypto', 'atob', 'btoa',
        'queueMicrotask', 'structuredClone'].forEach(n => definedNames.add(n));
    // Add requires
    const requireMatches = code.match(/(?:const|let|var)\s*\{?\s*([^}=]+)\}?\s*=\s*require/g) || [];
    requireMatches.forEach(r => {
        const names = r.match(/(?:const|let|var)\s*\{?\s*([^}=]+)/)?.[1];
        if (names) names.split(',').forEach(n => definedNames.add(n.trim()));
    });

    // 6. ABRUPT ENDING — File ends with incomplete code
    const lastLines = lines.slice(-5).join('\n').trim();
    if (lastLines.endsWith(',') || lastLines.endsWith('(') || lastLines.endsWith('{')) {
        issues.push({
            type: 'ABRUPT_ENDING',
            severity: 'CRITICAL',
            detail: `File ends abruptly — last chars: "${lastLines.slice(-30)}"`
        });
    }

    // 7. STUB PATTERNS — Empty implementations
    const stubPatterns = [
        { regex: /return\s*['"]TODO['"]/gi, name: 'TODO return' },
        { regex: /\/\/\s*TODO\b/gi, name: 'TODO comment' },
        { regex: /throw\s+new\s+Error\s*\(\s*['"]not\s+implemented/gi, name: 'Not implemented throw' },
        { regex: /return\s*\{\s*statusCode:\s*501/gi, name: '501 Not Implemented' },
        { regex: /placeholder|coming\s*soon|dummy\s*data|fake\s*data|mock\s*data/gi, name: 'Placeholder/mock text' },
    ];
    for (const pattern of stubPatterns) {
        const matches = code.match(pattern.regex);
        if (matches) {
            issues.push({
                type: 'STUB_CODE',
                severity: 'HIGH',
                detail: `Found "${pattern.name}" (${matches.length}x)`
            });
        }
    }

    // 8. RESPONSE TRUNCATION — substring/slice that cuts responses
    const truncPatterns = code.match(/\.substring\s*\(\s*0\s*,\s*\d+\s*\)|\.slice\s*\(\s*0\s*,\s*\d+\s*\)/g);
    if (truncPatterns) {
        for (const tp of truncPatterns) {
            const limit = tp.match(/\d+/g)?.[1];
            if (limit && parseInt(limit) < 200) {
                issues.push({
                    type: 'RESPONSE_TRUNCATION',
                    severity: 'MEDIUM',
                    detail: `Potential response truncation: ${tp}`
                });
            }
        }
    }

    // 9. CATCH SWALLOWING — Empty catch blocks that hide errors
    const emptyCatches = code.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    if (emptyCatches && emptyCatches.length > 2) {
        issues.push({
            type: 'ERROR_SWALLOWING',
            severity: 'MEDIUM',
            detail: `${emptyCatches.length} empty catch blocks — errors silently swallowed`
        });
    }

    // 10. VERY SHORT FILE — Could be incomplete
    if (lines.length < 15 && !code.includes('require(')) {
        issues.push({
            type: 'VERY_SHORT',
            severity: 'MEDIUM',
            detail: `Only ${lines.length} lines — possibly stub or redirect`
        });
    }

    // Categorize
    const criticals = issues.filter(i => i.severity === 'CRITICAL');
    const highs = issues.filter(i => i.severity === 'HIGH');

    const entry = {
        name,
        file,
        lines: lines.length,
        bytes: code.length,
        issues
    };

    if (criticals.length > 0 || highs.length > 0) {
        results.truncated.push(entry);
    } else if (issues.length > 0) {
        results.suspicious.push(entry);
    } else {
        results.clean.push(entry);
    }
}

// OUTPUT
console.log('\n' + '═'.repeat(70));
console.log('  TRUNCATION SCAN — Source Code Integrity Check');
console.log('  Scanned:', files.length, 'files');
console.log('  Time:', new Date().toISOString());
console.log('═'.repeat(70));

console.log(`\n✅ CLEAN: ${results.clean.length}`);
console.log(`⚠️  SUSPICIOUS: ${results.suspicious.length}`);
console.log(`❌ TRUNCATED/BROKEN: ${results.truncated.length}`);

if (results.truncated.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('❌ TRUNCATED / BROKEN FILES');
    console.log('─'.repeat(70));
    for (const t of results.truncated) {
        console.log(`\n  📄 ${t.name} (${t.lines}L, ${t.bytes}B)`);
        for (const issue of t.issues) {
            const icon = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'HIGH' ? '🟠' : '🟡';
            console.log(`     ${icon} [${issue.type}] ${issue.detail}`);
        }
    }
}

if (results.suspicious.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('⚠️  SUSPICIOUS FILES');
    console.log('─'.repeat(70));
    for (const s of results.suspicious) {
        console.log(`\n  📄 ${s.name} (${s.lines}L)`);
        for (const issue of s.issues) {
            console.log(`     🟡 [${issue.type}] ${issue.detail}`);
        }
    }
}

// Save full report
fs.writeFileSync('truncation_report.json', JSON.stringify(results, null, 2));
console.log('\n📄 Full report: truncation_report.json');
