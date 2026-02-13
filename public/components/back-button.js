/**
 * ═══ BACK BUTTON COMPONENT ═══
 * Auto-adds a "Back" button, fixed bottom-left on every page.
 * Skips landing.html (homepage) since there's nowhere to go back to.
 * 
 * Usage: <script src="/components/back-button.js"></script>
 */
(function () {
    'use strict';

    // Don't show on landing page (homepage)
    const path = window.location.pathname;
    if (path === '/' || path === '/landing.html' || path === '/index.html') return;

    // Create button
    const btn = document.createElement('button');
    btn.id = 'back-btn-global';
    btn.innerHTML = '← Back';
    btn.title = 'Go to previous page';
    btn.onclick = function () {
        if (document.referrer && document.referrer.includes(window.location.hostname)) {
            window.history.back();
        } else {
            window.location.href = '/landing.html';
        }
    };

    // Style — fixed bottom-left, matches Kelion UI
    btn.style.cssText = [
        'position: fixed',
        'bottom: 20px',
        'left: 20px',
        'z-index: 9999',
        'padding: 10px 20px',
        'background: rgba(20, 20, 30, 0.9)',
        'color: #d4af37',
        'border: 1px solid #d4af37',
        'border-radius: 10px',
        'font-size: 0.85rem',
        'font-weight: 500',
        'cursor: pointer',
        'transition: all 0.3s ease',
        'backdrop-filter: blur(10px)',
        '-webkit-backdrop-filter: blur(10px)',
        'font-family: "Segoe UI", system-ui, -apple-system, sans-serif'
    ].join(';');

    // Hover effects
    btn.addEventListener('mouseover', function () {
        this.style.background = '#d4af37';
        this.style.color = '#000';
    });
    btn.addEventListener('mouseout', function () {
        this.style.background = 'rgba(20, 20, 30, 0.9)';
        this.style.color = '#d4af37';
    });

    // Insert into DOM when ready
    function insert() {
        document.body.appendChild(btn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insert);
    } else {
        insert();
    }
})();
