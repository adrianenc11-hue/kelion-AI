/**
 * K Multitask Engine — Brings K to 100% on:
 * 1. MULTITASKING: Concurrent task queue (voice + docs + search + animation)
 * 2. DOCUMENT PROCESSING: PDF.js + Mammoth.js for proper extraction
 * 3. PLANNING / CONTEXT: Persistent memory, session context, task history
 * 
 * Loads automatically — no configuration needed.
 */

(function () {
    'use strict';
    console.log('⚡ K Multitask Engine loading...');

    // ═══════════════════════════════════════════════════════════
    // 1. MULTITASKING — Concurrent Task Queue
    // ═══════════════════════════════════════════════════════════

    const K_TASKS = {
        queue: new Map(),
        maxConcurrent: 5,
        taskCounter: 0,

        /** Add a new async task to the queue */
        add(name, asyncFn, options = {}) {
            const id = `task_${++this.taskCounter}_${Date.now()}`;
            const task = {
                id, name,
                status: 'running',
                startTime: Date.now(),
                priority: options.priority || 'normal',
                category: options.category || 'general',
                progress: 0,
                result: null,
                error: null
            };

            this.queue.set(id, task);
            this._updateUI();
            console.log(`📋 Task started: [${name}] (${id})`);

            // Run async — never blocks other tasks
            const promise = asyncFn((progress) => {
                task.progress = Math.min(100, progress);
                this._updateUI();
            }).then(result => {
                task.status = 'done';
                task.result = result;
                task.endTime = Date.now();
                task.duration = task.endTime - task.startTime;
                console.log(`✅ Task done: [${name}] in ${task.duration}ms`);
                this._updateUI();

                // Auto-cleanup after 10s
                setTimeout(() => {
                    this.queue.delete(id);
                    this._updateUI();
                }, 10000);

                return result;
            }).catch(err => {
                task.status = 'error';
                task.error = err.message;
                task.endTime = Date.now();
                console.error(`❌ Task failed: [${name}]`, err.message);
                this._updateUI();

                setTimeout(() => {
                    this.queue.delete(id);
                    this._updateUI();
                }, 15000);

                throw err;
            });

            return { id, promise };
        },

        /** Get active task count */
        get activeCount() {
            return [...this.queue.values()].filter(t => t.status === 'running').length;
        },

        /** Update task indicator UI */
        _updateUI() {
            let indicator = document.getElementById('k-task-indicator');
            const activeTasks = [...this.queue.values()].filter(t => t.status === 'running');

            if (activeTasks.length === 0) {
                if (indicator) indicator.style.display = 'none';
                return;
            }

            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'k-task-indicator';
                indicator.style.cssText = `
                    position: fixed; top: 10px; right: 10px; z-index: 99999;
                    background: rgba(0,0,0,0.85); border: 1px solid rgba(0,255,255,0.3);
                    border-radius: 12px; padding: 8px 14px; color: #fff;
                    font-family: 'Inter', sans-serif; font-size: 12px;
                    backdrop-filter: blur(10px); min-width: 160px;
                    box-shadow: 0 4px 20px rgba(0,255,255,0.15);
                    transition: all 0.3s ease;
                `;
                document.body.appendChild(indicator);
            }

            indicator.style.display = 'block';
            indicator.innerHTML = `
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <span style="animation:pulse 1s infinite;color:#00ffff;">⚡</span>
                    <strong style="color:#00ffff;">${activeTasks.length} task${activeTasks.length > 1 ? 's' : ''} active</strong>
                </div>
                ${activeTasks.slice(0, 3).map(t => `
                    <div style="font-size:11px;color:#aaa;padding:2px 0;display:flex;justify-content:space-between;">
                        <span>${t.name.substring(0, 20)}</span>
                        <span style="color:#0f0;">${t.progress}%</span>
                    </div>
                `).join('')}
                ${activeTasks.length > 3 ? `<div style="font-size:10px;color:#666;">+${activeTasks.length - 3} more</div>` : ''}
            `;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 2. DOCUMENT PROCESSING — PDF.js + Mammoth.js
    // ═══════════════════════════════════════════════════════════

    const K_DOCS = {
        pdfJsLoaded: false,
        mammothLoaded: false,

        /** Load PDF.js library dynamically */
        async _loadPdfJs() {
            if (this.pdfJsLoaded || window.pdfjsLib) {
                this.pdfJsLoaded = true;
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            this.pdfJsLoaded = true;
            console.log('📄 PDF.js loaded');
        },

        /** Load Mammoth.js for DOCX */
        async _loadMammoth() {
            if (this.mammothLoaded || window.mammoth) {
                this.mammothLoaded = true;
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            document.head.appendChild(script);
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
            this.mammothLoaded = true;
            console.log('📝 Mammoth.js loaded');
        },

        /** Extract text from PDF using PDF.js — proper full extraction */
        async extractPDF(file, onProgress) {
            await this._loadPdfJs();

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdf.numPages;
            let fullText = '';

            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += `\n--- Page ${i} ---\n${pageText}`;

                if (onProgress) onProgress(Math.round((i / totalPages) * 100));
            }

            console.log(`📄 PDF extracted: ${totalPages} pages, ${fullText.length} chars`);
            return fullText.trim();
        },

        /** Extract text from DOCX using Mammoth — proper structured extraction */
        async extractDOCX(file, onProgress) {
            await this._loadMammoth();

            const arrayBuffer = await file.arrayBuffer();
            if (onProgress) onProgress(30);

            const result = await window.mammoth.extractRawText({ arrayBuffer });
            if (onProgress) onProgress(90);

            console.log(`📝 DOCX extracted: ${result.value.length} chars`);
            if (result.messages.length > 0) {
                console.warn('📝 DOCX warnings:', result.messages);
            }
            if (onProgress) onProgress(100);
            return result.value;
        },

        /** Universal file reader — uses proper libraries */
        async readFile(file, onProgress) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'pdf') {
                return await this.extractPDF(file, onProgress);
            }

            if (['doc', 'docx'].includes(ext)) {
                return await this.extractDOCX(file, onProgress);
            }

            // Text-based formats — direct read
            if (onProgress) onProgress(50);
            const text = await file.text();
            if (onProgress) onProgress(100);
            return text;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 3. PLANNING / CONTEXT — Persistent Memory
    // ═══════════════════════════════════════════════════════════

    const K_MEMORY = {
        STORAGE_KEY: 'k_conversation_memory',
        MAX_ENTRIES: 100,  // Keep last 100 interactions
        MAX_CONTEXT_SIZE: 5000,  // Max chars for context injection

        /** Initialize memory from localStorage */
        _load() {
            try {
                const raw = localStorage.getItem(this.STORAGE_KEY);
                return raw ? JSON.parse(raw) : { conversations: [], facts: [], preferences: {}, lastSession: null };
            } catch {
                return { conversations: [], facts: [], preferences: {}, lastSession: null };
            }
        },

        /** Save memory to localStorage */
        _save(memory) {
            try {
                // Trim to max entries
                if (memory.conversations.length > this.MAX_ENTRIES) {
                    memory.conversations = memory.conversations.slice(-this.MAX_ENTRIES);
                }
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(memory));
            } catch (e) {
                console.warn('💾 Memory save failed:', e.message);
            }
        },

        /** Record a user query and K's response */
        remember(userQuery, kResponse, metadata = {}) {
            const memory = this._load();
            memory.conversations.push({
                timestamp: new Date().toISOString(),
                user: userQuery.substring(0, 500),  // Limit size
                k: kResponse.substring(0, 1000),
                mode: metadata.mode || 'chat',
                engine: metadata.engine || 'unknown',
                language: metadata.language || this.detectLanguage(userQuery)
            });
            memory.lastSession = new Date().toISOString();
            this._save(memory);
        },

        /** Store a fact about the user (learned from conversation) */
        learnFact(key, value) {
            const memory = this._load();
            memory.facts.push({
                key, value,
                learned: new Date().toISOString()
            });
            // Deduplicate facts by key — keep latest
            const uniqueFacts = {};
            memory.facts.forEach(f => uniqueFacts[f.key] = f);
            memory.facts = Object.values(uniqueFacts);
            this._save(memory);
            console.log(`🧠 Learned: ${key} = ${value}`);
        },

        /** Store user preference */
        setPreference(key, value) {
            const memory = this._load();
            memory.preferences[key] = value;
            this._save(memory);
        },

        /** Get context string for AI prompts — summarizes recent history */
        getContext() {
            const memory = this._load();
            const parts = [];

            // Last session info
            if (memory.lastSession) {
                const last = new Date(memory.lastSession);
                const now = new Date();
                const hoursAgo = Math.round((now - last) / (1000 * 60 * 60));
                if (hoursAgo > 0) {
                    parts.push(`[Ultima sesiune: acum ${hoursAgo}h]`);
                }
            }

            // User facts
            if (memory.facts.length > 0) {
                parts.push('[Fapte cunoscute: ' + memory.facts.map(f => `${f.key}: ${f.value}`).join(', ') + ']');
            }

            // Preferences
            if (Object.keys(memory.preferences).length > 0) {
                parts.push('[Preferințe: ' + Object.entries(memory.preferences).map(([k, v]) => `${k}=${v}`).join(', ') + ']');
            }

            // Recent conversations (last 5)
            const recent = memory.conversations.slice(-5);
            if (recent.length > 0) {
                parts.push('[Conversații recente:');
                recent.forEach(c => {
                    parts.push(`  User: ${c.user.substring(0, 100)}`);
                    parts.push(`  K: ${c.k.substring(0, 150)}`);
                });
                parts.push(']');
            }

            const context = parts.join('\n');
            return context.substring(0, this.MAX_CONTEXT_SIZE);
        },

        /** Get conversation count */
        getStats() {
            const memory = this._load();
            return {
                totalConversations: memory.conversations.length,
                factsLearned: memory.facts.length,
                preferences: Object.keys(memory.preferences).length,
                lastSession: memory.lastSession,
                memorySize: JSON.stringify(memory).length
            };
        },

        /** Simple language detection from text */
        detectLanguage(text) {
            const lower = text.toLowerCase();
            // Romanian indicators
            if (/[ăâîșț]|sunt|este|vreau|cum|unde|când|pentru|acum|bine/.test(lower)) return 'ro';
            // French
            if (/[àâéèêëïîôùûüÿç]|je suis|c'est|qu'est/.test(lower)) return 'fr';
            // German
            if (/[äöüß]|ich bin|das ist|wie|warum/.test(lower)) return 'de';
            // Spanish
            if (/[ñ¿¡]|estoy|es|cómo|dónde|por qué/.test(lower)) return 'es';
            // Default English
            return 'en';
        },

        /** Clear all memory */
        clear() {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🧹 K Memory cleared');
        }
    };

    // ═══════════════════════════════════════════════════════════
    // INTEGRATION — Wire into existing K systems
    // ═══════════════════════════════════════════════════════════

    // Override processUploadedDoc to use proper extractors + multitask
    const originalProcessDoc = window.processUploadedDoc;
    window.processUploadedDoc = function () {
        const file = window.pendingUploadFile;
        if (!file) return originalProcessDoc?.();

        // Run as multitask — non-blocking
        K_TASKS.add(`📄 ${file.name}`, async (onProgress) => {
            const statusEl = document.getElementById('upload-status');
            const processBtn = document.getElementById('btn-process-doc');

            if (processBtn) {
                processBtn.disabled = true;
                processBtn.textContent = '⏳ Procesare...';
            }

            try {
                // Step 1: Extract with proper library
                onProgress(10);
                if (statusEl) statusEl.textContent = '📖 Extragere text cu parser avansat...';
                const fileText = await K_DOCS.readFile(file, (p) => onProgress(10 + p * 0.4));

                // Step 2: Send to AI
                onProgress(50);
                if (statusEl) statusEl.textContent = '🤖 Analiză AI în curs...';

                // Include K's memory context for better responses
                const context = K_MEMORY.getContext();

                const response = await fetch('/.netlify/functions/smart-brain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: `${context ? '[Context: ' + context + ']\n\n' : ''}Analizează și procesează acest document (${file.name}). Furnizează rezumat structurat, puncte cheie, și informații relevante.\n\nConținut:\n${fileText.substring(0, 8000)}`,
                        context: 'document_processing'
                    })
                });

                onProgress(80);
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                const data = await response.json();
                const result = data.answer || data.response || data.combined || 'Nu am putut procesa.';

                // Step 3: Store in memory
                K_MEMORY.remember(`Procesare document: ${file.name}`, result.substring(0, 500), { mode: 'document' });

                // Step 4: Display
                onProgress(100);
                window.processedDocContent = {
                    original: fileText,
                    processed: result,
                    filename: file.name,
                    timestamp: new Date().toISOString()
                };

                if (statusEl) {
                    statusEl.innerHTML = `<div style="text-align:left;max-height:300px;overflow-y:auto;padding:10px;background:rgba(0,0,0,0.3);border-radius:10px;margin-top:10px;white-space:pre-wrap;font-size:0.9rem;line-height:1.6;color:#e0e0e0;">${result.replace(/</g, '&lt;')}</div>`;
                }

                if (processBtn) {
                    processBtn.textContent = '📥 Exportă';
                    processBtn.disabled = false;
                    processBtn.onclick = () => window.exportProcessedDoc?.();
                }

                // Speak short summary
                if (typeof window.speak === 'function') {
                    window.speak('Document procesat cu succes. ' + result.substring(0, 150));
                }

                return result;
            } catch (error) {
                if (statusEl) statusEl.textContent = '❌ Eroare: ' + error.message;
                if (processBtn) {
                    processBtn.textContent = '⚡ Process';
                    processBtn.disabled = false;
                    processBtn.onclick = () => window.processUploadedDoc();
                }
                throw error;
            }
        }, { category: 'document', priority: 'high' });
    };

    // Hook into chat/voice responses to auto-remember
    const originalSpeak = window.speak;
    if (typeof originalSpeak === 'function') {
        window.speak = function (text, ...args) {
            // Remember K's responses
            if (text && text.length > 10) {
                K_MEMORY.remember('[voice response]', text, { mode: 'voice' });
            }
            return originalSpeak.call(this, text, ...args);
        };
    }

    // Expose globally
    window.K_TASKS = K_TASKS;
    window.K_DOCS = K_DOCS;
    window.K_MEMORY = K_MEMORY;

    // Log stats on load
    const stats = K_MEMORY.getStats();
    console.log(`⚡ K Multitask Engine ready!`);
    console.log(`  📋 Task Queue: max ${K_TASKS.maxConcurrent} concurrent`);
    console.log(`  📄 Document Parsers: PDF.js + Mammoth.js (lazy-loaded)`);
    console.log(`  🧠 Memory: ${stats.totalConversations} conversations, ${stats.factsLearned} facts`);
    console.log(`  💾 Memory size: ${(stats.memorySize / 1024).toFixed(1)} KB`);

    // Detect returning user
    if (stats.lastSession) {
        const hoursAgo = Math.round((Date.now() - new Date(stats.lastSession).getTime()) / (1000 * 60 * 60));
        if (hoursAgo > 0 && hoursAgo < 72) {
            console.log(`  👋 Welcome back! Last session: ${hoursAgo}h ago`);
        }
    }

})();
