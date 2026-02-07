// Kelion Page Tracking Client
// Lightweight analytics to track page views, duration, and scroll depth

(function () {
    'use strict';

    const API_URL = '/.netlify/functions/page-tracking';
    const page = window.location.pathname.replace(/^\/+|\/+$/g, '').replace('.html', '') || 'index';

    // Get or create session ID
    let sessionId = sessionStorage.getItem('kelion_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('kelion_session_id', sessionId);
    }

    // Get user ID if logged in
    function getUserId() {
        try {
            const user = JSON.parse(localStorage.getItem('kelion_user') || '{}');
            return user.id || null;
        } catch {
            return null;
        }
    }

    // Track maximum scroll depth
    let maxScrollDepth = 0;
    function updateScrollDepth() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
            const depth = Math.round((scrollTop / docHeight) * 100);
            maxScrollDepth = Math.max(maxScrollDepth, Math.min(100, depth));
        }
    }

    // Send tracking event
    async function trackEvent(action, extra = {}) {
        try {
            const payload = {
                page: page,
                action: action,
                session_id: sessionId,
                user_id: getUserId(),
                ...extra
            };

            // Use sendBeacon for exit events (more reliable)
            if (action === 'exit' && navigator.sendBeacon) {
                navigator.sendBeacon(API_URL, JSON.stringify(payload));
            } else {
                fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true
                }).catch(() => { }); // Silent fail
            }
        } catch (e) {
            // Silent fail - don't break the page
        }
    }

    // Record page entry time
    const pageEnterTime = Date.now();

    // Track page enter
    trackEvent('enter', {
        metadata: {
            referrer: document.referrer || null,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
        }
    });

    // Update scroll on scroll
    let scrollTimeout;
    window.addEventListener('scroll', function () {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateScrollDepth, 100);
    }, { passive: true });

    // Track page exit with duration
    function sendExitEvent() {
        updateScrollDepth();
        trackEvent('exit', {
            duration_ms: Date.now() - pageEnterTime,
            scroll_depth: maxScrollDepth
        });
    }

    // Capture exit on various scenarios
    window.addEventListener('beforeunload', sendExitEvent);
    window.addEventListener('pagehide', sendExitEvent);

    // Visibility change (tab switch, minimize)
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            sendExitEvent();
        }
    });

    // Expose for manual tracking if needed
    window.kelionTracking = {
        trackEvent: trackEvent,
        getSessionId: () => sessionId,
        getScrollDepth: () => maxScrollDepth
    };

    console.log('📊 Page tracking active:', page);
})();
