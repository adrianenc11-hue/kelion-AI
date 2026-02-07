/**
 * K Dev Tools — Gives K developer capabilities (previously 0%)
 * Wires K's voice/chat interface to existing backend functions:
 * 
 * ✅ Editare cod     → AI code review + suggestions via smart-brain
 * ✅ Deploy          → k-auto-deploy.js (status, deploys, health)
 * ✅ Debug/analiză   → k-analyze-codebase.js + code-audit.js
 * ✅ Search codebase → k-analyze-codebase.js with AI query
 * ✅ Terminal         → Command suggestions (safe, no execution)
 * ✅ Generare imagini → generate-image.js (DALL-E 3)
 */

(function () {
    'use strict';
    console.log('🛠️ K Dev Tools loading...');

    const API_BASE = '/.netlify/functions';

    // ═══════════════════════════════════════════════════════════
    // CORE: Async fetch with K_TASKS integration
    // ═══════════════════════════════════════════════════════════

    async function kDevFetch(url, body = null) {
        const opts = {
            method: body ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        return res.json();
    }

    // ═══════════════════════════════════════════════════════════
    // 1. GENERARE IMAGINI — DALL-E 3 via generate-image.js
    // ═══════════════════════════════════════════════════════════

    window.K_generateImage = async function (prompt, size = '1024x1024') {
        const taskName = `🎨 Generare: ${prompt.substring(0, 25)}...`;

        const task = window.K_TASKS?.add(taskName, async (onProgress) => {
            onProgress(10);
            if (typeof window.speak === 'function') {
                window.speak('Generez imaginea acum...');
            }

            onProgress(30);
            const data = await kDevFetch(`${API_BASE}/generate-image`, { prompt, size });
            onProgress(90);

            if (data.success && data.url) {
                // Display image in workspace or modal
                showDevResult('🎨 Imagine Generată', `
                    <div style="text-align:center;">
                        <img src="${data.url}" alt="${prompt}" style="max-width:100%;border-radius:12px;margin:10px 0;box-shadow:0 4px 20px rgba(0,255,255,0.2);" />
                        <p style="color:#aaa;font-size:0.85rem;margin-top:8px;">${data.revised_prompt || prompt}</p>
                        <a href="${data.url}" target="_blank" style="color:#00ffff;text-decoration:none;">📥 Descarcă imaginea</a>
                    </div>
                `);

                if (typeof window.speak === 'function') {
                    window.speak('Am generat imaginea! O poți vedea și descărca.');
                }

                window.K_MEMORY?.remember(`Generare imagine: ${prompt}`, `URL: ${data.url}`, { mode: 'image' });
            } else {
                throw new Error(data.error || 'Generare eșuată');
            }

            onProgress(100);
            return data;
        }, { category: 'image', priority: 'normal' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 2. DEPLOY STATUS — via k-auto-deploy.js
    // ═══════════════════════════════════════════════════════════

    window.K_deployStatus = async function () {
        const task = window.K_TASKS?.add('🚀 Deploy Status', async (onProgress) => {
            onProgress(20);
            const [status, deploys, health] = await Promise.all([
                kDevFetch(`${API_BASE}/k-auto-deploy`, { action: 'status' }),
                kDevFetch(`${API_BASE}/k-auto-deploy`, { action: 'deploys' }),
                kDevFetch(`${API_BASE}/k-auto-deploy`, { action: 'health' })
            ]);
            onProgress(80);

            const healthIcon = health.healthy ? '✅' : '⚠️';
            const deploysHtml = (deploys.deploys || []).slice(0, 5).map(d => `
                <tr>
                    <td style="padding:4px 8px;color:#00ffff;">${d.id || '?'}</td>
                    <td style="padding:4px 8px;">${d.state || '?'}</td>
                    <td style="padding:4px 8px;color:#888;">${d.deploy_time || '?'}</td>
                    <td style="padding:4px 8px;color:${d.error ? '#ff4444' : '#00ff00'};">${d.error || '✓'}</td>
                </tr>
            `).join('');

            showDevResult('🚀 Deploy Status', `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;">
                        <div style="color:#888;font-size:0.8rem;">Site</div>
                        <div style="color:#fff;font-weight:600;">${status.site || 'kelionai.app'}</div>
                    </div>
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;">
                        <div style="color:#888;font-size:0.8rem;">Status</div>
                        <div style="color:#00ff00;font-weight:600;">${healthIcon} ${status.state || 'active'}</div>
                    </div>
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;">
                        <div style="color:#888;font-size:0.8rem;">Ultimul Deploy</div>
                        <div style="color:#fff;">${status.last_deploy ? new Date(status.last_deploy).toLocaleString() : 'N/A'}</div>
                    </div>
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;">
                        <div style="color:#888;font-size:0.8rem;">Health</div>
                        <div>${health.checks ? health.checks.map(c => `${c.status === 200 ? '✅' : '❌'} ${c.endpoint} (${c.latency}ms)`).join('<br>') : 'N/A'}</div>
                    </div>
                </div>
                ${deploysHtml ? `
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
                        <th style="text-align:left;padding:4px 8px;color:#888;">ID</th>
                        <th style="text-align:left;padding:4px 8px;color:#888;">Status</th>
                        <th style="text-align:left;padding:4px 8px;color:#888;">Durată</th>
                        <th style="text-align:left;padding:4px 8px;color:#888;">Erori</th>
                    </tr></thead>
                    <tbody>${deploysHtml}</tbody>
                </table>` : ''}
            `);

            if (typeof window.speak === 'function') {
                window.speak(`Site-ul este ${health.healthy ? 'sănătos' : 'cu probleme'}. Ultimul deploy: ${status.last_deploy ? 'recent' : 'necunoscut'}.`);
            }

            onProgress(100);
            return { status, deploys, health };
        }, { category: 'deploy', priority: 'normal' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 3. DEBUG / ANALIZĂ COD — via k-analyze-codebase.js
    // ═══════════════════════════════════════════════════════════

    window.K_analyzeCode = async function (query = '') {
        const task = window.K_TASKS?.add('🔍 Analiză Cod', async (onProgress) => {
            onProgress(10);
            if (typeof window.speak === 'function') {
                window.speak('Analizez codul...');
            }

            onProgress(30);
            const data = await kDevFetch(`${API_BASE}/k-analyze-codebase`, {
                query: query || 'Provide a comprehensive analysis of the codebase architecture, key systems, and potential improvements.'
            });
            onProgress(80);

            const categoriesHtml = data.categories ? Object.entries(data.categories)
                .filter(([_, v]) => v.count > 0)
                .map(([cat, info]) => `
                    <div style="background:rgba(0,255,255,0.06);padding:8px 12px;border-radius:8px;margin:4px 0;">
                        <span style="color:#00ffff;font-weight:600;">${cat}</span>
                        <span style="color:#888;float:right;">${info.count} fișiere</span>
                        <div style="font-size:0.75rem;color:#666;margin-top:4px;">${info.files?.join(', ') || ''}</div>
                    </div>
                `).join('') : '';

            showDevResult('🔍 Analiză Codebase', `
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;flex:1;text-align:center;">
                        <div style="font-size:1.5rem;color:#00ffff;font-weight:700;">${data.total_functions || 0}</div>
                        <div style="color:#888;font-size:0.8rem;">Funcții</div>
                    </div>
                    <div style="background:rgba(0,255,255,0.08);padding:12px;border-radius:10px;flex:1;text-align:center;">
                        <div style="font-size:1.5rem;color:#00ffff;font-weight:700;">${data.total_size_kb || 0}KB</div>
                        <div style="color:#888;font-size:0.8rem;">Total</div>
                    </div>
                </div>
                ${categoriesHtml}
                ${data.ai_analysis ? `
                    <div style="margin-top:12px;padding:12px;background:rgba(0,255,255,0.04);border-left:3px solid #00ffff;border-radius:0 8px 8px 0;">
                        <div style="color:#00ffff;font-weight:600;margin-bottom:8px;">🤖 Analiză AI</div>
                        <div style="color:#ccc;white-space:pre-wrap;font-size:0.85rem;line-height:1.5;">${data.ai_analysis}</div>
                    </div>
                ` : ''}
            `);

            if (typeof window.speak === 'function') {
                const summary = data.ai_analysis ? data.ai_analysis.substring(0, 200) : `Am analizat ${data.total_functions} funcții, ${data.total_size_kb} KB total.`;
                window.speak(summary);
            }

            onProgress(100);
            return data;
        }, { category: 'debug', priority: 'normal' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 4. SEARCH CODEBASE — AI-powered code search
    // ═══════════════════════════════════════════════════════════

    window.K_searchCode = async function (query) {
        if (!query) {
            if (typeof window.speak === 'function') window.speak('Ce cauți în cod?');
            return;
        }

        const task = window.K_TASKS?.add(`🔎 Search: ${query.substring(0, 20)}`, async (onProgress) => {
            onProgress(20);
            const data = await kDevFetch(`${API_BASE}/k-analyze-codebase`, {
                query: `Search the codebase for: "${query}". List relevant files, functions, and code patterns that match this query.`
            });
            onProgress(80);

            showDevResult(`🔎 Search: "${query}"`, `
                <div style="padding:12px;background:rgba(0,255,255,0.04);border-radius:8px;">
                    <div style="color:#ccc;white-space:pre-wrap;font-size:0.85rem;line-height:1.5;">${data.ai_analysis || 'Niciun rezultat.'}</div>
                </div>
                <div style="margin-top:8px;color:#888;font-size:0.75rem;">
                    Scanate: ${data.total_functions || 0} funcții | ${data.total_size_kb || 0} KB
                </div>
            `);

            if (typeof window.speak === 'function') {
                window.speak(data.ai_analysis ? data.ai_analysis.substring(0, 150) : 'Nu am găsit rezultate.');
            }

            onProgress(100);
            return data;
        }, { category: 'search', priority: 'normal' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 5. CODE AUDIT — via code-audit.js
    // ═══════════════════════════════════════════════════════════

    window.K_codeAudit = async function () {
        const task = window.K_TASKS?.add('📊 Code Audit', async (onProgress) => {
            onProgress(20);
            const data = await kDevFetch(`${API_BASE}/code-audit`);
            onProgress(70);

            const largest = (data.largest || []).map(f => `
                <tr>
                    <td style="padding:3px 8px;color:#fff;">${f.name}</td>
                    <td style="padding:3px 8px;color:#00ffff;text-align:right;">${f.size_kb} KB</td>
                </tr>
            `).join('');

            showDevResult('📊 Code Audit', `
                <div style="text-align:center;margin-bottom:12px;">
                    <span style="font-size:2rem;color:#00ffff;font-weight:700;">${data.total_functions || 0}</span>
                    <span style="color:#888;"> funcții | </span>
                    <span style="font-size:2rem;color:#00ffff;font-weight:700;">${data.total_size_kb || 0}</span>
                    <span style="color:#888;"> KB</span>
                </div>
                <div style="color:#888;font-size:0.8rem;margin-bottom:8px;">Top 5 fișiere:</div>
                <table style="width:100%;font-size:0.85rem;">${largest}</table>
            `);

            if (typeof window.speak === 'function') {
                window.speak(`Audit complet. ${data.total_functions} funcții backend, total ${data.total_size_kb} kilobytes.`);
            }

            onProgress(100);
            return data;
        }, { category: 'audit', priority: 'normal' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 6. CODE REVIEW — AI-powered review via smart-brain
    // ═══════════════════════════════════════════════════════════

    window.K_reviewCode = async function (code, language = 'javascript') {
        if (!code) {
            if (typeof window.speak === 'function') window.speak('Trimite-mi codul pe care vrei să-l revizuiesc.');
            return;
        }

        const task = window.K_TASKS?.add('📝 Code Review', async (onProgress) => {
            onProgress(10);
            const data = await kDevFetch(`${API_BASE}/smart-brain`, {
                question: `Act as a senior developer. Review this ${language} code. Provide: 1) Bugs/issues found, 2) Security concerns, 3) Performance improvements, 4) Best practices suggestions, 5) Corrected version if needed.\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``
            });
            onProgress(80);

            const review = data.reply || data.combined || data.answer || 'Review indisponibil.';

            showDevResult('📝 Code Review', `
                <div style="padding:12px;background:rgba(0,255,255,0.04);border-radius:8px;white-space:pre-wrap;font-size:0.85rem;line-height:1.5;color:#ccc;">
                    ${review.replace(/</g, '&lt;')}
                </div>
                <div style="margin-top:8px;color:#888;font-size:0.75rem;">
                    Engine: ${data.engine || 'cascade'} | Model: ${data.model || 'auto'}
                </div>
            `);

            if (typeof window.speak === 'function') {
                window.speak('Am terminat review-ul codului. ' + review.substring(0, 150));
            }

            onProgress(100);
            return review;
        }, { category: 'code', priority: 'high' });

        return task?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // 7. TERMINAL COMMAND SUGGESTIONS — Safe, no execution
    // ═══════════════════════════════════════════════════════════

    window.K_suggestCommand = async function (task) {
        if (!task) return;

        const result = window.K_TASKS?.add('💻 Terminal Assist', async (onProgress) => {
            onProgress(20);
            const data = await kDevFetch(`${API_BASE}/smart-brain`, {
                question: `As a DevOps expert, suggest the exact terminal commands for this task: "${task}". 
                Environment: Netlify, Node.js, Windows PowerShell.
                Format: numbered list with explanations. Include safety warnings for destructive commands.`
            });
            onProgress(80);

            const suggestion = data.reply || data.combined || data.answer || 'Nu pot sugera.';

            showDevResult('💻 Terminal Assist', `
                <div style="padding:12px;background:rgba(0,20,0,0.3);border:1px solid rgba(0,255,0,0.2);border-radius:8px;white-space:pre-wrap;font-size:0.85rem;line-height:1.5;color:#0f0;font-family:monospace;">
                    ${suggestion.replace(/</g, '&lt;')}
                </div>
                <div style="margin-top:8px;color:#ff8800;font-size:0.75rem;">
                    ⚠️ Verifică comenzile înainte de executare!
                </div>
            `);

            if (typeof window.speak === 'function') {
                window.speak('Am pregătit comenzile. Verifică-le înainte de executare.');
            }

            onProgress(100);
            return suggestion;
        }, { category: 'terminal', priority: 'normal' });

        return result?.promise;
    };

    // ═══════════════════════════════════════════════════════════
    // SHARED: Display results panel
    // ═══════════════════════════════════════════════════════════

    function showDevResult(title, contentHtml) {
        // Try workspace panel first
        if (window.kelionWorkspace?.show) {
            window.kelionWorkspace.show(title, contentHtml);
            return;
        }

        // Fallback: modal overlay
        let panel = document.getElementById('k-dev-result-panel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'k-dev-result-panel';
            panel.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                z-index: 100000; background: rgba(8,8,20,0.96);
                border: 1px solid rgba(0,255,255,0.25); border-radius: 16px;
                padding: 20px; color: #fff; font-family: 'Inter', sans-serif;
                max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
                backdrop-filter: blur(20px);
                box-shadow: 0 8px 40px rgba(0,255,255,0.15), 0 0 60px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="margin:0;color:#00ffff;font-size:1.1rem;">${title}</h3>
                <button onclick="document.getElementById('k-dev-result-panel').style.display='none'" 
                    style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;">✕</button>
            </div>
            <div style="font-size:0.9rem;line-height:1.5;">${contentHtml}</div>
        `;
        panel.style.display = 'block';
    }

    // ═══════════════════════════════════════════════════════════
    // CHAT INTEGRATION — Auto-detect dev commands in chat
    // ═══════════════════════════════════════════════════════════

    window.K_processDevCommand = function (message) {
        const lower = message.toLowerCase().trim();

        // Image generation triggers
        if (/^(genereaz[ăa]|creaz[ăa]|draw|generate|make)\s+(o\s+)?(imagine|image|picture|photo)/i.test(lower)) {
            const prompt = message.replace(/^(genereaz[ăa]|creaz[ăa]|draw|generate|make)\s+(o\s+)?(imagine|image|picture|photo)\s*(cu|of|with|despre)?\s*/i, '');
            if (prompt) {
                window.K_generateImage(prompt);
                return true;
            }
        }

        // Deploy status triggers
        if (/\b(deploy|status|site|health|server)\b/i.test(lower) && /\b(status|cum|check|verif|stare)\b/i.test(lower)) {
            window.K_deployStatus();
            return true;
        }

        // Code analysis triggers
        if (/\b(analiz|analyze|review|audit)\b/i.test(lower) && /\b(cod|code|codebase|proiect)\b/i.test(lower)) {
            window.K_analyzeCode(message);
            return true;
        }

        // Code search triggers
        if (/^(caut[ăa]|search|find|găsește|unde\s+e)/i.test(lower) && /\b(cod|code|func[tț]i|file|fișier)\b/i.test(lower)) {
            window.K_searchCode(message);
            return true;
        }

        // Terminal help triggers
        if (/\b(comand[ăa]|terminal|cmd|powershell|command|run|execut)\b/i.test(lower)) {
            window.K_suggestCommand(message);
            return true;
        }

        // Code audit triggers
        if (/\b(audit|inventar|list[ăa]|functions)\b/i.test(lower)) {
            window.K_codeAudit();
            return true;
        }

        return false; // Not a dev command
    };

    // Expose globally
    window.K_DEV = {
        generateImage: window.K_generateImage,
        deployStatus: window.K_deployStatus,
        analyzeCode: window.K_analyzeCode,
        searchCode: window.K_searchCode,
        codeAudit: window.K_codeAudit,
        reviewCode: window.K_reviewCode,
        suggestCommand: window.K_suggestCommand,
        processCommand: window.K_processDevCommand
    };

    console.log('🛠️ K Dev Tools ready! Available commands:');
    console.log('  🎨 K_generateImage("prompt")  — DALL-E 3 image generation');
    console.log('  🚀 K_deployStatus()           — Site health & deploy history');
    console.log('  🔍 K_analyzeCode("query")     — AI codebase analysis');
    console.log('  🔎 K_searchCode("query")      — Search code with AI');
    console.log('  📊 K_codeAudit()              — Function inventory');
    console.log('  📝 K_reviewCode(code)          — AI code review');
    console.log('  💻 K_suggestCommand("task")    — Terminal command suggestions');

})();
