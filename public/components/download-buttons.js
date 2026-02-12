/**
 * Download Buttons — Dynamic download buttons for generated content
 * Creates download links for images, documents, audio, presentations
 */

(function () {
    'use strict';
    if (window.KDownloadButtons) return;

    window.KDownloadButtons = {
        /**
         * Download content as file
         * @param {string} content - URL, base64, or text content
         * @param {string} filename - Download filename
         * @param {string} type - MIME type (auto-detected if omitted)
         */
        download(content, filename, type) {
            try {
                let blob;

                if (content.startsWith('data:')) {
                    // Base64 data URL
                    const parts = content.split(',');
                    const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
                    const binary = atob(parts[1]);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    blob = new Blob([bytes], { type: mime });
                } else if (content.startsWith('http')) {
                    // URL — open in new tab (browser handles download)
                    const a = document.createElement('a');
                    a.href = content;
                    a.download = filename || 'download';
                    a.target = '_blank';
                    a.click();
                    return;
                } else {
                    // Text content
                    blob = new Blob([content], { type: type || 'text/plain' });
                }

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                console.log('⬇️ Downloaded:', filename);
            } catch (err) {
                console.error('⬇️ Download error:', err.message);
            }
        },

        /**
         * Create a download button element
         * @param {string} label
         * @param {Function} onClick
         * @returns {HTMLButtonElement}
         */
        createButton(label, onClick) {
            const btn = document.createElement('button');
            btn.textContent = `⬇️ ${label}`;
            btn.style.cssText = 'background:linear-gradient(135deg,#d4af37,#b8860b);color:#000;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:600;transition:transform 0.2s;';
            btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; };
            btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
            btn.onclick = onClick;
            return btn;
        }
    };

    console.log('⬇️ K Download Buttons loaded');
})();
