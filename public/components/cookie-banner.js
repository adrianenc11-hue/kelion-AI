// cookie-banner.js — GDPR Cookie Consent Banner
// Auto-attaches to any page. Shows on first visit. Remembers choice.
(function () {
    // Skip if already accepted
    if (localStorage.getItem('kelion_cookie_consent') === 'accepted') return;

    const style = document.createElement('style');
    style.textContent = `
        .cookie-banner {
            position: fixed;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            width: 94%;
            max-width: 620px;
            background: linear-gradient(135deg, rgba(10,15,30,0.98), rgba(15,20,40,0.98));
            border: 1px solid rgba(212,175,55,0.15);
            border-radius: 16px;
            padding: 20px 22px;
            z-index: 99998;
            box-shadow: 0 16px 50px rgba(0,0,0,0.6);
            backdrop-filter: blur(16px);
            animation: cookieSlideUp .4s ease;
            font-family: 'Inter', sans-serif;
        }
        @keyframes cookieSlideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(30px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .cookie-banner h3 {
            font-size: .9rem;
            font-weight: 700;
            color: #fff;
            margin-bottom: 6px;
        }
        .cookie-banner p {
            font-size: .78rem;
            color: rgba(255,255,255,0.45);
            line-height: 1.6;
            margin-bottom: 14px;
        }
        .cookie-banner a {
            color: #d4af37;
            text-decoration: none;
        }
        .cookie-banner a:hover {
            text-decoration: underline;
        }
        .cookie-btns {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .cookie-btn {
            padding: 10px 20px;
            border-radius: 10px;
            font-size: .78rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            font-family: inherit;
            transition: all .3s;
        }
        .cookie-btn.accept {
            background: linear-gradient(135deg, #d4af37, #b8860b);
            color: #000;
        }
        .cookie-btn.accept:hover {
            box-shadow: 0 4px 16px rgba(212,175,55,0.3);
            transform: translateY(-1px);
        }
        .cookie-btn.essential {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.5);
        }
        .cookie-btn.essential:hover {
            border-color: rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.7);
        }
        .cookie-btn.details {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.25);
            text-decoration: underline;
            padding: 10px 12px;
        }
        .cookie-btn.details:hover {
            color: rgba(255,255,255,0.5);
        }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
        <h3>🍪 We respect your privacy</h3>
        <p>Kelion AI uses only <strong>essential cookies</strong> to keep you logged in and remember your consent. 
        We do <strong>NOT</strong> use advertising or tracking cookies. 
        <a href="/cookies.html">Read our Cookie Policy</a></p>
        <div class="cookie-btns">
            <button class="cookie-btn accept" onclick="window._acceptCookies('all')">✓ Accept All</button>
            <button class="cookie-btn essential" onclick="window._acceptCookies('essential')">Essential Only</button>
            <button class="cookie-btn details" onclick="window.location.href='/cookies.html'">More Details</button>
        </div>
    `;
    document.body.appendChild(banner);

    window._acceptCookies = function (level) {
        localStorage.setItem('kelion_cookie_consent', 'accepted');
        localStorage.setItem('kelion_cookie_level', level);
        localStorage.setItem('kelion_cookie_date', new Date().toISOString());
        banner.style.animation = 'cookieSlideUp .3s ease reverse';
        setTimeout(() => banner.remove(), 300);
    };
})();
