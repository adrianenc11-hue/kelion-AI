/**
 * Conversion Engine — Demo → Paid User Strategy
 * Strategies: Timer CTA, Feature Teaser, Email Drip, Freemium Daily
 * Drop into app.html: <script src="components/conversion-engine.js"></script>
 */

(function () {
    'use strict';

    // ═══ CONFIG ═══
    const CONFIG = {
        DEMO_DURATION: 180,          // 3 minutes in seconds
        DAILY_FREE_INTERACTIONS: 15, // Free interactions per day
        CTA_AT_50_PERCENT: true,     // Show subtle CTA at 50% time
        CTA_AT_80_PERCENT: true,     // Show urgent CTA at 80% time
        DISCOUNT_CODE: 'KELION25',   // 25% off first month
        SUBSCRIBE_URL: '/subscribe.html'
    };

    // ═══ STATE ═══
    const state = {
        isDemo: false,
        isPremium: false,
        timerStarted: false,
        timeRemaining: CONFIG.DEMO_DURATION,
        cta50Shown: false,
        cta80Shown: false,
        dailyInteractions: 0,
        userEmail: null
    };

    // ═══ DETECT USER TYPE ═══
    function detectUserType() {
        const token = localStorage.getItem('kelion_auth_token') || localStorage.getItem('kelion_access_token');
        const userEmail = localStorage.getItem('kelion_user_email');
        const subscription = localStorage.getItem('subscriptionType');

        if (subscription && ['pro', 'family', 'business'].some(t => subscription.includes(t))) {
            state.isPremium = true;
            return 'premium';
        }
        if (token || userEmail) {
            // Logged in but might be free
            state.userEmail = userEmail;
            return 'free_user';
        }
        state.isDemo = true;
        return 'demo';
    }

    // ═══ CREATE UI ELEMENTS ═══
    function createConversionUI() {
        // Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            /* Demo Timer Bar */
            #demo-timer-bar {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 40px;
                background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(20,20,40,0.95));
                border-bottom: 1px solid rgba(0,255,255,0.3);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 15px;
                z-index: 10000;
                font-family: 'Inter', sans-serif;
                backdrop-filter: blur(10px);
            }
            #demo-timer-bar .timer-left {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #fff;
                font-size: 0.85rem;
            }
            #demo-timer-bar .timer-countdown {
                font-family: 'Courier New', monospace;
                font-weight: bold;
                color: #00ffff;
                font-size: 1rem;
                min-width: 45px;
            }
            #demo-timer-bar .timer-countdown.warning { color: #ffa500; }
            #demo-timer-bar .timer-countdown.critical { color: #ff4444; animation: blink 0.5s infinite; }
            @keyframes blink { 50% { opacity: 0.3; } }
            #demo-timer-bar .timer-progress {
                flex: 1;
                height: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                margin: 0 10px;
                max-width: 200px;
            }
            #demo-timer-bar .timer-fill {
                height: 100%;
                background: linear-gradient(90deg, #00ffff, #0088ff);
                border-radius: 2px;
                transition: width 1s linear;
            }
            #demo-timer-bar .timer-fill.warning { background: linear-gradient(90deg, #ffa500, #ff6600); }
            #demo-timer-bar .timer-fill.critical { background: linear-gradient(90deg, #ff4444, #cc0000); }
            .upgrade-btn-small {
                padding: 5px 15px;
                background: linear-gradient(135deg, #d4af37, #f0d060);
                color: #000;
                border: none;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.8rem;
                cursor: pointer;
                transition: all 0.3s;
                text-decoration: none;
            }
            .upgrade-btn-small:hover { transform: scale(1.05); box-shadow: 0 0 15px rgba(212,175,55,0.5); }

            /* CTA Popup Overlay */
            .cta-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.7);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            .cta-card {
                background: linear-gradient(145deg, #0a0a2e, #1a1a4e);
                border: 1px solid rgba(0,255,255,0.3);
                border-radius: 20px;
                padding: 30px;
                max-width: 420px;
                width: 90%;
                text-align: center;
                color: #fff;
                animation: slideUp 0.4s ease;
            }
            @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .cta-card h2 { color: #00ffff; margin-bottom: 10px; font-size: 1.4rem; }
            .cta-card p { color: #aaa; margin-bottom: 20px; line-height: 1.5; }
            .cta-card .discount { color: #d4af37; font-weight: bold; font-size: 1.1rem; }
            .cta-card .cta-buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
            .cta-primary {
                padding: 12px 30px;
                background: linear-gradient(135deg, #d4af37, #f0d060);
                color: #000;
                border: none;
                border-radius: 25px;
                font-weight: bold;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s;
            }
            .cta-primary:hover { transform: scale(1.05); box-shadow: 0 0 20px rgba(212,175,55,0.5); }
            .cta-secondary {
                padding: 12px 20px;
                background: transparent;
                color: #aaa;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 25px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.3s;
            }
            .cta-secondary:hover { border-color: rgba(255,255,255,0.5); color: #fff; }

            /* Daily Interactions Counter */
            #interactions-badge {
                position: fixed;
                bottom: 80px;
                left: 20px;
                background: rgba(0,0,0,0.8);
                border: 1px solid rgba(0,255,255,0.3);
                border-radius: 12px;
                padding: 8px 15px;
                color: #fff;
                font-size: 0.8rem;
                z-index: 9999;
                backdrop-filter: blur(10px);
            }
            #interactions-badge .badge-count { color: #00ffff; font-weight: bold; }

            /* Email Collect Bar */
            #email-collect-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(0,255,255,0.1));
                border-top: 1px solid rgba(212,175,55,0.3);
                padding: 12px 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                z-index: 10000;
                backdrop-filter: blur(10px);
            }
            #email-collect-bar input {
                padding: 8px 15px;
                border-radius: 20px;
                border: 1px solid rgba(0,255,255,0.3);
                background: rgba(0,0,0,0.5);
                color: #fff;
                font-size: 0.9rem;
                width: 250px;
                max-width: 50vw;
            }
            #email-collect-bar input::placeholder { color: #666; }
            #email-collect-bar .collect-text { color: #ccc; font-size: 0.85rem; }
        `;
        document.head.appendChild(style);
    }

    // ═══ DEMO TIMER ═══
    function startDemoTimer() {
        if (state.timerStarted || state.isPremium) return;
        state.timerStarted = true;

        // Create timer bar
        const bar = document.createElement('div');
        bar.id = 'demo-timer-bar';
        bar.innerHTML = `
            <div class="timer-left">
                <span>⏱️ Demo</span>
                <span class="timer-countdown" id="timer-countdown">${formatTime(state.timeRemaining)}</span>
                <div class="timer-progress"><div class="timer-fill" id="timer-fill" style="width:100%"></div></div>
            </div>
            <a href="${CONFIG.SUBSCRIBE_URL}" class="upgrade-btn-small">⚡ Upgrade</a>
        `;
        document.body.prepend(bar);

        // Countdown
        const interval = setInterval(() => {
            state.timeRemaining--;
            const pct = (state.timeRemaining / CONFIG.DEMO_DURATION) * 100;

            const countdown = document.getElementById('timer-countdown');
            const fill = document.getElementById('timer-fill');

            if (countdown) countdown.textContent = formatTime(state.timeRemaining);
            if (fill) fill.style.width = pct + '%';

            // 50% CTA
            if (pct <= 50 && !state.cta50Shown && CONFIG.CTA_AT_50_PERCENT) {
                state.cta50Shown = true;
                showCTA('subtle');
                if (countdown) countdown.classList.add('warning');
                if (fill) fill.classList.add('warning');
            }

            // 80% CTA (20% remaining)
            if (pct <= 20 && !state.cta80Shown && CONFIG.CTA_AT_80_PERCENT) {
                state.cta80Shown = true;
                showCTA('urgent');
                if (countdown) countdown.classList.add('critical');
                if (fill) fill.classList.add('critical');
            }

            // Time's up
            if (state.timeRemaining <= 0) {
                clearInterval(interval);
                showCTA('expired');
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // ═══ CTA POPUPS ═══
    function showCTA(type) {
        // Remove existing
        document.querySelectorAll('.cta-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'cta-overlay';

        let content = '';
        switch (type) {
            case 'subtle':
                content = `
                    <div class="cta-card">
                        <h2>🌟 Enjoying K?</h2>
                        <p>You're halfway through your demo. K can do so much more with a subscription!</p>
                        <p>✅ Unlimited conversations<br>✅ Email management<br>✅ GPS tracking & chat (Family/Business)</p>
                        <div class="cta-buttons">
                            <button class="cta-primary" onclick="window.location.href='${CONFIG.SUBSCRIBE_URL}'">View Plans</button>
                            <button class="cta-secondary" onclick="this.closest('.cta-overlay').remove()">Continue Demo</button>
                        </div>
                    </div>`;
                break;

            case 'urgent':
                content = `
                    <div class="cta-card">
                        <h2>⚡ Time Running Out!</h2>
                        <p>Less than 1 minute left in your demo.</p>
                        <p class="discount">🔥 Use code <strong>${CONFIG.DISCOUNT_CODE}</strong> for 25% off your first month!</p>
                        <div class="cta-buttons">
                            <button class="cta-primary" onclick="window.location.href='${CONFIG.SUBSCRIBE_URL}?code=${CONFIG.DISCOUNT_CODE}'">Upgrade Now — 25% OFF</button>
                            <button class="cta-secondary" onclick="this.closest('.cta-overlay').remove()">I'll decide later</button>
                        </div>
                    </div>`;
                break;

            case 'expired':
                content = `
                    <div class="cta-card">
                        <h2>⏰ Demo Ended</h2>
                        <p>Your free demo has ended. Subscribe to continue using K without limits!</p>
                        <p class="discount">💎 Starting from just <strong>£15/month</strong></p>
                        <div class="cta-buttons">
                            <button class="cta-primary" onclick="window.location.href='${CONFIG.SUBSCRIBE_URL}'">Choose a Plan</button>
                            <button class="cta-secondary" onclick="collectEmailAndClose(this)">Get free tips by email</button>
                        </div>
                        <div id="email-form-inline" style="display:none;margin-top:15px;">
                            <input type="email" id="expired-email" placeholder="your@email.com" style="padding:8px 15px;border-radius:20px;border:1px solid rgba(0,255,255,0.3);background:rgba(0,0,0,0.5);color:#fff;width:80%;">
                            <button class="cta-primary" style="margin-top:10px;padding:8px 20px" onclick="submitEmailFromExpired()">Send me tips</button>
                        </div>
                    </div>`;
                break;
        }

        overlay.innerHTML = content;
        document.body.appendChild(overlay);
    }

    // ═══ DAILY INTERACTIONS (Freemium Strategy) ═══
    function checkDailyInteractions() {
        const today = new Date().toISOString().split('T')[0];
        const stored = JSON.parse(localStorage.getItem('kelion_daily') || '{}');

        if (stored.date !== today) {
            stored.date = today;
            stored.count = 0;
        }

        state.dailyInteractions = stored.count;
        return stored;
    }

    function incrementInteraction() {
        const stored = checkDailyInteractions();
        stored.count++;
        state.dailyInteractions = stored.count;
        localStorage.setItem('kelion_daily', JSON.stringify(stored));

        updateInteractionsBadge();

        if (stored.count >= CONFIG.DAILY_FREE_INTERACTIONS && !state.isPremium) {
            showCTA('expired');
            return false; // Block further interactions
        }
        return true;
    }

    function showInteractionsBadge() {
        const stored = checkDailyInteractions();
        const remaining = CONFIG.DAILY_FREE_INTERACTIONS - stored.count;

        const badge = document.createElement('div');
        badge.id = 'interactions-badge';
        badge.innerHTML = `<span class="badge-count">${remaining}</span> free left today`;
        document.body.appendChild(badge);
    }

    function updateInteractionsBadge() {
        const badge = document.getElementById('interactions-badge');
        if (!badge) return;
        const stored = checkDailyInteractions();
        const remaining = Math.max(0, CONFIG.DAILY_FREE_INTERACTIONS - stored.count);
        badge.querySelector('.badge-count').textContent = remaining;
    }

    // ═══ EMAIL COLLECTION ═══
    function showEmailCollectBar() {
        if (localStorage.getItem('kelion_email_collected')) return;

        const bar = document.createElement('div');
        bar.id = 'email-collect-bar';
        bar.innerHTML = `
            <span class="collect-text">📩 Get K tips & exclusive offers:</span>
            <input type="email" id="collect-email-input" placeholder="your@email.com">
            <button class="upgrade-btn-small" onclick="submitCollectedEmail()">Subscribe</button>
            <button style="background:none;border:none;color:#666;cursor:pointer;font-size:1.2rem" onclick="this.parentElement.remove()">✕</button>
        `;
        document.body.appendChild(bar);
    }

    // ═══ GLOBAL FUNCTIONS ═══
    window.collectEmailAndClose = function (btn) {
        const form = document.getElementById('email-form-inline');
        if (form) form.style.display = 'block';
        btn.style.display = 'none';
    };

    window.submitEmailFromExpired = function () {
        const emailInput = document.getElementById('expired-email');
        const email = emailInput?.value;
        if (!email || !email.includes('@')) {
            emailInput.style.borderColor = '#ff4444';
            return;
        }
        saveEmail(email);
        document.querySelector('.cta-overlay')?.remove();
    };

    window.submitCollectedEmail = function () {
        const input = document.getElementById('collect-email-input');
        const email = input?.value;
        if (!email || !email.includes('@')) {
            input.style.borderColor = '#ff4444';
            return;
        }
        saveEmail(email);
        document.getElementById('email-collect-bar')?.remove();
    };

    function saveEmail(email) {
        localStorage.setItem('kelion_email_collected', email);
        // Send to backend for drip campaign
        fetch('/.netlify/functions/group-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'collect_email', email, source: 'demo_conversion' })
        }).catch(() => { });

        // Show thank you
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);border:1px solid #00ffff;border-radius:15px;padding:20px 30px;color:#fff;z-index:10002;animation:fadeIn 0.3s';
        toast.innerHTML = '<h3 style="color:#00ffff">✅ Thanks!</h3><p>Check your inbox for K tips & offers!</p>';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ═══ INIT ═══
    function init() {
        // ADMIN BYPASS — no conversion UI for admin
        try {
            const u = JSON.parse(localStorage.getItem('kelion_user') || '{}');
            if (u.role === 'admin') {
                console.log('[Conversion] Admin detected — skipping all conversion UI');
                state.isPremium = true;
                return;
            }
        } catch (e) { /* continue normally */ }

        const userType = detectUserType();
        console.log('[Conversion] User type:', userType);

        if (userType === 'premium') {
            console.log('[Conversion] Premium user — no conversion UI');
            return;
        }

        createConversionUI();

        if (userType === 'demo') {
            startDemoTimer();
            // Show email bar after 30 seconds
            setTimeout(showEmailCollectBar, 30000);
        } else if (userType === 'free_user') {
            showInteractionsBadge();
            // Show email bar after 60 seconds
            setTimeout(showEmailCollectBar, 60000);
        }

        // Expose for external use
        window.KelionConversion = {
            incrementInteraction,
            checkDailyInteractions,
            showCTA,
            getState: () => ({ ...state })
        };
    }

    // Start when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
