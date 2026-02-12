/**
 * File Browser — Browse local files via File System Access API
 * Falls back to standard <input type="file"> on unsupported browsers
 */

(function () {
    'use strict';
    if (window.KFileBrowser) return;

    window.KFileBrowser = {
        /**
         * Open file picker and return selected files
         * @param {Object} options - { multiple, accept }
         * @returns {FileSystemFileHandle[]|File[]}
         */
        async browse(options = {}) {
            // Modern File System Access API
            if ('showOpenFilePicker' in window) {
                try {
                    const handles = await window.showOpenFilePicker({
                        multiple: options.multiple || false,
                        types: options.accept ? [{
                            description: 'Files',
                            accept: options.accept
                        }] : undefined
                    });
                    const files = await Promise.all(handles.map(h => h.getFile()));
                    console.log('📂 Selected:', files.map(f => f.name));
                    return files;
                } catch (err) {
                    if (err.name === 'AbortError') return []; // User cancelled
                    console.warn('📂 File picker error:', err.message);
                }
            }

            // Fallback: classic input
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = options.multiple || false;
                if (options.accept) input.accept = Object.keys(options.accept).join(',');

                input.onchange = () => {
                    const files = Array.from(input.files || []);
                    console.log('📂 Selected (fallback):', files.map(f => f.name));
                    resolve(files);
                };
                input.click();
            });
        },

        /**
         * Read file content as text
         * @param {File} file
         * @returns {string}
         */
        async readText(file) {
            return file.text();
        },

        /**
         * Read file content as data URL (for images, audio)
         * @param {File} file
         * @returns {string}
         */
        readDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }
    };

    console.log('📂 K File Browser loaded');
})();
