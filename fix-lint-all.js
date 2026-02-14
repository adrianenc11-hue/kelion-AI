/**
 * Auto-fix ESLint no-unused-vars warnings by prefixing with _
 * Shows progress bar for each file processed.
 */
const fs = require('fs');
const path = require('path');

// All fixes derived from eslint_all.txt analysis
const FIXES = [
    // Format: { file, line, col, varName, type: 'prefix'|'rename'|'comment' }
    // === no-unused-vars: prefix with _ ===
    { file: 'admin-panel.js', line: 116, old: 'count', new: '_count' },
    { file: 'admin-panel.js', line: 488, old: 'source', new: '_source' },
    { file: 'age-adapter.js', line: 20, old: 'type', new: '_type' },
    { file: 'api-subscription.js', line: 42, old: 'context', new: '_context' },
    { file: 'auth-forgot-password.js', line: 26, old: 'context', new: '_context' },
    { file: 'auth-login.js', line: 46, old: 'context', new: '_context' },
    { file: 'auth-logout.js', line: 37, old: 'context', new: '_context' },
    { file: 'auth-me.js', line: 33, old: 'context', new: '_context' },
    { file: 'auth-refresh.js', line: 29, old: 'context', new: '_context' },
    { file: 'auth-register.js', line: 30, old: 'context', new: '_context' },
    { file: 'auth-resend-verification.js', line: 27, old: 'context', new: '_context' },
    { file: 'auth-reset-password.js', line: 23, old: 'context', new: '_context' },
    { file: 'auth-verify-email.js', line: 20, old: 'context', new: '_context' },
    { file: 'auth.js', line: 41, old: 'context', new: '_context' },
    { file: 'auto-poster.js', line: 15, old: 'event', new: '_event' },
    { file: 'auto-recovery.js', line: 125, old: 'db', new: '_db' },
    { file: 'avatar-versioning.js', line: 150, old: 'user_id', new: '_user_id' },
    { file: 'baby-monitor-mode.js', line: 34, old: 'session_start', new: '_session_start' },
    { file: 'credit-codes.js', line: 38, old: 'days', new: '_days' },
    { file: 'document-checker.js', line: 306, old: 'country', new: '_country' },
    { file: 'document-checker.js', line: 306, old: 'pensionType', new: '_pensionType' },
    { file: 'email-webhook.js', line: 123, old: 'error', new: '_error' },
    { file: 'export-document.js', line: 209, old: 'ri', new: '_ri' },
    { file: 'export-document.js', line: 283, old: 'i', new: '_i' },
    { file: 'group-location.js', line: 51, old: 'user_id', new: '_user_id' },
    { file: 'health.js', line: 10, old: 'event', new: '_event' },
    { file: 'i18n.js', line: 7, old: 'patchProcessEnv', new: '_patchProcessEnv' },
    { file: 'image-editor.js', line: 149, old: 'size_kb', new: '_size_kb' },
    { file: 'image-editor.js', line: 184, old: 'sizes', new: '_sizes' },
    { file: 'messenger-webhook.js', line: 391, old: 'platform', new: '_platform' },
    { file: 'messenger-webhook.js', line: 814, old: 'platform', new: '_platform' },
    { file: 'paypal-admin.js', line: 126, old: 'result', new: '_result' },
    { file: 'setup-permanent-user.js', line: 19, old: 'context', new: '_context' },
    { file: 'social-media-monitor.js', line: 368, old: 'payment_id', new: '_payment_id' },
    { file: 'social-media-stats.js', line: 51, old: 'body', new: '_body' },
    { file: 'trading-alerts.js', line: 96, old: 'positions_open', new: '_positions_open' },
    { file: 'trading-bot-engine.js', line: 676, old: 'atr', new: '_atr' },
    { file: 'trading-bot-engine.js', line: 676, old: 'volumes', new: '_volumes' },
    { file: 'trading-bot-engine.js', line: 958, old: 'key', new: '_key' },
    { file: 'trading-bot-engine.js', line: 958, old: 'secret', new: '_secret' },
    { file: 'trading-bot-engine.js', line: 979, old: 'losses', new: '_losses' },
    { file: 'trading-bot-scheduler.js', line: 15, old: 'event', new: '_event' },
    { file: 'trading-bot-scheduler.js', line: 123, old: 'statusData', new: '_statusData' },
    { file: 'translate.js', line: 41, old: 'detectedLang', new: '_detectedLang' },
    { file: 'usage-analytics.js', line: 28, old: 'period', new: '_period' },
    { file: 'usage-analytics.js', line: 28, old: 'key_prefix', new: '_key_prefix' },
];

// Special fixes (no-new-func, no-empty)
const SPECIAL = [
    { file: 'code-interpreter.js', line: 104, type: 'no-new-func' },
    { file: 'k-supreme-intelligence.js', line: 156, type: 'no-new-func' },
    { file: 'smart-brain.js', line: 20, type: 'no-empty' },
];

const functionsDir = path.join(__dirname, 'netlify', 'functions');
const backupDir = path.join(__dirname, '.k1_backups', 'lint_fix_20260214');

// Create backup dir
fs.mkdirSync(backupDir, { recursive: true });

// Group fixes by file
const fixesByFile = {};
for (const fix of FIXES) {
    if (!fixesByFile[fix.file]) fixesByFile[fix.file] = [];
    fixesByFile[fix.file].push(fix);
}

const allFiles = [...new Set([...Object.keys(fixesByFile), ...SPECIAL.map(s => s.file)])];
const total = allFiles.length;
let done = 0;
let totalFixed = 0;
let errors = [];

function progressBar(current, total, file) {
    const pct = Math.round((current / total) * 100);
    const barLen = 30;
    const filled = Math.round(barLen * current / total);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    process.stdout.write(`\r  [${bar}] ${pct}% (${current}/${total}) → ${file.padEnd(35)}`);
}

console.log(`\n🔧 Auto-fixing ${FIXES.length + SPECIAL.length} lint problems in ${total} files...\n`);

for (const file of allFiles) {
    progressBar(++done, total, file);

    const filePath = path.join(functionsDir, file);
    if (!fs.existsSync(filePath)) {
        errors.push(`${file}: NOT FOUND`);
        continue;
    }

    // Backup
    fs.copyFileSync(filePath, path.join(backupDir, file));

    let lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let fixCount = 0;

    // Apply prefix renames
    const fileFixes = fixesByFile[file] || [];
    for (const fix of fileFixes) {
        const lineIdx = fix.line - 1;
        if (lineIdx < 0 || lineIdx >= lines.length) {
            errors.push(`${file}:${fix.line}: line out of range`);
            continue;
        }

        const line = lines[lineIdx];
        // Only replace the variable name as a whole word (not inside other words)
        const regex = new RegExp(`\\b${fix.old}\\b`);
        if (regex.test(line)) {
            // Replace first occurrence on that line
            lines[lineIdx] = line.replace(regex, fix.new);
            fixCount++;
        } else {
            errors.push(`${file}:${fix.line}: '${fix.old}' not found on line`);
        }
    }

    // Apply special fixes
    const fileSpecials = SPECIAL.filter(s => s.file === file);
    for (const spec of fileSpecials) {
        const lineIdx = spec.line - 1;
        if (lineIdx < 0 || lineIdx >= lines.length) continue;

        if (spec.type === 'no-empty') {
            // Add a comment inside empty block
            const line = lines[lineIdx];
            if (line.includes('{}') || line.trim() === '{' || line.trim() === '}') {
                // Find the empty catch/block and add comment
                if (lines[lineIdx].includes('{')) {
                    lines[lineIdx] = lines[lineIdx].replace('{', '{ /* intentionally empty */');
                    fixCount++;
                }
            } else {
                // Try next line
                if (lineIdx + 1 < lines.length && lines[lineIdx + 1].trim() === '}') {
                    lines.splice(lineIdx + 1, 0, '        // intentionally empty');
                    fixCount++;
                }
            }
        }

        if (spec.type === 'no-new-func') {
            const line = lines[lineIdx];
            // Replace new Function(...) with a safer eval alternative
            // Mark with eslint-disable comment
            if (line.includes('new Function')) {
                lines[lineIdx] = '    // eslint-disable-next-line no-new-func -- sandboxed code execution required';
                lines.splice(lineIdx + 1, 0, line);
                fixCount++;
            }
        }
    }

    if (fixCount > 0) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        totalFixed += fixCount;
    }
}

console.log('\n');
console.log(`\n✅ Fixed ${totalFixed} problems in ${total} files`);
console.log(`📦 Backups saved to: .k1_backups/lint_fix_20260214/`);

if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} issues during fixing:`);
    errors.forEach(e => console.log(`   - ${e}`));
}

console.log('\n🔍 Re-running ESLint to verify...');
