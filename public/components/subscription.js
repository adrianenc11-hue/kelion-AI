/**
 * Kelion AI - Subscription System
 * Timer + Login + PayPal Integration
 * 
 * Plans:
 * - Free Trial: 10 minutes
 * - Monthly: £15/month
 * - Annual: £100/year (save £80)
 */

const KelionSubscription = {
    // Config
    FREE_TRIAL_MINUTES: 60,
    STORAGE_KEYS: {
        sessionStart: 'kelion_session_start',
        authToken: 'kelion_auth_token',
        userEmail: 'kelion_user_email',
        subscriptionId: 'kelion_subscription_id'
    },

    // State
    timerInterval: null,
    isSubscribed: false,
    initialized: false,

    // Initialize
    async init() {
        // Prevent duplicate initialization
        if (this.initialized) {
            console.log('🔐 Subscription system already initialized, skipping...');
            return;
        }
        this.initialized = true;

        console.log('🔐 Subscription system initializing...');

        // Create login button FIRST so it exists when we update it
        this.addLoginButton();

        // Wait for auth check to complete before showing timer
        await this.checkAuthStatus();

        if (!this.isSubscribed) {
            this.startFreeTimer();

            // Make sure premium nav is hidden for non-subscribed users
            const premiumNav = document.getElementById('premium-nav');
            if (premiumNav) {
                premiumNav.style.display = 'none';
            }

            // Make sure Account button is hidden
            const accountBtn = document.getElementById('account-btn');
            if (accountBtn) {
                accountBtn.style.display = 'none';
            }
        }

        this.checkUrlParams();

        // Check if we should show login modal (returning from GDPR with LOGIN choice)
        if (localStorage.getItem('kelion_show_login') === 'true') {
            localStorage.removeItem('kelion_show_login');
            setTimeout(() => this.showLoginModal(), 500);
        } else if (localStorage.getItem('kelion_mode') === 'free_trial') {
            // User already chose FREE TRIAL from GDPR - reveal K directly, no modal needed
            console.log('🎯 Free trial mode detected from GDPR, waiting for model...');
            localStorage.removeItem('kelion_mode'); // Clear the flag
            // Wait for model to be fully loaded before revealing K
            const waitForModel = () => {
                if (window.modelReadyForReveal) {
                    console.log('🎯 Model ready, revealing K...');
                    this.revealK(false);
                } else {
                    setTimeout(waitForModel, 100); // Check every 100ms
                }
            };
            setTimeout(waitForModel, 300);
        } else if (localStorage.getItem(this.STORAGE_KEYS.authToken) && this.isSubscribed) {
            // User already logged in - reveal K directly with premium access
            console.log('🎯 User already authenticated, revealing K...');
            const waitForModelAuth = () => {
                if (window.modelReadyForReveal) {
                    console.log('🎯 Model ready, revealing K for authenticated user...');
                    this.revealK(true);
                } else {
                    setTimeout(waitForModelAuth, 100);
                }
            };
            setTimeout(waitForModelAuth, 300);
        } else {
            // New user OR returning free trial user - just reveal K directly (no modal)
            console.log('🎯 New/returning user - revealing K directly...');
            const waitForNewUser = () => {
                if (window.modelReadyForReveal) {
                    console.log('🎯 Model ready, revealing K for new user...');
                    this.revealK(false); // Free trial mode
                } else {
                    setTimeout(waitForNewUser, 100);
                }
            };
            setTimeout(waitForNewUser, 300);
        }
    },

    // Check authentication status
    async checkAuthStatus() {
        const token = localStorage.getItem(this.STORAGE_KEYS.authToken);
        const userDataStr = localStorage.getItem('kelion_user');

        // Quick check: if we have user data with admin role OR premium subscription, grant access immediately
        if (userDataStr) {
            try {
                const userData = JSON.parse(userDataStr);
                // Check for admin role
                if (userData.role === 'admin' || userData.role === 'superadmin') {
                    this.isSubscribed = true;
                    this.hideTimer();
                    this.updateLoginButton(userData.email);
                    console.log('✅ Admin authenticated from localStorage:', userData.email);
                    return;
                }
                // Check for premium/active subscription
                if (userData.subscription === 'premium' || userData.subscription === 'active' || userData.subscription === 'permanent') {
                    this.isSubscribed = true;
                    this.hideTimer();
                    this.updateLoginButton(userData.email);
                    console.log('✅ Premium user authenticated from localStorage:', userData.email, 'Subscription:', userData.subscription);
                    return;
                }
            } catch (e) { }
        }

        if (!token) {
            this.isSubscribed = false;
            return;
        }

        try {
            // Try admin JWT verification first (auth-me endpoint)
            const meResponse = await fetch('/.netlify/functions/auth-me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });

            if (meResponse.ok) {
                const meData = await meResponse.json();
                if (meData.user) {
                    // Admin JWT is valid
                    this.isSubscribed = true;
                    this.hideTimer();
                    this.updateLoginButton(meData.user.email);

                    // Update localStorage with fresh data
                    localStorage.setItem('kelion_user', JSON.stringify({
                        id: meData.user.id,
                        email: meData.user.email,
                        role: meData.user.role || 'admin',
                        subscription: meData.user.subscription || 'premium'
                    }));

                    console.log('✅ Admin JWT verified:', meData.user.email);
                    return;
                }
            }

            // Fallback: try regular subscription auth
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', token })
            });
            const data = await response.json();

            if (data.valid) {
                this.isSubscribed = true;
                this.hideTimer();
                this.updateLoginButton(data.user.email);
                console.log('✅ User authenticated:', data.user.email);
            } else {
                this.clearAuth();
            }
        } catch (e) {
            console.warn('Auth check failed:', e);
            // If we have valid local data, don't clear auth
            if (userDataStr) {
                const userData = JSON.parse(userDataStr);
                if (userData.email) {
                    this.isSubscribed = true;
                    this.hideTimer();
                    this.updateLoginButton(userData.email);
                    console.log('✅ Using cached auth for:', userData.email);
                }
            }
        }
    },

    // Start free trial timer - IP-based server tracking
    async startFreeTimer() {
        // First, fetch remaining time from server (IP-based)
        try {
            const response = await fetch('/.netlify/functions/free-trial', {
                method: 'GET',
                headers: {
                    'X-Fingerprint': this.getFingerprint()
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Check if blocked (time exhausted)
                if (data.blocked || data.remainingSeconds <= 0) {
                    this.onTrialExpired();
                    return;
                }

                // Store server time in localStorage for display
                this.serverRemainingSeconds = data.remainingSeconds;
                console.log(`⏱️ Server says: ${Math.floor(data.remainingSeconds / 60)} minutes remaining`);
            }
        } catch (e) {
            console.warn('Server time check failed, using localStorage fallback:', e.message);
        }

        // Fallback to localStorage if server fails
        let sessionStart = localStorage.getItem(this.STORAGE_KEYS.sessionStart);
        if (!sessionStart) {
            sessionStart = Date.now().toString();
            localStorage.setItem(this.STORAGE_KEYS.sessionStart, sessionStart);
            console.log('⏱️ New session started');
        }

        const startTime = parseInt(sessionStart);

        // Use server time if available, otherwise localStorage
        let remainingMs = this.serverRemainingSeconds
            ? this.serverRemainingSeconds * 1000
            : (this.FREE_TRIAL_MINUTES * 60 * 1000) - (Date.now() - startTime);

        this.createTimerDisplay();

        // Track time for server sync
        let lastSyncTime = Date.now();
        const SYNC_INTERVAL = 30000; // Sync every 30 seconds

        this.timerInterval = setInterval(async () => {
            const now = Date.now();
            remainingMs -= 1000;

            if (remainingMs <= 0) {
                // Sync final time to server before blocking
                await this.syncTimeToServer(Math.floor((now - lastSyncTime) / 1000));
                this.onTrialExpired();
                return;
            }

            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            this.updateTimerDisplay(minutes, seconds);

            if (remainingMs < 120000) {
                this.showWarning();
            }

            // Sync to server every 30 seconds
            if (now - lastSyncTime >= SYNC_INTERVAL) {
                const secondsElapsed = Math.floor((now - lastSyncTime) / 1000);
                this.syncTimeToServer(secondsElapsed);
                lastSyncTime = now;
            }
        }, 1000);

        // Sync when page is about to close
        window.addEventListener('beforeunload', () => {
            const secondsElapsed = Math.floor((Date.now() - lastSyncTime) / 1000);
            if (secondsElapsed > 5) {
                navigator.sendBeacon('/.netlify/functions/free-trial',
                    JSON.stringify({ seconds: secondsElapsed }));
            }
        });
    },

    // Sync time to server
    async syncTimeToServer(seconds) {
        try {
            await fetch('/.netlify/functions/free-trial', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Fingerprint': this.getFingerprint()
                },
                body: JSON.stringify({ seconds })
            });
        } catch (e) {
            console.warn('Time sync failed:', e.message);
        }
    },

    // Generate browser fingerprint for extra security
    getFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('fingerprint', 0, 0);
        const hash = canvas.toDataURL().slice(-20);
        return hash + navigator.language + screen.width;
    },

    // Create timer display
    createTimerDisplay() {
        if (document.getElementById('kelion-timer')) return;

        const timer = document.createElement('div');
        timer.id = 'kelion-timer';
        timer.innerHTML = `
            <span class="timer-icon">⏱️</span>
            <span class="timer-label">Free Time:</span>
            <span class="timer-value" id="timer-value">60:00</span>
        `;
        timer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, rgba(20, 25, 40, 0.95), rgba(10, 15, 30, 0.95));
            backdrop-filter: blur(15px);
            border: 2px solid rgba(212, 175, 55, 0.6);
            border-radius: 50px;
            padding: 12px 25px;
            color: #d4af37;
            font-family: 'Cinzel', 'Segoe UI', sans-serif;
            font-size: 1.1rem;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10000;
            box-shadow: 0 4px 25px rgba(212, 175, 55, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(timer);
    },

    // Update timer display
    updateTimerDisplay(minutes, seconds) {
        const timerValue = document.getElementById('timer-value');
        const timer = document.getElementById('kelion-timer');
        if (timerValue) {
            timerValue.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            // Only show warning colors in last 5 minutes - keep it calm until then
            if (minutes < 2) {
                timerValue.style.color = '#ff6b6b';
                timer.style.borderColor = 'rgba(255, 107, 107, 0.6)';
            } else if (minutes < 5) {
                timerValue.style.color = '#ffaa44';
                timer.style.borderColor = 'rgba(255, 170, 68, 0.6)';
            } else {
                timerValue.style.color = '#d4af37';
                timer.style.borderColor = 'rgba(212, 175, 55, 0.6)';
            }
        }
    },

    // Show warning when time is low
    showWarning() {
        const timer = document.getElementById('kelion-timer');
        if (timer && !timer.classList.contains('warning')) {
            timer.classList.add('warning');
            timer.style.borderColor = '#ff4444';
            timer.style.animation = 'pulse-warning 1s infinite';
        }
    },

    // Hide timer for subscribed users
    hideTimer() {
        clearInterval(this.timerInterval);
        const timer = document.getElementById('kelion-timer');
        if (timer) timer.remove();
    },

    // Trial expired - redirect to subscribe page (existing user tab)
    onTrialExpired() {
        clearInterval(this.timerInterval);
        // Clear timer display
        const timer = document.getElementById('kelion-timer');
        if (timer) timer.remove();
        // Redirect to subscription page - existing user tab for login
        window.location.href = '/subscribe.html?tab=existing';
    },

    // Show paywall modal
    showPaywall() {
        const existing = document.getElementById('kelion-paywall');
        if (existing) existing.remove();

        const paywall = document.createElement('div');
        paywall.id = 'kelion-paywall';
        paywall.innerHTML = `
            <div class="paywall-overlay"></div>
            <div class="paywall-modal">
                <img src="images/kelion_blazon.png" alt="Kelion" class="paywall-logo">
                <h2>Your Free Trial Has Ended</h2>
                <p>Upgrade to Kelion Premium for unlimited access to all features</p>
                
                <div class="paywall-plans">
                    <div class="plan-card" onclick="KelionSubscription.subscribe('monthly')">
                        <div class="plan-badge">Most Popular</div>
                        <div class="plan-price">£15</div>
                        <div class="plan-period">per month</div>
                        <ul class="plan-features">
                            <li>✓ Unlimited conversations</li>
                            <li>✓ All 25+ languages</li>
                            <li>✓ Premium voice quality</li>
                            <li>✓ Priority support</li>
                        </ul>
                        <button class="plan-btn">Subscribe Monthly</button>
                    </div>
                    
                    <div class="plan-card annual">
                        <div class="plan-badge save">Save £80!</div>
                        <div class="plan-price">£100</div>
                        <div class="plan-period">per year</div>
                        <ul class="plan-features">
                            <li>✓ Everything in Monthly</li>
                            <li>✓ 2 months FREE</li>
                            <li>✓ Early access to features</li>
                            <li>✓ Exclusive content</li>
                        </ul>
                        <button class="plan-btn">Subscribe Yearly</button>
                    </div>
                </div>
                
                <p class="paywall-footer">
                    Already subscribed? <a href="#" onclick="KelionSubscription.showLoginModal(); return false;">Login here</a>
                </p>
            </div>
        `;

        this.addPaywallStyles();
        document.body.appendChild(paywall);
    },

    addPaywallStyles() {
        if (document.getElementById('kelion-paywall-styles')) return;
        const style = document.createElement('style');
        style.id = 'kelion-paywall-styles';
        style.textContent = `
            #kelion-paywall .paywall-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.9); z-index: 99999;
            }
            #kelion-paywall .paywall-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #0a0a1a 100%);
                border: 2px solid #d4af37; border-radius: 25px; padding: 40px;
                max-width: 700px; width: 90%; z-index: 100000; text-align: center;
                color: #fff; box-shadow: 0 20px 60px rgba(212, 175, 55, 0.3);
            }
            #kelion-paywall .paywall-logo { height: 80px; margin-bottom: 20px; }
            #kelion-paywall h2 { color: #d4af37; font-size: 1.8rem; margin-bottom: 10px; }
            #kelion-paywall p { color: #aaa; margin-bottom: 30px; }
            #kelion-paywall .paywall-plans { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
            #kelion-paywall .plan-card {
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 20px; padding: 30px; width: 250px; cursor: pointer;
                transition: all 0.3s ease; position: relative;
            }
            #kelion-paywall .plan-card:hover {
                border-color: #d4af37; transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(212,175,55,0.2);
            }
            #kelion-paywall .plan-card.annual { border-color: #d4af37; }
            #kelion-paywall .plan-badge {
                position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
                background: #d4af37; color: #000; padding: 5px 15px; border-radius: 15px;
                font-size: 0.75rem; font-weight: bold;
            }
            #kelion-paywall .plan-badge.save { background: #00ff88; }
            #kelion-paywall .plan-price { font-size: 2.5rem; font-weight: bold; color: #d4af37; }
            #kelion-paywall .plan-period { color: #888; margin-bottom: 20px; }
            #kelion-paywall .plan-features { list-style: none; padding: 0; margin: 0 0 20px; text-align: left; }
            #kelion-paywall .plan-features li { padding: 8px 0; color: #ccc; font-size: 0.9rem; }
            #kelion-paywall .plan-btn {
                background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
                border: none; padding: 15px 30px; border-radius: 25px; color: #000;
                font-weight: bold; cursor: pointer; width: 100%; transition: all 0.3s ease;
            }
            #kelion-paywall .plan-btn:hover { transform: scale(1.05); box-shadow: 0 5px 20px rgba(212,175,55,0.4); }
            #kelion-paywall .paywall-footer { margin-top: 20px; font-size: 0.9rem; }
            #kelion-paywall .paywall-footer a { color: #d4af37; text-decoration: none; }
            @keyframes pulse-warning { 0%,100% { box-shadow: 0 0 10px rgba(255,68,68,0.5); } 50% { box-shadow: 0 0 20px rgba(255,68,68,0.8); } }
        `;
        document.head.appendChild(style);
    },

    // Subscribe with PayPal
    async subscribe(planType) {
        try {
            const btn = event.target;
            btn.textContent = 'Loading...';
            btn.disabled = true;

            const response = await fetch('/api/subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', planType })
            });

            const data = await response.json();

            if (data.approvalUrl) {
                window.location.href = data.approvalUrl;
            } else if (data.error) {
                alert('Error: ' + data.error + '\n' + (data.message || ''));
                btn.textContent = planType === 'monthly' ? 'Subscribe Monthly' : 'Subscribe Yearly';
                btn.disabled = false;
            }
        } catch (e) {
            console.error('Subscription error:', e);
            alert('Failed to start subscription. Please try again.');
        }
    },

    // Add login button to UI
    addLoginButton() {
        if (document.getElementById('kelion-login-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'kelion-login-btn';
        btn.innerHTML = '👤 Login';
        btn.style.cssText = `
            position: fixed; top: 20px; left: 20px;
            background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(10px);
            border: 1px solid rgba(212, 175, 55, 0.5); border-radius: 25px;
            padding: 10px 20px; color: #d4af37; font-family: 'Segoe UI', sans-serif;
            font-size: 0.9rem; cursor: pointer; z-index: 10000; transition: all 0.3s ease;
            display: none; visibility: hidden;
        `;
        btn.onclick = () => this.showLoginModal();
        btn.onmouseover = () => btn.style.borderColor = '#d4af37';
        btn.onmouseout = () => btn.style.borderColor = 'rgba(212, 175, 55, 0.5)';
        document.body.appendChild(btn);

        // Only add New User button for non-logged-in users
        if (!localStorage.getItem(this.STORAGE_KEYS.authToken)) {
            this.addNewUserButton();
        }
    },

    // Add New User / Subscribe button
    addNewUserButton() {
        if (document.getElementById('kelion-subscribe-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'kelion-subscribe-btn';
        btn.innerHTML = '✨ New User';
        btn.style.cssText = `
            position: fixed; top: 20px; left: 140px;
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(184, 134, 11, 0.3));
            backdrop-filter: blur(10px);
            border: 1px solid rgba(212, 175, 55, 0.6); border-radius: 25px;
            padding: 10px 20px; color: #d4af37; font-family: 'Segoe UI', sans-serif;
            font-size: 0.9rem; font-weight: 600; cursor: pointer; z-index: 10000;
            transition: all 0.3s ease;
            display: block; visibility: visible;
        `;
        btn.onclick = () => window.location.href = '/subscribe.html';
        btn.onmouseover = () => {
            btn.style.background = 'linear-gradient(135deg, #d4af37, #b8860b)';
            btn.style.color = '#000';
            btn.style.transform = 'translateY(-2px)';
        };
        btn.onmouseout = () => {
            btn.style.background = 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(184, 134, 11, 0.3))';
            btn.style.color = '#d4af37';
            btn.style.transform = 'translateY(0)';
        };
        document.body.appendChild(btn);
    },

    // Update login button for logged in users
    updateLoginButton(email) {
        const btn = document.getElementById('kelion-login-btn');
        if (btn) {
            // Check if admin
            const userDataStr = localStorage.getItem('kelion_user');
            let isAdmin = false;
            if (userDataStr) {
                try {
                    const userData = JSON.parse(userDataStr);
                    isAdmin = userData.role === 'admin' || userData.role === 'superadmin';
                } catch (e) { }
            }

            if (isAdmin) {
                // Show button ONLY for admins
                btn.style.display = 'block';
                btn.style.visibility = 'visible';
                btn.innerHTML = `🔓 Admin Panel`;
                btn.style.borderColor = '#ff4444';
                btn.style.color = '#ff4444';
                // Click opens admin.html
                btn.onclick = () => window.location.href = '/admin.html';

                // Hide Account button for admin (they don't need it)
                const accountBtn = document.getElementById('account-btn');
                if (accountBtn) {
                    accountBtn.style.display = 'none';
                }

                // Hide K1 Docs for admin (they have full access anyway)
                const premiumNav = document.getElementById('premium-nav');
                if (premiumNav) {
                    premiumNav.style.display = 'none';
                }
            } else {
                // Regular users - keep button hidden, they don't need admin access
                btn.style.display = 'none';
                const shortEmail = email.split('@')[0];
                btn.innerHTML = `✓ ${shortEmail} (Logout)`;
                btn.style.borderColor = '#00ff88';
                btn.onclick = () => this.showAccountMenu();

                // Show premium navigation for regular premium users
                const premiumNav = document.getElementById('premium-nav');
                if (premiumNav) {
                    premiumNav.style.display = 'flex';
                }
            }
        }
    },

    // Show choice modal - FREE TRIAL or LOGIN
    showChoiceModal() {
        const existing = document.getElementById('kelion-choice-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'kelion-choice-modal';
        modal.innerHTML = `
            <div class="choice-overlay"></div>
            <div class="choice-modal">
                <img src="images/kelion_blazon.png" alt="Kelion" class="choice-logo">
                <h2>Welcome to KELION</h2>
                <p class="choice-subtitle">Choose how you want to continue</p>
                
                <div class="choice-buttons">
                    <button onclick="KelionSubscription.chooseFreeTriak()" class="choice-btn choice-free">
                        ⏱️ FREE TRIAL
                        <br><small>60 minutes free access</small>
                    </button>
                    
                    <button onclick="KelionSubscription.chooseLogin()" class="choice-btn choice-login">
                        🔐 LOGIN
                        <br><small>Sign in to your account</small>
                    </button>
                </div>
            </div>
        `;

        // Add styles
        if (!document.getElementById('kelion-choice-styles')) {
            const style = document.createElement('style');
            style.id = 'kelion-choice-styles';
            style.textContent = `
                #kelion-choice-modal .choice-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.9); z-index: 99999;
                }
                #kelion-choice-modal .choice-modal {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a1a 100%);
                    border: 2px solid #d4af37; border-radius: 25px; padding: 40px;
                    max-width: 450px; width: 90%; z-index: 100000; text-align: center; color: #fff;
                    box-shadow: 0 25px 80px rgba(212,175,55,0.3);
                }
                #kelion-choice-modal .choice-logo { height: 80px; margin-bottom: 15px; }
                #kelion-choice-modal h2 { color: #d4af37; font-family: 'Cinzel', serif; font-size: 1.8rem; margin: 0 0 5px; }
                #kelion-choice-modal .choice-subtitle { color: #888; font-size: 1rem; margin: 0 0 30px; }
                #kelion-choice-modal .choice-buttons { display: flex; flex-direction: column; gap: 15px; }
                #kelion-choice-modal .choice-btn {
                    width: 100%; padding: 18px; border-radius: 15px; font-family: 'Cinzel', serif;
                    font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: all 0.3s;
                    border: 2px solid #d4af37;
                }
                #kelion-choice-modal .choice-btn small { font-weight: normal; opacity: 0.8; font-size: 0.8rem; }
                #kelion-choice-modal .choice-free {
                    background: linear-gradient(180deg, #1a5a3a 0%, #0d3d28 100%);
                    color: #ffd700;
                }
                #kelion-choice-modal .choice-free:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(26,90,58,0.4); }
                #kelion-choice-modal .choice-login {
                    background: linear-gradient(180deg, #1a3a6c 0%, #0a2a5c 100%);
                    color: #d4af37;
                }
                #kelion-choice-modal .choice-login:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(26,58,108,0.4); }
                #kelion-choice-modal .choice-footer { margin-top: 25px; font-size: 0.9rem; color: #888; }
                #kelion-choice-modal .choice-footer a { color: #d4af37; text-decoration: none; font-weight: bold; }
                #kelion-choice-modal .choice-footer a:hover { text-decoration: underline; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);
    },

    // Common function to reveal K and start experience (used by both FREE and LOGIN)
    revealK(isSubscribed = false) {
        // Remove any modals
        document.getElementById('kelion-choice-modal')?.remove();
        document.getElementById('kelion-login-modal')?.remove();
        document.getElementById('kelion-paywall')?.remove();

        // Reveal K (hide loading)
        document.getElementById('loading').style.display = 'none';

        // Update subscription state
        this.isSubscribed = isSubscribed;

        if (isSubscribed) {
            // Premium user - no timer, same look as free trial
            this.hideTimer();
            const loginBtn = document.getElementById('kelion-login-btn');
            if (loginBtn) loginBtn.style.display = 'none';
            // Hide premium nav - keep interface clean like free trial
            const premiumNav = document.getElementById('premium-nav');
            if (premiumNav) premiumNav.style.display = 'none';
            // Show small discrete logout button
            const logoutBtn = document.getElementById('logout-btn-small');
            if (logoutBtn) logoutBtn.style.display = 'block';
        } else {
            // Free trial - hide login button, start timer
            const loginBtn = document.getElementById('kelion-login-btn');
            if (loginBtn) loginBtn.style.display = 'none';
            const premiumNav = document.getElementById('premium-nav');
            if (premiumNav) premiumNav.style.display = 'none';
            const logoutBtn = document.getElementById('logout-btn-small');
            if (logoutBtn) logoutBtn.style.display = 'none';
            this.startFreeTimer();
        }

        // Greet user and trigger auto-start (GPS, etc.)
        if (typeof greetUser === 'function') greetUser();
        if (typeof triggerAutoStartAfterModel === 'function') triggerAutoStartAfterModel();

        // Auto-start realtime voice and vision - ALL go through Kimi
        setTimeout(() => {
            // Start realtime voice
            if (window.kelionRealtime && !window.kelionRealtime.isActive()) {
                console.log('🎙️ Starting voice (Kimi handles responses)...');
                window.kelionRealtime.start();
            }
            // Start vision (camera-based presence detection) - goes through Kimi
            if (window.kelionVision && !window.kelionVision.isEnabled()) {
                console.log('👁️ Starting vision (Kimi handles)...');
                window.kelionVision.init();
            }
        }, 1500);
        console.log('🧠 KIMI is the central brain - all AI goes through Kimi');
    },

    // Choose FREE TRIAL - reveal K with timer
    chooseFreeTriak() {
        this.revealK(false); // Not subscribed = has timer
    },

    // Choose LOGIN - show login form
    chooseLogin() {
        document.getElementById('kelion-choice-modal')?.remove();
        this.showLoginModal();
    },

    // Show login modal - DIRECT email/password form (NO create account button initially)
    showLoginModal() {
        const existing = document.getElementById('kelion-login-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'kelion-login-modal';
        modal.innerHTML = `
            <div class="login-overlay" onclick="document.getElementById('kelion-login-modal').remove()"></div>
            <div class="login-modal">
                <button class="login-close" onclick="document.getElementById('kelion-login-modal').remove()">×</button>
                <img src="images/kelion_blazon.png" alt="Kelion" class="login-logo">
                <h3>Welcome to KELION</h3>
                <p class="login-subtitle">Sign in to your account</p>
                
                <form class="login-form" onsubmit="event.preventDefault(); KelionSubscription.login();">
                    <div class="input-group">
                        <label for="login-email">Email Address</label>
                        <div class="input-wrapper">
                            <span class="input-icon">📧</span>
                            <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email" required>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label for="login-password">Password</label>
                        <div class="input-wrapper">
                            <span class="input-icon">🔐</span>
                            <input type="password" id="login-password" placeholder="••••••••••••" autocomplete="off" required>
                            <button type="button" class="toggle-password" onclick="KelionSubscription.togglePassword()">👁️</button>
                        </div>
                    </div>
                    
                    <div id="login-error" class="login-error"></div>
                    
                    <!-- Options section - hidden initially, shown after login fails -->
                    <div id="new-user-section" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(212,175,55,0.3);">
                        <p style="color: #ccc; margin-bottom: 15px; font-size: 0.9rem; text-align: center;">What would you like to do?</p>
                        
                        <button type="button" onclick="KelionSubscription.showForgotPassword()" class="forgot-password-btn" style="width:100%; margin-bottom: 10px; padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid #d4af37; border-radius: 6px; color: #d4af37; cursor: pointer;">
                            🔑 FORGOT PASSWORD
                            <br><small style="color: #999;">Reset your password</small>
                        </button>
                        
                        <button type="button" onclick="window.location.href='/subscribe.html'" class="new-user-btn" style="width:100%; padding: 12px;">
                            ✨ CREATE ACCOUNT
                            <br><small>Subscribe to get access</small>
                        </button>
                    </div>
                    
                    <button type="submit" id="login-submit-btn" class="login-submit">
                        <span class="btn-text">Sign In</span>
                    </button>
                </form>
                
                <p class="login-footer" style="margin-top: 15px;">
                    <a href="#" onclick="document.getElementById('kelion-login-modal').remove(); return false;">← Back</a>
                </p>
            </div>
        `;

        this.addLoginStyles();
        document.body.appendChild(modal);
        setTimeout(() => document.getElementById('login-email')?.focus(), 100);
    },

    // Show existing user login form
    showExistingUserForm() {
        const modalContent = document.querySelector('#kelion-login-modal .login-modal');
        if (!modalContent) return;

        modalContent.innerHTML = `
            <button class="login-close" onclick="document.getElementById('kelion-login-modal').remove()">×</button>
            <img src="images/kelion_blazon.png" alt="Kelion" class="login-logo">
            <h3>Welcome Back</h3>
            <p class="login-subtitle">Sign in to your premium account</p>
            
            <form class="login-form" onsubmit="event.preventDefault(); KelionSubscription.login();">
                <div class="input-group">
                    <label for="login-email">Email Address</label>
                    <div class="input-wrapper">
                        <span class="input-icon">📧</span>
                        <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email" required>
                    </div>
                </div>
                
                <div class="input-group">
                    <label for="login-password">Password</label>
                    <div class="input-wrapper">
                        <span class="input-icon">🔐</span>
                        <input type="password" id="login-password" placeholder="••••••••••••" autocomplete="off" required>
                        <button type="button" class="toggle-password" onclick="KelionSubscription.togglePassword()">👁️</button>
                    </div>
                </div>
                
                <div id="login-error" class="login-error"></div>
                
                <button type="submit" id="login-submit-btn" class="login-submit">
                    <span class="btn-text">Sign In</span>
                </button>
            </form>
            
            <p class="login-footer">
                <a href="#" onclick="KelionSubscription.showLoginModal(); return false;">← Back to options</a>
            </p>
        `;

        setTimeout(() => document.getElementById('login-email')?.focus(), 100);
    },

    addLoginStyles() {
        if (document.getElementById('kelion-login-styles')) return;
        const style = document.createElement('style');
        style.id = 'kelion-login-styles';
        style.textContent = `
            #kelion-login-modal .login-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.85); z-index: 99999; backdrop-filter: blur(5px);
            }
            #kelion-login-modal .login-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #0a0a1a 100%);
                border: 2px solid #d4af37; border-radius: 20px; padding: 35px 40px;
                width: 90%; max-width: 420px; z-index: 100000; text-align: center; color: #fff;
                box-shadow: 0 25px 80px rgba(212,175,55,0.25);
            }
            #kelion-login-modal .login-close {
                position: absolute; top: 12px; right: 16px; background: none; border: none;
                color: #666; font-size: 1.8rem; cursor: pointer; transition: color 0.3s;
            }
            #kelion-login-modal .login-close:hover { color: #d4af37; }
            #kelion-login-modal .login-logo { height: 60px; margin-bottom: 15px; }
            #kelion-login-modal h3 { color: #d4af37; font-size: 1.6rem; margin: 0 0 5px; font-weight: 600; }
            #kelion-login-modal .login-subtitle { color: #888; font-size: 0.9rem; margin: 0 0 25px; }
            #kelion-login-modal .login-form { text-align: left; }
            #kelion-login-modal .input-group { margin-bottom: 18px; }
            #kelion-login-modal .input-group label { display: block; color: #aaa; font-size: 0.85rem; margin-bottom: 6px; font-weight: 500; }
            #kelion-login-modal .input-wrapper { position: relative; display: flex; align-items: center; }
            #kelion-login-modal .input-icon { position: absolute; left: 14px; font-size: 1rem; opacity: 0.6; }
            #kelion-login-modal .input-group input {
                width: 100%; padding: 14px 45px 14px 42px;
                background: rgba(255,255,255,0.08); border: 1px solid rgba(212,175,55,0.25);
                border-radius: 10px; color: #fff; font-size: 1rem; transition: all 0.3s;
            }
            #kelion-login-modal .input-group input:focus {
                outline: none; border-color: #d4af37; background: rgba(255,255,255,0.12);
                box-shadow: 0 0 15px rgba(212,175,55,0.15);
            }
            #kelion-login-modal .input-group input::placeholder { color: #555; }
            #kelion-login-modal .toggle-password {
                position: absolute; right: 12px; background: none; border: none;
                cursor: pointer; font-size: 1.1rem; opacity: 0.6; transition: opacity 0.3s;
            }
            #kelion-login-modal .toggle-password:hover { opacity: 1; }
            #kelion-login-modal .input-hint { display: block; color: #666; font-size: 0.75rem; margin-top: 5px; }
            #kelion-login-modal .login-error {
                background: rgba(255,68,68,0.15); border: 1px solid rgba(255,68,68,0.4);
                color: #ff6b6b; padding: 10px 15px; border-radius: 8px; font-size: 0.85rem;
                margin-bottom: 15px; display: none;
            }
            #kelion-login-modal .login-error.show { display: block; }
            #kelion-login-modal .login-submit {
                width: 100%; padding: 15px;
                background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
                border: none; border-radius: 25px; color: #000; font-weight: 700;
                font-size: 1rem; cursor: pointer; transition: all 0.3s;
            }
            #kelion-login-modal .login-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(212,175,55,0.35); }
            #kelion-login-modal .login-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
            #kelion-login-modal .login-divider { display: flex; align-items: center; margin: 20px 0; }
            #kelion-login-modal .login-divider::before, #kelion-login-modal .login-divider::after {
                content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1);
            }
            #kelion-login-modal .login-divider span { padding: 0 15px; color: #555; font-size: 0.8rem; }
            #kelion-login-modal .login-footer { color: #888; font-size: 0.9rem; margin: 0; }
            #kelion-login-modal .login-footer a { color: #d4af37; text-decoration: none; font-weight: 500; }
            #kelion-login-modal .login-footer a:hover { text-decoration: underline; }
            #kelion-login-modal .login-help { margin-top: 15px; font-size: 0.8rem; }
            #kelion-login-modal .login-help a { color: #666; text-decoration: none; }
            #kelion-login-modal .login-help a:hover { color: #d4af37; }
            #kelion-login-modal .login-choice-buttons { display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; }
            #kelion-login-modal .existing-user-btn {
                width: 100%; padding: 16px;
                background: linear-gradient(180deg, #1a3a6c 0%, #0a2a5c 100%);
                border: 2px solid #d4af37; border-radius: 25px; color: #d4af37;
                font-family: inherit; font-weight: bold; font-size: 1rem; cursor: pointer;
                transition: all 0.3s;
            }
            #kelion-login-modal .existing-user-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(26,58,108,0.35); }
            #kelion-login-modal .existing-user-btn small { font-weight: normal; opacity: 0.8; }
            #kelion-login-modal .new-user-btn {
                width: 100%; padding: 14px; margin-bottom: 10px;
                background: linear-gradient(135deg, #d4af37 0%, #b8860b 100%);
                border: none; border-radius: 25px; color: #000;
                font-family: inherit; font-weight: bold; font-size: 1rem; cursor: pointer;
                transition: all 0.3s;
            }
            #kelion-login-modal .new-user-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(212,175,55,0.35); }
            #kelion-login-modal .new-user-btn small { font-weight: normal; opacity: 0.8; }
            #kelion-login-modal .free-trial-btn {
                width: 100%; padding: 14px;
                background: linear-gradient(180deg, #1a5a3a 0%, #0d3d28 100%);
                border: 2px solid #d4af37; border-radius: 25px; color: #ffd700;
                font-family: inherit; font-weight: bold; font-size: 1rem; cursor: pointer;
                transition: all 0.3s;
            }
            #kelion-login-modal .free-trial-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(26,90,58,0.35); }
            #kelion-login-modal .free-trial-btn small { font-weight: normal; opacity: 0.8; }
        `;
        document.head.appendChild(style);
    },

    // Toggle password visibility
    togglePassword() {
        const input = document.getElementById('login-password');
        const btn = event.target;
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    },

    // Show error in login modal
    showLoginError(message) {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    },

    // Hide error
    hideLoginError() {
        const errorEl = document.getElementById('login-error');
        if (errorEl) errorEl.classList.remove('show');
    },

    // Show help for finding subscription ID
    showHelp() {
        const helpModal = document.createElement('div');
        helpModal.id = 'kelion-help-modal';
        helpModal.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:100001;" onclick="this.parentElement.remove()"></div>
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a1a2e;border:2px solid #d4af37;border-radius:15px;padding:30px;max-width:400px;width:90%;z-index:100002;color:#fff;">
                <h4 style="color:#d4af37;margin:0 0 15px;">How to find your Subscription ID</h4>
                <ol style="padding-left:20px;line-height:1.8;color:#ccc;">
                    <li>Log in to <strong>PayPal.com</strong></li>
                    <li>Click <strong>Settings</strong> (⚙️ icon)</li>
                    <li>Go to <strong>Payments</strong></li>
                    <li>Click <strong>Manage automatic payments</strong></li>
                    <li>Find <strong>Kelion AI</strong> and click it</li>
                    <li>Your Subscription ID starts with <strong style="color:#d4af37;">I-</strong></li>
                </ol>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-top:20px;width:100%;padding:12px;background:#d4af37;border:none;border-radius:20px;color:#000;font-weight:bold;cursor:pointer;">Got it!</button>
            </div>
        `;
        document.body.appendChild(helpModal);
    },

    // Show forgot password form
    showForgotPassword() {
        const modalContent = document.querySelector('#kelion-login-modal .login-modal');
        if (!modalContent) return;

        // Get email from login form if already entered
        const existingEmail = document.getElementById('login-email')?.value || '';

        modalContent.innerHTML = `
            <button class="login-close" onclick="document.getElementById('kelion-login-modal').remove()">×</button>
            <img src="images/kelion_blazon.png" alt="Kelion" class="login-logo">
            <h3>Reset Password</h3>
            <p class="login-subtitle">Enter your email to receive a reset link</p>
            
            <form class="login-form" onsubmit="event.preventDefault(); KelionSubscription.sendResetLink();">
                <div class="input-group">
                    <label for="reset-email">Email Address</label>
                    <div class="input-wrapper">
                        <span class="input-icon">📧</span>
                        <input type="email" id="reset-email" value="${existingEmail}" placeholder="your@email.com" autocomplete="email" required>
                    </div>
                </div>
                
                <div id="reset-message" class="login-error"></div>
                
                <button type="submit" id="reset-submit-btn" class="login-submit">
                    <span class="btn-text">Send Reset Link</span>
                </button>
            </form>
            
            <p class="login-footer" style="margin-top: 15px;">
                <a href="#" onclick="KelionSubscription.showLoginModal(); return false;">← Back to Login</a>
            </p>
        `;

        setTimeout(() => document.getElementById('reset-email')?.focus(), 100);
    },

    // Send password reset link
    async sendResetLink() {
        const email = document.getElementById('reset-email').value.trim().toLowerCase();
        const submitBtn = document.getElementById('reset-submit-btn');
        const messageEl = document.getElementById('reset-message');

        if (!email) {
            messageEl.textContent = 'Please enter your email address.';
            messageEl.classList.add('show');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-text">Sending...</span>';

        try {
            const response = await fetch('/.netlify/functions/auth-forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                messageEl.style.color = '#4caf50';
                messageEl.textContent = '✅ Reset link sent! Check your email.';
                messageEl.classList.add('show');
                submitBtn.innerHTML = '<span class="btn-text">Email Sent!</span>';
            } else {
                messageEl.style.color = '#ff6b6b';
                messageEl.textContent = data.error || 'Could not send reset link.';
                messageEl.classList.add('show');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="btn-text">Send Reset Link</span>';
            }
        } catch (e) {
            console.error('Reset error:', e);
            messageEl.style.color = '#ff6b6b';
            messageEl.textContent = 'Connection error. Please try again.';
            messageEl.classList.add('show');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="btn-text">Send Reset Link</span>';
        }
    },

    // Login function - supports both admin (password) and user (subscription ID)
    async login() {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value.trim();
        const submitBtn = document.getElementById('login-submit-btn');

        this.hideLoginError();

        if (!email || !password) {
            this.showLoginError('Please enter email and password/subscription ID');
            return;
        }

        // Show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="btn-text">Signing in...</span>';

        try {
            // First, try auth-login for ALL users (password-based login)
            const authResponse = await fetch('/.netlify/functions/auth-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const authData = await authResponse.json();

            if (authData.success && authData.accessToken) {
                // Password login successful
                const isAdmin = authData.user.role === 'admin' || authData.user.role === 'superadmin';

                localStorage.setItem(this.STORAGE_KEYS.authToken, authData.accessToken);
                localStorage.setItem(this.STORAGE_KEYS.userEmail, email);
                localStorage.setItem('kelion_user_name', authData.user.name || email.split('@')[0]);
                localStorage.setItem('kelion_refresh_token', authData.refreshToken);
                localStorage.setItem('kelion_user', JSON.stringify({
                    id: authData.user.id,
                    email: email,
                    role: authData.user.role || 'user',
                    subscription: authData.user.subscription_status || 'premium'
                }));

                localStorage.removeItem(this.STORAGE_KEYS.sessionStart);

                // Close modal immediately
                document.getElementById('kelion-login-modal')?.remove();

                this.updateLoginButton(email);

                // Reveal K with premium access (no timer)
                this.revealK(true);

                if (isAdmin) {
                    this.showSuccess('Welcome Admin! Opening Admin Panel...');
                    setTimeout(() => window.location.href = '/admin.html', 1500);
                } else {
                    this.showSuccess('Welcome back! Enjoy unlimited access.');
                }
                return;
            }

            // Password login failed - try PayPal subscription if password looks like subscription ID
            if (password.startsWith('I-')) {
                const verifyResponse = await fetch('/api/subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'verify', subscriptionId: password })
                });

                const verifyData = await verifyResponse.json();

                if (verifyData.valid) {
                    // PayPal subscription valid - create auth token
                    const tokenResponse = await fetch('/api/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'login', email, subscriptionId: password })
                    });

                    const tokenData = await tokenResponse.json();

                    if (tokenData.success) {
                        localStorage.setItem(this.STORAGE_KEYS.authToken, tokenData.token);
                        localStorage.setItem(this.STORAGE_KEYS.userEmail, email);
                        localStorage.setItem(this.STORAGE_KEYS.subscriptionId, password);
                        localStorage.setItem('kelion_user', JSON.stringify({
                            email: email,
                            role: 'user',
                            subscription: 'premium'
                        }));

                        localStorage.removeItem(this.STORAGE_KEYS.sessionStart);
                        this.updateLoginButton(email);

                        // Reveal K with premium access (no timer)
                        this.revealK(true);
                        this.showSuccess('Welcome back! Enjoy unlimited access.');
                        return;
                    }
                }
            }

            // Both methods failed - show error AND reveal New User option
            this.showLoginError(authData.error || 'Invalid email or password.');

            // Show "Create Account" option after login fails
            const newUserSection = document.getElementById('new-user-section');
            if (newUserSection) {
                newUserSection.style.display = 'block';
            }

            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="btn-text">Sign In</span>';
        } catch (e) {
            console.error('Login error:', e);
            this.showLoginError('Connection error. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="btn-text">Sign In</span>';
        }
    },

    // Logout function - save data then clear auth and redirect
    async logout() {
        // Show saving message
        this.showSuccess('Saving your data...');

        // Get auth token before clearing
        const authToken = localStorage.getItem(this.STORAGE_KEYS.authToken);

        // Try to save local memories to server before logout
        if (authToken) {
            try {
                // Get local memories
                const localMemories = JSON.parse(localStorage.getItem('kelion_memories') || '[]');

                if (localMemories.length > 0) {
                    console.log('📤 Saving', localMemories.length, 'memories to server before logout...');

                    // Save each memory to server
                    for (const memory of localMemories) {
                        await fetch('/.netlify/functions/memory', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({ fact: memory.fact || memory })
                        });
                    }
                    console.log('✅ All memories saved to server');
                }
            } catch (e) {
                console.warn('Could not save memories:', e.message);
            }
        }

        // Call server logout to invalidate token
        if (authToken) {
            try {
                await fetch('/.netlify/functions/auth-logout', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
            } catch (e) {
                console.warn('Server logout failed:', e.message);
            }
        }

        // Clear all localStorage auth data
        localStorage.removeItem(this.STORAGE_KEYS.authToken);
        localStorage.removeItem(this.STORAGE_KEYS.userEmail);
        localStorage.removeItem(this.STORAGE_KEYS.subscriptionId);
        localStorage.removeItem(this.STORAGE_KEYS.sessionStart);
        localStorage.removeItem('kelion_user');
        localStorage.removeItem('kelion_refresh_token');
        localStorage.removeItem('kelion_gdpr_accepted');
        localStorage.removeItem('kelion_memories'); // Clear local memories after sync

        // Reset state
        this.isSubscribed = false;

        // Show success and redirect immediately
        this.showSuccess('Logged out successfully!');
        setTimeout(() => {
            window.location.href = '/gdpr.html';
        }, 500);
    },

    // Show success message
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
            color: #000; padding: 15px 30px; border-radius: 25px; font-weight: bold;
            z-index: 100003; box-shadow: 0 10px 30px rgba(0,255,136,0.3);
            animation: slideDown 0.3s ease;
        `;
        toast.textContent = '✓ ' + message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    // Check URL params for subscription success
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('subscription') === 'success') {
            const subscriptionId = params.get('subscription_id');
            if (subscriptionId) {
                localStorage.setItem(this.STORAGE_KEYS.subscriptionId, subscriptionId);
                this.showLoginModal();
            }
            window.history.replaceState({}, '', window.location.pathname);
        }
    },

    // Clear authentication
    clearAuth() {
        localStorage.removeItem(this.STORAGE_KEYS.authToken);
        localStorage.removeItem(this.STORAGE_KEYS.userEmail);
        localStorage.removeItem(this.STORAGE_KEYS.subscriptionId);
        localStorage.removeItem('kelion_user');
        localStorage.removeItem('kelion_refresh_token');
        localStorage.removeItem('kelion_access_token');
        this.isSubscribed = false;

        // Hide premium nav
        const premiumNav = document.getElementById('premium-nav');
        if (premiumNav) {
            premiumNav.style.display = 'none';
        }
    },

    // Logout
    logout() {
        this.clearAuth();
        // Clear everything - user is exiting completely
        localStorage.removeItem(this.STORAGE_KEYS.sessionStart);
        localStorage.removeItem('kelion_consent');
        localStorage.removeItem('kelion_consent_date');

        // Redirect to default internet page (exit app completely)
        window.location.href = 'https://google.com';
    },

    // Show account menu
    showAccountMenu() {
        const email = localStorage.getItem(this.STORAGE_KEYS.userEmail);
        const menu = document.createElement('div');
        menu.id = 'kelion-account-menu';
        menu.innerHTML = `
            <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99998;" onclick="document.getElementById('kelion-account-menu').remove()"></div>
            <div style="position:fixed;top:70px;left:20px;background:#1a1a2e;border:1px solid #d4af37;border-radius:10px;padding:15px;z-index:99999;min-width:200px;">
                <p style="color:#888;font-size:0.8rem;margin:0 0 10px;">Logged in as:</p>
                <p style="color:#fff;margin:0 0 15px;font-weight:bold;">${email}</p>
                <button onclick="KelionSubscription.logout()" style="width:100%;padding:10px;background:#5a1515;border:1px solid #8b2020;border-radius:8px;color:#fff;cursor:pointer;">Logout</button>
            </div>
        `;
        document.body.appendChild(menu);
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KelionSubscription.init());
} else {
    KelionSubscription.init();
}

// Export for global access
window.KelionSubscription = KelionSubscription;
