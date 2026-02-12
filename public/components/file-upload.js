/**
 * File Upload — Drag-drop and click file upload widget
 * Used by: index.html, app.html
 * Backend: /.netlify/functions/file-upload
 */

(function () {
    'use strict';
    if (window.KFileUpload) return;

    window.KFileUpload = {
        /**
         * Upload a file to backend
         * @param {File} file
         * @returns {Object|null} Upload result
         */
        async upload(file) {
            if (!file) return null;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch('/.netlify/functions/file-upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                console.log('📁 File uploaded:', file.name, data);
                return data;
            } catch (err) {
                console.error('📁 Upload error:', err.message);
                return null;
            }
        },

        /**
         * Create a drag-drop zone on an element
         * @param {HTMLElement} element
         * @param {Function} onFile - callback(File)
         */
        attachDropZone(element, onFile) {
            if (!element) return;

            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                element.style.outline = '2px dashed #d4af37';
            });

            element.addEventListener('dragleave', () => {
                element.style.outline = '';
            });

            element.addEventListener('drop', (e) => {
                e.preventDefault();
                element.style.outline = '';
                const files = e.dataTransfer?.files;
                if (files?.length > 0 && typeof onFile === 'function') {
                    onFile(files[0]);
                }
            });
        }
    };

    console.log('📁 K File Upload loaded');
})();
