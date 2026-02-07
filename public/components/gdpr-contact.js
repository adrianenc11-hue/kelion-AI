// ═══════════════════════════════════════════════════════════
// GDPR Overlay + Contact Modal — Ticker Bar Component
// Include this script on any page that has a .ticker-bar
// It will auto-inject: GDPR button, Contact button, overlays
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ═══ GDPR TEXT DATA (multi-language) ═══
    const gdprTexts = [
        { lang: 'EN', flag: '🇬🇧', text: 'We store only your IP, country and access date. Camera access is user-initiated only. We do NOT store any video or photos.' },
        { lang: 'RO', flag: '🇷🇴', text: 'Stocăm doar IP-ul, țara și data accesării. Accesul la cameră este doar la cererea utilizatorului. NU stocăm video sau fotografii.' },
        { lang: 'ES', flag: '🇪🇸', text: 'Solo almacenamos IP, país y fecha de acceso. El acceso a la cámara es solo a solicitud del usuario. NO almacenamos video ni fotos.' },
        { lang: 'FR', flag: '🇫🇷', text: 'Nous stockons uniquement IP, pays et date. L\'accès caméra est à la demande de l\'utilisateur. Nous NE stockons PAS de vidéos ou photos.' },
        { lang: 'DE', flag: '🇩🇪', text: 'Wir speichern nur IP, Land und Zugriffsdatum. Kamerazugriff erfolgt nur auf Nutzeranfrage. Wir speichern KEINE Videos oder Fotos.' },
        { lang: 'IT', flag: '🇮🇹', text: 'Memorizziamo solo IP, paese e data. L\'accesso alla fotocamera è solo su richiesta. NON memorizziamo video o foto.' },
        { lang: 'PT', flag: '🇵🇹', text: 'Armazenamos apenas IP, país e data. O acesso à câmera é apenas por solicitação. NÃO armazenamos vídeos ou fotos.' },
        { lang: 'NL', flag: '🇳🇱', text: 'We slaan alleen IP, land en datum op. Cameratoegang is alleen op verzoek. Wij slaan GEEN video\'s of foto\'s op.' },
        { lang: 'PL', flag: '🇵🇱', text: 'Przechowujemy tylko IP, kraj i datę. Dostęp do kamery tylko na życzenie. NIE przechowujemy wideo ani zdjęć.' },
        { lang: 'SV', flag: '🇸🇪', text: 'Vi lagrar endast IP, land och datum. Kameraåtkomst sker endast på begäran. Vi lagrar INTE video eller foton.' },
        { lang: 'HU', flag: '🇭🇺', text: 'Csak IP-t, országot és dátumot tárolunk. A kamerahozzáférés csak kérésre történik. NEM tárolunk videót vagy fotót.' },
        { lang: 'CS', flag: '🇨🇿', text: 'Ukládáme pouze IP, zemi a datum. Přístup ke kameře je pouze na vyžádání. NEUKLÁDÁME video ani fotografie.' },
        { lang: 'ZH', flag: '🇨🇳', text: '我们仅存储IP、国家和访问日期。摄像头访问仅在用户请求时进行。我们不存储任何视频或照片。' },
        { lang: 'JA', flag: '🇯🇵', text: 'IP、国、アクセス日のみ保存します。カメラアクセスはユーザーの要求時のみです。動画や写真は保存しません。' },
        { lang: 'AR', flag: '🇸🇦', text: 'نحن نخزن فقط IP والبلد والتاريخ. الوصول للكاميرا بناءً على طلب المستخدم فقط. لا نخزن أي فيديو أو صور.' },
        { lang: 'TR', flag: '🇹🇷', text: 'Sadece IP, ülke ve tarih saklıyoruz. Kamera erişimi sadece kullanıcı isteğiyle. Video veya fotoğraf SAKLAMIYORUZ.' },
        { lang: 'EL', flag: '🇬🇷', text: 'Αποθηκεύουμε μόνο IP, χώρα και ημερομηνία. Πρόσβαση κάμερας μόνο κατόπιν αιτήματος. ΔΕΝ αποθηκεύουμε βίντεο ή φωτογραφίες.' }
    ];

    // ═══ CHECK IF ALREADY ACCEPTED ═══
    const isAccepted = localStorage.getItem('kelion_gdpr_accepted') === 'true';

    // ═══ INJECT CSS ═══
    const style = document.createElement('style');
    style.textContent = `
        /* Ticker bar buttons */
        .ticker-actions{display:flex;align-items:center;gap:6px;padding:0 10px;flex-shrink:0}
        .ticker-action-btn{padding:6px 14px;border:1px solid rgba(212,175,55,0.3);border-radius:20px;background:rgba(212,175,55,0.06);color:#d4af37;font-size:.68rem;font-weight:600;cursor:pointer;transition:all .3s;white-space:nowrap;font-family:inherit;letter-spacing:.5px}
        .ticker-action-btn:hover{background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.6);transform:translateY(-1px)}
        .ticker-action-btn.gdpr-accepted{border-color:rgba(0,255,100,0.2);color:rgba(0,255,100,0.5)}
        .ticker-action-btn.gdpr-accepted:hover{border-color:rgba(0,255,100,0.4);color:rgba(0,255,100,0.8)}

        /* GDPR Overlay */
        .gdpr-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);z-index:100000;align-items:center;justify-content:center;animation:gdprFadeIn .3s ease}
        .gdpr-overlay.active{display:flex}
        @keyframes gdprFadeIn{from{opacity:0}to{opacity:1}}

        .gdpr-panel{width:90%;max-width:600px;max-height:85vh;background:linear-gradient(135deg,rgba(10,15,30,0.98),rgba(15,20,40,0.98));border:1px solid rgba(212,175,55,0.2);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5)}

        .gdpr-header{padding:24px 28px 16px;border-bottom:1px solid rgba(212,175,55,0.08)}
        .gdpr-header h2{font-size:1.3rem;font-weight:800;color:#fff;margin-bottom:4px}
        .gdpr-header h2 span{color:#d4af37}
        .gdpr-header p{color:rgba(255,255,255,0.3);font-size:.78rem}

        .gdpr-body{flex:1;overflow-y:auto;padding:20px 28px;scrollbar-width:thin;scrollbar-color:rgba(212,175,55,0.2) transparent}
        .gdpr-body::-webkit-scrollbar{width:4px}
        .gdpr-body::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.2);border-radius:4px}

        .gdpr-lang-item{padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.03);margin-bottom:8px;transition:background .3s}
        .gdpr-lang-item:hover{background:rgba(255,255,255,0.04)}
        .gdpr-lang-flag{font-size:1.2rem;margin-right:8px}
        .gdpr-lang-code{font-size:.6rem;font-weight:700;color:rgba(212,175,55,0.5);letter-spacing:1px;margin-right:10px}
        .gdpr-lang-text{color:rgba(255,255,255,0.5);font-size:.8rem;line-height:1.5}

        .gdpr-footer{padding:16px 28px 20px;border-top:1px solid rgba(212,175,55,0.08)}
        .gdpr-agree-row{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:10px;background:rgba(0,255,100,0.02);border:1px solid rgba(0,255,100,0.06);margin-bottom:12px;cursor:pointer}
        .gdpr-agree-row input[type=checkbox]{width:18px;height:18px;accent-color:#d4af37;flex-shrink:0;margin-top:2px;cursor:pointer}
        .gdpr-agree-text{font-size:.72rem;color:rgba(255,255,255,0.35);line-height:1.4}
        .gdpr-footer-btns{display:flex;gap:8px}
        .gdpr-btn{flex:1;padding:12px;border-radius:12px;border:none;font-size:.88rem;font-weight:600;cursor:pointer;transition:all .3s;font-family:inherit}
        .gdpr-btn-accept{background:linear-gradient(135deg,#d4af37,#b8860b);color:#000}
        .gdpr-btn-accept:hover:not(:disabled){box-shadow:0 6px 20px rgba(212,175,55,0.3);transform:translateY(-1px)}
        .gdpr-btn-accept:disabled{opacity:.4;cursor:not-allowed}
        .gdpr-btn-close{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.4)}
        .gdpr-btn-close:hover{border-color:rgba(255,255,255,0.2);color:#fff}
        .gdpr-accepted-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;background:rgba(0,255,100,0.06);color:rgba(0,255,100,0.6);font-size:.68rem;font-weight:600;margin-bottom:12px}

        /* Contact Modal */
        .contact-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);z-index:100001;align-items:center;justify-content:center;animation:gdprFadeIn .3s ease}
        .contact-overlay.active{display:flex}
        .contact-panel{width:90%;max-width:480px;background:linear-gradient(135deg,rgba(10,15,30,0.98),rgba(15,20,40,0.98));border:1px solid rgba(0,255,255,0.15);border-radius:20px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
        .contact-panel h2{font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:4px}
        .contact-panel h2 span{color:#00ffff}
        .contact-panel .contact-sub{color:rgba(255,255,255,0.3);font-size:.78rem;margin-bottom:20px}
        .contact-field{width:100%;padding:11px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;color:#fff;font-size:.85rem;font-family:inherit;outline:none;transition:border-color .3s;margin-bottom:10px}
        .contact-field:focus{border-color:rgba(0,255,255,0.3)}
        .contact-field::placeholder{color:rgba(255,255,255,0.12)}
        .contact-btns{display:flex;gap:8px;margin-top:6px}
        .contact-btn-send{flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#00ffff,#0066ff);color:#000;font-size:.88rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .3s}
        .contact-btn-send:hover{box-shadow:0 6px 20px rgba(0,255,255,0.3);transform:translateY(-1px)}
        .contact-btn-cancel{flex:0 0 auto;padding:12px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:rgba(255,255,255,0.4);font-size:.88rem;cursor:pointer;font-family:inherit;transition:all .3s}
        .contact-btn-cancel:hover{border-color:rgba(255,255,255,0.2);color:#fff}
    `;
    document.head.appendChild(style);

    // ═══ INJECT TICKER BUTTONS ═══
    const tickerBar = document.querySelector('.ticker-bar');
    if (!tickerBar) return;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'ticker-actions';
    actionsDiv.innerHTML = `
        <button class="ticker-action-btn ${isAccepted ? 'gdpr-accepted' : ''}" id="ticker-gdpr-btn" onclick="window._openGdprOverlay()">
            🛡️ ${isAccepted ? '✓ GDPR' : 'GDPR'}
        </button>
        <button class="ticker-action-btn" id="ticker-contact-btn" onclick="window._openContactOverlay()">
            ✉️ Contact
        </button>
    `;
    tickerBar.appendChild(actionsDiv);

    // ═══ INJECT GDPR OVERLAY HTML ═══
    const gdprOverlay = document.createElement('div');
    gdprOverlay.className = 'gdpr-overlay';
    gdprOverlay.id = 'gdpr-overlay';

    let langItems = gdprTexts.map(t =>
        `<div class="gdpr-lang-item"><span class="gdpr-lang-flag">${t.flag}</span><span class="gdpr-lang-code">${t.lang}</span><span class="gdpr-lang-text">${t.text}</span></div>`
    ).join('');

    gdprOverlay.innerHTML = `
        <div class="gdpr-panel">
            <div class="gdpr-header">
                <h2>🛡️ Data <span>Privacy</span> & GDPR</h2>
                <p>How we handle your data — in ${gdprTexts.length} languages</p>
            </div>
            <div class="gdpr-body" id="gdpr-body">
                ${langItems}
            </div>
            <div class="gdpr-footer">
                ${isAccepted
            ? '<div class="gdpr-accepted-badge">✓ You have already accepted the GDPR policy</div>'
            : `<label class="gdpr-agree-row" for="gdpr-accept-check">
                        <input type="checkbox" id="gdpr-accept-check" onchange="window._updateGdprBtn()">
                        <div class="gdpr-agree-text">I have read and accept the data privacy policy. I understand that only IP, country, and access date are stored. No video or photos are saved.</div>
                    </label>`
        }
                <div class="gdpr-footer-btns">
                    ${isAccepted
            ? '<button class="gdpr-btn gdpr-btn-close" onclick="window._closeGdprOverlay()" style="flex:1">Close</button>'
            : `<button class="gdpr-btn gdpr-btn-accept" id="gdpr-btn-accept" disabled onclick="window._acceptGdpr()">Accept & Continue</button>
                       <button class="gdpr-btn gdpr-btn-close" onclick="window._declineGdpr()">Decline</button>`
        }
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(gdprOverlay);

    // Close on backdrop click
    gdprOverlay.addEventListener('click', function (e) {
        if (e.target === gdprOverlay) {
            if (isAccepted) window._closeGdprOverlay();
        }
    });

    // ═══ INJECT CONTACT OVERLAY HTML ═══
    const contactOverlay = document.createElement('div');
    contactOverlay.className = 'contact-overlay';
    contactOverlay.id = 'contact-overlay';
    contactOverlay.innerHTML = `
        <div class="contact-panel">
            <h2>✉️ <span>Contact</span> Us</h2>
            <p class="contact-sub">Have questions? We'd love to hear from you.</p>
            <form id="gdpr-contact-form">
                <input class="contact-field" type="text" placeholder="Your Name" id="gc-name" required>
                <input class="contact-field" type="email" placeholder="Your Email" id="gc-email" required>
                <input class="contact-field" type="text" placeholder="Subject" id="gc-subject" required>
                <textarea class="contact-field" placeholder="Your Message" id="gc-message" rows="4" required style="resize:vertical"></textarea>
                <div class="contact-btns">
                    <button type="submit" class="contact-btn-send">Send Message</button>
                    <button type="button" class="contact-btn-cancel" onclick="window._closeContactOverlay()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(contactOverlay);

    contactOverlay.addEventListener('click', function (e) {
        if (e.target === contactOverlay) window._closeContactOverlay();
    });

    // Contact form handler
    document.getElementById('gdpr-contact-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const name = document.getElementById('gc-name').value;
        const email = document.getElementById('gc-email').value;
        const subject = document.getElementById('gc-subject').value;
        const message = document.getElementById('gc-message').value;
        const mailtoLink = `mailto:contact@kelionai.app?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)}`;
        window.location.href = mailtoLink;
        window._closeContactOverlay();
    });

    // ═══ GLOBAL FUNCTIONS ═══
    window._openGdprOverlay = function () {
        document.getElementById('gdpr-overlay').classList.add('active');
    };

    window._closeGdprOverlay = function () {
        document.getElementById('gdpr-overlay').classList.remove('active');
    };

    window._updateGdprBtn = function () {
        const checked = document.getElementById('gdpr-accept-check').checked;
        const btn = document.getElementById('gdpr-btn-accept');
        if (btn) btn.disabled = !checked;
    };

    window._acceptGdpr = function () {
        localStorage.setItem('kelion_gdpr_accepted', 'true');
        localStorage.setItem('kelion_gdpr_date', new Date().toISOString());
        localStorage.setItem('kelion_consent', 'accepted');
        localStorage.setItem('kelion_consent_date', new Date().toISOString());

        // Update button appearance
        const tickerBtn = document.getElementById('ticker-gdpr-btn');
        if (tickerBtn) {
            tickerBtn.classList.add('gdpr-accepted');
            tickerBtn.innerHTML = '🛡️ ✓ GDPR';
        }

        window._closeGdprOverlay();
    };

    window._declineGdpr = function () {
        window._closeGdprOverlay();
        // If on subscribe page and first time, redirect to landing
        if (!isAccepted && window.location.pathname.includes('subscribe')) {
            window.location.href = '/landing.html';
        }
    };

    window._openContactOverlay = function () {
        document.getElementById('contact-overlay').classList.add('active');
    };

    window._closeContactOverlay = function () {
        document.getElementById('contact-overlay').classList.remove('active');
    };

    // ═══ FIRST VISIT CHECK ═══
    // If GDPR not yet accepted, auto-show overlay on page load
    if (!isAccepted) {
        // Small delay so page renders first
        setTimeout(function () {
            window._openGdprOverlay();
        }, 800);
    }

})();
