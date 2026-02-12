/**
 * K Referral Policy — Teletext-style scrolling banner
 * Auto-displays referral program info at bottom of screen.
 * Detects language and shows in user's language.
 * AUTO-CAPTURES ?ref= parameter to link new users to referrers.
 */
(function () {
    'use strict';

    const API_BASE = '/.netlify/functions/referral';

    // ═══ AUTO-CAPTURE ?ref= PARAMETER ═══
    (function captureReferral() {
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (!refCode) return;

        // Already processed this code?
        if (localStorage.getItem('k_referred_by') === refCode) return;

        // Store referrer
        localStorage.setItem('k_referred_by', refCode);
        localStorage.setItem('k_referred_at', new Date().toISOString());

        // Generate or get user ID
        let userId = localStorage.getItem('kelion_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(36)).join('').substr(0, 6);
            localStorage.setItem('kelion_user_id', userId);
        }

        // Register referral with backend
        fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'register',
                ref_code: refCode,
                new_user_id: userId
            })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    console.log('🎁 Referral registered:', data);
                    // Store bonus
                    if (data.new_user_bonus) {
                        localStorage.setItem('k_bonus_days', data.new_user_bonus.extra_trial_days);
                        showWelcomeBonus(data.new_user_bonus.extra_trial_days, refCode);
                    }
                }
            })
            .catch(err => console.warn('Referral register failed:', err));

        // Clean URL (remove ?ref= so it looks nice)
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
    })();

    // Welcome bonus popup for referred users
    function showWelcomeBonus(days, code) {
        const lang = (navigator.language || 'en').substring(0, 2);
        const messages = {
            en: { title: '🎁 Welcome Bonus!', desc: `You were referred by a K user! You get <strong>${days} extra free days</strong> as a welcome gift.`, btn: 'Awesome, thanks!' },
            ro: { title: '🎁 Bonus de Bun Venit!', desc: `Ai fost recomandat de un utilizator K! Primești <strong>${days} zile extra gratuite</strong> ca și cadou de bun venit.`, btn: 'Super, mulțumesc!' },
            fr: { title: '🎁 Bonus de Bienvenue!', desc: `Vous avez été parrainé! Vous recevez <strong>${days} jours gratuits supplémentaires</strong>.`, btn: 'Génial, merci!' },
            de: { title: '🎁 Willkommensbonus!', desc: `Du wurdest empfohlen! Du erhältst <strong>${days} zusätzliche Gratistage</strong>.`, btn: 'Super, danke!' },
            es: { title: '🎁 ¡Bono de Bienvenida!', desc: `¡Fuiste referido! Recibes <strong>${days} días extra gratis</strong>.`, btn: '¡Genial, gracias!' }
        };
        const m = messages[lang] || messages.en;

        const popup = document.createElement('div');
        popup.id = 'k-welcome-bonus';
        popup.style.cssText = `
            position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
            z-index:999999;background:rgba(8,8,20,0.97);
            border:2px solid rgba(0,255,255,0.4);border-radius:20px;
            padding:32px;text-align:center;max-width:380px;width:90%;
            backdrop-filter:blur(20px);box-shadow:0 0 60px rgba(0,255,255,0.2);
            animation:k-bonus-pop 0.4s cubic-bezier(0.34,1.56,0.64,1);
            font-family:'Inter',sans-serif;
        `;
        popup.innerHTML = `
            <style>@keyframes k-bonus-pop { from { opacity:0;transform:translate(-50%,-50%) scale(0.7); } to { opacity:1;transform:translate(-50%,-50%) scale(1); } }</style>
            <div style="font-size:3rem;margin-bottom:12px;">🎁</div>
            <h3 style="color:#00ffff;font-size:1.3rem;margin:0 0 12px;">${m.title}</h3>
            <p style="color:rgba(255,255,255,0.7);font-size:0.95rem;line-height:1.5;margin:0 0 24px;">${m.desc}</p>
            <button onclick="document.getElementById('k-welcome-bonus').remove()"
                style="padding:12px 28px;border-radius:14px;border:none;
                background:linear-gradient(135deg,#00ffff,#0088ff);color:#000;
                cursor:pointer;font-size:1rem;font-weight:700;
                box-shadow:0 4px 20px rgba(0,255,255,0.3);">${m.btn}</button>
        `;
        document.body.appendChild(popup);
        setTimeout(() => { if (popup.parentNode) popup.remove(); }, 15000);
    }

    const lang = (navigator.language || 'en').substring(0, 2);

    const policies = {
        en: {
            title: 'K REFERRAL PROMO — 15 FEB to 17 MAR 2026',
            items: [
                '🥉 1 REFERRAL → 5 days FREE Pro',
                '🥈 3 REFERRALS → 15 days FREE Pro',
                '🥇 5 REFERRALS → 2 MONTHS FREE Pro',
                '💎 10 REFERRALS → 6 MONTHS FREE Pro',
                '👑 20 REFERRALS → 1 YEAR FREE Pro + Enterprise FOREVER',
                '🤝 YOUR FRIEND ALSO GETS → 5 extra free trial days',
                '📱 SHARE → QR Code, Link, WhatsApp, Telegram',
                '💰 TOP REFERRER OF THE MONTH → £50 credit'
            ]
        },
        ro: {
            title: 'PROMOȚIE RECOMANDĂRI K — 15 FEB până pe 17 MAR 2026',
            items: [
                '🥉 1 RECOMANDARE → 5 zile Pro GRATUIT',
                '🥈 3 RECOMANDĂRI → 15 zile Pro GRATUIT',
                '🥇 5 RECOMANDĂRI → 2 LUNI Pro GRATUIT',
                '💎 10 RECOMANDĂRI → 6 LUNI Pro GRATUIT',
                '👑 20 RECOMANDĂRI → 1 AN Pro + Enterprise PE VIAȚĂ',
                '🤝 PRIETENUL TĂU PRIMEȘTE → 5 zile extra de trial gratuit',
                '📱 PARTAJEAZĂ → QR Code, Link, WhatsApp, Telegram',
                '💰 TOP REFERRER AL LUNII → £50 credit'
            ]
        },
        fr: {
            title: 'PROMO PARRAINAGE K — 15 FÉV au 17 MAR 2026',
            items: [
                '🥉 1 PARRAINAGE → 5 jours Pro GRATUIT',
                '🥈 3 PARRAINAGES → 15 jours Pro GRATUIT',
                '🥇 5 PARRAINAGES → 2 MOIS Pro GRATUIT',
                '💎 10 PARRAINAGES → 6 MOIS Pro GRATUIT',
                '👑 20 PARRAINAGES → 1 AN Pro + Enterprise À VIE',
                '🤝 VOTRE AMI REÇOIT → 5 jours d\'essai en plus',
                '📱 PARTAGEZ → QR Code, Lien, WhatsApp, Telegram'
            ]
        },
        de: {
            title: 'K EMPFEHLUNGSAKTION — 15. FEB bis 17. MÄR 2026',
            items: [
                '🥉 1 EMPFEHLUNG → 5 Tage Pro GRATIS',
                '🥈 3 EMPFEHLUNGEN → 15 Tage Pro GRATIS',
                '🥇 5 EMPFEHLUNGEN → 2 MONATE Pro GRATIS',
                '💎 10 EMPFEHLUNGEN → 6 MONATE Pro GRATIS',
                '👑 20 EMPFEHLUNGEN → 1 JAHR Pro + Enterprise FÜR IMMER',
                '🤝 DEIN FREUND BEKOMMT → 5 extra Testtage'
            ]
        },
        es: {
            title: 'PROMO REFERENCIAS K — 15 FEB al 17 MAR 2026',
            items: [
                '🥉 1 REFERENCIA → 5 días Pro GRATIS',
                '🥈 3 REFERENCIAS → 15 días Pro GRATIS',
                '🥇 5 REFERENCIAS → 2 MESES Pro GRATIS',
                '💎 10 REFERENCIAS → 6 MESES Pro GRATIS',
                '👑 20 REFERENCIAS → 1 AÑO Pro + Enterprise PARA SIEMPRE',
                '🤝 TU AMIGO RECIBE → 5 días extra de prueba'
            ]
        }
    };

    const p = policies[lang] || policies.en;

    // Build the teletext ticker text
    const tickerText = `  ■ ${p.title}  ■  ${p.items.join('  ●  ')}  ■  `;

    // Wait for page to load
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(createTeletext, 2000);
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(createTeletext, 2000);
    }

    function createTeletext() {
        // Don't duplicate
        if (document.getElementById('k-teletext')) return;

        const bar = document.createElement('div');
        bar.id = 'k-teletext';
        bar.innerHTML = `
            <style>
                #k-teletext {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    z-index: 99990;
                    background: linear-gradient(90deg, #000810 0%, #001020 50%, #000810 100%);
                    border-top: 2px solid #00ffff;
                    height: 36px;
                    overflow: hidden;
                    font-family: 'Courier New', monospace;
                    cursor: pointer;
                    user-select: none;
                }

                #k-teletext-track {
                    display: flex;
                    align-items: center;
                    height: 100%;
                    white-space: nowrap;
                    animation: k-teletext-scroll 60s linear infinite;
                    will-change: transform;
                }

                #k-teletext-track:hover {
                    animation-play-state: paused;
                }

                .k-tt-text {
                    color: #00ffcc;
                    font-size: 13px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    text-shadow: 0 0 8px rgba(0,255,204,0.5);
                    padding-right: 80px;
                }

                .k-tt-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(0,255,255,0.1);
                    border: 1px solid rgba(0,255,255,0.3);
                    border-radius: 4px;
                    padding: 2px 10px;
                    margin-right: 14px;
                    color: #00ffff;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }

                #k-tt-close {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0,0,0,0.6);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 6px;
                    color: #888;
                    font-size: 14px;
                    cursor: pointer;
                    padding: 2px 8px;
                    z-index: 2;
                    transition: all 0.2s;
                }
                #k-tt-close:hover { color: #fff; border-color: #00ffff; }

                @keyframes k-teletext-scroll {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }

                /* Glow line at top */
                #k-teletext::before {
                    content: '';
                    position: absolute;
                    top: -2px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, #00ffff, #00ff88, #00ffff, transparent);
                    animation: k-tt-glow 3s ease-in-out infinite;
                }

                @keyframes k-tt-glow {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
            </style>

            <div id="k-teletext-track">
                <span class="k-tt-label">📡 KELION AI</span>
                <span class="k-tt-text">${tickerText}</span>
                <span class="k-tt-text">${tickerText}</span>
            </div>
            <button id="k-tt-close" title="Close">✕</button>
        `;

        document.body.appendChild(bar);

        // Close button
        document.getElementById('k-tt-close').addEventListener('click', (e) => {
            e.stopPropagation();
            bar.style.transform = 'translateY(100%)';
            bar.style.transition = 'transform 0.3s ease';
            setTimeout(() => bar.remove(), 300);
            sessionStorage.setItem('k_teletext_closed', '1');
        });

        // Click on bar opens referral modal
        bar.addEventListener('click', (e) => {
            if (e.target.id === 'k-tt-close') return;
            showReferralDetails();
        });

        console.log('📡 K Teletext referral banner active');
    }

    // Full referral details modal — complete flow
    function showReferralDetails() {
        const p = policies[lang] || policies.en;
        const isRo = lang === 'ro';

        let modal = document.getElementById('k-referral-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'k-referral-modal';
            document.body.appendChild(modal);
        }

        // Get or generate user ID
        let userId = localStorage.getItem('kelion_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => b.toString(36)).join('').substr(0, 6);
            localStorage.setItem('kelion_user_id', userId);
        }

        const existingCode = localStorage.getItem('k_my_referral_code');
        const referredBy = localStorage.getItem('k_referred_by');
        const bonusDays = localStorage.getItem('k_bonus_days') || 0;

        modal.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;z-index:100001;
            display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);
            animation:k-ref-fadein 0.3s ease;
        `;

        modal.innerHTML = `
            <style>
                @keyframes k-ref-fadein { from { opacity:0; } to { opacity:1; } }
                .k-ref-section { background:rgba(0,255,255,0.04);border:1px solid rgba(0,255,255,0.15);border-radius:14px;padding:18px;margin-bottom:14px; }
                .k-ref-section h3 { color:#00ffff;font-size:1rem;margin:0 0 10px;display:flex;align-items:center;gap:6px; }
                .k-ref-btn { padding:8px 16px;border-radius:10px;border:none;cursor:pointer;font-size:0.85rem;transition:all 0.2s; }
                .k-ref-btn-primary { background:linear-gradient(135deg,#00ffff,#0088ff);color:#000;font-weight:600; }
                .k-ref-btn-primary:hover { box-shadow:0 4px 15px rgba(0,255,255,0.3); }
                .k-ref-btn-outline { border:1px solid rgba(0,255,255,0.3);background:transparent;color:#00ffff; }
                .k-ref-input { width:100%;padding:10px 14px;border-radius:10px;border:1px solid rgba(0,255,255,0.2);background:rgba(0,0,0,0.4);color:#fff;font-size:0.95rem;font-family:monospace;text-align:center;outline:none; }
                .k-ref-input:focus { border-color:#00ffff;box-shadow:0 0 10px rgba(0,255,255,0.15); }
                .k-ref-input::placeholder { color:rgba(255,255,255,0.25); }
                #k-ref-status { margin-top:10px;padding:10px;border-radius:8px;font-size:0.85rem;display:none; }
                .k-ref-tier { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:8px;font-size:0.75rem;font-weight:600; }
            </style>
            <div style="max-width:520px;width:92%;background:rgba(8,8,20,0.98);border:1px solid rgba(0,255,255,0.25);
                border-radius:20px;padding:28px;max-height:90vh;overflow-y:auto;
                box-shadow:0 8px 40px rgba(0,255,255,0.15);">

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h2 style="margin:0;color:#00ffff;font-size:1.2rem;">📡 ${p.title}</h2>
                    <button onclick="document.getElementById('k-referral-modal').remove()"
                        style="background:none;border:none;color:#888;font-size:1.4rem;cursor:pointer;">✕</button>
                </div>

                <!-- TIERS DISPLAY -->
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
                    ${p.items.slice(0, 5).map(item => `
                        <div style="padding:6px 10px;background:rgba(0,255,255,0.04);border-left:2px solid rgba(0,255,255,0.3);
                            border-radius:0 8px 8px 0;color:rgba(255,255,255,0.75);font-size:0.8rem;flex:1 1 100%;">${item}</div>
                    `).join('')}
                </div>

                <!-- SECTION 1: YOUR REFERRAL CODE -->
                <div class="k-ref-section">
                    <h3>🔗 ${isRo ? 'Codul Tău de Recomandare' : 'Your Referral Code'}</h3>
                    <div id="k-ref-mycode-area">
                        ${existingCode ? `
                            <div style="text-align:center;">
                                <div style="color:#00ffff;font-family:monospace;font-size:1.4rem;font-weight:700;letter-spacing:2px;margin-bottom:8px;">${existingCode}</div>
                                <div style="color:rgba(255,255,255,0.4);font-size:0.75rem;margin-bottom:12px;">https://kelionai.app?ref=${existingCode}</div>
                                <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                                    <button class="k-ref-btn k-ref-btn-primary" onclick="navigator.clipboard.writeText('https://kelionai.app?ref=${existingCode}');this.textContent='✓ Copiat!';setTimeout(()=>this.textContent='📋 Copiază Link',2000)">📋 ${isRo ? 'Copiază Link' : 'Copy Link'}</button>
                                    <button class="k-ref-btn k-ref-btn-outline" onclick="window.K_shareQR && window.K_shareQR()">📱 QR</button>
                                    <button class="k-ref-btn" style="border:1px solid rgba(37,211,102,0.4);background:rgba(37,211,102,0.1);color:#25d366;" onclick="window.open('https://wa.me/?text=${encodeURIComponent((isRo ? 'Încearcă K — primul AI pe care îl poți vedea! ' : 'Try K — the first AI you can see! ') + 'https://kelionai.app?ref=' + existingCode)}','_blank')">💬 WhatsApp</button>
                                    <button class="k-ref-btn" style="border:1px solid rgba(0,136,204,0.4);background:rgba(0,136,204,0.1);color:#0088cc;" onclick="window.open('https://t.me/share/url?url=${encodeURIComponent('https://kelionai.app?ref=' + existingCode)}&text=${encodeURIComponent(isRo ? 'Încearcă K!' : 'Try K!')}','_blank')">✈️ Telegram</button>
                                </div>
                            </div>
                        ` : `
                            <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin:0 0 12px;">${isRo ? 'Generează codul tău unic pentru a invita prieteni și a primi zile Pro gratuite.' : 'Generate your unique code to invite friends and earn free Pro days.'}</p>
                            <button class="k-ref-btn k-ref-btn-primary" style="width:100%;padding:12px;" onclick="window._krefGenerate()">
                                🔑 ${isRo ? 'Generează Codul Meu' : 'Generate My Code'}
                            </button>
                        `}
                    </div>
                </div>

                <!-- SECTION 2: ENTER A CODE (for new users) -->
                <div class="k-ref-section">
                    <h3>🎁 ${isRo ? 'Ai Primit un Cod? Introdu-l Aici' : 'Got a Code? Enter It Here'}</h3>
                    ${referredBy ? `
                        <div style="text-align:center;color:rgba(255,255,255,0.6);font-size:0.85rem;">
                            ✅ ${isRo ? 'Ai fost recomandat cu codul:' : 'You were referred with code:'} <span style="color:#00ffff;font-weight:600;">${referredBy}</span>
                            <br><span style="color:rgba(0,255,255,0.5);font-size:0.8rem;">+${bonusDays} ${isRo ? 'zile extra' : 'extra days'}</span>
                        </div>
                    ` : `
                        <p style="color:rgba(255,255,255,0.5);font-size:0.8rem;margin:0 0 10px;">${isRo ? 'Dacă cineva ți-a dat un cod, introdu-l aici pentru a primi zile gratuite:' : 'If someone gave you a code, enter it here to get free days:'}</p>
                        <div style="display:flex;gap:8px;">
                            <input id="k-ref-code-input" class="k-ref-input" placeholder="${isRo ? 'Ex: KABC1234' : 'e.g. KABC1234'}" maxlength="12" style="flex:1;">
                            <button class="k-ref-btn k-ref-btn-primary" onclick="window._krefApply()">
                                ✓ ${isRo ? 'Aplică' : 'Apply'}
                            </button>
                        </div>
                        <div id="k-ref-status"></div>
                    `}
                </div>

                <!-- SECTION 3: YOUR STATS -->
                <div class="k-ref-section">
                    <h3>📊 ${isRo ? 'Statistici' : 'Your Stats'}</h3>
                    <div id="k-ref-stats" style="text-align:center;color:rgba(255,255,255,0.5);font-size:0.85rem;">
                        ${isRo ? 'Se încarcă...' : 'Loading...'}
                    </div>
                </div>

                <!-- PROMO DATE -->
                <div style="text-align:center;margin-top:8px;color:rgba(255,255,255,0.25);font-size:0.7rem;">
                    ${isRo ? 'Promoție activă: 15 feb – 17 mar 2026 (30 zile)' : 'Promo active: 15 Feb – 17 Mar 2026 (30 days)'}
                </div>
            </div>
        `;

        // Load stats
        loadReferralStats(userId);
    }

    // Generate referral code
    window._krefGenerate = async function () {
        const userId = localStorage.getItem('kelion_user_id');
        const userEmail = localStorage.getItem('kelion_user_email') || null;
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', user_id: userId, user_email: userEmail })
            });
            const data = await res.json();
            if (data.success && data.referral_code) {
                localStorage.setItem('k_my_referral_code', data.referral_code);
                console.log('🔑 Referral code generated:', data.referral_code);
                showReferralDetails(); // Refresh modal
            }
        } catch (err) { console.error('Generate code error:', err); }
    };

    // Apply a received referral code
    window._krefApply = async function () {
        const input = document.getElementById('k-ref-code-input');
        const status = document.getElementById('k-ref-status');
        const code = (input?.value || '').trim().toUpperCase();

        if (!code || code.length < 4) {
            status.style.display = 'block';
            status.style.background = 'rgba(255,50,50,0.1)';
            status.style.color = '#ff5555';
            status.textContent = lang === 'ro' ? '❌ Introdu un cod valid (min 4 caractere)' : '❌ Enter a valid code (min 4 chars)';
            return;
        }

        // Check not self-referral
        const myCode = localStorage.getItem('k_my_referral_code');
        if (myCode && code === myCode) {
            status.style.display = 'block';
            status.style.background = 'rgba(255,50,50,0.1)';
            status.style.color = '#ff5555';
            status.textContent = lang === 'ro' ? '❌ Nu poți folosi propriul cod' : '❌ Cannot use your own code';
            return;
        }

        status.style.display = 'block';
        status.style.background = 'rgba(0,255,255,0.06)';
        status.style.color = '#00ffcc';
        status.textContent = lang === 'ro' ? '⏳ Se verifică codul...' : '⏳ Verifying code...';

        try {
            const userId = localStorage.getItem('kelion_user_id');
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', ref_code: code, new_user_id: userId })
            });
            const data = await res.json();

            if (data.success) {
                localStorage.setItem('k_referred_by', code);
                const days = data.new_user_bonus?.extra_trial_days || 5;
                localStorage.setItem('k_bonus_days', days);

                // Extend subscription in localStorage
                extendSubscription(days);

                status.style.background = 'rgba(0,255,100,0.1)';
                status.style.color = '#00ff88';
                status.innerHTML = `✅ ${lang === 'ro'
                    ? `Cod aplicat! Ai primit <strong>+${days} zile gratuite</strong>. ${data.referrer_found ? 'Persoana care te-a recomandat a fost de asemenea recompensată!' : ''}`
                    : `Code applied! You got <strong>+${days} free days</strong>. ${data.referrer_found ? 'The person who referred you was also rewarded!' : ''}`
                    }`;

                // Refresh modal after 2s
                setTimeout(() => showReferralDetails(), 2500);
            } else {
                status.style.background = 'rgba(255,50,50,0.1)';
                status.style.color = '#ff5555';
                status.textContent = lang === 'ro' ? '❌ Cod invalid sau expirat' : '❌ Invalid or expired code';
            }
        } catch (err) {
            status.style.background = 'rgba(255,50,50,0.1)';
            status.style.color = '#ff5555';
            status.textContent = lang === 'ro' ? '❌ Eroare de rețea. Încearcă din nou.' : '❌ Network error. Try again.';
        }
    };

    // Extend subscription by adding bonus days
    function extendSubscription(days) {
        const currentExpiry = localStorage.getItem('k_subscription_expiry');
        const baseDate = currentExpiry ? new Date(currentExpiry) : new Date();
        const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
        localStorage.setItem('k_subscription_expiry', newExpiry.toISOString());
        localStorage.setItem('k_subscription_extended_by_referral', 'true');
        console.log(`📅 Subscription extended by ${days} days → expires ${newExpiry.toLocaleDateString()}`);
    }

    // Load referral stats from backend
    async function loadReferralStats(userId) {
        const statsEl = document.getElementById('k-ref-stats');
        if (!statsEl) return;
        const isRo = lang === 'ro';

        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stats', user_id: userId })
            });
            const data = await res.json();

            if (data.success && data.has_referral) {
                const tierColors = { '🥉': '#cd7f32', '🥈': '#c0c0c0', '🥇': '#ffd700', '💎': '#00bfff', '👑': '#ff6347' };
                const tierEmoji = (data.referral_code || '').length > 0 ? '🥉' : '';

                statsEl.innerHTML = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:center;">
                        <div style="background:rgba(0,255,255,0.04);border-radius:10px;padding:12px;">
                            <div style="font-size:1.5rem;font-weight:800;color:#00ffff;">${data.successful_referrals || 0}</div>
                            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${isRo ? 'Recomandări' : 'Referrals'}</div>
                        </div>
                        <div style="background:rgba(0,255,255,0.04);border-radius:10px;padding:12px;">
                            <div style="font-size:1.5rem;font-weight:800;color:#00ff88;">${data.bonus_days_earned || 0}</div>
                            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${isRo ? 'Zile Câștigate' : 'Days Earned'}</div>
                        </div>
                    </div>
                    ${data.next_milestone ? `
                        <div style="margin-top:10px;padding:8px;background:rgba(255,215,0,0.06);border-radius:8px;font-size:0.8rem;color:rgba(255,255,255,0.5);">
                            🎯 ${data.next_milestone}
                        </div>
                    ` : ''}
                    ${data.enterprise_unlocked ? `
                        <div style="margin-top:8px;padding:8px;background:rgba(255,99,71,0.1);border:1px solid rgba(255,99,71,0.3);border-radius:8px;font-size:0.85rem;color:#ff6347;font-weight:600;">
                            👑 Enterprise ${isRo ? 'Deblocat PE VIAȚĂ!' : 'Unlocked FOREVER!'}
                        </div>
                    ` : ''}
                `;
            } else {
                statsEl.textContent = isRo ? 'Generează un cod pentru a vedea statisticile.' : 'Generate a code to see your stats.';
            }
        } catch (err) {
            statsEl.textContent = isRo ? 'Nu se pot încărca statisticile.' : 'Could not load stats.';
        }
    }

    console.log('📡 K Referral Teletext loaded');
})();
