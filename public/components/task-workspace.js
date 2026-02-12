/**
 * K Universal Workspace - ENHANCED VERSION
 * 
 * Features:
 * - 🖼️ IMAGE: AI-generated images via DALL-E
 * - 📝 TEXT: Word, Excel, PDF, PowerPoint viewer
 * - 💻 CODE: Python editor with online execution
 * - 📍 MAP: Google Maps with routing (driving/walking)
 * - 📁 FOLDER: ZIP archive manager
 */

(function () {
    'use strict';

    class KWorkspace {
        constructor() {
            this.isOpen = false;
            this.currentContent = null;
            this.currentType = null;
            this.map = null;
            this.pythonCode = '';

            this.init();
        }

        init() {
            this.createUI();
            this.bindEvents();
            console.log('🌐 K Universal Workspace ENHANCED initialized');
        }

        createUI() {
            if (document.getElementById('k-workspace')) return;

            const workspace = document.createElement('div');
            workspace.id = 'k-workspace';
            workspace.innerHTML = `
                <style>
                    /* === K UNIVERSAL WORKSPACE === */
                    #k-workspace {
                        display: none;
                        position: fixed;
                        inset: 0;
                        background: linear-gradient(135deg, #0a1525 0%, #0d1a2d 50%, #101f35 100%);
                        z-index: 10000;
                        flex-direction: column;
                        font-family: 'Segoe UI', system-ui, sans-serif;
                    }
                    #k-workspace.open { display: flex; animation: wsOpen 0.4s ease; }
                    @keyframes wsOpen {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    
                    /* K Minimized Avatar - Top Left */
                    .k-avatar-mini {
                        position: absolute;
                        top: 15px;
                        left: 15px;
                        width: 70px;
                        height: 85px;
                        background: linear-gradient(180deg, rgba(20,60,100,0.9) 0%, rgba(10,30,60,0.95) 100%);
                        border: 2px solid rgba(0, 212, 255, 0.6);
                        border-radius: 12px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 0 25px rgba(0, 212, 255, 0.4);
                        z-index: 10001;
                        cursor: pointer;
                    }
                    .k-avatar-mini:hover { box-shadow: 0 0 40px rgba(0, 212, 255, 0.7); }
                    .k-avatar-mini .k-icon { font-size: 32px; margin-bottom: 4px; }
                    .k-avatar-mini .k-label { font-size: 10px; color: rgba(255,255,255,0.7); text-transform: uppercase; }
                    
                    /* Toolbar - Top */
                    .ws-toolbar {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 15px;
                        padding: 12px 20px;
                        padding-left: 100px;
                        background: linear-gradient(180deg, rgba(15,35,60,0.95) 0%, rgba(10,25,45,0.95) 100%);
                        border-bottom: 2px solid rgba(212, 175, 55, 0.4);
                    }
                    .ws-toolbar button {
                        padding: 10px 24px;
                        background: linear-gradient(180deg, rgba(30,50,80,0.9) 0%, rgba(20,35,60,0.9) 100%);
                        border: 1px solid rgba(212, 175, 55, 0.5);
                        border-radius: 20px;
                        color: #d4af37;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                    }
                    .ws-toolbar button:hover {
                        background: linear-gradient(180deg, rgba(50,80,120,0.9) 0%, rgba(35,60,95,0.9) 100%);
                        transform: translateY(-2px);
                        box-shadow: 0 5px 20px rgba(212, 175, 55, 0.3);
                    }
                    .ws-toolbar button.back-btn {
                        margin-left: auto;
                        background: linear-gradient(180deg, rgba(100,50,50,0.9) 0%, rgba(70,30,30,0.9) 100%);
                        border-color: rgba(255,100,100,0.5);
                        color: #ff9999;
                    }
                    
                    /* Main Container */
                    .ws-main { display: flex; flex: 1; overflow: hidden; }
                    
                    /* Sidebar - Left */
                    .ws-sidebar {
                        width: 100px;
                        background: linear-gradient(180deg, rgba(15,30,55,0.95) 0%, rgba(10,20,40,0.95) 100%);
                        border-right: 2px solid rgba(212, 175, 55, 0.3);
                        padding-top: 100px;
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    .ws-sidebar-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 15px 10px;
                        color: rgba(255,255,255,0.5);
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
                    .ws-sidebar-item .icon { font-size: 28px; margin-bottom: 6px; }
                    
                    /* Content Area */
                    .ws-content {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                        padding: 20px;
                    }
                    .ws-content-inner {
                        flex: 1;
                        background: rgba(10,20,40,0.6);
                        border: 1px solid rgba(0, 212, 255, 0.3);
                        border-radius: 15px;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    /* Type-specific panels */
                    .ws-panel { display: none; flex: 1; flex-direction: column; overflow: hidden; }
                    .ws-panel.active { display: flex; }
                    
                    /* IMAGE Panel - AI Generator */
                    .ws-image-panel {
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                    }
                    .ws-image-prompt {
                        display: flex;
                        gap: 10px;
                    }
                    .ws-image-prompt input {
                        flex: 1;
                        padding: 15px 20px;
                        background: rgba(0,0,0,0.3);
                        border: 1px solid rgba(212,175,55,0.4);
                        border-radius: 25px;
                        color: #fff;
                        font-size: 16px;
                    }
                    .ws-image-prompt button {
                        padding: 15px 30px;
                        background: linear-gradient(135deg, #d4af37, #c4a030);
                        border: none;
                        border-radius: 25px;
                        color: #000;
                        font-weight: bold;
                        cursor: pointer;
                    }
                    .ws-image-result {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: auto;
                    }
                    .ws-image-result img {
                        max-width: 90%;
                        max-height: 100%;
                        border-radius: 15px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    }
                    
                    /* TEXT Panel - Document Viewer */
                    .ws-text-panel {
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .ws-doc-types {
                        display: flex;
                        gap: 10px;
                        flex-wrap: wrap;
                    }
                    .ws-doc-types button {
                        padding: 10px 20px;
                        background: rgba(30,50,80,0.8);
                        border: 1px solid rgba(0,212,255,0.4);
                        border-radius: 10px;
                        color: #00d4ff;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .ws-doc-types button:hover { background: rgba(50,80,120,0.8); }
                    .ws-doc-viewer {
                        flex: 1;
                        background: #fff;
                        border-radius: 10px;
                        overflow: hidden;
                    }
                    .ws-doc-viewer iframe { width: 100%; height: 100%; border: none; }
                    
                    /* CODE Panel - Python Editor */
                    .ws-code-panel {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                    }
                    .ws-code-toolbar {
                        display: flex;
                        gap: 10px;
                        padding: 10px 15px;
                        background: rgba(20,30,50,0.9);
                        border-bottom: 1px solid rgba(0,212,255,0.3);
                    }
                    .ws-code-toolbar button {
                        padding: 8px 20px;
                        background: rgba(0,150,0,0.3);
                        border: 1px solid #00ff00;
                        border-radius: 8px;
                        color: #00ff00;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    .ws-code-toolbar button.run { background: rgba(0,200,0,0.3); }
                    .ws-code-toolbar button.download { background: rgba(0,150,255,0.3); border-color: #00bfff; color: #00bfff; }
                    .ws-code-editor {
                        flex: 1;
                        display: flex;
                        gap: 0;
                    }
                    .ws-code-input {
                        flex: 1;
                        background: #1e1e1e;
                        color: #e0e0e0;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 14px;
                        padding: 15px;
                        border: none;
                        resize: none;
                        line-height: 1.5;
                    }
                    .ws-code-output {
                        width: 40%;
                        background: #0d1117;
                        color: #00ff00;
                        font-family: monospace;
                        padding: 15px;
                        overflow: auto;
                        border-left: 2px solid rgba(0,255,0,0.3);
                    }
                    .ws-code-output .error { color: #ff6b6b; }
                    
                    /* MAP Panel - Google Maps */
                    .ws-map-panel {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                    }
                    .ws-map-controls {
                        display: flex;
                        gap: 10px;
                        padding: 15px;
                        background: rgba(20,30,50,0.9);
                        border-bottom: 1px solid rgba(0,212,255,0.3);
                        flex-wrap: wrap;
                    }
                    .ws-map-controls input {
                        flex: 1;
                        min-width: 200px;
                        padding: 12px 15px;
                        background: rgba(0,0,0,0.3);
                        border: 1px solid rgba(0,212,255,0.4);
                        border-radius: 8px;
                        color: #fff;
                    }
                    .ws-map-controls button {
                        padding: 12px 20px;
                        background: linear-gradient(135deg, #4285f4, #3367d6);
                        border: none;
                        border-radius: 8px;
                        color: #fff;
                        cursor: pointer;
                        font-weight: bold;
                    }
                    .ws-map-controls .mode-btns {
                        display: flex;
                        gap: 5px;
                    }
                    .ws-map-controls .mode-btn {
                        padding: 10px 15px;
                        background: rgba(50,50,50,0.8);
                        border: 1px solid #666;
                        border-radius: 5px;
                        color: #ccc;
                        cursor: pointer;
                    }
                    .ws-map-controls .mode-btn.active { background: #4285f4; color: #fff; border-color: #4285f4; }
                    .ws-map-container {
                        flex: 1;
                        position: relative;
                    }
                    .ws-map-container iframe { width: 100%; height: 100%; border: none; }
                    
                    /* FOLDER Panel - ZIP Manager */
                    .ws-folder-panel {
                        padding: 20px;
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .ws-folder-actions {
                        display: flex;
                        gap: 10px;
                    }
                    .ws-folder-actions button {
                        padding: 12px 25px;
                        background: rgba(30,50,80,0.8);
                        border: 1px solid rgba(212,175,55,0.5);
                        border-radius: 10px;
                        color: #d4af37;
                        cursor: pointer;
                    }
                    .ws-file-list {
                        flex: 1;
                        background: rgba(0,0,0,0.3);
                        border-radius: 10px;
                        overflow: auto;
                    }
                    .ws-file-item {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        padding: 15px 20px;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                        cursor: pointer;
                    }
                    .ws-file-item:hover { background: rgba(0,212,255,0.1); }
                    .ws-file-item .icon { font-size: 24px; }
                    .ws-file-item .name { flex: 1; color: #fff; }
                    .ws-file-item .size { color: #888; font-size: 12px; }
                    
                    /* Status Bar */
                    .ws-statusbar {
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        padding: 10px 20px;
                        background: rgba(10,20,40,0.95);
                        border-top: 1px solid rgba(0, 212, 255, 0.3);
                        font-size: 12px;
                        color: rgba(255,255,255,0.6);
                    }
                    .ws-statusbar .k-status { display: flex; align-items: center; gap: 8px; color: #00d4ff; }
                    .ws-statusbar .k-status .dot {
                        width: 10px; height: 10px; background: #00ff88;
                        border-radius: 50%; animation: pulse 1.5s infinite;
                    }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                    .ws-statusbar .file-info { flex: 1; }
                    
                    #ws-file-input { display: none; }
                </style>
                
                <!-- K Minimized Avatar -->
                <div class="k-avatar-mini" onclick="kWorkspace.onKClick()" title="K is active">
                    <span class="k-icon">🤖</span>
                    <span class="k-label">K Active</span>
                </div>
                
                <!-- Toolbar -->
                <div class="ws-toolbar">
                    <button onclick="kWorkspace.upload()"><span>📤</span> Upload</button>
                    <button onclick="kWorkspace.download()"><span>📥</span> Download</button>
                    <button onclick="kWorkspace.copy()"><span>📋</span> Copy</button>
                    <button onclick="kWorkspace.toggleFullscreen()"><span>⛶</span> Fullscreen</button>
                    <button class="back-btn" onclick="kWorkspace.close()"><span>←</span> Back</button>
                </div>
                
                <!-- Main Area -->
                <div class="ws-main">
                    <!-- Sidebar -->
                    <div class="ws-sidebar">
                        <div class="ws-sidebar-item" data-type="image" onclick="kWorkspace.setType('image')">
                            <span class="icon">🖼️</span>
                            AI IMAGE
                        </div>
                        <div class="ws-sidebar-item" data-type="text" onclick="kWorkspace.setType('text')">
                            <span class="icon">📝</span>
                            DOCS
                        </div>
                        <div class="ws-sidebar-item" data-type="code" onclick="kWorkspace.setType('code')">
                            <span class="icon">💻</span>
                            PYTHON
                        </div>
                        <div class="ws-sidebar-item" data-type="map" onclick="kWorkspace.setType('map')">
                            <span class="icon">📍</span>
                            MAPS
                        </div>
                        <div class="ws-sidebar-item" data-type="folder" onclick="kWorkspace.setType('folder')">
                            <span class="icon">📁</span>
                            ZIP
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div class="ws-content">
                        <div class="ws-content-inner" id="ws-content">
                            
                            <!-- IMAGE Panel -->
                            <div class="ws-panel ws-image-panel" id="panel-image">
                                <div class="ws-image-prompt">
                                    <input type="text" id="ai-image-prompt" placeholder="Describe the image you want AI to create...">
                                    <button onclick="kWorkspace.generateImage()">🎨 Generate</button>
                                </div>
                                <div class="ws-image-result" id="ai-image-result">
                                    <p style="color:#888;">Enter a description and click Generate to create an AI image</p>
                                </div>
                            </div>
                            
                            <!-- TEXT/DOCS Panel -->
                            <div class="ws-panel ws-text-panel" id="panel-text">
                                <div class="ws-doc-types">
                                    <button onclick="kWorkspace.uploadDoc('pdf')">📕 PDF</button>
                                    <button onclick="kWorkspace.uploadDoc('word')">📘 Word</button>
                                    <button onclick="kWorkspace.uploadDoc('excel')">📗 Excel</button>
                                    <button onclick="kWorkspace.uploadDoc('video')">🎬 Video</button>
                                    <button onclick="kWorkspace.uploadDoc('txt')">📄 Text</button>
                                </div>
                                <div class="ws-doc-viewer" id="doc-viewer">
                                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;">
                                        <p>Select a document type above or drag & drop a file</p>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- CODE Panel -->
                            <div class="ws-panel ws-code-panel" id="panel-code">
                                <div class="ws-code-toolbar">
                                    <button class="run" onclick="kWorkspace.runPython()">▶️ Run Python</button>
                                    <button class="download" onclick="kWorkspace.downloadCode()">💾 Download .py</button>
                                    <span style="flex:1;"></span>
                                    <span style="color:#888;">Python 3.x Online Compiler</span>
                                </div>
                                <div class="ws-code-editor">
                                    <textarea class="ws-code-input" id="python-code" placeholder="# Write your Python code here...
print('Hello from K!')

# Example:
for i in range(5):
    print(f'Count: {i}')"># Python Code Editor
print("Hello from K Workspace!")

# Your code here:
name = input("Enter your name: ")
print(f"Welcome, {name}!")</textarea>
                                    <div class="ws-code-output" id="python-output">
                                        <div style="color:#888;">Output will appear here after running...</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- MAP Panel -->
                            <div class="ws-panel ws-map-panel" id="panel-map">
                                <div class="ws-map-controls">
                                    <input type="text" id="map-from" placeholder="📍 From (or use My Location)">
                                    <input type="text" id="map-to" placeholder="🎯 To (destination)">
                                    <div class="mode-btns">
                                        <button class="mode-btn active" data-mode="driving" onclick="kWorkspace.setMapMode('driving')">🚗 Drive</button>
                                        <button class="mode-btn" data-mode="walking" onclick="kWorkspace.setMapMode('walking')">🚶 Walk</button>
                                        <button class="mode-btn" data-mode="transit" onclick="kWorkspace.setMapMode('transit')">🚌 Transit</button>
                                    </div>
                                    <button onclick="kWorkspace.getRoute()">🗺️ Get Route</button>
                                    <button onclick="kWorkspace.useMyLocation()">📍 My Location</button>
                                </div>
                                <div class="ws-map-container" id="map-container">
                                    <iframe id="google-map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2848.8444388487844!2d26.1025!3d44.4268!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDTCsDI1JzM2LjUiTiAyNsKwMDYnMDkuMCJF!5e0!3m2!1sen!2sro!4v1600000000000!5m2!1sen!2sro" allowfullscreen loading="lazy"></iframe>
                                </div>
                            </div>
                            
                            <!-- FOLDER Panel -->
                            <div class="ws-panel ws-folder-panel" id="panel-folder">
                                <div class="ws-folder-actions">
                                    <button onclick="kWorkspace.uploadZip()">📤 Upload ZIP</button>
                                    <button onclick="kWorkspace.createZip()">📦 Create ZIP</button>
                                    <button onclick="kWorkspace.extractZip()">📂 Extract All</button>
                                </div>
                                <div class="ws-file-list" id="zip-file-list">
                                    <div class="ws-file-item">
                                        <span class="icon">📁</span>
                                        <span class="name">Drop a ZIP file here or click Upload ZIP</span>
                                        <span class="size"></span>
                                    </div>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
                
                <!-- Status Bar -->
                <div class="ws-statusbar">
                    <div class="k-status">
                        <div class="dot"></div>
                        <span id="ws-status">K is ready.</span>
                    </div>
                    <div class="file-info" id="ws-file-info">Ready | Select a tool from the sidebar</div>
                </div>
                
                <input type="file" id="ws-file-input" multiple onchange="kWorkspace.handleFile(event)">
                <input type="file" id="ws-doc-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md" onchange="kWorkspace.handleDocUpload(event)">
                <input type="file" id="ws-zip-input" accept=".zip" onchange="kWorkspace.handleZipUpload(event)">
            `;

            document.body.appendChild(workspace);
        }

        bindEvents() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'K') {
                    e.preventDefault();
                    this.toggle();
                }
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }

        // === LIFECYCLE ===
        open() {
            const ws = document.getElementById('k-workspace');
            if (ws) {
                ws.classList.add('open');
                this.isOpen = true;
                this.hideMainK();
                console.log('🌐 Workspace opened');
            }
        }

        close() {
            const ws = document.getElementById('k-workspace');
            if (ws) {
                ws.classList.remove('open');
                this.isOpen = false;
                this.showMainK();
                console.log('🌐 Workspace closed');
            }
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        hideMainK() {
            const container = document.getElementById('hologram-container') || document.getElementById('container');
            if (container) {
                container.style.opacity = '0';
                container.style.pointerEvents = 'none';
            }
        }

        showMainK() {
            const container = document.getElementById('hologram-container') || document.getElementById('container');
            if (container) {
                container.style.opacity = '1';
                container.style.pointerEvents = 'auto';
            }
        }

        onKClick() {
            if (window.speak) {
                window.speak('Sunt aici și te ajut! Alege o unealtă din stânga.');
            }
        }

        setType(type) {
            // Update sidebar
            document.querySelectorAll('.ws-sidebar-item').forEach(item => {
                item.classList.toggle('active', item.dataset.type === type);
            });

            // Show correct panel
            document.querySelectorAll('.ws-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            const panel = document.getElementById(`panel-${type}`);
            if (panel) panel.classList.add('active');

            this.currentType = type;
            this.updateStatus(`Mode: ${type.toUpperCase()}`);
        }

        updateStatus(msg) {
            const status = document.getElementById('ws-status');
            if (status) status.textContent = msg;
        }

        updateFileInfo(msg) {
            const info = document.getElementById('ws-file-info');
            if (info) info.textContent = msg;
        }

        // === IMAGE - AI Generation ===
        async generateImage() {
            const prompt = document.getElementById('ai-image-prompt').value.trim();
            if (!prompt) {
                this.updateStatus('Please enter an image description');
                return;
            }

            const result = document.getElementById('ai-image-result');
            result.innerHTML = '<div style="color:#d4af37;font-size:20px;">🎨 Generating image...</div>';
            this.updateStatus('AI is creating your image...');

            try {
                const response = await fetch('/.netlify/functions/dalle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                const data = await response.json();

                if (data.success && data.imageUrl) {
                    result.innerHTML = `<img src="${data.imageUrl}" alt="${prompt}" onclick="window.open('${data.imageUrl}', '_blank')">`;
                    this.currentContent = { type: 'image', url: data.imageUrl, prompt };
                    this.updateStatus('Image generated successfully!');
                    this.updateFileInfo(`AI Image | Prompt: ${prompt.substring(0, 50)}...`);
                } else {
                    result.innerHTML = `<p style="color:#ff6b6b;">Error: ${this.escapeHtml(data.error || 'Failed to generate')}</p>`;
                }
            } catch (error) {
                result.innerHTML = `<p style="color:#ff6b6b;">Error: ${this.escapeHtml(error.message)}</p>`;
            }
        }

        // === DOCS - Document Viewer ===
        uploadDoc(type) {
            // Special case: USB Camera/Microscop
            if (type === 'camera' || type === 'microscop') {
                this.openUSBCamera();
                return;
            }

            const input = document.getElementById('ws-doc-input');
            const acceptMap = {
                pdf: '.pdf',
                word: '.doc,.docx',
                excel: '.xls,.xlsx',
                video: '.mp4,.webm,.mov,.avi',
                txt: '.txt,.md'
            };
            input.accept = acceptMap[type] || '*';
            input.click();
        }

        handleDocUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const viewer = document.getElementById('doc-viewer');
            const ext = file.name.split('.').pop().toLowerCase();
            const self = this;

            // For PDF - use direct embed
            if (ext === 'pdf') {
                const url = URL.createObjectURL(file);
                viewer.innerHTML = `<iframe src="${url}#view=FitH"></iframe>`;
            }
            // For Word files - use Mammoth.js
            else if (['doc', 'docx'].includes(ext)) {
                viewer.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">📄 Se încarcă documentul Word...</div>';
                const reader = new FileReader();
                reader.onload = async function (e) {
                    try {
                        if (typeof mammoth !== 'undefined') {
                            const result = await mammoth.convertToHtml({ arrayBuffer: e.target.result });
                            viewer.innerHTML = `<div style="padding:20px;background:#fff;color:#333;height:100%;overflow:auto;">${result.value}</div>`;
                            self.updateStatus('Word document loaded successfully!');
                        } else {
                            viewer.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b;">❌ Mammoth.js not loaded</div>';
                        }
                    } catch (err) {
                        viewer.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;">❌ Error: ${self.escapeHtml(err.message)}</div>`;
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // For Excel files - use SheetJS
            else if (['xls', 'xlsx'].includes(ext)) {
                viewer.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">📊 Se încarcă fișierul Excel...</div>';
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        if (typeof XLSX !== 'undefined') {
                            const workbook = XLSX.read(e.target.result, { type: 'array' });
                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                            const html = XLSX.utils.sheet_to_html(firstSheet);
                            viewer.innerHTML = `<div style="padding:10px;background:#fff;color:#333;height:100%;overflow:auto;">${html}</div>`;
                            // Style the table
                            const table = viewer.querySelector('table');
                            if (table) {
                                table.style.cssText = 'border-collapse:collapse;width:100%;';
                                table.querySelectorAll('td,th').forEach(cell => {
                                    cell.style.cssText = 'border:1px solid #ddd;padding:8px;';
                                });
                            }
                            self.updateStatus('Excel file loaded successfully!');
                        } else {
                            viewer.innerHTML = '<div style="padding:40px;text-align:center;color:#ff6b6b;">❌ SheetJS not loaded</div>';
                        }
                    } catch (err) {
                        viewer.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;">❌ Error: ${self.escapeHtml(err.message)}</div>`;
                    }
                };
                reader.readAsArrayBuffer(file);
            }
            // For Video files - HTML5 video player
            else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
                const url = URL.createObjectURL(file);
                viewer.innerHTML = `
                    <div style="height:100%;display:flex;align-items:center;justify-content:center;background:#000;">
                        <video controls autoplay style="max-width:100%;max-height:100%;border-radius:10px;">
                            <source src="${url}" type="video/${ext === 'mov' ? 'quicktime' : ext}">
                            Your browser does not support video playback.
                        </video>
                    </div>
                `;
                this.updateStatus('Video loaded - playing...');
            }
            // For Image files (BMP, etc)
            else if (['bmp', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
                const url = URL.createObjectURL(file);
                viewer.innerHTML = `
                    <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:20px;">
                        <img src="${url}" style="max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 5px 30px rgba(0,0,0,0.3);">
                    </div>
                `;
                this.updateStatus('Image loaded');
            }
            // For text files
            else {
                const reader = new FileReader();
                reader.onload = (e) => {
                    viewer.innerHTML = `<pre style="padding:20px;margin:0;overflow:auto;height:100%;background:#fff;color:#333;">${this.escapeHtml(e.target.result)}</pre>`;
                };
                reader.readAsText(file);
            }

            this.updateFileInfo(`Document: ${file.name} | Size: ${this.formatSize(file.size)}`);
            this.updateStatus(`Loaded: ${file.name}`);
        }

        // === USB CAMERA / MICROSCOP ===
        async openUSBCamera() {
            const viewer = document.getElementById('doc-viewer');
            viewer.innerHTML = '<div style="padding:40px;text-align:center;color:#888;">📷 Se conectează la cameră/microscop...</div>';

            try {
                // Request camera access (works for USB cameras/microscopes too)
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    }
                });

                viewer.innerHTML = `
                    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#000;padding:20px;">
                        <video id="usb-camera-feed" autoplay playsinline style="max-width:100%;max-height:60%;border-radius:10px;border:2px solid #00d4ff;"></video>
                        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
                            <button onclick="kWorkspace.captureUSBImage()" style="padding:12px 25px;background:#00d4ff;border:none;border-radius:10px;color:#000;font-weight:bold;cursor:pointer;">
                                📸 Captură Imagine
                            </button>
                            <button onclick="kWorkspace.stopUSBCamera()" style="padding:12px 25px;background:#666;border:none;border-radius:10px;color:#fff;font-weight:bold;cursor:pointer;">
                                ⏹️ Stop
                            </button>
                        </div>
                        <canvas id="usb-capture-canvas" style="display:none;"></canvas>
                    </div>
                `;

                const video = document.getElementById('usb-camera-feed');
                video.srcObject = stream;
                this.usbStream = stream;
                this.updateStatus('📷 Camera/Microscop conectat - Apasă Captură pentru poză');
            } catch (error) {
                viewer.innerHTML = `<div style="padding:40px;text-align:center;color:#ff6b6b;">❌ Eroare cameră: ${this.escapeHtml(error.message)}<br><br>Verifică dacă microscopul USB este conectat.</div>`;
            }
        }

        captureUSBImage() {
            const video = document.getElementById('usb-camera-feed');
            const canvas = document.getElementById('usb-capture-canvas');
            if (!video || !canvas) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            // Show captured image
            const imageUrl = canvas.toDataURL('image/png');
            const viewer = document.getElementById('doc-viewer');
            viewer.innerHTML = `
                <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;">
                    <img src="${imageUrl}" style="max-width:100%;max-height:70%;border-radius:10px;box-shadow:0 5px 30px rgba(0,212,255,0.3);">
                    <div style="margin-top:20px;display:flex;gap:15px;">
                        <a href="${imageUrl}" download="microscop_capture_${Date.now()}.png" style="padding:15px 30px;background:#00ff88;border:none;border-radius:10px;color:#000;font-weight:bold;cursor:pointer;text-decoration:none;font-size:16px;">
                            💾 Salvează
                        </a>
                        <button onclick="kWorkspace.openUSBCamera()" style="padding:15px 30px;background:#00d4ff;border:none;border-radius:10px;color:#000;font-weight:bold;cursor:pointer;font-size:16px;">
                            📷 Altă Captură
                        </button>
                    </div>
                </div>
            `;
            this.stopUSBCamera();
            this.updateStatus('📸 Imagine capturată! Click Salvează pentru a descărca.');
        }

        stopUSBCamera() {
            if (this.usbStream) {
                this.usbStream.getTracks().forEach(track => track.stop());
                this.usbStream = null;
            }
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
        }

        // Video Recording from USB Camera/Microscop
        toggleVideoRecording() {
            const btn = document.getElementById('record-video-btn');

            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                // Stop recording
                this.mediaRecorder.stop();
                btn.innerHTML = '🎬 Record Video';
                btn.style.background = '#ff0066';
                this.updateStatus('⏹️ Recording stopped - processing...');
            } else {
                // Start recording
                if (!this.usbStream) {
                    this.updateStatus('❌ Conectează camera mai întâi!');
                    return;
                }

                this.recordedChunks = [];
                this.mediaRecorder = new MediaRecorder(this.usbStream, { mimeType: 'video/webm' });

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.recordedChunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const viewer = document.getElementById('doc-viewer');
                    viewer.innerHTML = `
                        <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;">
                            <video controls src="${url}" style="max-width:100%;max-height:60%;border-radius:10px;"></video>
                            <div style="margin-top:20px;display:flex;gap:15px;">
                                <a href="${url}" download="microscop_video_${Date.now()}.webm" style="padding:15px 30px;background:#00ff88;border:none;border-radius:10px;color:#000;font-weight:bold;cursor:pointer;text-decoration:none;">
                                    💾 Salvează Video
                                </a>
                                <button onclick="kWorkspace.openUSBCamera()" style="padding:15px 30px;background:#00d4ff;border:none;border-radius:10px;color:#000;font-weight:bold;cursor:pointer;">
                                    📷 Altă Înregistrare
                                </button>
                            </div>
                        </div>
                    `;
                    this.updateStatus('🎬 Video salvat! Click pentru a descărca.');
                };

                this.mediaRecorder.start();
                btn.innerHTML = '⏹️ Stop Recording';
                btn.style.background = '#ff0000';
                this.updateStatus('🔴 Recording... Apasă Stop când ești gata.');
            }
        }

        // === CODE - Python Editor ===
        async runPython() {
            const code = document.getElementById('python-code').value;
            const output = document.getElementById('python-output');

            output.innerHTML = '<div style="color:#888;">Running...</div>';
            this.updateStatus('Executing Python code...');

            try {
                // Use Piston API for code execution
                const response = await fetch('https://emkc.org/api/v2/piston/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        language: 'python',
                        version: '3.10',
                        files: [{ content: code }]
                    })
                });

                const data = await response.json();

                if (data.run) {
                    const out = data.run.output || 'No output';
                    const hasError = data.run.stderr && data.run.stderr.length > 0;
                    output.innerHTML = `<pre class="${hasError ? 'error' : ''}">${this.escapeHtml(out)}</pre>`;
                    this.updateStatus(hasError ? 'Execution completed with errors' : 'Execution successful!');
                } else {
                    output.innerHTML = '<div class="error">Failed to execute code</div>';
                }
            } catch (error) {
                output.innerHTML = `<div class="error">Error: ${this.escapeHtml(error.message)}</div>`;
            }
        }

        downloadCode() {
            const code = document.getElementById('python-code').value;
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'k_workspace_code.py';
            a.click();
            URL.revokeObjectURL(url);
            this.updateStatus('Code downloaded as k_workspace_code.py');
        }

        // === MAP - Google Maps ===
        mapMode = 'driving';
        _gmapsKey = null;

        async _loadMapsKey() {
            if (this._gmapsKey) return this._gmapsKey;
            try {
                const res = await fetch('/.netlify/functions/maps-config');
                if (res.ok) { const d = await res.json(); this._gmapsKey = d.key; }
            } catch (e) { console.warn('Maps config unavailable:', e.message); }
            return this._gmapsKey;
        }

        setMapMode(mode) {
            this.mapMode = mode;
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
        }

        async useMyLocation() {
            if (window.kelionLocation) {
                const lat = window.kelionLocation.lat || window.kelionLocation.latitude;
                const lon = window.kelionLocation.lon || window.kelionLocation.longitude;
                const key = await this._loadMapsKey();
                const fromInput = document.getElementById('map-from');
                fromInput.value = `${lat},${lon}`;
                this.updateStatus('Location detected!');

                // Update map to show current location
                const mapFrame = document.getElementById('google-map');
                if (key) {
                    mapFrame.src = `https://www.google.com/maps/embed/v1/place?key=${key}&q=${lat},${lon}&zoom=15`;
                } else {
                    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.01},${lat - 0.01},${lon + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lon}`;
                }
            } else {
                this.updateStatus('Location not available (GPS pre-fetch not completed)');
            }
        }

        async getRoute() {
            const from = document.getElementById('map-from').value;
            const to = document.getElementById('map-to').value;

            if (!to) {
                this.updateStatus('Please enter a destination');
                return;
            }

            const origin = from || 'My+Location';
            const destination = encodeURIComponent(to);
            const mode = this.mapMode;
            const key = await this._loadMapsKey();

            // Open Google Maps with directions
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${destination}&travelmode=${mode}`;

            // Also update the embedded map
            const mapFrame = document.getElementById('google-map');
            if (key) {
                mapFrame.src = `https://www.google.com/maps/embed/v1/directions?key=${key}&origin=${encodeURIComponent(origin)}&destination=${destination}&mode=${mode}`;
            } else {
                // Fallback: just open in new tab
                this.updateStatus('Maps key unavailable, opening in browser...');
            }

            this.updateStatus(`Route: ${origin} → ${to} (${mode})`);
            this.updateFileInfo(`Navigation: ${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`);

            // Open in new tab as well for full functionality
            window.open(mapsUrl, '_blank');
        }

        // === FOLDER - ZIP Manager ===
        uploadZip() {
            document.getElementById('ws-zip-input').click();
        }

        async handleZipUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            // Load JSZip dynamically
            if (typeof JSZip === 'undefined') {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            }

            const list = document.getElementById('zip-file-list');
            list.innerHTML = '<div style="padding:20px;color:#888;">Loading ZIP contents...</div>';

            try {
                const zip = await JSZip.loadAsync(file);
                let html = '';

                zip.forEach((relativePath, zipEntry) => {
                    const icon = zipEntry.dir ? '📁' : this.getFileIcon(relativePath);
                    const size = zipEntry.dir ? '-' : 'File';
                    html += `
                        <div class="ws-file-item" onclick="kWorkspace.extractFile('${relativePath}')">
                            <span class="icon">${icon}</span>
                            <span class="name">${relativePath}</span>
                            <span class="size">${size}</span>
                        </div>
                    `;
                });

                list.innerHTML = html || '<div style="padding:20px;color:#888;">ZIP is empty</div>';
                this.currentContent = { type: 'zip', zip, filename: file.name };
                this.updateStatus(`Loaded: ${file.name}`);
                this.updateFileInfo(`ZIP: ${file.name} | Files: ${Object.keys(zip.files).length}`);
            } catch (error) {
                list.innerHTML = `<div style="padding:20px;color:#ff6b6b;">Error reading ZIP: ${this.escapeHtml(error.message)}</div>`;
            }
        }

        async extractFile(path) {
            if (!this.currentContent || !this.currentContent.zip) return;

            const file = this.currentContent.zip.file(path);
            if (file) {
                const blob = await file.async('blob');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = path.split('/').pop();
                a.click();
                URL.revokeObjectURL(url);
                this.updateStatus(`Extracted: ${path}`);
            }
        }

        extractZip() {
            if (!this.currentContent || !this.currentContent.zip) {
                this.updateStatus('No ZIP file loaded');
                return;
            }
            // Extract all files
            const zip = this.currentContent.zip;
            zip.forEach(async (relativePath, zipEntry) => {
                if (!zipEntry.dir) {
                    const blob = await zipEntry.async('blob');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = relativePath.split('/').pop();
                    a.click();
                    URL.revokeObjectURL(url);
                }
            });
            this.updateStatus('Extracting all files...');
        }

        createZip() {
            this.updateStatus('Drag files here to add to a new ZIP');
        }

        getFileIcon(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            const icons = {
                pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
                ppt: '📙', pptx: '📙', jpg: '🖼️', png: '🖼️', gif: '🖼️',
                mp3: '🎵', mp4: '🎬', zip: '📦', py: '🐍', js: '📜'
            };
            return icons[ext] || '📄';
        }

        // === UTILITIES ===
        async loadScript(src) {
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }

        upload() {
            document.getElementById('ws-file-input').click();
        }

        handleFile(event) {
            const file = event.target.files[0];
            if (file) this.processFile(file);
        }

        processFile(file) {
            const ext = file.name.split('.').pop().toLowerCase();

            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                this.setType('image');
                const result = document.getElementById('ai-image-result');
                result.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`;
            } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md'].includes(ext)) {
                this.setType('text');
                // Trigger doc handler
                const fakeEvent = { target: { files: [file] } };
                this.handleDocUpload(fakeEvent);
            } else if (['py', 'js', 'ts', 'html', 'css', 'json'].includes(ext)) {
                this.setType('code');
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('python-code').value = e.target.result;
                };
                reader.readAsText(file);
            } else if (ext === 'zip') {
                this.setType('folder');
                const fakeEvent = { target: { files: [file] } };
                this.handleZipUpload(fakeEvent);
            }

            this.updateFileInfo(`Loaded: ${file.name} | Size: ${this.formatSize(file.size)}`);
        }

        download() {
            if (this.currentContent) {
                if (this.currentContent.type === 'image' && this.currentContent.url) {
                    window.open(this.currentContent.url, '_blank');
                }
            }
        }

        copy() {
            const content = document.getElementById('ws-content');
            if (content) {
                navigator.clipboard.writeText(content.innerText || '');
                this.updateStatus('Copied to clipboard!');
            }
        }

        toggleFullscreen() {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.getElementById('k-workspace')?.requestFullscreen();
            }
        }

        formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }

        escapeHtml(str) {
            return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // === K AUTO-DISPLAY ===
        displayContent(data, type = 'text', title = '') {
            this.open();
            this.setType(type);

            if (type === 'image') {
                const result = document.getElementById('ai-image-result');
                result.innerHTML = `<img src="${data}" alt="${title}">`;
                this.currentContent = { type: 'image', url: data };
            } else if (type === 'text' || type === 'code') {
                if (type === 'code') {
                    document.getElementById('python-code').value = data;
                } else {
                    const viewer = document.getElementById('doc-viewer');
                    viewer.innerHTML = `<pre style="padding:20px;overflow:auto;height:100%;background:#fff;color:#333;">${this.escapeHtml(data)}</pre>`;
                }
            }

            this.updateStatus(`Displaying: ${title}`);
            this.updateFileInfo(`K Generated: ${title}`);
        }

        showCurrentLocation() {
            this.open();
            this.setType('map');
            this.useMyLocation();
        }

        // === WEATHER MAP LIVE ===
        async showWeatherMap(lat, lon, weatherData = null) {
            this.open();
            this.setType('map');

            // Get coordinates from cache
            if (!lat || !lon) {
                if (window.kelionLocation) {
                    lat = window.kelionLocation.lat || window.kelionLocation.latitude;
                    lon = window.kelionLocation.lon || window.kelionLocation.longitude;
                } else {
                    console.warn('📍 GPS cache not available, using default: Bucharest');
                    lat = 44.4268; lon = 26.1025;
                }
            }

            // Fetch weather if not provided
            if (!weatherData) {
                try {
                    const res = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}`);
                    const data = await res.json();
                    if (data.success) weatherData = data.data;
                } catch (e) {
                    console.warn('🌤️ Weather fetch failed:', e.message);
                }
            }

            // Create weather map with OpenWeatherMap tile layer
            const mapPanel = document.getElementById('map-panel');
            const mapContainer = mapPanel.querySelector('.map-container') || document.createElement('div');
            mapContainer.id = 'weather-map';
            mapContainer.style.cssText = 'width:100%;height:100%;min-height:400px;';

            // Clear and add
            const contentArea = mapPanel.querySelector('.map-content') || mapPanel;
            contentArea.innerHTML = '';
            contentArea.appendChild(mapContainer);

            // Weather info overlay
            const weatherInfo = weatherData ? `
                <div style="position:absolute;top:10px;left:10px;z-index:1000;background:rgba(0,0,0,0.8);padding:15px 20px;border-radius:12px;color:#fff;font-family:system-ui;">
                    <div style="font-size:32px;font-weight:bold;color:#00ffff;">${weatherData.temp}°C</div>
                    <div style="font-size:14px;color:#d4af37;text-transform:capitalize;">${weatherData.description || ''}</div>
                    <div style="font-size:12px;margin-top:8px;color:#aaa;">
                        🌡️ Feels like: ${weatherData.feels_like}°C<br>
                        💧 Humidity: ${weatherData.humidity}%<br>
                        💨 Wind: ${weatherData.wind_speed} m/s<br>
                        📍 ${weatherData.city || ''}, ${weatherData.country || ''}
                    </div>
                </div>
            ` : '';

            // Embed Ventusky.com cu coordonate
            console.log('🌤️ WEATHER MAP: Folosesc coordonate lat=' + lat + ', lon=' + lon);
            mapContainer.innerHTML = weatherInfo + `
                <iframe 
                    width="100%" 
                    height="100%" 
                    src="https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=10&level=surface&overlay=temp&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" 
                    frameborder="0"
                    style="border-radius:10px;">
                </iframe>
            `;

            this.updateStatus(`🌤️ Weather Map - ${weatherData?.city || 'Your Location'}`);
            this.updateFileInfo(`Live weather at ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
            console.log('🌤️ Weather map displayed', { lat, lon, weatherData });
        }
    }

    // Initialize
    window.kWorkspace = new KWorkspace();
    console.log('🌐 K Workspace ENHANCED ready. Press Ctrl+Shift+K to open.');
})();
