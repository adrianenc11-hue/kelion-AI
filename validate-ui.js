/**
 * validate-ui.js — Scanner pentru bug-uri grosolane HTML/UI
 * Versiunea 2.0 — cu tracking corect pentru <script>, template literals, etc.
 * 
 * VERIFICĂ:
 * 1. Template literals ${...} expuse ca text vizibil în HTML (nu în <script>)
 * 2. Elemente HTML care nu ar trebui să existe (ex: buton Login în nav)
 * 3. Imagini/modele 3D referențiate dar inexistente
 * 4. Texte placeholder nerezolvate
 * 5. Linkuri interne broken
 * 6. Duplicate IDs
 * 
 * UTILIZARE: node validate-ui.js
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, 'public');
const ERRORS = [];
const WARNINGS = [];

function addError(file, line, msg) {
    ERRORS.push({ file: path.basename(file), line, msg });
}
function addWarning(file, line, msg) {
    WARNINGS.push({ file: path.basename(file), line, msg });
}

// ═══ CHECK 1: Template Literals în HTML (nu în <script>) ═══
// Versiune îmbunătățită: parsează CORECT blocurile <script>
function checkTemplateLiterals(filePath, content) {
    const lines = content.split('\n');
    let inScript = false;
    let inStyle = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim().toLowerCase();

        // Track entering/leaving <script> and <style> blocks
        // Handle both <script> and <script type="..."> and </script>
        if (/<script[\s>]/i.test(line) && !trimmed.startsWith('//')) inScript = true;
        if (/<\/script>/i.test(line)) { inScript = false; continue; }
        if (/<style[\s>]/i.test(line)) inStyle = true;
        if (/<\/style>/i.test(line)) { inStyle = false; continue; }

        // Skip EVERYTHING inside <script> and <style> blocks
        // This is the key fix — ${...} inside script tags are JS template literals, NOT HTML bugs
        if (inScript || inStyle) continue;

        // Find ${...} in pure HTML content (outside of script/style tags)
        const templateLiteralRegex = /\$\{[^}]+\}/g;
        let match;
        while ((match = templateLiteralRegex.exec(line)) !== null) {
            // Additional check: skip if it's in an HTML comment
            if (line.trim().startsWith('<!--')) continue;
            addError(filePath, i + 1, `Template literal in pure HTML: "${match[0]}" — va apărea RAW pe ecran`);
        }
    }
}

// ═══ CHECK 2: Elemente care NU ar trebui să existe ═══
function checkForbiddenElements(filePath, content) {
    const rules = [
        {
            file: 'landing.html',
            patterns: [
                {
                    test: (c) => {
                        // Check for a visible Login button in navigation (not footer)
                        // Look for nav section with login link
                        const navMatch = c.match(/<nav[^>]*>[\s\S]*?<\/nav>/gi);
                        if (navMatch) {
                            for (const nav of navMatch) {
                                if (/login|log\s*in/i.test(nav) && /<a\s/i.test(nav)) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    },
                    msg: 'Buton "Log In" găsit în navigație — ar trebui eliminat (review_notes.md punct 1)'
                },
                {
                    test: (c) => /Skip.*default\s*to\s*Kelion/i.test(c),
                    msg: 'Text "Skip — default to Kelion" găsit — ar trebui eliminat (punct 3)'
                }
            ]
        },
        {
            file: 'app.html',
            patterns: [
                {
                    test: (c) => {
                        // Check placeholder is in English
                        const match = c.match(/id="chat-input"[^>]*placeholder="([^"]+)"/i);
                        if (match && !/type your message/i.test(match[1])) {
                            return true;
                        }
                        return false;
                    },
                    msg: 'Placeholder chat NU e în engleză — ar trebui "Type your message..." (punct 16)'
                }
            ]
        }
    ];

    const basename = path.basename(filePath);
    for (const rule of rules) {
        if (basename !== rule.file) continue;
        for (const p of rule.patterns) {
            if (p.test(content)) {
                addError(filePath, 0, p.msg);
            }
        }
    }
}

// ═══ CHECK 3: Referințe la fișiere inexistente ═══
function checkBrokenReferences(filePath, content) {
    const lines = content.split('\n');
    let inScript = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<script[\s>]/i.test(line)) inScript = true;
        if (/<\/script>/i.test(line)) { inScript = false; continue; }
        if (inScript) continue; // Skip JS references — only check HTML src/href

        const refRegex = /(?:src|href)=["'](?!https?:\/\/|mailto:|tel:|#|data:|javascript:|\{|\/\/)([^"'?#]+)/gi;
        let match;
        while ((match = refRegex.exec(line)) !== null) {
            const ref = match[1];
            if (ref.includes('${') || ref.includes('{{')) continue;
            if (ref.startsWith('/.netlify/')) continue;
            if (ref.endsWith('.js') || ref.endsWith('.css')) continue; // Skip resource files

            const fullPath = ref.startsWith('/')
                ? path.join(PUBLIC_DIR, ref)
                : path.join(path.dirname(filePath), ref);

            if (!fs.existsSync(fullPath)) {
                addWarning(filePath, i + 1, `Referință la fișier inexistent: "${ref}"`);
            }
        }
    }
}

// ═══ CHECK 4: Duplicate IDs ═══
function checkDuplicateIds(filePath, content) {
    const idRegex = /\bid=["']([^"']+)["']/gi;
    const ids = {};
    let match;

    // Only check IDs in HTML, not in script
    const lines = content.split('\n');
    let inScript = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<script[\s>]/i.test(line)) inScript = true;
        if (/<\/script>/i.test(line)) { inScript = false; continue; }
        if (inScript) continue;

        while ((match = idRegex.exec(line)) !== null) {
            const id = match[1];
            if (ids[id]) {
                addWarning(filePath, i + 1, `ID duplicat: "${id}" (prima apariție: linia ${ids[id]})`);
            } else {
                ids[id] = i + 1;
            }
        }
    }
}

// ═══ CHECK 5: Texte vizibile neinternționat ═══
function checkVisibleBugs(filePath, content) {
    const lines = content.split('\n');
    let inScript = false;
    let inStyle = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/<script[\s>]/i.test(line)) inScript = true;
        if (/<\/script>/i.test(line)) { inScript = false; continue; }
        if (/<style[\s>]/i.test(line)) inStyle = true;
        if (/<\/style>/i.test(line)) { inStyle = false; continue; }
        if (inScript || inStyle) continue;

        // Check for unresolved Angular/Vue/React bindings in pure HTML
        if (/\{\{[^}]+\}\}/.test(line) && !line.trim().startsWith('<!--')) {
            addWarning(filePath, i + 1, `Posibil binding nerezolvat: "${line.trim().substring(0, 60)}..."`);
        }
    }
}

// ═══ MAIN ═══
function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   🔍 VALIDATE-UI v2.0 — Scanner HTML    ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    const htmlFiles = fs.readdirSync(PUBLIC_DIR)
        .filter(f => f.endsWith('.html'))
        .map(f => path.join(PUBLIC_DIR, f));

    console.log(`📋 Scanning ${htmlFiles.length} HTML files...\n`);

    for (const file of htmlFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        checkTemplateLiterals(file, content);
        checkForbiddenElements(file, content);
        checkBrokenReferences(file, content);
        checkDuplicateIds(file, content);
        checkVisibleBugs(file, content);
    }

    // Print results
    if (ERRORS.length > 0) {
        console.log(`\n❌ ERORI CRITICE: ${ERRORS.length}`);
        console.log('─'.repeat(60));
        for (const e of ERRORS) {
            console.log(`  ❌ ${e.file}:${e.line} — ${e.msg}`);
        }
    }

    if (WARNINGS.length > 0) {
        console.log(`\n⚠️  WARNINGS: ${WARNINGS.length}`);
        console.log('─'.repeat(60));
        for (const w of WARNINGS) {
            console.log(`  ⚠️  ${w.file}:${w.line} — ${w.msg}`);
        }
    }

    if (ERRORS.length === 0 && WARNINGS.length === 0) {
        console.log('✅ Toate verificările UI au trecut! Zero probleme.');
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`TOTAL: ${ERRORS.length} erori, ${WARNINGS.length} warnings`);
    console.log(`${'═'.repeat(60)}`);

    if (ERRORS.length > 0) {
        process.exit(1);
    }
}

main();
