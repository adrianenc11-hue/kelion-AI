/**
 * K Enhanced Chat - Keyword Detection + Presentation Mode
 * 
 * Features:
 * - Detects keywords in user messages
 * - Enters PRESENTATION MODE when media is generated
 * - K shrinks to top-left corner
 * - Media fills rest of screen
 * - Click anywhere or say "închide" to exit
 */

const KEnhancedChat = {
    initialized: false,
    presentationMode: false,

    // Keyword mappings
    triggers: {
        image: {
            keywords: ['generează imagine', 'creează poză', 'desenează', 'fă o imagine', 'generează o imagine', 'arată-mi o imagine'],
            endpoint: '/.netlify/functions/dalle',
            handler: 'handleImageResult'
        },
        sound: {
            keywords: ['sunet de', 'efect sonor', 'fă un sunet', 'generează sunet', 'redă sunet'],
            endpoint: '/.netlify/functions/sound-effects',
            handler: 'handleSoundResult'
        },
        research: {
            keywords: ['cercetează', 'analizează detaliat', 'raport despre', 'investigează', 'documentează'],
            endpoint: '/.netlify/functions/deep-research',
            handler: 'handleResearchResult'
        },
        reasoning: {
            keywords: ['gândește', 'raționează', 'analizează logic', 'explică pas cu pas'],
            endpoint: '/.netlify/functions/deep-research',
            mode: 'reasoning',
            handler: 'handleResearchResult'
        },
        location: {
            keywords: [
                'arată poziția', 'afișează poziția', 'unde sunt', 'locația mea', 'poziția mea',
                'pe hartă', 'harta', 'hartă google', 'google maps', 'maps',
                'show my location', 'where am i', 'my location', 'show location', 'show map',
                'arată pe hartă', 'afișează pe hartă', 'deschide harta'
            ],
            endpoint: null, // No API call needed
            handler: 'handleLocationResult'
        }
    },

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.createPresentationOverlay();
        this.addStyles();
        console.log('🔮 K Enhanced Chat + Presentation Mode initialized');
    },

    createPresentationOverlay() {
        // Create the overlay if it doesn't exist
        if (document.getElementById('k-presentation-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'k-presentation-overlay';
        overlay.innerHTML = `
            <div class="k-mini-container" id="k-mini-hologram">
                <!-- K hologram will be cloned here -->
            </div>
            <div class="k-media-area" id="k-media-area">
                <div class="k-media-loading" id="k-media-loading">
                    <div class="spinner"></div>
                    <span>Procesez...</span>
                </div>
                <div class="k-media-content" id="k-media-content"></div>
            </div>
            <button class="k-close-btn" id="k-close-presentation">✕ Închide</button>
        `;
        document.body.appendChild(overlay);

        // Close button handler
        document.getElementById('k-close-presentation').onclick = () => this.exitPresentationMode();

        // Click outside to close
        overlay.onclick = (e) => {
            if (e.target === overlay) this.exitPresentationMode();
        };
    },

    addStyles() {
        if (document.getElementById('k-enhanced-styles')) return;

        const style = document.createElement('style');
        style.id = 'k-enhanced-styles';
        style.textContent = `
            /* ============================================
               PRESENTATION MODE OVERLAY
               K mic stânga-sus, media mare în rest
               ============================================ */
            
            #k-presentation-overlay {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: linear-gradient(135deg, #050a18 0%, #0a1628 50%, #0d1b30 100%);
                z-index: 10000;
                padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            }
            
            #k-presentation-overlay.active {
                display: flex;
                animation: k-fadeIn 0.5s ease;
            }
            
            @keyframes k-fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* K Mini Container - Top Left */
            .k-mini-container {
                position: absolute;
                top: 20px;
                left: 20px;
                width: 180px;
                height: 180px;
                border-radius: 50%;
                background: radial-gradient(circle, rgba(0,20,40,0.9) 0%, rgba(0,10,20,0.95) 100%);
                border: 2px solid rgba(0, 255, 255, 0.5);
                box-shadow: 
                    0 0 30px rgba(0, 255, 255, 0.3),
                    inset 0 0 30px rgba(0, 128, 255, 0.1);
                overflow: hidden;
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .k-mini-container::after {
                content: '🔮 K';
                font-size: 3rem;
                opacity: 0.7;
            }
            
            /* Media Area - Takes rest of screen */
            .k-media-area {
                flex: 1;
                margin-left: 220px;
                margin-top: 20px;
                margin-right: 20px;
                margin-bottom: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: auto;
            }
            
            /* Loading State */
            .k-media-loading {
                display: none;
                flex-direction: column;
                align-items: center;
                gap: 20px;
                color: rgba(255,255,255,0.7);
                font-size: 1.2rem;
            }
            
            .k-media-loading.active {
                display: flex;
            }
            
            .k-media-loading .spinner {
                width: 60px;
                height: 60px;
                border: 4px solid rgba(212,175,55,0.2);
                border-top-color: #d4af37;
                border-radius: 50%;
                animation: k-spin 1s linear infinite;
            }
            
            @keyframes k-spin {
                to { transform: rotate(360deg); }
            }
            
            /* Media Content Container */
            .k-media-content {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            /* Generated Image - Full size */
            .k-media-content .k-generated-image {
                max-width: 90%;
                max-height: 80vh;
                border-radius: 20px;
                box-shadow: 
                    0 20px 60px rgba(0, 0, 0, 0.5),
                    0 0 40px rgba(212, 175, 55, 0.2);
                cursor: pointer;
                transition: transform 0.3s ease;
            }
            
            .k-media-content .k-generated-image:hover {
                transform: scale(1.02);
            }
            
            /* Audio Player - Large centered */
            .k-media-content .k-audio-player {
                background: linear-gradient(135deg, rgba(20,20,40,0.95), rgba(30,30,50,0.95));
                border: 2px solid rgba(212, 175, 55, 0.4);
                border-radius: 25px;
                padding: 40px 60px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 25px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            
            .k-media-content .k-audio-player .play-btn {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: linear-gradient(135deg, #d4af37, #c4a030);
                border: none;
                color: #000;
                font-size: 3rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                box-shadow: 0 10px 30px rgba(212, 175, 55, 0.4);
            }
            
            .k-media-content .k-audio-player .play-btn:hover {
                transform: scale(1.1);
            }
            
            .k-media-content .k-audio-player .audio-title {
                color: #fff;
                font-size: 1.5rem;
                font-weight: bold;
            }
            
            .k-media-content .k-audio-player .audio-desc {
                color: rgba(255,255,255,0.6);
                font-size: 1rem;
                max-width: 400px;
                text-align: center;
            }
            
            /* Research Result - Scrollable */
            .k-media-content .k-research-result {
                background: rgba(0,0,0,0.6);
                border: 1px solid rgba(212, 175, 55, 0.3);
                border-radius: 20px;
                padding: 30px 40px;
                max-width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                color: #fff;
                line-height: 1.8;
                font-size: 1.1rem;
            }
            
            .k-media-content .k-research-result h3 {
                color: #d4af37;
                margin-bottom: 20px;
                font-size: 1.8rem;
            }
            
            .k-media-content .k-research-result .citations {
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid rgba(255,255,255,0.2);
            }
            
            .k-media-content .k-research-result .citation {
                color: rgba(255,255,255,0.6);
                font-size: 0.9rem;
                margin: 8px 0;
            }
            
            .k-media-content .k-research-result .citation a {
                color: #00bfff;
            }
            
            /* Close Button */
            .k-close-btn {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.3);
                color: #fff;
                padding: 12px 30px;
                border-radius: 25px;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s ease;
                z-index: 10002;
            }
            
            .k-close-btn:hover {
                background: rgba(255,255,255,0.2);
            }
            
            /* Mobile Responsive */
            @media (max-width: 768px) {
                .k-mini-container {
                    width: 100px;
                    height: 100px;
                    top: 10px;
                    left: 10px;
                }
                
                .k-mini-container::after {
                    font-size: 2rem;
                }
                
                .k-media-area {
                    margin-left: 10px;
                    margin-top: 120px;
                }
            }
        `;
        document.head.appendChild(style);
    },

    // Enter presentation mode
    enterPresentationMode(type) {
        const overlay = document.getElementById('k-presentation-overlay');
        const loading = document.getElementById('k-media-loading');
        const content = document.getElementById('k-media-content');

        if (!overlay) return;

        // Clear previous content
        content.innerHTML = '';

        // Show overlay with loading
        overlay.classList.add('active');
        loading.classList.add('active');

        // Update loading message
        const messages = {
            image: 'Generez imaginea...',
            sound: 'Creez efectul sonor...',
            research: 'Cercetez subiectul...',
            reasoning: 'Analizez logic...'
        };
        loading.querySelector('span').textContent = messages[type] || 'Procesez...';

        this.presentationMode = true;
        console.log('🎬 Entered presentation mode');
    },

    // Exit presentation mode
    exitPresentationMode() {
        const overlay = document.getElementById('k-presentation-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        this.presentationMode = false;

        // Clear any pending auto-close timer
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
            this.autoCloseTimer = null;
        }

        console.log('🎬 Exited presentation mode - K returns to normal');
    },

    // Schedule auto-close after content is displayed
    scheduleAutoClose(delaySeconds = 15) {
        // Clear existing timer
        if (this.autoCloseTimer) {
            clearTimeout(this.autoCloseTimer);
        }

        // Auto-close after delay (give time to view content)
        this.autoCloseTimer = setTimeout(() => {
            if (this.presentationMode) {
                console.log('🎬 Auto-closing presentation after', delaySeconds, 'seconds');
                this.exitPresentationMode();
            }
        }, delaySeconds * 1000);
    },

    // Detect if message contains trigger keywords
    detectTrigger(message) {
        const lowerMsg = message.toLowerCase();

        for (const [type, config] of Object.entries(this.triggers)) {
            for (const keyword of config.keywords) {
                if (lowerMsg.includes(keyword.toLowerCase())) {
                    // Extract prompt (text after keyword)
                    const idx = lowerMsg.indexOf(keyword.toLowerCase());
                    const prompt = message.substring(idx + keyword.length).trim();

                    return {
                        type,
                        keyword,
                        prompt: prompt || message,
                        endpoint: config.endpoint,
                        mode: config.mode,
                        handler: config.handler
                    };
                }
            }
        }
        return null;
    },

    // Process message with keyword detection
    async processMessage(message) {
        const trigger = this.detectTrigger(message);

        if (!trigger) {
            return null; // No trigger found, use normal chat
        }

        console.log('🔮 Trigger detected:', trigger.type, trigger.prompt);

        // Special handling for location - no API call needed
        if (trigger.type === 'location') {
            return this.handleLocationResult();
        }

        // Enter presentation mode
        this.enterPresentationMode(trigger.type);

        try {
            const body = {
                prompt: trigger.prompt,
                text: trigger.prompt,
                query: trigger.prompt
            };

            if (trigger.mode) {
                body.mode = trigger.mode;
            }

            const response = await fetch(trigger.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            // Hide loading
            document.getElementById('k-media-loading').classList.remove('active');

            // Get media container
            const mediaContent = document.getElementById('k-media-content');

            // Handle result based on type
            return this[trigger.handler](data, mediaContent, trigger);

        } catch (error) {
            console.error('Trigger error:', error);
            document.getElementById('k-media-loading').classList.remove('active');
            this.showError(document.getElementById('k-media-content'), error.message);
            return null;
        }
    },

    // Handle location request - opens workspace with GPS map
    handleLocationResult() {
        // Use the K Universal Workspace for map display
        if (window.kWorkspace) {
            console.log('📍 Opening workspace with GPS location...');
            window.kWorkspace.showCurrentLocation();
            return "I'm showing your location on the map. Please allow location access if prompted.";
        } else {
            // Fallback to presentation mode with simple message
            return "I need the location workspace to show the map. Please try again.";
        }
    },

    showError(container, message) {
        container.innerHTML = `
            <div style="color: #ff6b6b; font-size: 1.5rem; text-align: center;">
                ❌ ${message}
            </div>
            <p style="color: rgba(255,255,255,0.5); margin-top: 20px;">
                Încearcă din nou sau apasă "Închide"
            </p>
        `;
    },

    // Handle image generation result - USE WORKSPACE
    handleImageResult(data, container, trigger) {
        if (!data.success || !data.imageUrl) {
            this.showError(container, 'Imaginea nu a putut fi generată');
            return null;
        }

        // Use workspace if available
        if (window.kWorkspace) {
            this.exitPresentationMode(); // Close old presentation
            window.kWorkspace.displayContent(data.imageUrl, 'image', data.revisedPrompt || trigger.prompt);
            return `Am generat imaginea. ${data.revisedPrompt ? 'Am îmbunătățit descrierea pentru un rezultat mai bun.' : ''}`;
        }

        // Fallback to old presentation mode
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.className = 'k-generated-image';
        img.alt = trigger.prompt;
        img.title = 'Click pentru a deschide în tab nou';
        img.onclick = () => window.open(data.imageUrl, '_blank');

        container.appendChild(img);

        // Add caption
        const caption = document.createElement('p');
        caption.style.cssText = 'color: rgba(255,255,255,0.6); margin-top: 20px; font-style: italic; text-align: center;';
        caption.textContent = data.revisedPrompt || trigger.prompt;
        container.appendChild(caption);

        this.scheduleAutoClose(20);
        return `Am generat imaginea pe care ai cerut-o. ${data.revisedPrompt ? 'Am îmbunătățit descrierea pentru un rezultat mai bun.' : ''}`;
    },

    // Handle sound effects result
    handleSoundResult(data, container, trigger) {
        if (!data.success || !data.audioBase64) {
            this.showError(container, 'Sunetul nu a putut fi generat');
            return null;
        }

        const audioDiv = document.createElement('div');
        audioDiv.className = 'k-audio-player';

        const audioSrc = `data:audio/mpeg;base64,${data.audioBase64}`;

        audioDiv.innerHTML = `
            <div class="audio-title">🔊 Efect Sonor Generat</div>
            <button class="play-btn">▶️</button>
            <div class="audio-desc">${trigger.prompt}</div>
            <audio src="${audioSrc}"></audio>
        `;

        const playBtn = audioDiv.querySelector('.play-btn');
        const audio = audioDiv.querySelector('audio');

        playBtn.onclick = () => {
            if (audio.paused) {
                audio.play();
                playBtn.textContent = '⏸️';
            } else {
                audio.pause();
                playBtn.textContent = '▶️';
            }
        };

        audio.onended = () => {
            playBtn.textContent = '▶️';
        };

        container.appendChild(audioDiv);

        // Auto-close after 15 seconds
        this.scheduleAutoClose(15);

        return `Am creat efectul sonor. Apasă butonul de play pentru a-l asculta.`;
    },

    // Handle research result - USE WORKSPACE
    handleResearchResult(data, container, trigger) {
        if (!data.success || !data.result) {
            this.showError(container, 'Cercetarea nu a putut fi realizată');
            return null;
        }

        // Use workspace if available
        if (window.kWorkspace) {
            this.exitPresentationMode(); // Close old presentation

            // Format research with citations
            let content = data.result;
            if (data.citations && data.citations.length > 0) {
                content += '\n\n---\n📚 Surse:\n';
                data.citations.forEach((c, i) => {
                    content += `[${i + 1}] ${c}\n`;
                });
            }

            window.kWorkspace.displayContent(content, 'text', 'Research Results');

            const shortResult = data.result.substring(0, 300);
            return shortResult + (data.result.length > 300 ? '... The full report is displayed in the workspace.' : '');
        }

        // Fallback to old presentation mode
        const researchDiv = document.createElement('div');
        researchDiv.className = 'k-research-result';

        let citationsHtml = '';
        if (data.citations && data.citations.length > 0) {
            citationsHtml = `
                <div class="citations">
                    <strong>📚 Surse:</strong>
                    ${data.citations.map((c, i) => `
                        <div class="citation">[${i + 1}] <a href="${c}" target="_blank">${c}</a></div>
                    `).join('')}
                </div>
            `;
        }

        researchDiv.innerHTML = `
            <h3>🔬 Rezultat Cercetare</h3>
            <div class="content">${this.formatMarkdown(data.result)}</div>
            ${citationsHtml}
        `;

        container.appendChild(researchDiv);

        // Auto-close after 30 seconds (time to read)
        this.scheduleAutoClose(30);

        // Return shortened version for K to speak
        const shortResult = data.result.substring(0, 500);
        return shortResult + (data.result.length > 500 ? '... Raportul complet e afișat pe ecran.' : '');
    },

    // Simple markdown formatter
    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }
};

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KEnhancedChat.init());
} else {
    KEnhancedChat.init();
}

// Export for use
window.KEnhancedChat = KEnhancedChat;
