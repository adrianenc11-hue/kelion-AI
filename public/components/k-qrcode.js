/**
 * K QR Code Generator
 * Generates QR codes for:
 * - Protocol links (share K sessions)
 * - Recommendations (share K with friends)
 * - Custom URLs/text
 * Uses qrcodejs library loaded dynamically.
 */
(function () {
    'use strict';
    console.log('📱 K QR Code module loading...');

    let qrLibLoaded = false;

    // HTML escape helper to prevent XSS
    function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    async function loadQRLib() {
        if (qrLibLoaded) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
            script.onload = () => { qrLibLoaded = true; resolve(); };
            script.onerror = () => reject(new Error('QR library failed to load'));
            document.head.appendChild(script);
        });
    }

    /**
     * Generate a QR code and display it
     * @param {string} data - URL or text to encode
     * @param {object} opts - { title, description, size, color }
     */
    window.K_generateQR = async function (data, opts = {}) {
        const {
            title = '📱 QR Code',
            description = '',
            size = 200,
            colorDark = '#000000',
            colorLight = '#ffffff'
        } = opts;

        const task = window.K_TASKS?.add(`📱 QR: ${(data || '').substring(0, 20)}`, async (onProgress) => {
            onProgress(20);
            await loadQRLib();
            onProgress(60);

            // Create display panel
            let panel = document.getElementById('k-qr-panel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'k-qr-panel';
                document.body.appendChild(panel);
            }

            panel.style.cssText = `
                position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
                z-index:100000;background:rgba(8,8,20,0.96);
                border:1px solid rgba(0,255,255,0.25);border-radius:20px;
                padding:28px;color:#fff;font-family:'Inter',sans-serif;
                max-width:380px;width:90%;text-align:center;
                backdrop-filter:blur(20px);
                box-shadow:0 8px 40px rgba(0,255,255,0.15);
                animation:qr-fadein 0.3s ease;
            `;

            panel.innerHTML = `
                <style>
                    @keyframes qr-fadein { from { opacity:0;transform:translate(-50%,-50%) scale(0.9); } to { opacity:1;transform:translate(-50%,-50%) scale(1); } }
                </style>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;color:#00ffff;font-size:1.1rem;">${escHtml(title)}</h3>
                    <button onclick="document.getElementById('k-qr-panel').style.display='none'"
                        style="background:none;border:none;color:#888;font-size:1.3rem;cursor:pointer;">✕</button>
                </div>
                ${description ? `<p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin-bottom:16px;">${escHtml(description)}</p>` : ''}
                <div id="k-qr-canvas" style="display:inline-block;padding:16px;background:#fff;border-radius:12px;margin-bottom:16px;"></div>
                <div style="margin-top:8px;">
                    <p style="color:rgba(255,255,255,0.4);font-size:0.75rem;word-break:break-all;margin-bottom:12px;">${escHtml(data)}</p>
                    <div style="display:flex;gap:8px;justify-content:center;">
                        <button onclick="window._kqrDownload()" style="padding:8px 16px;border-radius:10px;border:none;
                            background:linear-gradient(135deg,#00ffff,#0088ff);color:#000;cursor:pointer;font-weight:600;font-size:0.85rem;">
                            📥 Download PNG
                        </button>
                        <button onclick="window._kqrCopy(decodeURIComponent('${encodeURIComponent(data)}'))" style="padding:8px 16px;border-radius:10px;
                            border:1px solid rgba(255,255,255,0.2);background:transparent;color:#fff;cursor:pointer;font-size:0.85rem;">
                            📋 Copy Link
                        </button>
                    </div>
                </div>
            `;

            panel.style.display = 'block';

            // Generate QR
            const container = document.getElementById('k-qr-canvas');
            container.innerHTML = '';
            new QRCode(container, {
                text: data,
                width: size,
                height: size,
                colorDark: colorDark,
                colorLight: colorLight,
                correctLevel: QRCode.CorrectLevel.H
            });

            if (typeof window.speak === 'function') {
                window.speak('Am generat codul QR. Îl poți descărca sau copia linkul.');
            }

            onProgress(100);
            return { data, title };
        }, { category: 'qr', priority: 'normal' });

        return task?.promise;
    };

    // Download QR as PNG
    window._kqrDownload = function () {
        const canvas = document.querySelector('#k-qr-canvas canvas');
        if (!canvas) {
            const img = document.querySelector('#k-qr-canvas img');
            if (img) {
                const a = document.createElement('a');
                a.href = img.src;
                a.download = 'K-QR-Code.png';
                a.click();
            }
            return;
        }
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'K-QR-Code.png';
        a.click();
    };

    // Copy link
    window._kqrCopy = function (text) {
        navigator.clipboard.writeText(text).then(() => {
            if (typeof window.speak === 'function') window.speak('Link copiat!');
        });
    };

    // ═══════════════════════════════════════════════════════════
    // PRESET QR CODE GENERATORS
    // ═══════════════════════════════════════════════════════════

    // Share K link
    window.K_shareQR = function () {
        window.K_generateQR('https://kelionai.app', {
            title: '📱 Share K',
            description: 'Scanează pentru a încerca K — primul AI holografic.'
        });
    };

    // Share current session / recommendation
    window.K_recommendQR = function (message) {
        const url = `https://kelionai.app?ref=qr&msg=${encodeURIComponent(message || 'Try K!')}`;
        window.K_generateQR(url, {
            title: '🌟 Recomandare K',
            description: message || 'Recomandat de un utilizator K.'
        });
    };

    // Protocol link (e.g. for medical, business, etc.)
    window.K_protocolQR = function (protocolId, protocolName) {
        const url = `https://kelionai.app/protocol/${protocolId || 'default'}`;
        window.K_generateQR(url, {
            title: `📋 Protocol: ${protocolName || protocolId || 'Standard'}`,
            description: 'Scanează pentru a accesa protocolul.'
        });
    };

    // Custom QR
    window.K_customQR = function (text, title) {
        window.K_generateQR(text, { title: title || '📱 QR Code' });
    };

    // Chat command detection
    const originalProcessDev = window.K_processDevCommand;
    window.K_processDevCommand = function (message) {
        const lower = message.toLowerCase().trim();

        if (/\b(qr|cod qr|qr code|genereaz[ăa] qr)\b/i.test(lower)) {
            if (/\b(share|partaj|distribuie|recomand)\b/i.test(lower)) {
                window.K_shareQR();
            } else if (/\b(protocol)\b/i.test(lower)) {
                window.K_protocolQR();
            } else {
                const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
                if (urlMatch) {
                    window.K_customQR(urlMatch[1]);
                } else {
                    window.K_shareQR();
                }
            }
            return true;
        }

        return originalProcessDev ? originalProcessDev(message) : false;
    };

    console.log('📱 K QR Code ready! Commands: K_shareQR(), K_recommendQR(), K_protocolQR(), K_customQR()');
})();
