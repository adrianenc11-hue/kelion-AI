/**
 * ═══ VISITOR TRACKER ═══
 * Auto-fires on every page load — sends visit data to page-tracking.js
 * Tracks: page, referrer, device, language, session, scroll depth, duration
 * 
 * Usage: <script src="/components/visitor-tracker.js"></script>
 */
(function () {
    'use strict';

    const TRACKING_ENDPOINT = '/.netlify/functions/page-tracking';
    const SESSION_KEY = 'kelion_session_id';

    // Generate or retrieve session ID
    function getSessionId() {
        let sid = sessionStorage.getItem(SESSION_KEY);
        if (!sid) {
            sid = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem(SESSION_KEY, sid);
        }
        return sid;
    }

    // Get user ID if logged in
    function getUserId() {
        try {
            const u = JSON.parse(localStorage.getItem('kelion_user') || '{}');
            return u.id || u.email || null;
        } catch (e) { return null; }
    }

    // Track page view
    function trackPageView() {
        const data = {
            page: window.location.pathname,
            action: 'page_view',
            session_id: getSessionId(),
            user_id: getUserId(),
            metadata: {
                referrer: document.referrer || 'direct',
                language: navigator.language || 'unknown',
                screen: window.screen.width + 'x' + window.screen.height,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
            }
        };

        // Fire and forget — don't block page load
        fetch(TRACKING_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(function () { /* silent fail */ });
    }

    // Track scroll depth on page unload
    let maxScroll = 0;
    let startTime = Date.now();

    window.addEventListener('scroll', function () {
        var scrollPct = Math.round(
            (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        if (scrollPct > maxScroll) maxScroll = scrollPct;
    }, { passive: true });

    // Send duration + scroll depth on page leave
    window.addEventListener('beforeunload', function () {
        var duration = Date.now() - startTime;
        var data = {
            page: window.location.pathname,
            action: 'page_leave',
            session_id: getSessionId(),
            user_id: getUserId(),
            duration_ms: duration,
            scroll_depth: maxScroll
        };

        // Use sendBeacon for reliable delivery on page unload
        if (navigator.sendBeacon) {
            navigator.sendBeacon(TRACKING_ENDPOINT, JSON.stringify(data));
        }
    });

    // Fire page view tracking
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackPageView);
    } else {
        trackPageView();
    }
})();
