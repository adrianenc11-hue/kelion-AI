// Kelion AI — Ambient Sound Detection Module
// Classifies environmental sounds using Web Audio API + TensorFlow.js YAMNet
// K comments on detected sounds (music, dogs, rain, doorbell, etc.)

(function () {
    'use strict';

    const CONFIG = {
        COMMENT_COOLDOWN: 60000,    // 60s between K comments
        DETECTION_INTERVAL: 3000,   // Analyze every 3s
        CONFIDENCE_THRESHOLD: 0.35, // Min confidence for detection
        SAMPLE_RATE: 16000,         // YAMNet expects 16kHz
        FRAME_LENGTH: 15600,        // ~1 second of audio at 16kHz
        YAMNET_MODEL_URL: 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1',
        LOW_POWER_INTERVAL: 10000   // 10s in low-power mode
    };

    // Sound categories K cares about (from YAMNet's 521 classes)
    const SOUND_RESPONSES = {
        'Music': ['I hear music playing! 🎵 Nice taste!', 'That music sounds great! What genre is it?', 'Oh, some tunes in the background! 🎶'],
        'Speech': null, // Ignore — handled by VAD
        'Dog': ['Is that a dog I hear? 🐕 Woof!', 'A dog barking nearby! Do you have a dog?'],
        'Cat': ['Meow! I think I hear a cat! 🐱', 'Is that a kitty nearby?'],
        'Bird': ['I hear birds chirping! 🐦 Nice and peaceful.', 'Bird songs! Must be a nice day.'],
        'Doorbell': ['Sounds like someone\'s at the door! 🔔', 'Was that a doorbell? You might have a visitor!'],
        'Knock': ['I heard a knock! Someone\'s at the door? 🚪'],
        'Siren': ['I hear a siren! 🚨 Stay safe!', 'Emergency vehicle nearby — stay alert!'],
        'Rain': ['Is it raining? ☔ Cozy weather for staying in!', 'I hear rain! Perfect weather for coding.'],
        'Thunder': ['Thunder! ⛈️ Hope you\'re somewhere safe!'],
        'Laughter': ['I hear laughter! 😄 Sounds like fun!', 'Someone\'s having a good time! 😊'],
        'Applause': ['Applause! 👏 What an achievement!', 'Are people clapping? Something exciting!'],
        'Crying': ['I hear crying... 😢 Is everything okay?'],
        'Alarm': ['An alarm is going off! ⏰ Check it out!', 'I hear an alarm — is that yours?'],
        'Typing': null, // Too common, ignore
        'Car horn': ['Car horn! 🚗 Traffic nearby?'],
        'Glass': ['I heard glass! 🥂 Cheers, or be careful!'],
        'Whistle': ['Was that a whistle? 🎵'],
        'Telephone': ['Is that a phone ringing? 📞 You might want to answer that!'],
        'Water': ['I hear water running! 💧'],
        'Wind': ['Windy out there! 💨'],
        'Snoring': ['Is someone snoring? 😴 Time for a nap!'],
        'Cough': ['Gesundheit! 🤧 Hope you\'re feeling okay!'],
        'Fireworks': ['Fireworks! 🎆 What\'s the celebration?'],
        'Engine': ['I hear an engine running. 🚗'],
        'Clock': ['I hear a clock ticking ⏰ — time is passing!']
    };

    // YAMNet class index to friendly name mapping (simplified top categories)
    const YAMNET_CLASS_MAP = {
        0: 'Speech', 1: 'Speech', 2: 'Speech', 3: 'Speech',
        67: 'Music', 68: 'Music', 69: 'Music', 70: 'Music', 71: 'Music',
        72: 'Music', 73: 'Music', 74: 'Music',
        75: 'Singing', 76: 'Singing',
        137: 'Dog', 138: 'Dog',
        139: 'Cat',
        106: 'Bird', 107: 'Bird', 108: 'Bird',
        324: 'Doorbell',
        326: 'Knock',
        316: 'Siren',
        286: 'Rain', 287: 'Rain',
        288: 'Thunder',
        17: 'Laughter',
        36: 'Crying',
        37: 'Crying',
        393: 'Alarm', 394: 'Alarm', 395: 'Alarm',
        65: 'Typing',
        284: 'Wind',
        300: 'Water',
        341: 'Telephone',
        374: 'Car horn',
        423: 'Glass',
        280: 'Fireworks',
        368: 'Engine', 369: 'Engine',
        425: 'Clock',
        14: 'Whistle',
        34: 'Snoring',
        40: 'Cough',
        38: 'Applause'
    };

    let model = null;
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let detectionInterval = null;
    let lastCommentTime = 0;
    let isRunning = false;
    let isLowPower = false;
    let detectedSounds = [];
    let callbacks = [];

    // ═══ MODEL LOADING ═══

    async function loadModel() {
        if (model) return model;

        try {
            // Try to load TensorFlow.js if not present
            if (typeof tf === 'undefined') {
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
            }

            // Load YAMNet model
            console.log('🔊 Loading YAMNet audio classifier...');
            model = await tf.loadGraphModel(CONFIG.YAMNET_MODEL_URL, { fromTFHub: true });
            console.log('🔊 YAMNet model loaded successfully');
            return model;
        } catch (error) {
            console.warn('🔊 YAMNet load failed, using fallback frequency analysis:', error.message);
            return null;
        }
    }

    function loadScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ═══ AUDIO CAPTURE ═══

    async function startAudioCapture() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: false, // We WANT ambient sounds
                    autoGainControl: true,
                    sampleRate: CONFIG.SAMPLE_RATE
                }
            });

            audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: CONFIG.SAMPLE_RATE
            });

            microphone = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;
            microphone.connect(analyser);

            console.log('🔊 Audio capture started');
            return true;
        } catch (error) {
            console.error('🔊 Audio capture failed:', error);
            return false;
        }
    }

    // ═══ SOUND CLASSIFICATION ═══

    async function classifyAudio() {
        if (!analyser || !audioContext) return null;

        try {
            // Get audio data
            const bufferLength = analyser.frequencyBinCount;
            const timeData = new Float32Array(bufferLength);
            analyser.getFloatTimeDomainData(timeData);

            // Check if there's actual sound (not silence)
            const rms = Math.sqrt(timeData.reduce((sum, v) => sum + v * v, 0) / bufferLength);
            if (rms < 0.01) return null; // Too quiet, skip

            if (model) {
                // YAMNet classification
                return await classifyWithYAMNet(timeData);
            } else {
                // Fallback: frequency-based heuristic
                return classifyWithFrequency();
            }
        } catch (error) {
            return null;
        }
    }

    async function classifyWithYAMNet(audioData) {
        try {
            // Prepare input tensor
            const input = tf.tensor1d(audioData);
            const resized = tf.image.resizeBilinear(
                input.reshape([1, audioData.length, 1]),
                [1, CONFIG.FRAME_LENGTH]
            ).reshape([CONFIG.FRAME_LENGTH]);

            // Run inference
            const predictions = model.predict(resized.expandDims(0));
            const scores = await predictions.data();

            // Find top predictions
            const results = [];
            for (let i = 0; i < scores.length; i++) {
                if (scores[i] > CONFIG.CONFIDENCE_THRESHOLD && YAMNET_CLASS_MAP[i]) {
                    results.push({
                        class: YAMNET_CLASS_MAP[i],
                        confidence: scores[i],
                        classIndex: i
                    });
                }
            }

            // Cleanup tensors
            input.dispose();
            resized.dispose();
            predictions.dispose();

            results.sort((a, b) => b.confidence - a.confidence);
            return results.length > 0 ? results[0] : null;
        } catch (e) {
            return null;
        }
    }

    function classifyWithFrequency() {
        // Simple frequency-based fallback when YAMNet unavailable
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);

        const nyquist = audioContext.sampleRate / 2;
        const binSize = nyquist / freqData.length;

        // Calculate energy in frequency bands
        let lowEnergy = 0, midEnergy = 0, highEnergy = 0;
        for (let i = 0; i < freqData.length; i++) {
            const freq = i * binSize;
            const val = freqData[i] / 255;
            if (freq < 300) lowEnergy += val;
            else if (freq < 2000) midEnergy += val;
            else highEnergy += val;
        }

        const total = lowEnergy + midEnergy + highEnergy;
        if (total < 5) return null;

        // Very rough heuristics
        if (midEnergy > lowEnergy * 2 && midEnergy > highEnergy * 2) {
            return { class: 'Music', confidence: 0.4, method: 'frequency' };
        }
        if (highEnergy > midEnergy * 3) {
            return { class: 'Alarm', confidence: 0.35, method: 'frequency' };
        }
        if (lowEnergy > midEnergy * 3) {
            return { class: 'Engine', confidence: 0.3, method: 'frequency' };
        }

        return null;
    }

    // ═══ DETECTION LOOP ═══

    async function detectLoop() {
        if (!isRunning) return;

        const result = await classifyAudio();
        if (!result || !result.class) return;

        // Skip speech — handled by VAD
        if (result.class === 'Speech' || result.class === 'Typing') return;

        const now = Date.now();

        // Log detection
        detectedSounds.push({
            sound: result.class,
            confidence: result.confidence,
            timestamp: now
        });

        // Keep only last 50 detections
        if (detectedSounds.length > 50) {
            detectedSounds = detectedSounds.slice(-50);
        }

        // Notify callbacks
        callbacks.forEach(cb => {
            try { cb(result); } catch (e) { /* ignore */ }
        });

        // K comment (with cooldown)
        if (now - lastCommentTime < CONFIG.COMMENT_COOLDOWN) return;

        const responses = SOUND_RESPONSES[result.class];
        if (!responses) return;

        const comment = responses[Math.floor(Math.random() * responses.length)];
        lastCommentTime = now;

        console.log(`🔊 Detected: ${result.class} (${(result.confidence * 100).toFixed(0)}%) → "${comment}"`);

        // Dispatch event for K
        window.dispatchEvent(new CustomEvent('kelion:ambient-sound', {
            detail: {
                sound: result.class,
                confidence: result.confidence,
                comment: comment
            }
        }));
    }

    // ═══ LIFECYCLE ═══

    async function start() {
        if (isRunning) return;

        const audioOk = await startAudioCapture();
        if (!audioOk) {
            console.error('🔊 Cannot start ambient sound detection — microphone access denied');
            return false;
        }

        // Load model (non-blocking)
        loadModel().catch(() => console.warn('🔊 Running without YAMNet — frequency fallback only'));

        isRunning = true;
        const interval = isLowPower ? CONFIG.LOW_POWER_INTERVAL : CONFIG.DETECTION_INTERVAL;
        detectionInterval = setInterval(detectLoop, interval);

        console.log('🔊 Ambient Sound AI started — listening for environmental sounds');
        return true;
    }

    function stop() {
        isRunning = false;
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().catch(() => { });
            audioContext = null;
        }
        console.log('🔊 Ambient Sound AI stopped');
    }

    function setLowPower(enabled) {
        isLowPower = enabled;
        if (isRunning && detectionInterval) {
            clearInterval(detectionInterval);
            const interval = isLowPower ? CONFIG.LOW_POWER_INTERVAL : CONFIG.DETECTION_INTERVAL;
            detectionInterval = setInterval(detectLoop, interval);
            console.log(`🔊 ${enabled ? 'Low-power' : 'Normal'} mode active`);
        }
    }

    // ═══ PUBLIC API ═══

    window.kelionAmbientSound = {
        start,
        stop,
        onSound: (callback) => callbacks.push(callback),
        getDetected: () => [...detectedSounds],
        getRecentSounds: (n = 10) => detectedSounds.slice(-n),
        setLowPower,
        isRunning: () => isRunning,
        isLowPower: () => isLowPower,
        getSupportedSounds: () => Object.keys(SOUND_RESPONSES).filter(k => SOUND_RESPONSES[k])
    };

    // Listen for battery status
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            battery.addEventListener('levelchange', () => {
                if (battery.level < 0.2 && !isLowPower) {
                    setLowPower(true);
                    console.log('🔊 Auto-switched to low-power mode (battery < 20%)');
                }
            });
        }).catch(() => { });
    }

    console.log('🔊 Ambient Sound AI module loaded. Use kelionAmbientSound.start() to begin.');
})();
