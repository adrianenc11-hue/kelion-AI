/**
 * K Presentation Workspace — Connects backend k-presentation function to UI
 * Generates HTML presentations via /.netlify/functions/k-presentation
 * Displays in doc-presentation-panel or k-workspace-panel
 * 
 * Used by: app.html, index.html
 * Backend: netlify/functions/k-presentation.js (Gemini 2.0 Flash / GPT-4o-mini)
 */

(function () {
    'use strict';

    // Prevent duplicate
    if (window.KPresentationWorkspace) return;

    const KPresentationWorkspace = {
        isLoading: false,

        /**
         * Generate and display a presentation
         * @param {string} topic - Presentation topic
         * @param {Object} options - { slides_count, style, language }
         */
        async generate(topic, options = {}) {
            if (this.isLoading) {
                console.warn('⏳ Presentation already loading');
                return null;
            }

            this.isLoading = true;
            console.log('📊 Generating presentation:', topic);

            try {
                const res = await fetch('/.netlify/functions/k-presentation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic,
                        slides_count: options.slides_count || 6,
                        style: options.style || 'modern-dark',
                        language: options.language || 'ro'
                    })
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();

                if (!data.success || !data.presentation?.html) {
                    throw new Error(data.error || 'No presentation HTML returned');
                }

                console.log(`📊 Presentation generated via ${data.engine}`);

                // Display in workspace panel if available
                this.display(data.presentation.html, topic);

                return data;

            } catch (err) {
                console.error('📊 Presentation error:', err.message);
                return null;
            } finally {
                this.isLoading = false;
            }
        },

        /**
         * Display HTML presentation in workspace
         */
        display(html, title) {
            // Try K Workspace Panel first
            if (window.kWorkspace) {
                window.kWorkspace.open();
                const content = document.getElementById('k-workspace-content');
                if (content) {
                    content.innerHTML = `
                        <iframe srcdoc="${html.replace(/"/g, '&quot;')}" 
                            style="width:100%;height:100%;border:none;border-radius:12px;"
                            sandbox="allow-scripts allow-same-origin">
                        </iframe>`;
                }
                console.log('📊 Presentation displayed in workspace');
                return;
            }

            // Fallback: open in new window
            const win = window.open('', '_blank');
            if (win) {
                win.document.write(html);
                win.document.close();
                win.document.title = title || 'K Presentation';
            }
        }
    };

    window.KPresentationWorkspace = KPresentationWorkspace;
    console.log('📊 K Presentation Workspace loaded');
})();
