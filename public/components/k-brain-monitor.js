/**
 * K Brain Monitor — Permanent Health & Subsystem Monitoring
 * Monitors: Voice, Vision, Thinking, Memory, I/O, Performance
 * Auto-recovery for failed subsystems
 * Heartbeat every 5 seconds
 */

(function () {
    'use strict';

    const HEARTBEAT_INTERVAL = 5000; // 5 seconds
    const MAX_RECOVERY_ATTEMPTS = 3;

    // ═══ BRAIN STATE ═══
    const brain = {
        alive: true,
        startedAt: Date.now(),
        heartbeatCount: 0,
        subsystems: {
            voice: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' },
            vision: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' },
            thinking: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' },
            memory: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' },
            io: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' },
            performance: { status: 'init', lastCheck: 0, recoveryAttempts: 0, detail: '' }
        }
    };

    // ═══ SUBSYSTEM CHECKERS ═══

    // 👂 ASCULTARE (Voice/Wake-Word/Speech Recognition)
    function checkVoice() {
        const sub = brain.subsystems.voice;
        sub.lastCheck = Date.now();

        try {
            // Check if SpeechRecognition is available
            const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

            // Check if realtime-voice or wake-word is active
            const hasVoiceModule = !!(window.realtimeVoice || window.KelionVoice || window.wakeWordActive);

            // Check mic status element
            const micStatus = document.getElementById('mic-status');
            const micText = micStatus ? micStatus.textContent : '';

            if (!hasSpeechAPI) {
                sub.status = 'unavailable';
                sub.detail = 'SpeechRecognition API not supported';
                return;
            }

            if (hasVoiceModule || micText.includes('Tap to speak') || micText.includes('Listening')) {
                sub.status = 'active';
                sub.detail = `Voice ready. Mic: ${micText || 'standby'}`;
            } else {
                sub.status = 'standby';
                sub.detail = 'Voice modules loaded, waiting for activation';
            }
        } catch (e) {
            sub.status = 'error';
            sub.detail = e.message;
        }
    }

    // 👁️ VĂZ (Vision/Camera)
    function checkVision() {
        const sub = brain.subsystems.vision;
        sub.lastCheck = Date.now();

        try {
            // Check if camera streams exist
            const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const hasVisionModule = !!(window.KelionVision || window.cameraCapture);

            // Check video elements for active streams
            const videos = document.querySelectorAll('video');
            let activeStreams = 0;
            videos.forEach(v => {
                if (v.srcObject && v.srcObject.active) activeStreams++;
            });

            if (activeStreams > 0) {
                sub.status = 'active';
                sub.detail = `${activeStreams} active camera stream(s)`;
            } else if (hasVisionModule) {
                sub.status = 'standby';
                sub.detail = 'Vision module loaded, camera not active';
            } else if (hasMediaDevices) {
                sub.status = 'standby';
                sub.detail = 'Camera API available, no module loaded';
            } else {
                sub.status = 'unavailable';
                sub.detail = 'No camera API support';
            }
        } catch (e) {
            sub.status = 'error';
            sub.detail = e.message;
        }
    }

    // 💭 GÂNDIRE (AI/Smart-Brain)
    function checkThinking() {
        const sub = brain.subsystems.thinking;
        sub.lastCheck = Date.now();

        try {
            // Check if smart-functions or AI engine is loaded
            const hasSmartFunctions = !!(window.SmartFunctionExecutor || window.smartFunctions);
            const hasChatHistory = !!(window.chatHistory && window.chatHistory.length > 0);
            const hasSendChat = typeof window.sendChatMessage === 'function' || document.getElementById('chat-send');

            // Check if chat panel exists and is functional
            const chatPanel = document.getElementById('chat-panel');
            const chatMessages = document.getElementById('chat-messages');

            if (hasSendChat && chatMessages) {
                sub.status = 'active';
                const msgCount = chatMessages ? chatMessages.children.length : 0;
                sub.detail = `AI ready. ${msgCount} messages. Context: ${hasChatHistory ? window.chatHistory.length + ' msgs' : 'empty'}`;
            } else if (chatPanel) {
                sub.status = 'standby';
                sub.detail = 'Chat panel exists but not fully initialized';
            } else {
                sub.status = 'error';
                sub.detail = 'No chat system found';
            }
        } catch (e) {
            sub.status = 'error';
            sub.detail = e.message;
        }
    }

    // 🧠 MEMORIE (Context/Storage/History)
    function checkMemory() {
        const sub = brain.subsystems.memory;
        sub.lastCheck = Date.now();

        try {
            // Check localStorage accessibility
            const testKey = '_brain_mem_test';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);

            // Count stored items
            const storageKeys = Object.keys(localStorage).length;
            const chatHistorySize = window.chatHistory ? window.chatHistory.length : 0;
            const hasUser = !!localStorage.getItem('kelion_user');

            // Estimate storage usage
            let storageBytes = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                storageBytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
            }
            const storageKB = Math.round(storageBytes / 1024);

            sub.status = 'active';
            sub.detail = `${storageKeys} keys, ${storageKB}KB used. Chat context: ${chatHistorySize} msgs. User: ${hasUser ? 'yes' : 'no'}`;
        } catch (e) {
            sub.status = 'error';
            sub.detail = `Storage error: ${e.message}`;
        }
    }

    // 📡 I/O (Network/GPS/External)
    function checkIO() {
        const sub = brain.subsystems.io;
        sub.lastCheck = Date.now();

        try {
            // Network status
            const online = navigator.onLine;

            // GPS status
            const hasGPS = !!navigator.geolocation;
            const gpsActive = !!(window.KelionGPS || window.kelionGPS);

            // Service Worker status
            const hasSW = !!navigator.serviceWorker?.controller;

            if (!online) {
                sub.status = 'error';
                sub.detail = '⚠️ OFFLINE — No network connection';
                return;
            }

            const parts = [];
            parts.push('🌐 Online');
            if (hasSW) parts.push('SW active');
            if (gpsActive) parts.push('GPS active');
            else if (hasGPS) parts.push('GPS available');

            sub.status = 'active';
            sub.detail = parts.join(' · ');
        } catch (e) {
            sub.status = 'error';
            sub.detail = e.message;
        }
    }

    // ⚡ PERFORMANCE (FPS/Memory/CPU)
    function checkPerformance() {
        const sub = brain.subsystems.performance;
        sub.lastCheck = Date.now();

        try {
            const perf = {};

            // Memory usage (Chrome only)
            if (performance.memory) {
                perf.heapUsed = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                perf.heapTotal = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024);
            }

            // Navigation timing
            const timing = performance.getEntriesByType('navigation')[0];
            if (timing) {
                perf.loadTime = Math.round(timing.loadEventEnd - timing.startTime);
            }

            // Uptime
            const uptimeMs = Date.now() - brain.startedAt;
            const uptimeMin = Math.round(uptimeMs / 60000);

            const parts = [];
            if (perf.heapUsed) parts.push(`RAM: ${perf.heapUsed}/${perf.heapTotal}MB`);
            if (perf.loadTime) parts.push(`Load: ${perf.loadTime}ms`);
            parts.push(`Uptime: ${uptimeMin}min`);
            parts.push(`Beats: ${brain.heartbeatCount}`);

            // Determine status based on memory usage
            if (perf.heapUsed && perf.heapTotal && (perf.heapUsed / perf.heapTotal) > 0.85) {
                sub.status = 'warning';
                sub.detail = '⚠️ HIGH MEMORY! ' + parts.join(' · ');
            } else {
                sub.status = 'active';
                sub.detail = parts.join(' · ');
            }
        } catch (e) {
            sub.status = 'error';
            sub.detail = e.message;
        }
    }

    // ═══ AUTO-RECOVERY ═══
    function attemptRecovery(subsystemName) {
        const sub = brain.subsystems[subsystemName];
        if (sub.recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            console.warn(`[BRAIN] ⚠️ ${subsystemName} exceeded max recovery attempts (${MAX_RECOVERY_ATTEMPTS})`);
            return;
        }

        sub.recoveryAttempts++;
        console.log(`[BRAIN] 🔧 Recovery attempt ${sub.recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} for ${subsystemName}`);

        switch (subsystemName) {
            case 'voice':
                // Try to re-initialize voice recognition
                try {
                    const micStatus = document.getElementById('mic-status');
                    if (micStatus) micStatus.textContent = '🎤 Tap to speak';
                    // Trigger voice module reload if available
                    if (window.initVoiceRecognition) window.initVoiceRecognition();
                } catch (e) { console.error('[BRAIN] Voice recovery failed:', e); }
                break;

            case 'thinking':
                // Check if chat panel needs re-init
                try {
                    const chatPanel = document.getElementById('chat-panel');
                    if (chatPanel && !document.getElementById('chat-messages')) {
                        console.log('[BRAIN] Re-creating chat messages container');
                        const msgs = document.createElement('div');
                        msgs.id = 'chat-messages';
                        chatPanel.insertBefore(msgs, chatPanel.querySelector('.chat-input-area'));
                    }
                } catch (e) { console.error('[BRAIN] Thinking recovery failed:', e); }
                break;

            case 'memory':
                // Re-initialize chatHistory if lost
                try {
                    if (!window.chatHistory) window.chatHistory = [];
                } catch (e) { console.error('[BRAIN] Memory recovery failed:', e); }
                break;

            case 'io':
                // Network recovery - nothing we can force, just log
                console.log('[BRAIN] I/O recovery: waiting for network...');
                break;
        }
    }

    // ═══ HEARTBEAT ═══
    function heartbeat() {
        brain.heartbeatCount++;

        // Run all checks
        checkVoice();
        checkVision();
        checkThinking();
        checkMemory();
        checkIO();
        checkPerformance();

        // Auto-recovery for errored subsystems
        for (const [name, sub] of Object.entries(brain.subsystems)) {
            if (sub.status === 'error' && sub.recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
                attemptRecovery(name);
            }
            // Reset recovery counter if subsystem recovered
            if (sub.status === 'active' && sub.recoveryAttempts > 0) {
                console.log(`[BRAIN] ✅ ${name} recovered after ${sub.recoveryAttempts} attempts`);
                sub.recoveryAttempts = 0;
            }
        }

        // Update visual indicator
        updateHealthIndicator();

        // Log summary every 12 beats (1 minute)
        if (brain.heartbeatCount % 12 === 0) {
            const summary = Object.entries(brain.subsystems)
                .map(([k, v]) => `${statusIcon(v.status)} ${k}`)
                .join(' | ');
            console.log(`[BRAIN] 💓 Heartbeat #${brain.heartbeatCount}: ${summary}`);
        }
    }

    function statusIcon(status) {
        switch (status) {
            case 'active': return '🟢';
            case 'standby': return '🟡';
            case 'warning': return '🟠';
            case 'error': return '🔴';
            case 'unavailable': return '⚫';
            default: return '⚪';
        }
    }

    // ═══ VISUAL HEALTH INDICATOR ═══
    function createHealthIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'brain-health-indicator';
        indicator.title = 'K Brain Monitor — Click for details';
        indicator.innerHTML = '🧠';
        indicator.style.cssText = `
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 2px solid #00ffcc;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            cursor: pointer;
            z-index: 9998;
            transition: all 0.3s ease;
            animation: brainPulse 2s ease-in-out infinite;
            backdrop-filter: blur(8px);
        `;

        // Pulse animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes brainPulse {
                0%, 100% { box-shadow: 0 0 5px rgba(0,255,204,0.3); }
                50% { box-shadow: 0 0 15px rgba(0,255,204,0.6); }
            }
            @keyframes brainError {
                0%, 100% { box-shadow: 0 0 5px rgba(255,50,50,0.3); border-color: #ff3333; }
                50% { box-shadow: 0 0 15px rgba(255,50,50,0.8); border-color: #ff6666; }
            }
            #brain-health-panel {
                position: fixed;
                top: 55px;
                left: 50%;
                transform: translateX(-50%);
                width: 340px;
                max-height: 400px;
                overflow-y: auto;
                background: rgba(10,10,30,0.95);
                border: 1px solid rgba(0,255,204,0.3);
                border-radius: 16px;
                padding: 16px;
                z-index: 9999;
                color: #fff;
                font-family: 'Inter', 'Segoe UI', sans-serif;
                font-size: 0.85rem;
                display: none;
                backdrop-filter: blur(12px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            }
            #brain-health-panel h3 {
                margin: 0 0 12px 0;
                color: #00ffcc;
                font-size: 1rem;
                text-align: center;
            }
            .brain-sub-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .brain-sub-row:last-child { border-bottom: none; }
            .brain-sub-icon { font-size: 1.1rem; min-width: 24px; text-align: center; }
            .brain-sub-name { font-weight: 600; min-width: 80px; color: #ccc; }
            .brain-sub-detail { color: #888; font-size: 0.75rem; flex: 1; }
            .brain-sub-status { font-size: 0.7rem; padding: 2px 6px; border-radius: 8px; }
            .brain-sub-status.active { background: rgba(0,255,100,0.15); color: #00ff64; }
            .brain-sub-status.standby { background: rgba(255,200,0,0.15); color: #ffc800; }
            .brain-sub-status.warning { background: rgba(255,150,0,0.15); color: #ff9600; }
            .brain-sub-status.error { background: rgba(255,50,50,0.15); color: #ff3333; }
            .brain-sub-status.unavailable { background: rgba(100,100,100,0.15); color: #666; }
            .brain-sub-status.init { background: rgba(100,100,255,0.15); color: #6666ff; }
        `;
        document.head.appendChild(style);

        // Health detail panel
        const panel = document.createElement('div');
        panel.id = 'brain-health-panel';
        panel.innerHTML = '<h3>🧠 K Brain Monitor</h3><div id="brain-health-list"></div>';

        // Toggle panel on click
        indicator.addEventListener('click', () => {
            const p = document.getElementById('brain-health-panel');
            p.style.display = p.style.display === 'none' ? 'block' : 'none';
        });

        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!indicator.contains(e.target) && !panel.contains(e.target)) {
                panel.style.display = 'none';
            }
        });

        document.body.appendChild(indicator);
        document.body.appendChild(panel);
    }

    function updateHealthIndicator() {
        const indicator = document.getElementById('brain-health-indicator');
        const list = document.getElementById('brain-health-list');
        if (!indicator || !list) return;

        // Check overall health
        const statuses = Object.values(brain.subsystems).map(s => s.status);
        const hasError = statuses.includes('error');
        const hasWarning = statuses.includes('warning');

        // Update indicator style
        if (hasError) {
            indicator.style.animation = 'brainError 1s ease-in-out infinite';
            indicator.style.borderColor = '#ff3333';
        } else if (hasWarning) {
            indicator.style.animation = 'brainPulse 1.5s ease-in-out infinite';
            indicator.style.borderColor = '#ffa500';
        } else {
            indicator.style.animation = 'brainPulse 2s ease-in-out infinite';
            indicator.style.borderColor = '#00ffcc';
        }

        // Build subsystem list
        const subsystemLabels = {
            voice: { icon: '👂', name: 'Ascultare' },
            vision: { icon: '👁️', name: 'Văz' },
            thinking: { icon: '💭', name: 'Gândire' },
            memory: { icon: '🧠', name: 'Memorie' },
            io: { icon: '📡', name: 'I/O' },
            performance: { icon: '⚡', name: 'Stare' }
        };

        let html = '';
        for (const [key, sub] of Object.entries(brain.subsystems)) {
            const label = subsystemLabels[key];
            html += `
                <div class="brain-sub-row">
                    <span class="brain-sub-icon">${label.icon}</span>
                    <span class="brain-sub-name">${label.name}</span>
                    <span class="brain-sub-status ${sub.status}">${sub.status.toUpperCase()}</span>
                </div>
                <div style="padding:0 0 4px 40px;"><span class="brain-sub-detail">${sub.detail || '...'}</span></div>
            `;
        }

        // Add uptime info
        const uptimeMin = Math.round((Date.now() - brain.startedAt) / 60000);
        html += `<div style="margin-top:10px;text-align:center;color:#555;font-size:0.7rem;">
            💓 Beat #${brain.heartbeatCount} · ⏱️ Uptime: ${uptimeMin}min
        </div>`;

        list.innerHTML = html;
    }

    // ═══ NETWORK LISTENERS ═══
    window.addEventListener('online', () => {
        console.log('[BRAIN] 🌐 Network restored — checking I/O');
        checkIO();
    });
    window.addEventListener('offline', () => {
        console.log('[BRAIN] ⚠️ Network lost');
        brain.subsystems.io.status = 'error';
        brain.subsystems.io.detail = '⚠️ OFFLINE';
        updateHealthIndicator();
    });

    // ═══ INIT ═══
    function init() {
        console.log('[BRAIN] 🧠 K Brain Monitor starting...');

        // Create visual indicator
        createHealthIndicator();

        // Run first heartbeat immediately
        heartbeat();

        // Start heartbeat loop
        setInterval(heartbeat, HEARTBEAT_INTERVAL);

        // Expose for debugging
        window.brainHealth = brain;
        window.getBrainStatus = () => {
            const result = {};
            for (const [k, v] of Object.entries(brain.subsystems)) {
                result[k] = `${statusIcon(v.status)} ${v.status} — ${v.detail}`;
            }
            return result;
        };

        console.log('[BRAIN] ✅ Brain Monitor active — heartbeat every 5s');
        console.log('[BRAIN] 💡 Use window.getBrainStatus() for details');
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
