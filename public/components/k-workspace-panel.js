/**
 * K Workspace Panel - Exact Mockup Design
 * K deschide automat când are conținut de afișat
 * 
 * Design: K minimizat stânga-sus, toolbar sus, sidebar stânga, conținut centru
 * Butoane active: Upload, Download, Copy, Fullscreen, Back
 */

(function () {
    'use strict';

    // Prevent duplicate
    if (window.KWorkspacePanel) return;

    class KWorkspacePanel {
        constructor() {
            this.isOpen = false;
            this.map = null;
            this.currentData = null;
            this.currentType = null;
            this.init();
        }

        init() {
            this.injectStyles();
            this.createDOM();
            this.bindEvents();
            console.log('🖥️ K Workspace Panel ready');
        }

        injectStyles() {
            if (document.getElementById('k-ws-styles')) return;

            const style = document.createElement('style');
            style.id = 'k-ws-styles';
            style.textContent = `
                #k-workspace-panel {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: linear-gradient(135deg, #0a1428 0%, #0d1a30 50%, #0f1d35 100%);
                    z-index: 10000;
                    flex-direction: column;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                }
                #k-workspace-panel.open {
                    display: flex;
                    animation: kWsOpen 0.3s ease-out;
                }
                @keyframes kWsOpen {
                    from { opacity: 0; transform: scale(0.96); }
                    to { opacity: 1; transform: scale(1); }
                }

                /* K Minimized - ULTRA COMPACT */
                .kws-k-avatar {
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 30px;
                    height: 35px;
                    background: rgba(15,50,90,0.9);
                    border: 1px solid rgba(0,220,255,0.5);
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 10px rgba(0,220,255,0.3);
                    z-index: 10001;
                    cursor: pointer;
                }
                .kws-k-avatar:hover { box-shadow: 0 0 15px rgba(0,220,255,0.5); }
                .kws-k-avatar .icon { font-size: 14px; }
                .kws-k-avatar .label { display: none; }

                /* Toolbar - ULTRA COMPACT */
                .kws-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3px;
                    padding: 3px 5px 3px 35px;
                    background: rgba(15,30,50,0.95);
                    border-bottom: 1px solid rgba(212,175,55,0.3);
                }
                .kws-toolbar button {
                    padding: 3px 8px;
                    background: rgba(25,50,85,0.8);
                    border: 1px solid rgba(212,175,55,0.4);
                    border-radius: 10px;
                    color: #d4af37;
                    font-size: 9px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 2px;
                }
                .kws-toolbar button:hover {
                    background: linear-gradient(180deg, rgba(40,70,110,0.95) 0%, rgba(30,55,90,0.95) 100%);
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(212,175,55,0.3);
                }
                .kws-toolbar .back-btn {
                    margin-left: auto;
                    background: linear-gradient(180deg, rgba(90,40,40,0.9) 0%, rgba(60,25,25,0.9) 100%) !important;
                    border-color: rgba(255,100,100,0.6) !important;
                    color: #ff9999 !important;
                }
                .kws-toolbar .compact-btn {
                    background: linear-gradient(180deg, rgba(40,90,40,0.9) 0%, rgba(25,60,25,0.9) 100%) !important;
                    border-color: rgba(100,255,100,0.6) !important;
                    color: #99ff99 !important;
                }

                /* COMPACT MODE - Maximized content area */
                #k-workspace-panel.compact .kws-toolbar {
                    padding: 6px 10px 6px 75px;
                    gap: 5px;
                }
                #k-workspace-panel.compact .kws-toolbar button {
                    padding: 5px 10px;
                    font-size: 11px;
                }
                #k-workspace-panel.compact .kws-toolbar button span {
                    display: none;
                }
                #k-workspace-panel.compact .kws-sidebar {
                    width: 45px;
                }
                #k-workspace-panel.compact .kws-sidebar-item {
                    padding: 10px 5px;
                    font-size: 8px;
                }
                #k-workspace-panel.compact .kws-sidebar-item .icon {
                    font-size: 18px;
                }
                #k-workspace-panel.compact .kws-k-avatar {
                    width: 45px;
                    height: 55px;
                    top: 6px;
                    left: 6px;
                }
                #k-workspace-panel.compact .kws-k-avatar .label {
                    font-size: 7px;
                }
                #k-workspace-panel.compact .kws-statusbar {
                    padding: 5px 10px;
                    font-size: 10px;
                }
                #k-workspace-panel.compact .kws-content {
                    padding: 8px;
                }

                /* Main Layout */
                .kws-main {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                /* Sidebar - ULTRA COMPACT */
                .kws-sidebar {
                    width: 32px;
                    background: rgba(10,25,45,0.95);
                    border-right: 1px solid rgba(212,175,55,0.2);
                    padding-top: 2px;
                    display: flex;
                    flex-direction: column;
                }
                .kws-sidebar-item {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 2px;
                    color: rgba(255,255,255,0.4);
                    font-size: 0;
                    cursor: pointer;
                    border-left: 2px solid transparent;
                }
                .kws-sidebar-item:hover { background: rgba(0,220,255,0.1); color: #00dcff; }
                .kws-sidebar-item.active { background: rgba(0,220,255,0.15); color: #00dcff; border-left-color: #00dcff; }
                .kws-sidebar-item .icon { font-size: 14px; }

                /* Content Area - MAXIMIZED */
                .kws-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    padding: 5px;
                    overflow: hidden;
                }
                .kws-content-inner {
                    flex: 1;
                    background: rgba(8,18,35,0.9);
                    border: 1px solid rgba(0,220,255,0.2);
                    border-radius: 8px;
                    overflow: hidden;
                    position: relative;
                }

                /* Map Controls */
                .kws-map-controls {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    z-index: 1000;
                }
                .kws-map-controls button {
                    width: 40px;
                    height: 40px;
                    background: rgba(20,40,70,0.95);
                    border: 1px solid rgba(0,220,255,0.5);
                    border-radius: 8px;
                    color: #00dcff;
                    font-size: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .kws-map-controls button:hover {
                    background: rgba(0,220,255,0.2);
                }

                /* Location Info Overlay */
                .kws-location-info {
                    position: absolute;
                    top: 15px;
                    left: 15px;
                    background: rgba(10,25,50,0.95);
                    border: 1px solid rgba(0,220,255,0.5);
                    border-radius: 8px;
                    padding: 12px 18px;
                    color: #fff;
                    font-size: 13px;
                    z-index: 1000;
                }
                .kws-location-info .coords {
                    color: #00dcff;
                    font-family: monospace;
                }
                .kws-location-info .label {
                    color: #d4af37;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                /* Status Bar - ULTRA COMPACT */
                .kws-statusbar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 3px 10px;
                    background: rgba(8,18,35,0.95);
                    border-top: 1px solid rgba(0,220,255,0.2);
                    font-size: 9px;
                    color: rgba(255,255,255,0.5);
                }
                .kws-statusbar .k-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #00dcff;
                }
                .kws-statusbar .dot {
                    width: 10px;
                    height: 10px;
                    background: #00ff88;
                    border-radius: 50%;
                    animation: kDotPulse 1.5s infinite;
                }
                @keyframes kDotPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .kws-statusbar .info { flex: 1; }
                .kws-statusbar .progress-bar {
                    width: 120px;
                    height: 5px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    overflow: hidden;
                }
                .kws-statusbar .progress-fill {
                    height: 100%;
                    width: 100%;
                    background: linear-gradient(90deg, #00dcff, #00ff88);
                }

                /* Map container */
                #kws-map-container {
                    width: 100%;
                    height: 100%;
                }

                /* Image display */
                .kws-image-display {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .kws-image-display img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    border-radius: 8px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }

                /* Text display */
                .kws-text-display {
                    width: 100%;
                    height: 100%;
                    padding: 25px;
                    overflow: auto;
                    color: #e0e0e0;
                    font-size: 15px;
                    line-height: 1.7;
                    white-space: pre-wrap;
                }
                .kws-code-display {
                    font-family: 'Fira Code', 'Consolas', monospace;
                    background: #1e1e1e;
                    font-size: 14px;
                }

                /* Folder Browser */
                .kws-folder-browser { padding: 20px; }
                .kws-folder-browser h3 { color: #00dcff; margin-bottom: 10px; }
                .folder-actions { display: flex; gap: 10px; margin: 15px 0; }
                .folder-actions button {
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #0080ff, #00dcff);
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                }
                .folder-actions button:hover { transform: scale(1.05); }
                .folder-list { max-height: 400px; overflow-y: auto; }
                .file-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    margin-bottom: 5px;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .file-item:hover { background: rgba(0,220,255,0.1); }
                .file-icon { font-size: 20px; }
                .file-name { flex: 1; color: #fff; }
                .file-size { color: #888; font-size: 12px; }

                /* Camera View */
                .kws-camera-view { display: flex; flex-direction: column; height: 100%; }
                #kws-camera-video {
                    flex: 1;
                    width: 100%;
                    background: #000;
                    object-fit: contain;
                }
                .camera-controls {
                    display: flex;
                    gap: 10px;
                    padding: 15px;
                    background: rgba(0,0,0,0.5);
                }
                .camera-controls select, .camera-controls button {
                    padding: 10px 15px;
                    border-radius: 8px;
                    border: none;
                    cursor: pointer;
                }
                .camera-controls select { flex: 1; background: #333; color: #fff; }
                .camera-controls button { background: #00dcff; color: #000; font-weight: bold; }
                #camera-preview { text-align: center; padding: 10px; }
                #camera-preview img { max-width: 200px; border-radius: 8px; margin-right: 10px; }

                /* Code Learning Hub */
                .kws-code-hub { padding: 20px; }
                .kws-code-hub h3 { color: #00dcff; margin-bottom: 20px; }
                .code-categories { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                .code-category {
                    padding: 20px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .code-category:hover { background: rgba(0,220,255,0.2); transform: translateY(-3px); }
                .code-category .icon { display: block; font-size: 32px; margin-bottom: 8px; }
                #code-tutorial-content {
                    margin-top: 20px;
                    padding: 15px;
                    background: #1e1e1e;
                    border-radius: 8px;
                }
                #code-tutorial-content pre {
                    color: #00ff88;
                    font-family: 'Fira Code', monospace;
                    white-space: pre-wrap;
                }            `;
            document.head.appendChild(style);
        }

        createDOM() {
            if (document.getElementById('k-workspace-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'k-workspace-panel';
            panel.innerHTML = `
                <!-- K Minimized Avatar - Small hologram thumbnail -->
                <div class="kws-k-avatar" id="kws-k-mini" onclick="KWorkspacePanel.onKClick()" title="K is active - click to talk">
                    <canvas id="kws-k-canvas" width="60" height="60"></canvas>
                    <span class="label">K (Active)</span>
                </div>

                <!-- Toolbar -->
                <div class="kws-toolbar">
                    <button onclick="KWorkspacePanel.upload()"><span>📤</span> Upload</button>
                    <button onclick="KWorkspacePanel.download()"><span>📥</span> Download</button>
                    <button onclick="KWorkspacePanel.copy()"><span>📋</span> Copy</button>
                    <button onclick="KWorkspacePanel.fullscreen()"><span>⛶</span> Fullscreen</button>
                    <button class="compact-btn" onclick="KWorkspacePanel.toggleCompact()"><span>◫</span> Compact</button>
                    <button class="back-btn" onclick="KWorkspacePanel.close()"><span>←</span> Back</button>
                </div>

                <!-- Main Area -->
                <div class="kws-main">
                    <!-- Sidebar -->
                    <div class="kws-sidebar">
                        <div class="kws-sidebar-item" data-type="image" onclick="KWorkspacePanel.setType('image')">
                            <span class="icon">🖼️</span>IMAGE
                        </div>
                        <div class="kws-sidebar-item" data-type="text" onclick="KWorkspacePanel.setType('text')">
                            <span class="icon">📝</span>TEXT
                        </div>
                        <div class="kws-sidebar-item" data-type="code" onclick="KWorkspacePanel.setType('code'); KWorkspacePanel.showCodeView();">
                            <span class="icon">💻</span>CODE
                        </div>
                        <div class="kws-sidebar-item active" data-type="map" onclick="KWorkspacePanel.setType('map')">
                            <span class="icon">📍</span>MAP PIN
                        </div>
                        <div class="kws-sidebar-item" data-type="folder" onclick="KWorkspacePanel.setType('folder'); KWorkspacePanel.showFolder();">
                            <span class="icon">📁</span>FOLDER/ZIP
                        </div>
                        <div class="kws-sidebar-item" data-type="camera" onclick="KWorkspacePanel.setType('camera'); KWorkspacePanel.showCamera();">
                            <span class="icon">📷</span>SCANARE
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="kws-content">
                        <div class="kws-content-inner" id="kws-content">
                            <!-- Content rendered here -->
                        </div>
                    </div>
                </div>

                <!-- Status Bar -->
                <div class="kws-statusbar">
                    <div class="k-status">
                        <div class="dot"></div>
                        <span id="kws-k-status">K is ready.</span>
                    </div>
                    <div class="info" id="kws-info">File: - | Size: - | Type: - | Status: Ready</div>
                    <div class="progress-bar"><div class="progress-fill"></div></div>
                    <span>100% Complete</span>
                </div>

                <!-- Chat Container - Main chat moves here when workspace opens -->
                <div id="kws-chat-container"></div>

                <input type="file" id="kws-file-input" style="display:none" onchange="KWorkspacePanel.handleUpload(event)">
            `;
            document.body.appendChild(panel);
        }

        bindEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }

        // === PUBLIC API - Called by K ===

        open() {
            const panel = document.getElementById('k-workspace-panel');
            if (panel) {
                panel.classList.add('open');
                this.isOpen = true;
                this.captureKThumbnail();
                this.hideMainK();
                this.moveChatToWorkspace();
            }
        }

        close() {
            const panel = document.getElementById('k-workspace-panel');
            if (panel) {
                panel.classList.remove('open');
                this.isOpen = false;
                this.moveChatBack();
                this.showMainK();
                if (this.map) {
                    this.map.remove();
                    this.map = null;
                }
            }
        }

        toggleCompact() {
            const panel = document.getElementById('k-workspace-panel');
            if (panel) {
                panel.classList.toggle('compact');
                this.isCompact = panel.classList.contains('compact');
                console.log('🔲 Compact mode:', this.isCompact);
            }
        }

        // Capture K's hologram as thumbnail for mini avatar
        captureKThumbnail() {
            try {
                const miniCanvas = document.getElementById('kws-k-canvas');
                if (!miniCanvas) return;

                const ctx = miniCanvas.getContext('2d');

                // Try to capture from main 3D canvas
                const mainCanvas = document.querySelector('#canvas-container canvas')
                    || document.querySelector('#container canvas')
                    || document.querySelector('canvas');

                let captured = false;
                if (mainCanvas) {
                    try {
                        ctx.drawImage(mainCanvas, 0, 0, miniCanvas.width, miniCanvas.height);
                        captured = true;
                    } catch (e) {
                        console.log('Canvas capture failed (WebGL):', e.message);
                    }
                }

                // Fallback: draw a K icon if capture failed
                if (!captured) {
                    // Gradient background
                    const grad = ctx.createLinearGradient(0, 0, 60, 60);
                    grad.addColorStop(0, '#0080ff');
                    grad.addColorStop(1, '#00ffff');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, 60, 60);

                    // K letter
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 36px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('K', 30, 32);
                }
            } catch (e) {
                console.log('Could not capture K thumbnail:', e);
            }
        }

        // Move chat panel into workspace
        moveChatToWorkspace() {
            const chat = document.getElementById('chat-panel');
            const wsChat = document.getElementById('kws-chat-container');
            if (chat && wsChat) {
                this.originalChatParent = chat.parentNode;
                wsChat.appendChild(chat);
                chat.style.position = 'fixed';
                chat.style.bottom = '20px';
                chat.style.left = '110px';
                chat.style.right = 'auto';
                chat.style.width = '400px';
                chat.style.zIndex = '10002';

                // Make chat messages visible in workspace (increased from 50px to 200px)
                const msgs = chat.querySelector('#chat-messages');
                if (msgs) {
                    msgs.style.maxHeight = '200px';  // Increased for better visibility
                    msgs.style.padding = '10px 15px';
                    msgs.style.fontSize = '13px';     // Readable font size
                }
            }
        }

        // Move chat back to original location
        moveChatBack() {
            const chat = document.getElementById('chat-panel');
            if (chat && this.originalChatParent) {
                this.originalChatParent.appendChild(chat);
                chat.style.position = '';
                chat.style.bottom = '';
                chat.style.left = '';
                chat.style.right = '';
                chat.style.width = '';
                chat.style.zIndex = '';

                // Restore chat messages to original size
                const msgs = chat.querySelector('#chat-messages');
                if (msgs) {
                    msgs.style.maxHeight = '';
                    msgs.style.padding = '';
                }
            }
        }

        hideMainK() {
            const c = document.getElementById('container');
            if (c) {
                c.style.opacity = '0';
                c.style.pointerEvents = 'none';
            }
        }

        showMainK() {
            const c = document.getElementById('container');
            if (c) {
                c.style.opacity = '1';
                c.style.pointerEvents = 'auto';
            }
        }

        // === K SHOWS LOCATION ===
        async showLocation(lat, lng, label = 'Your Location') {
            this.open();
            this.setType('map');
            this.currentType = 'map';
            this.currentData = { lat, lng, label };

            const content = document.getElementById('kws-content');
            content.innerHTML = `
                <div id="kws-map-container"></div>
                <div class="kws-location-info">
                    <div class="label">📍 LOCATION DETECTED</div>
                    <div class="coords">N ${lat.toFixed(6)}° E ${lng.toFixed(6)}°</div>
                </div>
                <div class="kws-map-controls">
                    <button onclick="KWorkspacePanel.zoomIn()">+</button>
                    <button onclick="KWorkspacePanel.zoomOut()">−</button>
                </div>
            `;

            // Load Leaflet if needed
            if (typeof L === 'undefined') {
                await this.loadLeaflet();
            }

            setTimeout(() => {
                this.map = L.map('kws-map-container').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(this.map);

                L.marker([lat, lng]).addTo(this.map)
                    .bindPopup(`📍 ${label}`)
                    .openPopup();

                this.updateInfo(`Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                this.updateStatus(`Showing: ${label}`);
            }, 100);
        }

        async showCurrentLocation() {
            this.updateStatus('Getting location...');

            if (window.kelionLocation) {
                const lat = window.kelionLocation.lat || window.kelionLocation.latitude;
                const lon = window.kelionLocation.lon || window.kelionLocation.longitude;
                console.log('📍 Using cached GPS:', lat, lon);
                this.showLocation(lat, lon, 'Your Location');
            } else {
                console.warn('📍 GPS cache not available');
                this.updateStatus('Location not available (GPS pre-fetch not completed)');
            }
        }

        zoomIn() {
            if (this.map) this.map.zoomIn();
        }

        zoomOut() {
            if (this.map) this.map.zoomOut();
        }

        // === K SHOWS IMAGE ===
        showImage(url, title = '') {
            this.open();
            this.setType('image');
            this.currentType = 'image';
            this.currentData = { url, title };

            const content = document.getElementById('kws-content');
            content.innerHTML = `
                <div class="kws-image-display">
                    <img src="${url}" alt="${title}">
                </div>
            `;
            this.updateInfo(`Image: ${title || 'Generated'}`);
            this.updateStatus(`Displaying image`);
        }

        // === K SHOWS TEXT ===
        showText(text, title = '', isCode = false) {
            this.open();
            this.setType(isCode ? 'code' : 'text');
            this.currentType = isCode ? 'code' : 'text';
            this.currentData = { text, title };

            const content = document.getElementById('kws-content');
            const className = isCode ? 'kws-text-display kws-code-display' : 'kws-text-display';
            content.innerHTML = `<div class="${className}">${this.escapeHtml(text)}</div>`;
            this.updateInfo(`${isCode ? 'Code' : 'Text'}: ${title || 'Document'}`);
            this.updateStatus(`Displaying ${isCode ? 'code' : 'text'}`);
        }

        // === FOLDER BROWSER ===
        showFolder() {
            this.open();
            this.setType('folder');
            this.currentType = 'folder';

            const content = document.getElementById('kws-content');
            content.innerHTML = `
                <div class="kws-folder-browser">
                    <div class="folder-header">
                        <h3>📁 File Browser</h3>
                        <p>Select files from your computer</p>
                    </div>
                    <div class="folder-actions">
                        <button onclick="KWorkspacePanel.selectFiles()">📂 Select Files</button>
                        <button onclick="KWorkspacePanel.selectFolder()">📁 Select Folder</button>
                    </div>
                    <div class="folder-list" id="folder-list">
                        <p class="empty">No files selected. Click a button above to browse.</p>
                    </div>
                </div>
            `;
            this.updateStatus('File browser ready');
        }

        selectFiles() {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = (e) => this.displayFiles(Array.from(e.target.files));
            input.click();
        }

        selectFolder() {
            const input = document.createElement('input');
            input.type = 'file';
            input.webkitdirectory = true;
            input.onchange = (e) => this.displayFiles(Array.from(e.target.files));
            input.click();
        }

        displayFiles(files) {
            const list = document.getElementById('folder-list');
            if (!list || files.length === 0) return;

            list.innerHTML = files.map(f => `
                <div class="file-item" onclick="KWorkspacePanel.previewFile('${f.name}', '${f.type}')">
                    <span class="file-icon">${this.getFileIcon(f.name)}</span>
                    <span class="file-name">${f.name}</span>
                    <span class="file-size">${this.formatSize(f.size)}</span>
                </div>
            `).join('');
            this.selectedFiles = files;
            this.updateStatus(`${files.length} files loaded`);
        }

        getFileIcon(name) {
            const ext = name.split('.').pop().toLowerCase();
            const icons = {
                'pdf': '📄', 'doc': '📃', 'docx': '📃', 'xls': '📊', 'xlsx': '📊',
                'ppt': '📽️', 'pptx': '📽️', 'txt': '📝', 'jpg': '🖼️', 'png': '🖼️',
                'gif': '🖼️', 'mp4': '🎬', 'mp3': '🎵', 'zip': '📦', 'rar': '📦'
            };
            return icons[ext] || '📄';
        }

        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }

        // === CAMERA / SCANARE ===
        showCamera() {
            this.open();
            this.setType('camera');
            this.currentType = 'camera';

            const content = document.getElementById('kws-content');
            content.innerHTML = `
                <div class="kws-camera-view">
                    <video id="kws-camera-video" autoplay playsinline></video>
                    <div class="camera-controls">
                        <select id="camera-select" onchange="KWorkspacePanel.switchCamera()">
                            <option value="">Loading cameras...</option>
                        </select>
                        <button onclick="KWorkspacePanel.capturePhoto()">📸 Capture</button>
                    </div>
                    <div id="camera-preview"></div>
                </div>
            `;
            this.startCamera();
        }

        async startCamera(deviceId = null) {
            try {
                const constraints = {
                    video: deviceId ? { deviceId: { exact: deviceId } } : true
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                const video = document.getElementById('kws-camera-video');
                if (video) video.srcObject = stream;
                this.cameraStream = stream;

                // Populate camera list
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter(d => d.kind === 'videoinput');
                const select = document.getElementById('camera-select');
                if (select) {
                    select.innerHTML = cameras.map(c =>
                        `<option value="${c.deviceId}">${c.label || 'Camera ' + (cameras.indexOf(c) + 1)}</option>`
                    ).join('');
                }
                this.updateStatus('Camera ready');
            } catch (e) {
                console.error('Camera error:', e);
                this.updateStatus('Camera access denied');
            }
        }

        switchCamera() {
            const select = document.getElementById('camera-select');
            if (select && select.value) {
                if (this.cameraStream) {
                    this.cameraStream.getTracks().forEach(t => t.stop());
                }
                this.startCamera(select.value);
            }
        }

        capturePhoto() {
            const video = document.getElementById('kws-camera-video');
            if (!video) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const preview = document.getElementById('camera-preview');
            if (preview) {
                preview.innerHTML = `<img src="${dataUrl}" alt="Captured"><button onclick="KWorkspacePanel.saveCapture('${dataUrl}')">💾 Save</button>`;
            }
            this.updateStatus('Photo captured');
        }

        saveCapture(dataUrl) {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'capture_' + Date.now() + '.jpg';
            a.click();
            this.updateStatus('Photo saved');
        }

        // === CODE LEARNING ===
        showCodeView() {
            this.open();
            this.setType('code');
            this.currentType = 'code';

            const content = document.getElementById('kws-content');
            content.innerHTML = `
                <div class="kws-code-hub">
                    <h3>💻 Code Learning Hub</h3>
                    <div class="code-categories">
                        <div class="code-category" onclick="KWorkspacePanel.loadCodeTutorial('html')">
                            <span class="icon">🌐</span>HTML
                        </div>
                        <div class="code-category" onclick="KWorkspacePanel.loadCodeTutorial('css')">
                            <span class="icon">🎨</span>CSS
                        </div>
                        <div class="code-category" onclick="KWorkspacePanel.loadCodeTutorial('javascript')">
                            <span class="icon">⚡</span>JavaScript
                        </div>
                        <div class="code-category" onclick="KWorkspacePanel.loadCodeTutorial('python')">
                            <span class="icon">🐍</span>Python
                        </div>
                    </div>
                    <div id="code-tutorial-content"></div>
                </div>
            `;
            this.updateStatus('Code tutorials ready');
        }

        loadCodeTutorial(lang) {
            const tutorials = {
                html: '<h4>HTML Basics</h4><pre>&lt;html&gt;\n  &lt;head&gt;&lt;title&gt;My Page&lt;/title&gt;&lt;/head&gt;\n  &lt;body&gt;\n    &lt;h1&gt;Hello World&lt;/h1&gt;\n  &lt;/body&gt;\n&lt;/html&gt;</pre>',
                css: '<h4>CSS Basics</h4><pre>body {\n  background: #000;\n  color: #fff;\n}\nh1 {\n  color: #00ffff;\n}</pre>',
                javascript: '<h4>JavaScript Basics</h4><pre>function sayHello(name) {\n  console.log("Hello, " + name);\n}\nsayHello("World");</pre>',
                python: '<h4>Python Basics</h4><pre>def say_hello(name):\n    print(f"Hello, {name}")\n\nsay_hello("World")</pre>'
            };
            const container = document.getElementById('code-tutorial-content');
            if (container) container.innerHTML = tutorials[lang] || '';
        }

        // === TOOLBAR ACTIONS ===
        upload() {
            document.getElementById('kws-file-input').click();
        }

        handleUpload(e) {
            const file = e.target.files[0];
            if (!file) return;
            // Handle file based on type
            const ext = file.name.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                const url = URL.createObjectURL(file);
                this.showImage(url, file.name);
            } else if (['txt', 'md', 'json', 'js', 'py', 'html', 'css'].includes(ext)) {
                file.text().then(text => {
                    const isCode = ['js', 'py', 'json', 'html', 'css'].includes(ext);
                    this.showText(text, file.name, isCode);
                });
            }
        }

        download() {
            if (!this.currentData) return;

            if (this.currentType === 'image' && this.currentData.url) {
                const a = document.createElement('a');
                a.href = this.currentData.url;
                a.download = this.currentData.title || 'image.png';
                a.click();
            } else if (this.currentData.text) {
                const blob = new Blob([this.currentData.text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = this.currentData.title || 'document.txt';
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        copy() {
            if (!this.currentData) return;

            let textToCopy = '';
            if (this.currentData.text) {
                textToCopy = this.currentData.text;
            } else if (this.currentData.url) {
                textToCopy = this.currentData.url;
            } else if (this.currentData.lat) {
                textToCopy = `${this.currentData.lat}, ${this.currentData.lng}`;
            }

            navigator.clipboard.writeText(textToCopy).then(() => {
                this.updateStatus('Copied to clipboard!');
            });
        }

        download() {
            if (!this.currentData) {
                this.updateStatus('Nothing to download');
                return;
            }

            const a = document.createElement('a');
            let filename = 'kelion_';

            if (this.currentType === 'image' && this.currentData.url) {
                // Download image
                a.href = this.currentData.url;
                filename += (this.currentData.title || 'image') + '.png';
            } else if (this.currentType === 'text' || this.currentType === 'code') {
                // Download text/code as .txt file
                const blob = new Blob([this.currentData.text], { type: 'text/plain' });
                a.href = URL.createObjectURL(blob);
                filename += (this.currentData.title || 'document') + (this.currentType === 'code' ? '.txt' : '.txt');
            } else if (this.currentType === 'map') {
                // Download map coordinates as JSON
                const mapData = JSON.stringify(this.currentData, null, 2);
                const blob = new Blob([mapData], { type: 'application/json' });
                a.href = URL.createObjectURL(blob);
                filename += 'location.json';
            } else {
                this.updateStatus('Cannot download this type');
                return;
            }

            a.download = filename;
            a.click();
            this.updateStatus(`Downloaded: ${filename}`);
        }

        fullscreen() {
            const panel = document.getElementById('k-workspace-panel');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                panel.requestFullscreen();
            }
        }

        // === HELPERS ===
        setType(type) {
            document.querySelectorAll('.kws-sidebar-item').forEach(item => {
                item.classList.toggle('active', item.dataset.type === type);
            });
        }

        updateStatus(msg) {
            const el = document.getElementById('kws-k-status');
            if (el) el.textContent = msg;
        }

        updateInfo(msg) {
            const el = document.getElementById('kws-info');
            if (el) el.textContent = msg;
        }

        escapeHtml(str) {
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        async loadLeaflet() {
            return new Promise(resolve => {
                const css = document.createElement('link');
                css.rel = 'stylesheet';
                css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(css);

                const js = document.createElement('script');
                js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                js.onload = resolve;
                document.head.appendChild(js);
            });
        }

        // Static methods for onclick handlers
        static onKClick() {
            if (window.speak) window.speak('Sunt aici, activ!');
        }
        static close() { window.KWorkspacePanel.close(); }
        static upload() { window.KWorkspacePanel.upload(); }
        static download() { window.KWorkspacePanel.download(); }
        static copy() { window.KWorkspacePanel.copy(); }
        static fullscreen() { window.KWorkspacePanel.fullscreen(); }
        static setType(t) { window.KWorkspacePanel.setType(t); }
        static zoomIn() { window.KWorkspacePanel.zoomIn(); }
        static zoomOut() { window.KWorkspacePanel.zoomOut(); }
        static handleUpload(e) { window.KWorkspacePanel.handleUpload(e); }
        static showFolder() { window.KWorkspacePanel.showFolder(); }
        static showCamera() { window.KWorkspacePanel.showCamera(); }
        static selectFiles() { window.KWorkspacePanel.selectFiles(); }
        static selectFolder() { window.KWorkspacePanel.selectFolder(); }
        static switchCamera() { window.KWorkspacePanel.switchCamera(); }
        static capturePhoto() { window.KWorkspacePanel.capturePhoto(); }
        static saveCapture(url) { window.KWorkspacePanel.saveCapture(url); }
        static showCodeView() { window.KWorkspacePanel.showCodeView(); }
        static loadCodeTutorial(lang) { window.KWorkspacePanel.loadCodeTutorial(lang); }
        static toggleCompact() { window.KWorkspacePanel.toggleCompact(); }
        // Missing methods that were causing errors
        static open() { window.KWorkspacePanel.open(); }
        static showText(text, title, isCode) { window.KWorkspacePanel.showText(text, title, isCode); }
        static showImage(url, title) { window.KWorkspacePanel.showImage(url, title); }
        static showLocation(lat, lng, label) { window.KWorkspacePanel.showLocation(lat, lng, label); }
        static showCurrentLocation() { window.KWorkspacePanel.showCurrentLocation(); }
        static showWeatherMap(lat, lng) { window.KWorkspacePanel.showWeatherMap ? window.KWorkspacePanel.showWeatherMap(lat, lng) : window.KWorkspacePanel.showLocation(lat, lng, 'Weather'); }
    }

    // Initialize
    window.KWorkspacePanel = new KWorkspacePanel();

    // Also expose as kWorkspace for compatibility
    window.kWorkspace = window.KWorkspacePanel;

    console.log('🖥️ K Workspace Panel initialized');
})();
