// age-gate.js — Age Verification Gate
// Required by GDPR (16+ EU) and COPPA (13+ US with parental consent)
// Shows on first visit to subscribe page before account creation
(function () {
    // Only show on subscribe page
    if (!window.location.pathname.includes('subscribe')) return;

    // Skip if already verified
    if (localStorage.getItem('kelion_age_verified') === 'true') return;

    const style = document.createElement('style');
    style.textContent = `
        .age-overlay {
            position: fixed;
            inset: 0;
            background: rgba(3,3,17,0.97);
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: ageFadeIn .3s ease;
            font-family: 'Inter', sans-serif;
        }
        @keyframes ageFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .age-panel {
            width: 92%;
            max-width: 440px;
            background: linear-gradient(135deg, rgba(10,15,30,0.98), rgba(15,20,40,0.98));
            border: 1px solid rgba(212,175,55,0.15);
            border-radius: 20px;
            padding: 32px 28px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .age-icon {
            font-size: 2.5rem;
            margin-bottom: 14px;
        }
        .age-title {
            font-size: 1.2rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: 8px;
        }
        .age-desc {
            font-size: .82rem;
            color: rgba(255,255,255,0.4);
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .age-desc strong {
            color: #d4af37;
        }
        .age-field {
            margin-bottom: 14px;
        }
        .age-field label {
            display: block;
            font-size: .72rem;
            font-weight: 600;
            color: rgba(255,255,255,0.3);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: .5px;
        }
        .age-field input {
            width: 100%;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.03);
            color: #fff;
            font-size: .95rem;
            text-align: center;
            font-family: inherit;
            outline: none;
        }
        .age-field input:focus {
            border-color: rgba(212,175,55,0.3);
        }
        .age-confirm-btn {
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            border: none;
            background: linear-gradient(135deg, #d4af37, #b8860b);
            color: #000;
            font-size: .9rem;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            transition: all .3s;
            margin-bottom: 10px;
        }
        .age-confirm-btn:hover:not(:disabled) {
            box-shadow: 0 4px 16px rgba(212,175,55,0.3);
            transform: translateY(-1px);
        }
        .age-confirm-btn:disabled {
            opacity: .4;
            cursor: not-allowed;
        }
        .age-error {
            color: #ff6464;
            font-size: .78rem;
            margin-bottom: 10px;
            display: none;
        }
        .age-legal {
            font-size: .68rem;
            color: rgba(255,255,255,0.15);
            line-height: 1.5;
        }
        .age-legal a {
            color: rgba(212,175,55,0.4);
            text-decoration: none;
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'age-overlay';
    overlay.innerHTML = `
        <div class="age-panel">
            <div class="age-icon">🔒</div>
            <div class="age-title">Age Verification Required</div>
            <div class="age-desc">
                Kelion AI requires users to be at least <strong>16 years old</strong> in the EU/UK 
                or <strong>13 years old</strong> in the US (with parental consent).<br>
                Please confirm your date of birth to continue.
            </div>
            <div class="age-field">
                <label>Date of Birth</label>
                <input type="date" id="age-dob" max="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="age-error" id="age-error"></div>
            <button class="age-confirm-btn" id="age-confirm-btn" onclick="window._verifyAge()">Confirm Age</button>
            <div class="age-legal">
                By continuing, you confirm that the date of birth provided is accurate. 
                See our <a href="/terms.html">Terms of Service</a> and <a href="/privacy.html">Privacy Policy</a>.
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    window._verifyAge = function () {
        const dob = document.getElementById('age-dob').value;
        const errorEl = document.getElementById('age-error');

        if (!dob) {
            errorEl.textContent = 'Please enter your date of birth.';
            errorEl.style.display = 'block';
            return;
        }

        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13) {
            errorEl.textContent = '⚠️ Sorry, you must be at least 13 years old to use Kelion AI.';
            errorEl.style.display = 'block';
            return;
        }

        if (age < 16) {
            errorEl.innerHTML = '⚠️ Users aged 13-15 require parental consent in the EU/UK. ' +
                'By continuing, you confirm a parent or guardian has approved your use of this service.';
            errorEl.style.display = 'block';
            errorEl.style.color = '#ffc800';
            // Still allow with warning — store as parental consent needed
            localStorage.setItem('kelion_age_verified', 'true');
            localStorage.setItem('kelion_age_verified_date', new Date().toISOString());
            localStorage.setItem('kelion_age_category', 'minor_with_consent');
            setTimeout(() => {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity .3s';
                setTimeout(() => overlay.remove(), 300);
            }, 3000);
            return;
        }

        // 16+ — fully verified
        localStorage.setItem('kelion_age_verified', 'true');
        localStorage.setItem('kelion_age_verified_date', new Date().toISOString());
        localStorage.setItem('kelion_age_category', 'adult');
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity .3s';
        setTimeout(() => overlay.remove(), 300);
    };
})();
