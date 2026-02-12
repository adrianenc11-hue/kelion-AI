// Screen Capture & Analysis Component
class KelionScreenShare {
    constructor() {
        this.stream = null;
        this.isSharing = false;
        this.analysisInterval = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    async startCapture() {
        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            this.isSharing = true;
            console.log('🖥️ Screen sharing started');

            // Start analysis every 5 seconds
            this.analysisInterval = setInterval(() => {
                this.analyzeScreen();
            }, 5000);

            // Handle stream ending (user clicks "Stop sharing")
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopCapture();
            });

            return true;
        } catch (error) {
            console.error('Screen capture failed:', error);
            return false;
        }
    }

    stopCapture() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        this.isSharing = false;
        console.log('🛑 Screen sharing stopped');
    }

    async analyzeScreen() {
        if (!this.stream || !this.isSharing) return;

        try {
            const videoTrack = this.stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(videoTrack);
            const bitmap = await imageCapture.grabFrame();

            // Draw to canvas
            this.canvas.width = bitmap.width;
            this.canvas.height = bitmap.height;
            this.ctx.drawImage(bitmap, 0, 0);

            // Convert to base64
            const base64 = this.canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

            // Send to backend for Gemini Vision analysis
            const analysis = await fetch('/.netlify/functions/analyze-screen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64 })
            }).then(r => r.json());

            if (analysis.insights) {
                console.log('👁️ Screen analysis:', analysis.insights);
                // Notify K about what's on screen
                this.notifyK(analysis.insights);
            }
        } catch (error) {
            console.warn('Analysis failed:', error);
        }
    }

    notifyK(insights) {
        // Send visual context to K
        if (window.sendVisualContext) {
            window.sendVisualContext(insights);
        }
    }

    getStatus() {
        return {
            isSharing: this.isSharing,
            hasStream: !!this.stream
        };
    }
}

// Initialize
window.KelionScreenShare = KelionScreenShare;
