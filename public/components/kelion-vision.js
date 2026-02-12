/**
 * Kelion Vision — Camera-based AI vision analysis
 * Calls /.netlify/functions/vision for image analysis
 * Exposes window.kelionVision with init(), isEnabled()
 * 
 * Note: vision-compliments.js also exports window.kelionVision.
 * This module is a loader/adapter — if vision-compliments.js loaded first,
 * we defer to its implementation. Otherwise we provide the interface expected
 * by app.html and subscription.js.
 */

(function () {
    'use strict';

    // If vision-compliments.js already loaded and exported kelionVision, skip
    if (window.kelionVision) {
        console.log('👁️ Kelion Vision: vision-compliments.js already active, deferring');
        return;
    }

    let enabled = false;
    let videoStream = null;

    window.kelionVision = {
        /**
         * Initialize vision — request camera, start capturing
         */
        async init() {
            if (enabled) return;

            try {
                // Find existing video element or create new one
                let video = document.querySelector('video#vision-feed');
                if (!video) {
                    video = document.createElement('video');
                    video.id = 'vision-feed';
                    video.autoplay = true;
                    video.playsInline = true;
                    video.muted = true;
                    video.style.cssText = 'position:fixed;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
                    document.body.appendChild(video);
                }

                videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
                });
                video.srcObject = videoStream;
                enabled = true;
                console.log('👁️ Kelion Vision initialized');
            } catch (err) {
                console.warn('👁️ Vision init failed:', err.message);
            }
        },

        /**
         * Check if vision is currently enabled
         */
        isEnabled() {
            return enabled;
        },

        /**
         * Capture current frame and analyze via backend
         * @param {string} question - Optional question about the image
         */
        async analyze(question) {
            if (!enabled) {
                console.warn('👁️ Vision not enabled');
                return null;
            }

            try {
                const video = document.querySelector('video#vision-feed');
                if (!video) return null;

                // Capture frame
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                const imageData = canvas.toDataURL('image/jpeg', 0.7);

                // Send to backend
                const res = await fetch('/.netlify/functions/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: imageData,
                        question: question || 'Describe what you see'
                    })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();

            } catch (err) {
                console.error('👁️ Vision analyze error:', err.message);
                return null;
            }
        },

        /**
         * Stop vision and release camera
         */
        stop() {
            if (videoStream) {
                videoStream.getTracks().forEach(t => t.stop());
                videoStream = null;
            }
            enabled = false;
            console.log('👁️ Kelion Vision stopped');
        }
    };

    console.log('👁️ Kelion Vision module loaded');
})();
