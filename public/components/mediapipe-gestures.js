// Kelion AI - MediaPipe Gesture Recognition
// Real-time hand tracking and gesture detection in browser

(function () {
    'use strict';

    // MediaPipe module URLs
    const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8';
    const WASM_PATH = `${MEDIAPIPE_CDN}/wasm`;
    const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

    // State
    let gestureRecognizer = null;
    let isRunning = false;
    let videoElement = null;
    let canvasElement = null;
    let canvasCtx = null;
    let lastGesture = null;
    let lastGestureTime = 0;
    let gestureCallbacks = [];

    // Gesture names mapping (more descriptive)
    const GESTURE_NAMES = {
        'None': null,
        'Closed_Fist': 'fist',
        'Open_Palm': 'open hand',
        'Pointing_Up': 'pointing up',
        'Thumb_Down': 'thumbs down',
        'Thumb_Up': 'thumbs up',
        'Victory': 'peace sign',
        'ILoveYou': 'I love you sign'
    };

    // Action descriptions for K to speak
    const GESTURE_ACTIONS = {
        'fist': 'I see you making a fist.',
        'open hand': 'I see your open hand. Hello!',
        'pointing up': 'You\'re pointing upward.',
        'thumbs down': 'Oh no, thumbs down? What\'s wrong?',
        'thumbs up': 'Great! Thumbs up - I like your positivity!',
        'peace sign': 'Peace! That\'s a nice gesture.',
        'I love you sign': 'Aww, I love you too!'
    };

    // Load MediaPipe dynamically
    async function loadMediaPipe() {
        if (window.FilesetResolver && window.GestureRecognizer) {
            console.log('🖐️ MediaPipe already loaded');
            return true;
        }

        console.log('🖐️ Loading MediaPipe Gesture Recognizer...');

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${MEDIAPIPE_CDN}/vision_bundle.js`;
            script.onload = () => {
                console.log('🖐️ MediaPipe script loaded');
                resolve(true);
            };
            script.onerror = (err) => {
                console.error('🖐️ Failed to load MediaPipe:', err);
                reject(err);
            };
            document.head.appendChild(script);
        });
    }

    // Initialize the gesture recognizer
    async function initGestureRecognizer() {
        try {
            await loadMediaPipe();

            const { FilesetResolver, GestureRecognizer } = await import(
                `${MEDIAPIPE_CDN}/vision_bundle.js`
            ).catch(() => {
                // Fallback for browsers that don't support dynamic import
                return {
                    FilesetResolver: window.FilesetResolver,
                    GestureRecognizer: window.GestureRecognizer
                };
            });

            const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

            gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: MODEL_PATH,
                    delegate: 'GPU' // Use GPU for better performance
                },
                runningMode: 'VIDEO',
                numHands: 2 // Detect up to 2 hands
            });

            console.log('🖐️ Gesture Recognizer initialized successfully!');
            return true;
        } catch (error) {
            console.error('🖐️ Failed to initialize Gesture Recognizer:', error);
            return false;
        }
    }

    // Create hidden video element for camera feed
    function createVideoElement() {
        if (videoElement) return videoElement;

        videoElement = document.createElement('video');
        videoElement.id = 'gesture-video';
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:320px;height:240px;';
        document.body.appendChild(videoElement);

        return videoElement;
    }

    // Start camera for gesture detection
    async function startCamera() {
        try {
            videoElement = createVideoElement();

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                }
            });

            videoElement.srcObject = stream;
            await videoElement.play();

            console.log('🖐️ Camera started for gesture detection');
            return true;
        } catch (error) {
            console.error('🖐️ Camera access denied:', error);
            return false;
        }
    }

    // Process frame and detect gestures
    function detectGestures(timestamp) {
        if (!isRunning || !gestureRecognizer || !videoElement) {
            return;
        }

        if (videoElement.readyState >= 2) {
            const results = gestureRecognizer.recognizeForVideo(videoElement, timestamp);

            if (results.gestures && results.gestures.length > 0) {
                const gesture = results.gestures[0][0];
                const gestureName = GESTURE_NAMES[gesture.categoryName];
                const confidence = gesture.score;

                // Only trigger if confidence > 70% and gesture changed or 3s passed
                if (gestureName && confidence > 0.7) {
                    const now = Date.now();
                    if (gestureName !== lastGesture || now - lastGestureTime > 3000) {
                        lastGesture = gestureName;
                        lastGestureTime = now;

                        console.log(`🖐️ Gesture detected: ${gestureName} (${(confidence * 100).toFixed(0)}%)`);

                        // Notify callbacks
                        gestureCallbacks.forEach(cb => cb(gestureName, confidence, results));
                    }
                }
            }

            // Draw landmarks if canvas exists
            if (canvasElement && canvasCtx && results.landmarks) {
                drawLandmarks(results.landmarks);
            }
        }

        // Continue detection loop
        if (isRunning) {
            requestAnimationFrame(detectGestures);
        }
    }

    // Draw hand landmarks on canvas (optional visualization)
    function drawLandmarks(landmarks) {
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        landmarks.forEach(handLandmarks => {
            // Draw connections
            canvasCtx.strokeStyle = '#00ffff';
            canvasCtx.lineWidth = 2;

            handLandmarks.forEach((landmark, i) => {
                const x = landmark.x * canvasElement.width;
                const y = landmark.y * canvasElement.height;

                canvasCtx.beginPath();
                canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
                canvasCtx.fillStyle = '#00ff00';
                canvasCtx.fill();
            });
        });
    }

    // Start gesture detection
    async function start() {
        if (isRunning) {
            console.log('🖐️ Gesture detection already running');
            return true;
        }

        console.log('🖐️ Starting gesture detection...');

        // Initialize if needed
        if (!gestureRecognizer) {
            const initialized = await initGestureRecognizer();
            if (!initialized) return false;
        }

        // Start camera
        const cameraStarted = await startCamera();
        if (!cameraStarted) return false;

        // Start detection loop
        isRunning = true;
        requestAnimationFrame(detectGestures);

        console.log('🖐️ Gesture detection ACTIVE');
        return true;
    }

    // Stop gesture detection
    function stop() {
        isRunning = false;
        lastGesture = null;

        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }

        console.log('🖐️ Gesture detection stopped');
    }

    // Register callback for gesture events
    function onGesture(callback) {
        if (typeof callback === 'function') {
            gestureCallbacks.push(callback);
        }
    }

    // Get action text for K to speak
    function getGestureAction(gesture) {
        return GESTURE_ACTIONS[gesture] || `I see your hand making a ${gesture} gesture.`;
    }

    // Expose public API
    window.KelionGestures = {
        start,
        stop,
        onGesture,
        getGestureAction,
        isRunning: () => isRunning,
        GESTURE_NAMES: Object.values(GESTURE_NAMES).filter(Boolean)
    };

    console.log('🖐️ Kelion Gestures module loaded. Use KelionGestures.start() to begin.');

})();
