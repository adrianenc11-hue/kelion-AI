/**
 * K Universal Workspace
 * Spațiu de lucru universal pentru K și utilizator
 * 
 * Features:
 * - K se minimizează în colț dar rămâne ACTIV (voice, chat, toate funcțiile)
 * - Auto-detect tip conținut: image, text, code, map, zip, pdf, video
 * - Upload/Download/Copy/Save local
 * - Dezarhivare ZIP automată
 * - Hărți GPS cu Leaflet
 * - Syntax highlighting pentru cod
 */

(function () {
    'use strict';

    // === CONFIGURATION ===
    const CONFIG = {
        supportedTypes: {
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
            text: ['txt', 'md', 'rtf'],
            code: ['js', 'ts', 'py', 'html', 'css', 'json', 'xml', 'sql', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift'],
            pdf: ['pdf'],
            archive: ['zip', 'rar', '7z', 'tar', 'gz'],
            video: ['mp4', 'webm', 'ogg', 'mov', 'avi'],
            audio: ['mp3', 'wav', 'ogg', 'm4a'],
            document: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt']
        }
    };

    // === WORKSPACE CLASS ===
    class KUniversalWorkspace {
        constructor() {
            this.isOpen = false;
            this.currentContent = null;
            this.currentType = null;
            this.contentHistory = [];
            this.map = null;

            this.init();
        }

        init() {
            this.createWorkspaceDOM();
            this.setupEventListeners();
            this.setupDragDrop();
            console.log('🌐 K Universal Workspace initialized');
        }

        // === DOM CREATION ===
        createWorkspaceDOM() {
            if (document.getElementById('k-universal-workspace')) return;

            const workspace = document.createElement('div');
            workspace.id = 'k-universal-workspace';
            workspace.innerHTML = `
                <style>
                    /* === K UNIVERSAL WORKSPACE STYLES === */
                    #k-universal-workspace {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(5, 15, 35, 0.98);
                        z-index: 9999;
                        display: none;
                        flex-direction: column;
                        font-family: 'Segoe UI', system-ui, sans-serif;
                    }
                    
                    #k-universal-workspace.open {
                        display: flex;
                        animation: wsSlideIn 0.4s ease-out;
                    }
                    
                    @keyframes wsSlideIn {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    
                    /* K Minimized Avatar */
                    .k-mini-avatar {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #0a1a3a 0%, #1a3a6a 100%);
                        border: 2px solid #00d4ff;
                        box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        z-index: 10;
                        transition: all 0.3s ease;
                    }
                    
                    .k-mini-avatar:hover {
                        transform: scale(1.1);
                        box-shadow: 0 0 30px rgba(0, 212, 255, 0.8);
                    }
                    
                    .k-mini-avatar img {
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        object-fit: cover;
                    }
                    
                    .k-mini-avatar .k-pulse {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        border: 2px solid #00d4ff;
                        animation: kPulse 2s infinite;
                    }
                    
                    @keyframes kPulse {
                        0% { transform: scale(1); opacity: 1; }
                        100% { transform: scale(1.5); opacity: 0; }
                    }
                    
                    /* Toolbar */
                    .ws-toolbar {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 10px 20px;
                        padding-left: 90px;
                        background: linear-gradient(180deg, rgba(20, 40, 80, 0.9) 0%, rgba(10, 25, 50, 0.9) 100%);
                        border-bottom: 1px solid rgba(212, 175, 55, 0.4);
                    }
                    
                    .ws-toolbar button {
                        padding: 10px 18px;
                        background: linear-gradient(180deg, rgba(30, 60, 100, 0.8) 0%, rgba(20, 40, 70, 0.8) 100%);
                        border: 1px solid rgba(212, 175, 55, 0.5);
                        border-radius: 6px;
                        color: #d4af37;
                        font-size: 14px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        transition: all 0.2s ease;
                    }
                    
                    .ws-toolbar button:hover {
                        background: linear-gradient(180deg, rgba(40, 80, 130, 0.9) 0%, rgba(30, 60, 100, 0.9) 100%);
                        border-color: #d4af37;
                        transform: translateY(-2px);
                    }
                    
                    .ws-toolbar button.back-btn {
                        margin-left: auto;
                        background: linear-gradient(180deg, rgba(100, 40, 40, 0.8) 0%, rgba(70, 25, 25, 0.8) 100%);
                        border-color: rgba(255, 100, 100, 0.5);
                        color: #ff9999;
                    }
                    
                    .ws-toolbar button.back-btn:hover {
                        background: linear-gradient(180deg, rgba(130, 50, 50, 0.9) 0%, rgba(100, 35, 35, 0.9) 100%);
                    }
                    
                    /* Main Container */
                    .ws-main {
                        display: flex;
                        flex: 1;
                        overflow: hidden;
                    }
                    
                    /* Sidebar */
                    .ws-sidebar {
                        width: 90px;
                        background: rgba(15, 30, 60, 0.8);
                        border-right: 1px solid rgba(212, 175, 55, 0.3);
                        display: flex;
                        flex-direction: column;
                        padding: 15px 0;
                    }
                    
                    .ws-sidebar-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 12px 8px;
                        color: #888;
                        font-size: 11px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        border-left: 3px solid transparent;
                    }
                    
                    .ws-sidebar-item:hover {
                        background: rgba(0, 212, 255, 0.1);
                        color: #00d4ff;
                    }
                    
                    .ws-sidebar-item.active {
                        background: rgba(0, 212, 255, 0.15);
                        color: #00d4ff;
                        border-left-color: #00d4ff;
                    }
                    
                    .ws-sidebar-item .icon {
                        font-size: 24px;
                        margin-bottom: 4px;
                    }
                    
                    /* Content Area */
                    .ws-content {
                        flex: 1;
                        padding: 20px;
                        overflow: auto;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .ws-content.has-content {
                        justify-content: flex-start;
                        align-items: stretch;
                    }
                    
                    .ws-drop-zone {
                        border: 3px dashed rgba(212, 175, 55, 0.4);
                        border-radius: 20px;
                        padding: 60px;
                        text-align: center;
                        color: #888;
                        transition: all 0.3s ease;
                    }
                    
                    .ws-drop-zone.drag-over {
                        border-color: #00d4ff;
                        background: rgba(0, 212, 255, 0.1);
                        color: #00d4ff;
                    }
                    
                    .ws-drop-zone .drop-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    
                    .ws-drop-zone h3 {
                        color: #d4af37;
                        margin-bottom: 10px;
                    }
                    
                    /* Content Viewers */
                    .ws-image-viewer {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .ws-image-viewer img {
                        max-width: 100%;
                        max-height: 100%;
                        object-fit: contain;
                        border-radius: 8px;
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    }
                    
                    .ws-text-viewer, .ws-code-viewer {
                        width: 100%;
                        height: 100%;
                        background: rgba(10, 20, 40, 0.9);
                        border: 1px solid rgba(212, 175, 55, 0.3);
                        border-radius: 8px;
                        padding: 20px;
                        overflow: auto;
                        color: #e0e0e0;
                        font-family: 'Fira Code', 'Consolas', monospace;
                        font-size: 14px;
                        line-height: 1.6;
                        white-space: pre-wrap;
                    }
                    
                    .ws-code-viewer {
                        background: #1e1e1e;
                    }
                    
                    .ws-map-viewer {
                        width: 100%;
                        height: 100%;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    
                    .ws-map-viewer #workspace-map {
                        width: 100%;
                        height: 100%;
                    }
                    
                    .ws-video-viewer {
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .ws-video-viewer video {
                        max-width: 100%;
                        max-height: 100%;
                        border-radius: 8px;
                    }
                    
                    .ws-file-tree {
                        width: 100%;
                        color: #e0e0e0;
                    }
                    
                    .ws-file-tree-item {
                        padding: 8px 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        border-radius: 4px;
                    }
                    
                    .ws-file-tree-item:hover {
                        background: rgba(0, 212, 255, 0.1);
                    }
                    
                    /* Status Bar */
                    .ws-statusbar {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        padding: 8px 20px;
                        background: rgba(10, 25, 50, 0.95);
                        border-top: 1px solid rgba(212, 175, 55, 0.3);
                        font-size: 12px;
                        color: #888;
                    }
                    
                    .ws-statusbar .k-status {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        color: #00d4ff;
                    }
                    
                    .ws-statusbar .k-status .dot {
                        width: 8px;
                        height: 8px;
                        background: #00ff88;
                        border-radius: 50%;
                        animation: statusPulse 1.5s infinite;
                    }
                    
                    @keyframes statusPulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.5; }
                    }
                    
                    /* Hidden file input */
                    #ws-file-input {
                        display: none;
                    }
                </style>
                
                <div class="k-mini-avatar" onclick="kWorkspace.onMiniAvatarClick()" title="K - Click pentru a vorbi">
                    <div class="k-pulse"></div>
                    <span style="font-size: 28px;">🤖</span>
                </div>
                
                <div class="ws-toolbar">
                    <button onclick="kWorkspace.upload()" title="Upload fișier">
                        <span>⬆️</span> Upload
                    </button>
                    <button onclick="kWorkspace.download()" title="Download">
                        <span>⬇️</span> Download
                    </button>
                    <button onclick="kWorkspace.copy()" title="Copiază în clipboard">
                        <span>📋</span> Copy
                    </button>
                    <button onclick="kWorkspace.save()" title="Salvează local">
                        <span>💾</span> Save
                    </button>
                    <button onclick="kWorkspace.toggleFullscreen()" title="Fullscreen">
                        <span>⛶</span> Fullscreen
                    </button>
                    <button class="back-btn" onclick="kWorkspace.close()" title="Înapoi la K">
                        <span>←</span> Back
                    </button>
                </div>
                
                <div class="ws-main">
                    <div class="ws-sidebar">
                        <div class="ws-sidebar-item" data-type="image" onclick="kWorkspace.filterByType('image')">
                            <span class="icon">🖼️</span>
                            IMAGE
                        </div>
                        <div class="ws-sidebar-item" data-type="text" onclick="kWorkspace.filterByType('text')">
                            <span class="icon">📝</span>
                            TEXT
                        </div>
                        <div class="ws-sidebar-item" data-type="code" onclick="kWorkspace.filterByType('code')">
                            <span class="icon">💻</span>
                            CODE
                        </div>
                        <div class="ws-sidebar-item" data-type="map" onclick="kWorkspace.filterByType('map')">
                            <span class="icon">📍</span>
                            MAP
                        </div>
                        <div class="ws-sidebar-item" data-type="archive" onclick="kWorkspace.filterByType('archive')">
                            <span class="icon">📁</span>
                            ZIP
                        </div>
                        <div class="ws-sidebar-item" data-type="video" onclick="kWorkspace.filterByType('video')">
                            <span class="icon">🎬</span>
                            VIDEO
                        </div>
                        <div class="ws-sidebar-item" data-type="pdf" onclick="kWorkspace.filterByType('pdf')">
                            <span class="icon">📄</span>
                            PDF
                        </div>
                    </div>
                    
                    <div class="ws-content" id="ws-content">
                        <div class="ws-drop-zone" id="ws-drop-zone">
                            <div class="drop-icon">📂</div>
                            <h3>Drag & Drop fișiere aici</h3>
                            <p>sau click pe Upload pentru a selecta</p>
                            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                                Suportat: Imagini, Text, Cod, PDF, ZIP, Video, Audio
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="ws-statusbar">
                    <div class="k-status">
                        <div class="dot"></div>
                        <span>K is active</span>
                    </div>
                    <div class="file-info" id="ws-file-info">No file loaded</div>
                    <div style="margin-left: auto;" id="ws-status">Ready</div>
                </div>
                
                <input type="file" id="ws-file-input" multiple onchange="kWorkspace.handleFileSelect(event)">
            `;

            document.body.appendChild(workspace);
        }

        // === EVENT LISTENERS ===
        setupEventListeners() {
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                // Ctrl+Shift+Space to toggle workspace (W would close browser tab!)
                if (e.ctrlKey && e.shiftKey && e.code === 'Space') {
                    e.preventDefault();
                    this.toggle();
                }
                // Escape to close
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }

        setupDragDrop() {
            const dropZone = document.getElementById('ws-drop-zone');
            const content = document.getElementById('ws-content');

            ['dragenter', 'dragover'].forEach(event => {
                content.addEventListener(event, (e) => {
                    e.preventDefault();
                    if (dropZone) dropZone.classList.add('drag-over');
                });
            });

            ['dragleave', 'drop'].forEach(event => {
                content.addEventListener(event, (e) => {
                    e.preventDefault();
                    if (dropZone) dropZone.classList.remove('drag-over');
                });
            });

            content.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.processFile(files[0]);
                }
            });
        }

        // === LIFECYCLE ===
        open() {
            const workspace = document.getElementById('k-universal-workspace');
            workspace.classList.add('open');
            this.isOpen = true;
            this.minimizeK();
            console.log('🌐 Workspace opened');
        }

        close() {
            const workspace = document.getElementById('k-universal-workspace');
            workspace.classList.remove('open');
            this.isOpen = false;
            this.restoreK();
            console.log('🌐 Workspace closed');
        }

        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }

        // === K AVATAR CONTROL ===
        minimizeK() {
            // Notify K components that we're in workspace mode
            if (window.kAvatarMinimized !== undefined) {
                window.kAvatarMinimized = true;
            }
            // Hide main hologram container but keep functionality
            const hologram = document.getElementById('hologram-container');
            if (hologram) {
                hologram.style.opacity = '0';
                hologram.style.pointerEvents = 'none';
            }
        }

        restoreK() {
            if (window.kAvatarMinimized !== undefined) {
                window.kAvatarMinimized = false;
            }
            const hologram = document.getElementById('hologram-container');
            if (hologram) {
                hologram.style.opacity = '1';
                hologram.style.pointerEvents = 'auto';
            }
        }

        onMiniAvatarClick() {
            // K is always active - trigger voice or show status
            if (window.speak) {
                window.speak('Sunt aici. Cu ce te pot ajuta?');
            }
        }

        // === FILE OPERATIONS ===
        upload() {
            document.getElementById('ws-file-input').click();
        }

        handleFileSelect(event) {
            const files = event.target.files;
            if (files.length > 0) {
                this.processFile(files[0]);
            }
        }

        async processFile(file) {
            const type = this.detectType(file.name);
            this.currentType = type;
            this.currentContent = file;

            this.updateSidebar(type);
            this.updateFileInfo(file);
            this.setStatus('Processing...');

            const content = document.getElementById('ws-content');
            content.classList.add('has-content');

            try {
                switch (type) {
                    case 'image':
                        await this.renderImage(file);
                        break;
                    case 'text':
                    case 'code':
                        await this.renderTextOrCode(file, type);
                        break;
                    case 'video':
                        await this.renderVideo(file);
                        break;
                    case 'audio':
                        await this.renderAudio(file);
                        break;
                    case 'archive':
                        await this.renderArchive(file);
                        break;
                    case 'pdf':
                        await this.renderPDF(file);
                        break;
                    default:
                        await this.renderGeneric(file);
                }
                this.setStatus('Ready');
            } catch (error) {
                console.error('Error processing file:', error);
                this.setStatus('Error: ' + error.message);
            }
        }

        detectType(filename) {
            const ext = filename.split('.').pop().toLowerCase();

            for (const [type, extensions] of Object.entries(CONFIG.supportedTypes)) {
                if (extensions.includes(ext)) {
                    return type;
                }
            }
            return 'unknown';
        }

        // === RENDERERS ===
        async renderImage(file) {
            const content = document.getElementById('ws-content');
            const url = URL.createObjectURL(file);
            content.innerHTML = `
                <div class="ws-image-viewer">
                    <img src="${url}" alt="${file.name}">
                </div>
            `;
        }

        async renderTextOrCode(file, type) {
            const content = document.getElementById('ws-content');
            const text = await file.text();

            const className = type === 'code' ? 'ws-code-viewer' : 'ws-text-viewer';
            content.innerHTML = `<pre class="${className}">${this.escapeHtml(text)}</pre>`;
        }

        async renderVideo(file) {
            const content = document.getElementById('ws-content');
            const url = URL.createObjectURL(file);
            content.innerHTML = `
                <div class="ws-video-viewer">
                    <video controls autoplay>
                        <source src="${url}" type="${file.type}">
                        Your browser does not support video playback.
                    </video>
                </div>
            `;
        }

        async renderAudio(file) {
            const content = document.getElementById('ws-content');
            const url = URL.createObjectURL(file);
            content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">🎵</div>
                    <h3 style="color: #d4af37; margin-bottom: 20px;">${file.name}</h3>
                    <audio controls autoplay style="width: 80%; max-width: 400px;">
                        <source src="${url}" type="${file.type}">
                    </audio>
                </div>
            `;
        }

        async renderArchive(file) {
            const content = document.getElementById('ws-content');

            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="font-size: 80px; margin-bottom: 20px;">📦</div>
                        <h3 style="color: #d4af37;">${file.name}</h3>
                        <p style="color: #888;">ZIP viewer requires JSZip library</p>
                        <button onclick="kWorkspace.download()" style="margin-top: 20px; padding: 10px 20px; background: #1a5a3a; border: 1px solid #d4af37; color: #d4af37; border-radius: 6px; cursor: pointer;">
                            Download ZIP
                        </button>
                    </div>
                `;
                return;
            }

            try {
                const zip = await JSZip.loadAsync(file);
                let html = '<div class="ws-file-tree">';

                zip.forEach((path, zipEntry) => {
                    const icon = zipEntry.dir ? '📁' : '📄';
                    html += `
                        <div class="ws-file-tree-item" onclick="kWorkspace.extractFile('${path}')">
                            <span>${icon}</span>
                            <span>${path}</span>
                        </div>
                    `;
                });

                html += '</div>';
                content.innerHTML = html;
                this.currentZip = zip;
            } catch (error) {
                content.innerHTML = `<p style="color: #ff6666;">Error reading archive: ${error.message}</p>`;
            }
        }

        async renderPDF(file) {
            const content = document.getElementById('ws-content');
            const url = URL.createObjectURL(file);

            content.innerHTML = `
                <iframe src="${url}" style="width: 100%; height: 100%; border: none; border-radius: 8px;"></iframe>
            `;
        }

        async renderGeneric(file) {
            const content = document.getElementById('ws-content');
            content.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="font-size: 80px; margin-bottom: 20px;">📄</div>
                    <h3 style="color: #d4af37;">${file.name}</h3>
                    <p style="color: #888;">Type: ${file.type || 'Unknown'}</p>
                    <p style="color: #888;">Size: ${this.formatSize(file.size)}</p>
                    <button onclick="kWorkspace.download()" style="margin-top: 20px; padding: 10px 20px; background: #1a5a3a; border: 1px solid #d4af37; color: #d4af37; border-radius: 6px; cursor: pointer;">
                        Download
                    </button>
                </div>
            `;
        }

        // === MAP FUNCTIONS ===
        async showMap(lat, lng, label = 'Location') {
            this.open();
            this.currentType = 'map';
            this.updateSidebar('map');

            const content = document.getElementById('ws-content');
            content.classList.add('has-content');
            content.innerHTML = '<div class="ws-map-viewer"><div id="workspace-map"></div></div>';

            // Load Leaflet if not available
            if (typeof L === 'undefined') {
                await this.loadLeaflet();
            }

            setTimeout(() => {
                this.map = L.map('workspace-map').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(this.map);

                L.marker([lat, lng]).addTo(this.map).bindPopup(label).openPopup();

                this.setStatus(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }, 100);
        }

        async loadLeaflet() {
            return new Promise((resolve) => {
                // Load CSS
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(css);

                // Load JS
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }

        async showCurrentLocation() {
            if (!navigator.geolocation) {
                this.setStatus('Geolocation not supported');
                return;
            }

            this.setStatus('Getting location...');

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    this.showMap(pos.coords.latitude, pos.coords.longitude, 'Your Location');
                },
                (err) => {
                    this.setStatus('Location error: ' + err.message);
                }
            );
        }

        // === CONTENT DISPLAY (for K generated content) ===
        displayContent(content, type = 'text', title = '') {
            this.open();
            this.currentType = type;
            this.currentContent = content;
            this.updateSidebar(type);

            const contentArea = document.getElementById('ws-content');
            contentArea.classList.add('has-content');

            switch (type) {
                case 'image':
                    contentArea.innerHTML = `
                        <div class="ws-image-viewer">
                            <img src="${content}" alt="${title}">
                        </div>
                    `;
                    break;
                case 'text':
                    contentArea.innerHTML = `<pre class="ws-text-viewer">${this.escapeHtml(content)}</pre>`;
                    break;
                case 'code':
                    contentArea.innerHTML = `<pre class="ws-code-viewer">${this.escapeHtml(content)}</pre>`;
                    break;
                case 'html':
                    contentArea.innerHTML = `<div class="ws-text-viewer">${content}</div>`;
                    break;
                default:
                    contentArea.innerHTML = `<pre class="ws-text-viewer">${this.escapeHtml(content)}</pre>`;
            }

            this.updateFileInfo({ name: title || 'Generated Content', size: content.length });
        }

        // === TOOLBAR ACTIONS ===
        download() {
            if (!this.currentContent) {
                this.setStatus('Nothing to download');
                return;
            }

            let blob, filename;

            if (this.currentContent instanceof File) {
                blob = this.currentContent;
                filename = this.currentContent.name;
            } else if (typeof this.currentContent === 'string') {
                if (this.currentContent.startsWith('data:') || this.currentContent.startsWith('http')) {
                    // It's an image URL
                    const a = document.createElement('a');
                    a.href = this.currentContent;
                    a.download = 'download';
                    a.click();
                    return;
                }
                blob = new Blob([this.currentContent], { type: 'text/plain' });
                filename = 'content.txt';
            }

            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                this.setStatus('Downloaded: ' + filename);
            }
        }

        async copy() {
            let textToCopy = '';

            if (this.currentContent instanceof File) {
                if (this.currentType === 'text' || this.currentType === 'code') {
                    textToCopy = await this.currentContent.text();
                } else {
                    textToCopy = this.currentContent.name;
                }
            } else if (typeof this.currentContent === 'string') {
                textToCopy = this.currentContent;
            }

            if (textToCopy) {
                await navigator.clipboard.writeText(textToCopy);
                this.setStatus('Copied to clipboard!');
            } else {
                this.setStatus('Nothing to copy');
            }
        }

        save() {
            // Same as download for now, but could show format options
            this.download();
        }

        toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.getElementById('k-universal-workspace').requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }

        filterByType(type) {
            // Could filter content history by type
            console.log('Filter by:', type);
        }

        // === HELPERS ===
        updateSidebar(activeType) {
            document.querySelectorAll('.ws-sidebar-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.type === activeType) {
                    item.classList.add('active');
                }
            });
        }

        updateFileInfo(file) {
            const info = document.getElementById('ws-file-info');
            if (file) {
                info.textContent = `File: ${file.name} | Size: ${this.formatSize(file.size)}`;
            }
        }

        setStatus(status) {
            document.getElementById('ws-status').textContent = status;
        }

        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // === INITIALIZE ===
    window.kWorkspace = new KUniversalWorkspace();

    console.log('🌐 K Universal Workspace loaded. Press Ctrl+Shift+W to open.');
})();
