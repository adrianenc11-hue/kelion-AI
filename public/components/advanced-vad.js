// Kelion Professional VAD - Silero Integration
// Replaces basic OpenAI VAD with ML-based detection

// vad-web loaded via CDN (see script tag in app.html)
// Fallback: if MicVAD not available, use a stub
const MicVAD = window.vad?.MicVAD || class MicVADStub {
    static async new() { console.warn('[VAD] vad-web not loaded — voice detection disabled'); return new MicVADStub(); }
    start() { }
    pause() { }
    destroy() { }
};

class KelionAdvancedVAD {
    constructor() {
        this.vad = null;
        this.isActive = false;
        this.userSpeechPattern = {
            avgSilenceDuration: 1200,  // Learned from user
            speechRate: 1.0,            // Words per second
            lastSpeechEnd: 0
        };
        this.onSpeechStart = null;
        this.onSpeechEnd = null;
        this.onVADMisfire = null;
    }

    async init(callbacks = {}) {
        this.onSpeechStart = callbacks.onSpeechStart || (() => { });
        this.onSpeechEnd = callbacks.onSpeechEnd || (() => { });
        this.onVADMisfire = callbacks.onVADMisfire || (() => { });

        try {
            this.vad = await MicVAD.new({
                // ML Model Configuration
                modelURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/silero_vad.onnx',
                workletURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/vad.worklet.bundle.min.js',

                // Advanced Settings
                positiveSpeechThreshold: 0.6,      // ML confidence (60%)
                negativeSpeechThreshold: 0.4,      // End speech threshold
                redemptionFrames: 8,               // Prevent false stops
                preSpeechPadFrames: 2,             // Buffer before speech
                minSpeechFrames: 4,                // Min speech duration

                // Callbacks
                onSpeechStart: (audio) => {
                    console.log('🎙️ [Advanced VAD] Speech detected');
                    this.userSpeechPattern.lastSpeechEnd = 0;
                    this.onSpeechStart(audio);
                },

                onSpeechEnd: (audio) => {
                    const now = Date.now();
                    if (this.userSpeechPattern.lastSpeechEnd > 0) {
                        const silenceDuration = now - this.userSpeechPattern.lastSpeechEnd;
                        this.learnSilencePattern(silenceDuration);
                    }
                    this.userSpeechPattern.lastSpeechEnd = now;

                    console.log('🎙️ [Advanced VAD] Speech ended');
                    this.onSpeechEnd(audio);
                },

                onVADMisfire: () => {
                    console.warn('⚠️ [Advanced VAD] False positive detected');
                    this.onVADMisfire();
                }
            });

            this.isActive = true;
            console.log('✅ Advanced VAD initialized (Silero ML)');
            return true;
        } catch (e) {
            console.error('❌ Advanced VAD failed to initialize:', e);
            return false;
        }
    }

    learnSilencePattern(duration) {
        const alpha = 0.2;
        this.userSpeechPattern.avgSilenceDuration =
            (alpha * duration) + ((1 - alpha) * this.userSpeechPattern.avgSilenceDuration);
        console.log(`📊 Learned silence: ${Math.round(this.userSpeechPattern.avgSilenceDuration)}ms`);
    }

    start() {
        if (this.vad && !this.isActive) {
            this.vad.start();
            this.isActive = true;
        }
    }

    pause() {
        if (this.vad && this.isActive) {
            this.vad.pause();
            this.isActive = false;
        }
    }

    destroy() {
        if (this.vad) {
            this.vad.destroy();
            this.vad = null;
            this.isActive = false;
        }
    }

    getStats() {
        return {
            avgSilenceDuration: Math.round(this.userSpeechPattern.avgSilenceDuration),
            isActive: this.isActive
        };
    }
}

window.KelionAdvancedVAD = KelionAdvancedVAD;
console.log('✅ Kelion Advanced VAD module loaded');
