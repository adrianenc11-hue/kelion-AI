/**
 * Browser Viewer — In-page URL viewer/iframe controller
 * Loads and displays web pages in a sandboxed iframe overlay
 * Used by: browse_webpage tool in chat.js
 */

(function () {
    'use strict';
    if (window.KBrowserViewer) return;

    window.KBrowserViewer = {
        overlay: null,

        /**
         * Open a URL in the in-page viewer
         * @param {string} url - URL to display
         * @param {string} title - Optional title
         */
        open(url, title) {
            if (!url) return;

            this.close(); // Close any existing viewer

            const overlay = document.createElement('div');
            overlay.id = 'k-browser-viewer';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:20000;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;';

            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 16px;background:#111;border-bottom:1px solid #333;';
            toolbar.innerHTML = `
                <span style="color:#d4af37;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title || url}</span>
                <a href="${url}" target="_blank" style="color:#00bfff;text-decoration:none;font-size:0.85rem;">🔗 Open in tab</a>
                <button id="k-browser-close" style="background:none;border:1px solid #555;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;">✕ Close</button>
            `;
            overlay.appendChild(toolbar);

            // Iframe
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.style.cssText = 'flex:1;border:none;width:100%;';
            iframe.sandbox = 'allow-scripts allow-same-origin allow-popups';
            overlay.appendChild(iframe);

            document.body.appendChild(overlay);
            this.overlay = overlay;

            document.getElementById('k-browser-close').onclick = () => this.close();

            console.log('🌐 Browser viewer opened:', url);
        },

        /**
         * Close the viewer
         */
        close() {
            if (this.overlay) {
                this.overlay.remove();
                this.overlay = null;
                console.log('🌐 Browser viewer closed');
            }
        }
    };

    console.log('🌐 K Browser Viewer loaded');
})();
