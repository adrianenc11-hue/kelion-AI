/**
 * ═══════════════════════════════════════════════════════
 * K-BRAIN CORE v1.0 — Autonomous AI Brain Module
 * ═══════════════════════════════════════════════════════
 * 
 * Transplantable, self-configuring brain module.
 * Drop into any system → auto-discovers connections → works.
 * 
 * Subsystems:
 *   🧠 Hippocampus  — Persistent memory (save/load/recall)
 *   😔 Amygdala     — Emotion detection (6 emotions)
 *   🎯 Prefrontal   — Confidence scoring (metacognition)
 *   🧬 Synapse      — Neuroplasticity (feedback learning)
 *   💡 Limbic       — Objectives & patterns (motivation)
 *   📊 Cortex       — Query analysis & routing
 */

(function (global) {
    'use strict';

    // ═══════════════════════════════════════
    // CONFIGURATION (overridable via brain-config.json)
    // ═══════════════════════════════════════
    const DEFAULT_CONFIG = {
        endpoints: {
            intelligence: '/.netlify/functions/smart-brain',
            memory: '/.netlify/functions/brain-memory'
        },
        storage: {
            engineScores: 'k_engine_scores',
            patterns: 'k_brain_patterns',
            session: 'k_brain_session'
        },
        defaults: {
            contextWindow: 10,
            memorySaveDepth: 4,
            suggestionInterval: 10
        }
    };

    let config = { ...DEFAULT_CONFIG };

    // ═══════════════════════════════════════
    // 🧠 HIPPOCAMPUS — Persistent Memory
    // ═══════════════════════════════════════
    const Hippocampus = {
        sessionId: Date.now().toString(),
        chatHistory: [],

        async save(userEmail, queryType, emotion) {
            try {
                const res = await fetch(config.endpoints.memory, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save',
                        user_email: userEmail || 'anonymous',
                        messages: this.chatHistory.slice(-config.defaults.memorySaveDepth),
                        query_type: queryType || 'general',
                        emotion: emotion || 'neutral',
                        session_id: this.sessionId
                    })
                });
                return await res.json();
            } catch (e) {
                console.log('[BRAIN] 🧠 Memory save skipped:', e.message);
                return { success: false };
            }
        },

        async load(userEmail, limit) {
            try {
                const res = await fetch(config.endpoints.memory, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'load', user_email: userEmail || 'anonymous', limit: limit || 3 })
                });
                const data = await res.json();
                if (data.success && data.memories && data.memories.length > 0) {
                    const lastMemory = data.memories[0];
                    try {
                        const msgs = typeof lastMemory.messages === 'string' ? JSON.parse(lastMemory.messages) : lastMemory.messages;
                        if (Array.isArray(msgs) && msgs.length > 0) {
                            this.chatHistory = msgs.slice(-5);
                            console.log(`[BRAIN] 🧠 Hippocampus: Loaded ${msgs.length} messages from last session`);
                            return { success: true, count: msgs.length };
                        }
                    } catch (e) { /* parse error */ }
                }
                return { success: true, count: 0 };
            } catch (e) {
                console.log('[BRAIN] 🧠 Memory load skipped:', e.message);
                return { success: false };
            }
        },

        async recall(userEmail, keyword) {
            try {
                const res = await fetch(config.endpoints.memory, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'recall', user_email: userEmail, keyword })
                });
                return await res.json();
            } catch (e) { return { success: false }; }
        },

        async stats(userEmail) {
            try {
                const res = await fetch(config.endpoints.memory, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'stats', user_email: userEmail })
                });
                return await res.json();
            } catch (e) { return { success: false }; }
        },

        addMessage(role, content) {
            this.chatHistory.push({ role, content });
            if (this.chatHistory.length > 20) this.chatHistory = this.chatHistory.slice(-10);
        },

        getContext() {
            return this.chatHistory.slice(-config.defaults.contextWindow);
        }
    };

    // ═══════════════════════════════════════
    // 😔 AMYGDALA — Emotion Detection
    // ═══════════════════════════════════════
    const Amygdala = {
        detect(text) {
            const q = (text || '').toLowerCase();

            if (/\burgent|\bajut[oă]|\bsos\b|\bcritic|\bpericol|\baccident|\bgrav\b|\bimediat/i.test(q))
                return { emotion: 'urgent', intensity: 0.9, tone: 'empathetic-fast', emoji: '🚨' };
            if (/\bfurios|\bînnebun|\bprost|\bnu merge|\bnu funcțion|\bhat[eă]|\bnenoroc|\biritat/i.test(q))
                return { emotion: 'frustrated', intensity: 0.7, tone: 'calm-helpful', emoji: '😤' };
            if (/\btrist|\bîngrijor|\bfrică|\bstres|\bdeprim|\bsingur|\bplâng|\banxiet|\bpierd/i.test(q))
                return { emotion: 'sad', intensity: 0.6, tone: 'warm-supportive', emoji: '😔' };
            if (/\bsuper\b|\bgenial|\bminunat|\bmulțu|\bbravo|\bexcelent|\byeah|\bwow|\bfericir|\bentuzias/i.test(q))
                return { emotion: 'happy', intensity: 0.5, tone: 'enthusiastic', emoji: '😊' };
            if (/\bcum\b|\bde ce|\bce este|\bexplică|\bînvăț|\bvreau să știu|\bcurios|\binteresant/i.test(q))
                return { emotion: 'curious', intensity: 0.4, tone: 'educational', emoji: '🤔' };

            return { emotion: 'neutral', intensity: 0.2, tone: 'professional', emoji: '😐' };
        },

        lastEmotion: null,
        history: [],

        process(text) {
            const emotion = this.detect(text);
            this.lastEmotion = emotion;
            this.history.push({ ...emotion, timestamp: Date.now() });
            if (this.history.length > 50) this.history = this.history.slice(-25);
            return emotion;
        }
    };

    // ═══════════════════════════════════════
    // 🎯 PREFRONTAL CORTEX — Confidence / Metacognition
    // ═══════════════════════════════════════
    const Prefrontal = {
        calculate(reply, queryType) {
            if (!reply) return { score: 0, label: 'no_response' };
            const text = reply.trim();
            let score = 50;

            if (text.length > 500) score += 15;
            else if (text.length > 200) score += 10;
            else if (text.length > 50) score += 5;

            if (/\d{2,}/.test(text)) score += 5;
            if (/de exemplu|for example|cum ar fi/i.test(text)) score += 5;
            if (/conform|according|sursa|source/i.test(text)) score += 8;
            if (/probabil|maybe|perhaps|posibil|nu sunt sigur|not sure/i.test(text)) score -= 10;
            if (/cred că|I think|I believe|ar putea/i.test(text)) score -= 5;

            if (queryType === 'math' && /\d/.test(text)) score += 10;
            if (queryType === 'code' && /[{}();=]|function|def |class /.test(text)) score += 10;
            if (queryType === 'legal' && /articol|lege|cod|hotărâre/i.test(text)) score += 10;

            score = Math.max(5, Math.min(98, score));
            const label = score >= 80 ? 'high' : score >= 60 ? 'medium' : score >= 40 ? 'low' : 'very_low';
            return { score, label };
        },

        history: [],

        track(confidence) {
            this.history.push({ ...confidence, timestamp: Date.now() });
            if (this.history.length > 30) this.history = this.history.slice(-15);
        }
    };

    // ═══════════════════════════════════════
    // 🧬 SYNAPSE — Neuroplasticity / Learning
    // ═══════════════════════════════════════
    const Synapse = {
        getScores() {
            try { return JSON.parse(localStorage.getItem(config.storage.engineScores) || '{}'); }
            catch { return {}; }
        },

        feedback(engine, score) {
            const scores = this.getScores();
            scores[engine] = (scores[engine] || 0) + score;
            localStorage.setItem(config.storage.engineScores, JSON.stringify(scores));
            console.log(`[BRAIN] 🧬 Synapse: ${engine} ${score > 0 ? '+1' : '-1'} → total: ${scores[engine]}`);
            return scores[engine];
        },

        getBestEngine() {
            const scores = this.getScores();
            let best = null, bestScore = -Infinity;
            Object.entries(scores).forEach(([engine, s]) => {
                if (s > bestScore) { best = engine; bestScore = s; }
            });
            return best;
        },

        reset() {
            localStorage.removeItem(config.storage.engineScores);
        }
    };

    // ═══════════════════════════════════════
    // 💡 LIMBIC — Objectives & Pattern Tracking
    // ═══════════════════════════════════════
    const Limbic = {
        getPatterns() {
            try { return JSON.parse(localStorage.getItem(config.storage.patterns) || '{}'); }
            catch { return {}; }
        },

        track(queryType, emotion) {
            const p = this.getPatterns();
            p[queryType] = (p[queryType] || 0) + 1;
            p['_emotion_' + emotion] = (p['_emotion_' + emotion] || 0) + 1;
            p._totalQueries = (p._totalQueries || 0) + 1;
            p._lastActive = Date.now();
            localStorage.setItem(config.storage.patterns, JSON.stringify(p));
            return p._totalQueries;
        },

        getSuggestion() {
            const p = this.getPatterns();
            if ((p._totalQueries || 0) < 5) return null;

            const types = ['math', 'code', 'creative', 'realtime', 'legal', 'search', 'translation'];
            let topType = 'general', topCount = 0;
            types.forEach(t => { if ((p[t] || 0) > topCount) { topCount = p[t]; topType = t; } });

            const suggestions = {
                math: '📊 Pare că folosești mult matematica. Vrei funcțiile avansate de calcul?',
                code: '💻 Ești programator activ! Activează modul Code Expert.',
                creative: '✍️ Ai talent creativ! Încearcă o poveste sau un poem.',
                realtime: '📰 Ești la curent! Pot trimite zilnic un rezumat al știrilor.',
                legal: '⚖️ Întrebări juridice frecvente? Pot salva legislația relevantă.',
                search: '🔍 Căutări frecvente! Activează modul Research.'
            };
            return suggestions[topType] || null;
        },

        shouldSuggest() {
            const p = this.getPatterns();
            const total = p._totalQueries || 0;
            return total > 0 && total % config.defaults.suggestionInterval === 0;
        }
    };

    // ═══════════════════════════════════════
    // 📊 CORTEX — Main Brain API
    // ═══════════════════════════════════════
    const KBrain = {
        version: '1.0.0',
        ready: false,

        // Subsystems
        memory: Hippocampus,
        emotion: Amygdala,
        confidence: Prefrontal,
        learning: Synapse,
        objectives: Limbic,

        // Configuration
        config: config,

        configure(customConfig) {
            if (customConfig.endpoints) Object.assign(config.endpoints, customConfig.endpoints);
            if (customConfig.storage) Object.assign(config.storage, customConfig.storage);
            if (customConfig.defaults) Object.assign(config.defaults, customConfig.defaults);
        },

        /**
         * Send a query through the brain
         * Returns: { reply, engine, emotion, confidence, routing }
         */
        async think(query, userEmail) {
            // Detect emotion
            const emotionResult = this.emotion.process(query);

            // Add user message to context
            this.memory.addMessage('user', query);

            // Send to backend
            const res = await fetch(config.endpoints.intelligence, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: query,
                    context: this.memory.getContext(),
                    user_email: userEmail || 'anonymous',
                    engineScores: this.learning.getScores()
                })
            });

            const data = await res.json();

            if (data.success) {
                const reply = data.reply || data.answer || 'No response';

                // Track
                this.memory.addMessage('assistant', reply);
                const conf = data.confidence || this.confidence.calculate(reply, data.routing?.type);
                this.confidence.track(conf);

                // Track objectives
                const total = this.objectives.track(
                    data.routing?.type || 'general',
                    emotionResult.emotion
                );

                // Auto-save to persistent memory (non-blocking)
                this.memory.save(userEmail, data.routing?.type, emotionResult.emotion).catch(() => { });

                return {
                    success: true,
                    reply,
                    engine: data.engine,
                    model: data.model,
                    usage: data.usage,
                    routing: data.routing,
                    emotion: data.emotion || emotionResult,
                    confidence: conf,
                    suggestion: this.objectives.shouldSuggest() ? this.objectives.getSuggestion() : null,
                    totalQueries: total
                };
            }

            throw new Error(data.error || 'Brain failed');
        },

        /**
         * Get full brain status
         */
        getStatus() {
            return {
                version: this.version,
                ready: this.ready,
                sessionId: this.memory.sessionId,
                contextSize: this.memory.chatHistory.length,
                lastEmotion: this.emotion.lastEmotion,
                emotionHistory: this.emotion.history.slice(-5),
                confidenceHistory: this.confidence.history.slice(-5),
                engineScores: this.learning.getScores(),
                patterns: this.objectives.getPatterns(),
                bestEngine: this.learning.getBestEngine()
            };
        },

        /**
         * Initialize brain — auto-discovers host, loads memory
         */
        async init(userEmail) {
            console.log('[BRAIN] 🧠 K-Brain v1.0 initializing...');

            // Load persistent memory
            await this.memory.load(userEmail);

            this.ready = true;
            console.log('[BRAIN] ✅ K-Brain ready. Subsystems: Memory, Emotion, Confidence, Learning, Objectives');

            // Dispatch ready event for host systems to listen
            window.dispatchEvent(new CustomEvent('brain-ready', { detail: this.getStatus() }));

            return this;
        }
    };

    // Export to global
    global.KBrain = KBrain;

})(typeof window !== 'undefined' ? window : global);
