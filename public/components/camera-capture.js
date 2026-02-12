// Kelion Camera Capture Client
// Captures snapshots from video stream and uploads to server

(function () {
    'use strict';

    const API_URL = '/.netlify/functions/camera-capture';

    // Get auth token
    function getAuthToken() {
        return localStorage.getItem('kelion_auth_token') || null;
    }

    // Get video element (from Three.js webcam or direct video)
    function getVideoElement() {
        // Try to find existing video element
        const video = document.querySelector('video');
        if (video && video.srcObject) return video;
        return null;
    }

    // Capture frame from video stream
    function captureFrame(video, quality = 0.8) {
        if (!video) return null;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Return as base64 JPEG (smaller than PNG)
        return canvas.toDataURL('image/jpeg', quality);
    }

    // Upload capture to server
    async function uploadCapture(imageData, context = 'manual', metadata = {}) {
        const token = getAuthToken();
        if (!token) {
            console.warn('📷 Camera capture: Not logged in');
            return { success: false, error: 'Not authenticated' };
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    image: imageData,
                    context: context,
                    metadata: metadata
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('📷 Capture saved:', data.id, data.size, 'bytes');
            } else {
                console.error('📷 Capture failed:', data.error);
            }

            return data;
        } catch (error) {
            console.error('📷 Capture error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get list of captures
    async function getCaptures(limit = 20) {
        const token = getAuthToken();
        if (!token) return { success: false, captures: [] };

        try {
            const response = await fetch(`${API_URL}?limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            return { success: false, captures: [], error: error.message };
        }
    }

    // Delete a capture
    async function deleteCapture(id) {
        const token = getAuthToken();
        if (!token) return { success: false };

        try {
            const response = await fetch(`${API_URL}?id=${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Main capture function (convenience wrapper)
    async function captureNow(context = 'manual') {
        const video = getVideoElement();
        if (!video) {
            console.warn('📷 No video element found');
            return { success: false, error: 'No video stream available' };
        }

        const imageData = captureFrame(video, 0.7);
        if (!imageData) {
            return { success: false, error: 'Failed to capture frame' };
        }

        return await uploadCapture(imageData, context, {
            timestamp: Date.now(),
            page: window.location.pathname
        });
    }

    // Auto-capture on key moments (optional, disabled by default)
    let autoCaptureEnabled = false;
    let lastCaptureTime = 0;
    const CAPTURE_COOLDOWN = 60000; // 1 minute between auto-captures

    function enableAutoCapture() {
        autoCaptureEnabled = true;
        console.log('📷 Auto-capture enabled');
    }

    function disableAutoCapture() {
        autoCaptureEnabled = false;
        console.log('📷 Auto-capture disabled');
    }

    // Trigger auto-capture (called from app.js on key events)
    async function triggerAutoCapture(context) {
        if (!autoCaptureEnabled) return;

        const now = Date.now();
        if (now - lastCaptureTime < CAPTURE_COOLDOWN) {
            console.log('📷 Auto-capture cooldown active');
            return;
        }

        lastCaptureTime = now;
        return await captureNow(context);
    }

    // Expose API
    window.kelionCapture = {
        captureNow,
        uploadCapture,
        getCaptures,
        deleteCapture,
        enableAutoCapture,
        disableAutoCapture,
        triggerAutoCapture,
        isEnabled: () => autoCaptureEnabled
    };

    console.log('📷 Camera capture module loaded');
})();
