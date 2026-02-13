/**
 * ═══════════════════════════════════════════════════════
 * K-BRAIN INIT v1.0 — Single Entry Point
 * ═══════════════════════════════════════════════════════
 * 
 * Drop this single script tag into any HTML page:
 *   <script src="/brain/brain-init.js"></script>
 * 
 * It will auto-load brain-core.js and brain-ui.js,
 * initialize the brain, create the dashboard, and 
 * auto-wire to the host chat system.
 */

(function () {
    'use strict';

    const BRAIN_BASE = '/brain/';

    // ═══ STEP 1: Load dependencies ═══
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function loadConfig() {
        try {
            const res = await fetch(BRAIN_BASE + 'brain-config.json');
            return await res.json();
        } catch (e) {
            console.log('[BRAIN-INIT] Config not found, using defaults');
            return null;
        }
    }

    // ═══ STEP 2: Auto-wire to host chat system ═══
    function autoWire(configData) {
        const ad = configData?.auto_discovery || {};

        // Find chat elements
        const chatInput = document.getElementById(ad.chat_input_id || 'chat-input')
            || document.querySelector(ad.fallback_selectors?.input || 'textarea');
        const chatMessages = document.getElementById(ad.chat_messages_id || 'chat-messages')
            || document.querySelector(ad.fallback_selectors?.messages || '.chat-messages');

        if (!chatInput || !chatMessages) {
            console.log('[BRAIN-INIT] Chat elements not found yet, will retry on visibility');
            return false;
        }

        console.log('[BRAIN-INIT] ✅ Auto-wired to host chat system');
        return { chatInput, chatMessages };
    }

    // ═══ STEP 3: Bootstrap ═══
    async function bootstrap() {
        console.log('[BRAIN-INIT] 🧠 K-Brain bootstrap starting...');

        // Load config
        const configData = await loadConfig();

        // Load modules
        await loadScript(BRAIN_BASE + 'brain-core.js');
        await loadScript(BRAIN_BASE + 'brain-ui.js');

        // Apply config
        if (configData && window.KBrain) {
            window.KBrain.configure({
                endpoints: configData.backend,
                storage: configData.storage_keys ? {
                    engineScores: configData.storage_keys.engine_scores,
                    patterns: configData.storage_keys.patterns,
                    session: configData.storage_keys.session
                } : undefined,
                defaults: configData.defaults ? {
                    contextWindow: configData.defaults.context_window,
                    memorySaveDepth: configData.defaults.memory_save_depth,
                    suggestionInterval: configData.defaults.suggestion_interval
                } : undefined
            });
        }

        // Initialize brain
        if (window.KBrain) {
            const userEmail = (JSON.parse(localStorage.getItem('kelion_user') || '{}').email || '');
            await window.KBrain.init(userEmail);
        }

        // Create dashboard
        if (window.BrainUI) {
            window.BrainUI.createDashboard();
        }

        // Try to auto-wire
        autoWire(configData);

        console.log('[BRAIN-INIT] 🧠 K-Brain fully loaded and operational');
    }

    // Start after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
