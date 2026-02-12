/**
 * Code Detector — Syntax-highlight code blocks in page content
 * Auto-detects code patterns and applies syntax highlighting
 */

(function () {
    'use strict';
    if (window.KCodeDetector) return;

    const LANG_PATTERNS = {
        javascript: /\b(const|let|var|function|class|import|export|async|await|return)\b/,
        python: /\b(def|class|import|from|return|if|elif|else|for|while|with|as)\b/,
        html: /<\/?[a-z][\s\S]*>/i,
        css: /[{}\s]*[a-z-]+\s*:\s*[^;]+;/,
        sql: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|CREATE|ALTER|DROP)\b/i,
        json: /^\s*[{\[]/
    };

    window.KCodeDetector = {
        /**
         * Detect language of code text
         * @param {string} code
         * @returns {string} Language name
         */
        detect(code) {
            for (const [lang, pattern] of Object.entries(LANG_PATTERNS)) {
                if (pattern.test(code)) return lang;
            }
            return 'text';
        },

        /**
         * Wrap code blocks in styled containers
         * @param {HTMLElement} container - Element containing text with code
         */
        highlight(container) {
            if (!container) return;

            const codeBlocks = container.querySelectorAll('pre, code, .code-block');
            codeBlocks.forEach(block => {
                if (block.dataset.highlighted) return;
                block.dataset.highlighted = 'true';

                const lang = this.detect(block.textContent);
                block.style.cssText = 'background:#1a1a2e;color:#e0e0e0;padding:16px;border-radius:8px;overflow-x:auto;font-family:monospace;font-size:0.9rem;border:1px solid rgba(212,175,55,0.3);';

                // Add language badge
                if (lang !== 'text') {
                    const badge = document.createElement('span');
                    badge.textContent = lang.toUpperCase();
                    badge.style.cssText = 'position:absolute;top:4px;right:8px;font-size:0.7rem;color:#d4af37;opacity:0.7;';
                    block.style.position = 'relative';
                    block.appendChild(badge);
                }
            });
        },

        /**
         * Check if text looks like code
         * @param {string} text
         * @returns {boolean}
         */
        isCode(text) {
            if (!text || text.length < 10) return false;
            return Object.values(LANG_PATTERNS).some(p => p.test(text));
        }
    };

    console.log('🔍 K Code Detector loaded');
})();
