// Wake Word Detector for "Hello AI"
class KelionWakeWord {
    constructor(onWakeWord) {
        this.onWakeWord = onWakeWord;
        this.isListening = false;
        this.porcupine = null;
    }

    async start(accessKey) {
        try {
            const { PorcupineWorker } = await import('@picovoice/porcupine-web');
            const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor');

            this.porcupine = await PorcupineWorker.create(
                accessKey,
                [{ publicPath: '/models/hello-ai.ppn', label: 'hello ai' }],
                (detection) => {
                    if (detection.label === 'hello ai') {
                        console.log('🎙️ Wake word detected: Hello AI!');
                        this.onWakeWord();
                    }
                }
            );

            await WebVoiceProcessor.subscribe(this.porcupine);
            this.isListening = true;
            console.log('👂 Listening for "Hello AI"...');
        } catch (error) {
            console.error('Wake word initialization failed:', error);
        }
    }

    stop() {
        if (this.porcupine) {
            const { WebVoiceProcessor } = require('@picovoice/web-voice-processor');
            WebVoiceProcessor.unsubscribe(this.porcupine);
            this.porcupine.release();
            this.isListening = false;
            console.log('👋 Wake word detection stopped');
        }
    }
}

window.KelionWakeWord = KelionWakeWord;
