#!/usr/bin/env node
/**
 * validate-fake-data.js — Blocheaza deploy daca detecteaza date fake
 * 
 * REGULA: ZERO FALSIFICARE
 * - Nu sponsori falsi (Apple, Microsoft, NVIDIA, AWS nu sunt parteneri)
 * - Nu testimoniale inventate (nume fictive)
 * - Nu statistici neverificabile (99.9% uptime etc)
 * - Nu "Trusted by Industry Leaders" fara dovada
 * 
 * Rulare: node validate-fake-data.js
 * Exit 0 = OK, Exit 1 = date fake detectate
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');

// ═══ REGULI DE DETECTIE ═══

const FAKE_SPONSORS = [
    'Apple',
    'Microsoft',
    'NVIDIA',
    'AWS',
    'Amazon',
    'Meta AI',
    'Samsung',
    'Tesla',
    'IBM'
];

const FAKE_PARTNERSHIP_PHRASES = [
    'Trusted by Industry Leaders',
    'Our Sponsors',
    'Industry Partners',
    'Platform Partner',
    'Cloud Infrastructure',
    'GPU Acceleration',
    'Cloud Services'
];

const FAKE_TESTIMONIAL_PATTERNS = [
    /— \w+ [A-Z]\., \w+ (?:Plan|User)/g,  // "— Sarah M., Family Plan"
    /— [A-Z][a-z]+ [A-Z]\./g,              // "— James T."
];

const FAKE_STATS = [
    '99.9%',
    '99.99%',
    '100%',
    '10,000+',
    '50,000+',
    '100,000+'
];

// Companiile REALE care sunt API-uri folosite efectiv
const REAL_PARTNERS = [
    'OpenAI',      // API folosit in chat.js, smart-brain.js
    'Google',      // Gemini API
    'Deepgram',    // Voice TTS
    'Stripe',      // Plati
    'PayPal',      // Plati
    'Supabase',    // Database
    'Netlify',     // Hosting
    'ElevenLabs',  // TTS
    'Anthropic',   // Claude API
];

// ═══ SCANARE ═══

let totalIssues = 0;
const issues = [];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(__dirname, filePath);
    const lines = content.split('\n');

    // Check sponsori falsi
    FAKE_SPONSORS.forEach(sponsor => {
        lines.forEach((line, i) => {
            // Skip daca e in context de privacy policy sau terms (legitimate mention)
            if (filePath.includes('privacy.html') || filePath.includes('terms.html')) return;
            // Skip comments
            if (line.trim().startsWith('//') || line.trim().startsWith('<!--')) return;
            // Skip acest script
            if (filePath.includes('validate-fake-data')) return;

            if (line.includes(`>${sponsor}<`) || line.includes(`"${sponsor}"`) || line.includes(`'${sponsor}'`)) {
                // Verifica daca nu e unul real
                if (!REAL_PARTNERS.includes(sponsor)) {
                    issues.push({
                        file: relPath,
                        line: i + 1,
                        type: 'FAKE_SPONSOR',
                        severity: 'CRITICAL',
                        detail: `Sponsor fals detectat: "${sponsor}" — nu este partener real al Kelion AI`,
                        content: line.trim().substring(0, 100)
                    });
                    totalIssues++;
                }
            }
        });
    });

    // Check fraze de parteneriat fals
    FAKE_PARTNERSHIP_PHRASES.forEach(phrase => {
        lines.forEach((line, i) => {
            if (filePath.includes('validate-fake-data')) return;
            if (line.includes(phrase)) {
                issues.push({
                    file: relPath,
                    line: i + 1,
                    type: 'FAKE_PARTNERSHIP',
                    severity: 'CRITICAL',
                    detail: `Fraza de parteneriat fals: "${phrase}"`,
                    content: line.trim().substring(0, 100)
                });
                totalIssues++;
            }
        });
    });

    // Check testimoniale fake
    FAKE_TESTIMONIAL_PATTERNS.forEach(pattern => {
        lines.forEach((line, i) => {
            if (filePath.includes('validate-fake-data')) return;
            const matches = line.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    issues.push({
                        file: relPath,
                        line: i + 1,
                        type: 'FAKE_TESTIMONIAL',
                        severity: 'WARNING',
                        detail: `Testimonial posibil inventat: "${match}"`,
                        content: line.trim().substring(0, 100)
                    });
                    totalIssues++;
                });
            }
        });
    });

    // Check statistici fake (doar in HTML, nu in JS logic)
    if (filePath.endsWith('.html')) {
        FAKE_STATS.forEach(stat => {
            lines.forEach((line, i) => {
                if (line.includes(stat) && !line.includes('<!--') && !line.includes('//')) {
                    // Check context — daca e in "data-target" sau afisare vizibila
                    if (line.includes('data-target') || line.includes('Uptime') || line.includes('Users')) {
                        issues.push({
                            file: relPath,
                            line: i + 1,
                            type: 'FAKE_STAT',
                            severity: 'WARNING',
                            detail: `Statistica neverificabila: "${stat}"`,
                            content: line.trim().substring(0, 100)
                        });
                        totalIssues++;
                    }
                }
            });
        });
    }
}

// ═══ GASIRE FISIERE ═══

function findHTMLFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            files.push(...findHTMLFiles(fullPath));
        } else if (file.endsWith('.html') || file.endsWith('.js')) {
            files.push(fullPath);
        }
    });
    return files;
}

// ═══ EXECUTIE ═══

console.log('');
console.log('🔍 Scanare date fake in frontend...');
console.log('');

const files = findHTMLFiles(PUBLIC_DIR);
files.forEach(scanFile);

// ═══ RAPORT ═══

if (issues.length === 0) {
    console.log('  ✅ ZERO date fake detectate');
    console.log(`  📄 Scanat: ${files.length} fisiere`);
    console.log('');
    process.exit(0);
} else {
    const critical = issues.filter(i => i.severity === 'CRITICAL');
    const warnings = issues.filter(i => i.severity === 'WARNING');

    console.log(`  ❌ ${issues.length} probleme detectate (${critical.length} CRITICAL, ${warnings.length} WARNING)`);
    console.log('');

    if (critical.length > 0) {
        console.log('  ═══ CRITICAL — Blocheaza deploy ═══');
        critical.forEach(issue => {
            console.log(`  ❌ ${issue.file}:${issue.line} — ${issue.detail}`);
        });
        console.log('');
    }

    if (warnings.length > 0) {
        console.log('  ═══ WARNINGS ═══');
        warnings.forEach(issue => {
            console.log(`  ⚠️  ${issue.file}:${issue.line} — ${issue.detail}`);
        });
        console.log('');
    }

    // Salveaza raport
    const report = {
        timestamp: new Date().toISOString(),
        total_issues: issues.length,
        critical: critical.length,
        warnings: warnings.length,
        files_scanned: files.length,
        issues: issues
    };

    fs.writeFileSync('fake_data_report.json', JSON.stringify(report, null, 2));
    console.log('  📄 Raport salvat: fake_data_report.json');

    if (critical.length > 0) {
        console.log('');
        console.log('  🚫 DEPLOY BLOCAT — rezolva problemele CRITICAL');
        process.exit(1);
    } else {
        console.log('');
        console.log('  ⚠️  Deploy permis dar cu warnings');
        process.exit(0);
    }
}
