// ai-disclosure.js — EU AI Act Compliance
// Shows a small persistent badge indicating the user is talking to an AI
// Required by EU AI Act Article 52(1) — transparency obligation
(function () {
    // Skip if already added
    if (document.getElementById('ai-disclosure-badge')) return;

    const style = document.createElement('style');
    style.textContent = `
        #ai-disclosure-badge {
            position: fixed;
            top: 12px;
            right: 12px;
            background: rgba(10,15,30,0.85);
            border: 1px solid rgba(212,175,55,0.12);
            border-radius: 20px;
            padding: 6px 14px;
            display: flex;
            align-items: center;
            gap: 6px;
            z-index: 99990;
            cursor: pointer;
            transition: all .3s;
            backdrop-filter: blur(10px);
            font-family: 'Inter', sans-serif;
        }
        #ai-disclosure-badge:hover {
            border-color: rgba(212,175,55,0.3);
            background: rgba(10,15,30,0.95);
        }
        #ai-disclosure-badge .ai-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #d4af37;
            animation: aiPulse 2s ease infinite;
        }
        @keyframes aiPulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(212,175,55,0.3); }
            50% { opacity: .5; box-shadow: 0 0 8px rgba(212,175,55,0.5); }
        }
        #ai-disclosure-badge .ai-label {
            font-size: .65rem;
            font-weight: 600;
            color: rgba(255,255,255,0.35);
            letter-spacing: .3px;
        }
        #ai-disclosure-tooltip {
            position: fixed;
            top: 44px;
            right: 12px;
            width: 260px;
            background: rgba(10,15,30,0.97);
            border: 1px solid rgba(212,175,55,0.12);
            border-radius: 12px;
            padding: 14px 16px;
            z-index: 99991;
            display: none;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.4);
            font-family: 'Inter', sans-serif;
        }
        #ai-disclosure-tooltip.show {
            display: block;
            animation: tooltipFade .2s ease;
        }
        @keyframes tooltipFade {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #ai-disclosure-tooltip h4 {
            font-size: .78rem;
            font-weight: 700;
            color: #d4af37;
            margin-bottom: 6px;
        }
        #ai-disclosure-tooltip p {
            font-size: .72rem;
            color: rgba(255,255,255,0.4);
            line-height: 1.5;
            margin-bottom: 6px;
        }
        #ai-disclosure-tooltip a {
            color: #d4af37;
            text-decoration: none;
            font-size: .7rem;
        }
    `;
    document.head.appendChild(style);

    const badge = document.createElement('div');
    badge.id = 'ai-disclosure-badge';
    badge.innerHTML = `<div class="ai-dot"></div><span class="ai-label">AI ASSISTANT</span>`;
    document.body.appendChild(badge);

    const tooltip = document.createElement('div');
    tooltip.id = 'ai-disclosure-tooltip';
    tooltip.innerHTML = `
        <h4>🤖 AI Transparency Notice</h4>
        <p>You are interacting with <strong>Kelion AI</strong>, an artificial intelligence assistant. All responses are computer-generated.</p>
        <p>K is NOT a human. While designed to be accurate, AI can make mistakes. Verify critical information independently.</p>
        <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a>
    `;
    document.body.appendChild(tooltip);

    badge.addEventListener('click', () => {
        tooltip.classList.toggle('show');
    });

    // Close tooltip when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!badge.contains(e.target) && !tooltip.contains(e.target)) {
            tooltip.classList.remove('show');
        }
    });
})();
