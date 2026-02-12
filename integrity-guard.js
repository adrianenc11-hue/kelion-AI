// ═══════════════════════════════════════════════════════════════
// K INTEGRITY GUARD — 6-Layer Protection System
// REGULA DE AUR: SE REPARĂ CODUL SURSĂ, NU SE OCOLEȘTE TESTUL!
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══ ENFORCEMENT RULES — ALWAYS DISPLAYED ═══
const ENFORCEMENT_RULES = [
    'REGULĂ 0: NICIUN AI NU MODIFICĂ NIMIC FĂRĂ APROBARE EXPLICITĂ! ZERO INIȚIATIVĂ! NU DISTRUGE SOFTUL!',
    'REGULĂ 1: SE REPARĂ CODUL SURSĂ, NU SE MODIFICĂ TESTELE!',
    'REGULĂ 2: NU SE RAPORTEAZĂ AUDIT TRECUT FĂRĂ VERIFICARE FIZICĂ!',
    'REGULĂ 3: DEZACTIVARE IMPOSIBILĂ FĂRĂ APROBAREA ADMIN!',
    'REGULĂ 4: FIECARE AUDIT TESTEAZĂ INTEGRITATEA!',
    'REGULĂ 5: MONITORIZARE PERMANENTĂ, LIVE, NON-STOP!',
    'REGULĂ 6: NU SE OCOLESC ERORILE — SE REPARĂ!',
    'REGULĂ 7: SE REZOLVĂ TOATE ALERTELE PÂNĂ LA ZERO, DEPLOY, APOI SE MERGE MAI DEPARTE!',
    'REGULĂ 8: ESLINT — SCANARE SINTAXĂ + LOGICĂ LA FIECARE SESIUNE!',
    'REGULĂ 9: NPM AUDIT — VERIFICARE VULNERABILITĂȚI DEPENDENȚE!',
    'REGULĂ 10: LIGHTHOUSE — AUDIT PERFORMANCE, SEO, ACCESIBILITATE!',
    'REGULĂ 11: PLAYWRIGHT E2E — TESTARE FUNCȚIONALĂ COMPLETĂ DUPĂ FINALIZARE FEATURE!',
    'REGULĂ 12: DEAD CODE — DETECTARE COD NEFOLOSIT LA FIECARE AUDIT!'
];

// ═══ LAYER 1: SHA256 INTEGRITY MANIFEST ═══
// Hash-urile REALE sunt stocate în Supabase vault (INTEGRITY_HASHES)
// Hash-urile locale din integrity-manifest.json sunt doar backup
// Dacă vault-ul nu e disponibil, se folosesc cele locale ca fallback

const CRITICAL_FILES = [
    'validate-code.js',
    'validate-fake-data.js',
    'audit-live.js',
    'audit_complete.js',
    'netlify/functions/truth-detector.js',
    'netlify/functions/smart-brain.js'
];

// Files that should NEVER be modified to make tests pass
const IMMUTABLE_TEST_FILES = [
    'validate-code.js',
    'validate-fake-data.js',
    'audit-live.js',
    'audit_complete.js',
    'integrity-guard.js'
];

async function getServerHashes() {
    // Try to fetch hashes from Supabase vault via get-secret
    try {
        const { patchProcessEnv } = require('./netlify/functions/get-secret');
        await patchProcessEnv();
        const vaultHashes = process.env.INTEGRITY_HASHES;
        if (vaultHashes) {
            return JSON.parse(vaultHashes);
        }
    } catch (e) {
        // Vault not available locally — use manifest fallback
    }

    // Fallback: read from local manifest
    try {
        const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'integrity-manifest.json'), 'utf8'));
        const hashes = {};
        for (const [file, info] of Object.entries(manifest.protected_files)) {
            hashes[file] = info.sha256;
        }
        return hashes;
    } catch (e) {
        console.error('❌ CRITICAL: Cannot read integrity-manifest.json!');
        return null;
    }
}

function computeHash(filePath) {
    try {
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    } catch (e) {
        return 'FILE_NOT_FOUND';
    }
}

// ═══ LAYER 2: LIVE INTEGRITY CHECK ═══
async function checkIntegrity() {
    console.log('');
    console.log('🛡️  K INTEGRITY GUARD — Verificare integritate fișiere critice');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    const expectedHashes = await getServerHashes();
    if (!expectedHashes) {
        console.error('🚨 CRITICAL: Nu pot obține hash-urile de referință!');
        console.error('   Setați INTEGRITY_HASHES în Supabase vault sau verificați integrity-manifest.json');
        process.exit(1);
    }

    let tampered = 0;
    let passed = 0;
    let missing = 0;
    const violations = [];

    for (const file of CRITICAL_FILES) {
        const fullPath = path.join(__dirname, file);
        const currentHash = computeHash(fullPath);
        const expectedHash = expectedHashes[file];

        if (!expectedHash) {
            console.log(`  ⚠️  ${file} — nu are hash de referință`);
            missing++;
            continue;
        }

        if (currentHash === 'FILE_NOT_FOUND') {
            console.log(`  ❌ ${file} — LIPSĂ! Fișierul critic a fost șters!`);
            tampered++;
            violations.push({ file, issue: 'DELETED', severity: 'CRITICAL' });
            continue;
        }

        if (currentHash !== expectedHash) {
            console.log(`  🚨 ${file} — MODIFICAT! Hash nu corespunde!`);
            console.log(`     Expected: ${expectedHash.substring(0, 16)}...`);
            console.log(`     Actual:   ${currentHash.substring(0, 16)}...`);
            tampered++;
            violations.push({ file, issue: 'TAMPERED', expected: expectedHash, actual: currentHash, severity: 'CRITICAL' });
        } else {
            console.log(`  ✅ ${file} — INTACT`);
            passed++;
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    // ═══ LAYER 3: READ-ONLY CHECK ═══
    console.log('');
    console.log('🔒 Layer 3: Verificare permisiuni fișiere...');
    for (const file of IMMUTABLE_TEST_FILES) {
        const fullPath = path.join(__dirname, file);
        try {
            const stats = fs.statSync(fullPath);
            // Check if file is writable
            try {
                fs.accessSync(fullPath, fs.constants.W_OK);
                // File is writable — mark as warning
                console.log(`  ⚠️  ${file} — writable (recomandare: set read-only)`);
            } catch (e) {
                console.log(`  🔒 ${file} — read-only ✅`);
            }
        } catch (e) {
            console.log(`  ❌ ${file} — nu există!`);
        }
    }

    // ═══ LAYER 4: GIT STATUS CHECK ═══
    console.log('');
    console.log('📋 Layer 4: Verificare Git changes pe fișiere critice...');
    try {
        const { execSync } = require('child_process');
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8', cwd: __dirname });
        const modifiedCritical = CRITICAL_FILES.filter(f => gitStatus.includes(f));
        if (modifiedCritical.length > 0) {
            console.log(`  🚨 Fișiere critice modificate în Git:`);
            for (const f of modifiedCritical) {
                console.log(`     ❌ ${f}`);
            }
        } else {
            console.log('  ✅ Niciun fișier critic modificat în Git');
        }
    } catch (e) {
        console.log('  ⚠️  Git nu e disponibil sau nu e repository');
    }

    // ═══ REZULTAT FINAL ═══
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    if (tampered > 0) {
        console.log(`  🚨 INTEGRITATE COMPROMISĂ: ${tampered} fișiere modificate!`);
        console.log('');
        console.log('  ╔═══════════════════════════════════════════════════════╗');
        console.log('  ║  REGULĂ DE AUR: SE REPARĂ CODUL SURSĂ,              ║');
        console.log('  ║  NU SE MODIFICĂ TESTELE/VALIDĂRILE!                  ║');
        console.log('  ║                                                       ║');
        console.log('  ║  Dacă un test pică → fix-ul e în codul testat,       ║');
        console.log('  ║  NICIODATĂ în fișierul de test/validare.             ║');
        console.log('  ╚═══════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  ❌ DEPLOY BLOCAT — Restaurați fișierele originale!');
        console.log('');

        // Save violation report
        const report = {
            timestamp: new Date().toISOString(),
            status: 'INTEGRITY_VIOLATED',
            tampered,
            passed,
            violations,
            action_required: 'RESTORE_ORIGINAL_FILES',
            rule: 'FIX SOURCE CODE, NEVER MODIFY TESTS'
        };
        fs.writeFileSync(path.join(__dirname, 'integrity_report.json'), JSON.stringify(report, null, 2));
        console.log('  📄 Raport salvat: integrity_report.json');
        process.exit(1);
    } else {
        console.log(`  ✅ INTEGRITATE VERIFICATĂ: ${passed}/${CRITICAL_FILES.length} fișiere INTACTE`);
        console.log(`  🛡️  Truth Shield: ACTIV`);
        console.log(`  🔒 Protecție: 6 LAYERS ACTIVE`);
        console.log('');

        const report = {
            timestamp: new Date().toISOString(),
            status: 'INTEGRITY_VERIFIED',
            files_checked: passed,
            total_files: CRITICAL_FILES.length,
            all_layers_active: true,
            physical_verification_required: true
        };
        fs.writeFileSync(path.join(__dirname, 'integrity_report.json'), JSON.stringify(report, null, 2));
    }

    // ═══ LAYER 6: ENFORCEMENT RULES — ALWAYS DISPLAYED ═══
    console.log('');
    console.log('📜 Layer 6: Reguli de enforcement obligatorii:');
    for (const rule of ENFORCEMENT_RULES) {
        console.log(`  🔹 ${rule}`);
    }
    console.log('');
    console.log('  ⚠️  ATENȚIE: Rezultatul auditului este INVALID dacă');
    console.log('     nu s-a verificat FIZIC (browser, endpoint live).');
    console.log('     Doar scriptul trecut NU e suficient!');
    console.log('');
}

// ═══ LAYER 5: EXPORT PENTRU ALTE SCRIPTURI ═══
// Alte scripturi pot importa și verifica integritatea
module.exports = { checkIntegrity, computeHash, CRITICAL_FILES, IMMUTABLE_TEST_FILES, ENFORCEMENT_RULES };

// Run if called directly
if (require.main === module) {
    checkIntegrity().catch(err => {
        console.error('Integrity guard error:', err);
        process.exit(1);
    });
}
