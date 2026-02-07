/**
 * K Onboarding — 5-step interactive tutorial for first-time users
 * Shows automatically on first visit, remembers completion.
 * Multilingual: detects browser language (RO/EN/FR/DE/ES)
 */
(function () {
    'use strict';

    const ONBOARDING_KEY = 'k_onboarding_done';
    if (localStorage.getItem(ONBOARDING_KEY)) return;

    // Detect language
    const lang = (navigator.language || 'en').substring(0, 2);

    const translations = {
        en: {
            steps: [
                { icon: '👋', title: 'Welcome to K', desc: 'K is your AI holographic assistant. Unlike any chatbot — K can see, speak, and think.' },
                { icon: '🎙️', title: 'Talk to K', desc: 'Click the microphone button or just start talking. K understands over 30 languages in real-time.' },
                { icon: '📷', title: 'K Can See You', desc: 'Allow camera access and K will recognize you, detect emotions, and respond visually.' },
                { icon: '📄', title: 'Smart Documents', desc: 'Upload any document — K will analyze, summarize, and let you export in any format.' },
                { icon: '🚀', title: 'You\'re Ready!', desc: 'Start talking to K now. Say "Hello K" to begin your first conversation!' }
            ],
            next: 'Next', prev: 'Back', skip: 'Skip', start: 'Start Now'
        },
        ro: {
            steps: [
                { icon: '👋', title: 'Bun venit la K', desc: 'K este asistentul tău AI holografic. Nu e un simplu chatbot — K poate vedea, vorbi și gândi.' },
                { icon: '🎙️', title: 'Vorbește cu K', desc: 'Apasă butonul de microfon sau pur și simplu începe să vorbești. K înțelege peste 30 de limbi.' },
                { icon: '📷', title: 'K Te Poate Vedea', desc: 'Permite accesul la cameră și K te va recunoaște, va detecta emoții și va răspunde vizual.' },
                { icon: '📄', title: 'Documente Inteligente', desc: 'Încarcă orice document — K va analiza, rezuma și îți permite export în orice format.' },
                { icon: '🚀', title: 'Ești Gata!', desc: 'Începe să vorbești cu K acum. Spune "Salut K" pentru prima conversație!' }
            ],
            next: 'Următorul', prev: 'Înapoi', skip: 'Sari', start: 'Începe'
        },
        fr: {
            steps: [
                { icon: '👋', title: 'Bienvenue sur K', desc: 'K est votre assistant IA holographique. Il peut voir, parler et penser.' },
                { icon: '🎙️', title: 'Parlez à K', desc: 'Cliquez sur le micro ou commencez à parler. K comprend plus de 30 langues.' },
                { icon: '📷', title: 'K Vous Voit', desc: 'Autorisez la caméra et K vous reconnaîtra et détectera vos émotions.' },
                { icon: '📄', title: 'Documents Intelligents', desc: 'Téléchargez un document — K analysera, résumera et exportera.' },
                { icon: '🚀', title: 'Vous êtes prêt!', desc: 'Dites "Bonjour K" pour commencer!' }
            ],
            next: 'Suivant', prev: 'Retour', skip: 'Passer', start: 'Commencer'
        },
        de: {
            steps: [
                { icon: '👋', title: 'Willkommen bei K', desc: 'K ist Ihr KI-Hologramm-Assistent. K kann sehen, sprechen und denken.' },
                { icon: '🎙️', title: 'Sprich mit K', desc: 'Klicke auf das Mikrofon oder sprich einfach. K versteht über 30 Sprachen.' },
                { icon: '📷', title: 'K kann dich sehen', desc: 'Erlaube Kamerazugriff — K erkennt dich und reagiert visuell.' },
                { icon: '📄', title: 'Smarte Dokumente', desc: 'Lade ein Dokument hoch — K analysiert, fasst zusammen und exportiert.' },
                { icon: '🚀', title: 'Du bist bereit!', desc: 'Sag "Hallo K" um zu beginnen!' }
            ],
            next: 'Weiter', prev: 'Zurück', skip: 'Überspringen', start: 'Starten'
        },
        es: {
            steps: [
                { icon: '👋', title: 'Bienvenido a K', desc: 'K es tu asistente IA holográfico. K puede ver, hablar y pensar.' },
                { icon: '🎙️', title: 'Habla con K', desc: 'Haz clic en el micrófono o simplemente habla. K entiende más de 30 idiomas.' },
                { icon: '📷', title: 'K Te Puede Ver', desc: 'Permite el acceso a la cámara — K te reconocerá y detectará emociones.' },
                { icon: '📄', title: 'Documentos Inteligentes', desc: 'Sube cualquier documento — K analizará, resumirá y exportará.' },
                { icon: '🚀', title: '¡Estás listo!', desc: '¡Di "Hola K" para empezar!' }
            ],
            next: 'Siguiente', prev: 'Atrás', skip: 'Saltar', start: 'Comenzar'
        }
    };

    const t = translations[lang] || translations.en;
    let currentStep = 0;

    function render() {
        const step = t.steps[currentStep];
        const isLast = currentStep === t.steps.length - 1;
        const isFirst = currentStep === 0;

        let overlay = document.getElementById('k-onboarding');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'k-onboarding';
            document.body.appendChild(overlay);
        }

        overlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;
            display:flex;align-items:center;justify-content:center;
            background:rgba(0,0,0,0.85);backdrop-filter:blur(15px);
            font-family:'Inter','Segoe UI',sans-serif;
            animation:kob-fadein 0.4s ease;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes kob-fadein { from { opacity:0; } to { opacity:1; } }
                @keyframes kob-slide { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
                @keyframes kob-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.1); } }
                @keyframes kob-glow { 0%,100% { box-shadow:0 0 20px rgba(0,255,255,0.2); } 50% { box-shadow:0 0 40px rgba(0,255,255,0.4); } }
            </style>
            <div style="max-width:440px;width:90%;animation:kob-slide 0.5s ease;text-align:center;">
                <!-- Progress dots -->
                <div style="margin-bottom:24px;display:flex;justify-content:center;gap:8px;">
                    ${t.steps.map((_, i) => `
                        <div style="width:${i === currentStep ? '24px' : '8px'};height:8px;border-radius:4px;
                            background:${i === currentStep ? '#00ffff' : i < currentStep ? 'rgba(0,255,255,0.5)' : 'rgba(255,255,255,0.15)'};
                            transition:all 0.3s ease;"></div>
                    `).join('')}
                </div>

                <!-- Card -->
                <div style="background:rgba(15,15,30,0.95);border:1px solid rgba(0,255,255,0.2);border-radius:20px;
                    padding:40px 32px;animation:kob-glow 3s infinite;">

                    <!-- Icon -->
                    <div style="font-size:3.5rem;margin-bottom:16px;animation:kob-pulse 2s infinite;">${step.icon}</div>

                    <!-- Title -->
                    <h2 style="color:#fff;font-size:1.5rem;margin:0 0 12px;font-weight:700;">${step.title}</h2>

                    <!-- Description -->
                    <p style="color:rgba(255,255,255,0.7);font-size:1rem;line-height:1.6;margin:0 0 32px;">${step.desc}</p>

                    <!-- Buttons -->
                    <div style="display:flex;gap:10px;justify-content:center;">
                        ${!isFirst ? `<button onclick="window._kobPrev()" style="padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.2);
                            background:transparent;color:#fff;cursor:pointer;font-size:0.9rem;transition:all 0.2s;">${t.prev}</button>` : ''}

                        <button onclick="${isLast ? 'window._kobDone()' : 'window._kobNext()'}" style="padding:10px 28px;border-radius:12px;border:none;
                            background:linear-gradient(135deg,#00ffff,#0088ff);color:#000;cursor:pointer;font-size:0.95rem;
                            font-weight:600;transition:all 0.2s;box-shadow:0 4px 15px rgba(0,255,255,0.3);">
                            ${isLast ? t.start : t.next}
                        </button>
                    </div>

                    <!-- Skip -->
                    ${!isLast ? `<button onclick="window._kobDone()" style="margin-top:16px;background:none;border:none;
                        color:rgba(255,255,255,0.35);cursor:pointer;font-size:0.8rem;">${t.skip}</button>` : ''}
                </div>

                <!-- Step counter -->
                <div style="margin-top:16px;color:rgba(255,255,255,0.3);font-size:0.75rem;">${currentStep + 1} / ${t.steps.length}</div>
            </div>
        `;
    }

    window._kobNext = () => { currentStep = Math.min(currentStep + 1, t.steps.length - 1); render(); };
    window._kobPrev = () => { currentStep = Math.max(currentStep - 1, 0); render(); };
    window._kobDone = () => {
        localStorage.setItem(ONBOARDING_KEY, Date.now().toString());
        const el = document.getElementById('k-onboarding');
        if (el) {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.4s ease';
            setTimeout(() => el.remove(), 400);
        }
        console.log('✅ Onboarding completed');
    };

    // Show after a short delay to let K load
    setTimeout(render, 1500);
    console.log(`🎓 Onboarding ready (${lang})`);
})();
