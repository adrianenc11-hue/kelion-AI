// K1 Vision Compliments Module
// Analyzes camera feed and generates contextual compliments
// Integrated with Kelion AI hologram

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        RETURN_GAP_MS: 2500,           // Gap to consider "return" vs "start"
        COMPLIMENT_COOLDOWN_MS: 120000, // 2 minutes between compliments
        COLOR_CONF_MIN: 0.85,          // Minimum confidence to mention color
        ANALYSIS_INTERVAL_MS: 250,     // Frame analysis interval
        ANALYSIS_WIDTH: 240            // Downscaled width for analysis
    };

    // State
    let video = null;
    let analysisCanvas = null;
    let analysisCtx = null;
    let lastPresence = false;
    let lastPresenceFlip = performance.now();
    let lastComplimentAt = 0;
    let isEnabled = false;
    let analysisInterval = null;

    // Color analysis helpers
    function rgbToColorName(r, g, b) {
        const rr = r / 255, gg = g / 255, bb = b / 255;
        const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
        const d = mx - mn;
        const v = mx;
        const s = mx === 0 ? 0 : d / mx;

        if (v < 0.12) return "black";
        if (v > 0.92 && s < 0.12) return "white";
        if (s < 0.15) return "gray";

        let h = 0;
        if (d !== 0) {
            if (mx === rr) h = ((gg - bb) / d) % 6;
            else if (mx === gg) h = (bb - rr) / d + 2;
            else h = (rr - gg) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }

        if (h < 15 || h >= 345) return "red";
        if (h < 45) return "orange";
        if (h < 70) return "yellow";
        if (h < 170) return "green";
        if (h < 200) return "cyan";
        if (h < 255) return "blue";
        if (h < 290) return "purple";
        if (h < 345) return "pink";
        return "unknown";
    }

    function colorConfidence(r, g, b) {
        const rr = r / 255, gg = g / 255, bb = b / 255;
        const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
        const d = mx - mn;
        const s = mx === 0 ? 0 : d / mx;
        const v = mx;
        return Math.max(0, Math.min(1, s * 0.75 + v * 0.25));
    }

    function avgRGB(data, w, rx0, ry0, rx1, ry1) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = ry0; y < ry1; y++) {
            for (let x = rx0; x < rx1; x++) {
                const i = (y * w + x) * 4;
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                n++;
            }
        }
        return { r: r / n, g: g / n, b: b / n };
    }

    // API call to get compliment
    async function verbalize(semantic) {
        try {
            const res = await fetch('/.netlify/functions/vision-compliment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(semantic)
            });
            if (!res.ok) return '';
            const j = await res.json();
            return (j && j.text) ? j.text : '';
        } catch (e) {
            console.error('👁️ Vision verbalize error:', e);
            return '';
        }
    }

    // Speak using K's voice (or TTS fallback)
    function speakCompliment(text) {
        console.log('👁️ Vision compliment:', text);

        // Try to use K's realtime voice if available
        if (window.kelionRealtime && typeof window.kelionRealtime.sendText === 'function') {
            window.kelionRealtime.sendText(text);
            return;
        }

        // Try to use K's legacy speak function
        if (window.kelionSpeak && typeof window.kelionSpeak === 'function') {
            window.kelionSpeak(text);
            return;
        }

        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
            try {
                const u = new SpeechSynthesisUtterance(text);
                u.lang = navigator.language || 'en';
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(u);
            } catch (e) {
                console.log(text);
            }
        }
    }

    // Frame analysis
    function analyzeFrame() {
        if (!video || !video.videoWidth || !video.videoHeight) return;

        const vw = video.videoWidth, vh = video.videoHeight;
        const targetW = CONFIG.ANALYSIS_WIDTH;
        const targetH = Math.round(targetW * (vh / vw));

        if (analysisCanvas.width !== targetW || analysisCanvas.height !== targetH) {
            analysisCanvas.width = targetW;
            analysisCanvas.height = targetH;
        }

        analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);
        const img = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
        const data = img.data;
        const w = analysisCanvas.width;
        const h = analysisCanvas.height;

        // Face region (upper center)
        const fx0 = Math.floor(w * 0.35), fx1 = Math.floor(w * 0.65);
        const fy0 = Math.floor(h * 0.12), fy1 = Math.floor(h * 0.42);

        // Torso region (middle)
        const tx0 = Math.floor(w * 0.30), tx1 = Math.floor(w * 0.70);
        const ty0 = Math.floor(h * 0.45), ty1 = Math.floor(h * 0.80);

        const faceRGB = avgRGB(data, w, fx0, fy0, fx1, fy1);
        const torsoRGB = avgRGB(data, w, tx0, ty0, tx1, ty1);

        // Presence detection
        const faceV = Math.max(faceRGB.r, faceRGB.g, faceRGB.b) / 255;
        const faceS = (() => {
            const rr = faceRGB.r / 255, gg = faceRGB.g / 255, bb = faceRGB.b / 255;
            const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
            return mx === 0 ? 0 : (mx - mn) / mx;
        })();

        const presenceNow = (faceV > 0.18) && (faceS > 0.05);

        const now = performance.now();
        let presenceEvent = null;

        if (presenceNow !== lastPresence) {
            const gap = now - lastPresenceFlip;
            lastPresenceFlip = now;
            if (presenceNow) {
                presenceEvent = (gap > CONFIG.RETURN_GAP_MS) ? 'return' : 'start';
            }
            lastPresence = presenceNow;
        }

        // Generate compliment on presence event
        if (presenceEvent && presenceNow) {
            if (now - lastComplimentAt >= CONFIG.COMPLIMENT_COOLDOWN_MS) {
                const colorName = rgbToColorName(torsoRGB.r, torsoRGB.g, torsoRGB.b);
                const conf = colorConfidence(torsoRGB.r, torsoRGB.g, torsoRGB.b);
                const mentionColor = (conf >= CONFIG.COLOR_CONF_MIN && colorName !== 'unknown');

                const semantic = {
                    intent: mentionColor ? 'compliment_outfit_color' : 'compliment_presence',
                    observations: {
                        presence: presenceEvent,
                        garment: mentionColor ? 'top' : null,
                        color: mentionColor ? colorName : null
                    },
                    tone: 'warm',
                    locale: navigator.language || 'en',
                    confidence: { presence: 0.9, color: conf },
                    constraints: {
                        avoid: ['age', 'ethnicity', 'religion', 'body', 'attractiveness', 'emotion_diagnosis', 'location', 'background_objects', 'camera_mentions']
                    },
                    ts: Date.now()
                };

                console.log('👁️ Presence detected:', presenceEvent, mentionColor ? `(${colorName})` : '');

                verbalize(semantic).then(text => {
                    if (text) {
                        speakCompliment(text);
                        lastComplimentAt = now;
                    }
                }).catch(() => { });
            }
        }
    }

    // Initialize with existing video element or create hidden one
    function init(existingVideo = null) {
        if (isEnabled) return;

        console.log('👁️ Vision compliments initializing...');

        // Use existing camera or get new stream
        if (existingVideo && existingVideo.srcObject) {
            video = existingVideo;
        } else {
            video = document.createElement('video');
            video.style.display = 'none';
            video.playsInline = true;
            video.muted = true;
            document.body.appendChild(video);

            navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            }).then(stream => {
                video.srcObject = stream;
                video.play();
                console.log('👁️ Vision camera started');
            }).catch(e => {
                console.error('👁️ Camera access failed:', e);
            });
        }

        // Create analysis canvas
        analysisCanvas = document.createElement('canvas');
        analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });

        // Start analysis loop
        analysisInterval = setInterval(analyzeFrame, CONFIG.ANALYSIS_INTERVAL_MS);
        isEnabled = true;

        console.log('👁️ Vision compliments enabled');
    }

    // Stop and cleanup
    function stop() {
        if (!isEnabled) return;

        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
        }

        // Don't stop video if it was shared from another source
        isEnabled = false;
        console.log('👁️ Vision compliments disabled');
    }

    // Expose module
    window.kelionVision = {
        init,
        stop,
        isEnabled: () => isEnabled,
        triggerAnalysis: analyzeFrame // Manual trigger for testing
    };

    console.log('👁️ Vision compliments module loaded');
})();
