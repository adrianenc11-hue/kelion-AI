// Kelion Face Security Module
// Detects when a different person appears and requires account holder permission
// Uses face-api.js for face detection and recognition

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        CHECK_INTERVAL_MS: 30000,      // Check face every 30 seconds
        CONFIDENCE_THRESHOLD: 0.6,      // 60% match required
        MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/', // CDN models
        ENROLLMENT_DELAY_MS: 3000       // Wait 3s after reveal before enrolling
    };

    // State
    let isInitialized = false;
    let enrolledDescriptor = null;     // Original user's face descriptor
    let checkInterval = null;
    let videoElement = null;
    let isSecurityPaused = false;
    let originalUserEmail = null;
    let knownFaces = [];               // Array of {name, descriptor} for returning users

    const KNOWN_FACES_KEY = 'kelion_known_faces';

    // Initialize face-api models
    async function initModels() {
        if (isInitialized) return true;

        try {
            console.log('🔐 Loading face recognition models...');

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(CONFIG.MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(CONFIG.MODEL_URL)
            ]);

            isInitialized = true;
            console.log('✅ Face recognition models loaded');
            return true;
        } catch (e) {
            console.error('❌ Failed to load face models:', e);
            return false;
        }
    }

    // Get video element from existing camera
    function getVideoElement() {
        // Try to find existing video from vision module
        videoElement = document.getElementById('camera-video') ||
            document.querySelector('video[autoplay]');
        return videoElement;
    }

    // Load known faces from localStorage
    function loadKnownFaces() {
        try {
            const stored = localStorage.getItem(KNOWN_FACES_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Convert back to Float32Array
                knownFaces = parsed.map(f => ({
                    name: f.name,
                    descriptor: new Float32Array(f.descriptor),
                    timestamp: f.timestamp
                }));
                console.log('📚 Loaded', knownFaces.length, 'known faces');
            }
        } catch (e) {
            console.warn('Could not load known faces:', e);
            knownFaces = [];
        }
    }

    // Save known faces to localStorage
    function saveKnownFaces() {
        try {
            const toSave = knownFaces.map(f => ({
                name: f.name,
                descriptor: Array.from(f.descriptor), // Convert Float32Array to regular array
                timestamp: f.timestamp
            }));
            localStorage.setItem(KNOWN_FACES_KEY, JSON.stringify(toSave));
        } catch (e) {
            console.warn('Could not save known faces:', e);
        }
    }

    // Find matching known face
    function findKnownFace(descriptor) {
        for (const known of knownFaces) {
            const distance = faceapi.euclideanDistance(known.descriptor, descriptor);
            const confidence = 1 - distance;
            if (confidence >= CONFIG.CONFIDENCE_THRESHOLD) {
                return { ...known, confidence };
            }
        }
        return null;
    }

    // Add face to known faces
    function addKnownFace(name, descriptor) {
        // Check if already exists
        const existing = findKnownFace(descriptor);
        if (existing) {
            console.log('Face already known as:', existing.name);
            return false;
        }

        knownFaces.push({
            name,
            descriptor: new Float32Array(descriptor),
            timestamp: new Date().toISOString()
        });
        saveKnownFaces();
        console.log('✅ Saved new known face:', name);
        return true;
    }

    // Greet a returning user - SILENT (no voice), just visual toast
    function greetReturningUser(name, retryCount = 0) {
        console.log('👋 Greeting returning user (silent):', name);

        // NO VOICE - just show visual toast
        if (typeof KelionSubscription !== 'undefined') {
            KelionSubscription.showSuccess(`Bine ai revenit, ${name}!`);
        }

        console.log('✅ Silent greeting shown for:', name);
        return true;
    }

    // Enroll the original user's face and check if known
    let enrollRetryCount = 0;
    const MAX_ENROLL_RETRIES = 10;

    async function enrollFace() {
        const video = getVideoElement();
        if (!video || !video.srcObject) {
            console.warn('🔐 No camera available for face enrollment');
            return false;
        }

        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (detection) {
                enrolledDescriptor = detection.descriptor;
                originalUserEmail = localStorage.getItem('kelion_user_email') || 'free_trial_user';
                enrollRetryCount = 0; // Reset counter on success

                // Check if this is a known returning user
                const knownUser = findKnownFace(detection.descriptor);

                if (knownUser) {
                    // Greet by name!
                    console.log('👋 Welcome back:', knownUser.name);
                    greetReturningUser(knownUser.name);
                } else {
                    console.log('👤 New user detected, will learn their name');
                }

                // Start periodic checking
                startSecurityCheck();
                return true;
            } else {
                enrollRetryCount++;
                if (enrollRetryCount < MAX_ENROLL_RETRIES) {
                    console.log(`🔐 No face detected for enrollment (${enrollRetryCount}/${MAX_ENROLL_RETRIES}), will retry...`);
                    setTimeout(enrollFace, 10000); // 10s between retries
                } else {
                    console.log('🔐 Max enrollment retries reached, giving up face security');
                }
                return false;
            }
        } catch (e) {
            console.error('❌ Face enrollment error:', e);
            return false;
        }
    }

    // Compare current face with enrolled face
    async function checkIdentity() {
        if (!enrolledDescriptor || isSecurityPaused) return { match: true };

        const video = getVideoElement();
        if (!video || !video.srcObject) return { match: true }; // No camera = skip check

        try {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks(true)
                .withFaceDescriptor();

            if (!detection) {
                // No face detected - person might have left
                console.log('🔐 No face detected - user may have left');
                return { match: true, noFace: true };
            }

            // Calculate similarity (lower distance = more similar)
            const distance = faceapi.euclideanDistance(enrolledDescriptor, detection.descriptor);
            const confidence = 1 - distance;
            const match = confidence >= CONFIG.CONFIDENCE_THRESHOLD;

            console.log(`🔐 Face check: ${match ? 'MATCH' : 'DIFFERENT'} (confidence: ${(confidence * 100).toFixed(1)}%)`);

            return { match, confidence, detection };
        } catch (e) {
            console.error('Face check error:', e);
            return { match: true }; // On error, don't trigger false positive
        }
    }

    // Start periodic security checks
    function startSecurityCheck() {
        if (checkInterval) return;

        console.log('🔐 Starting face security monitoring...');
        checkInterval = setInterval(async () => {
            const result = await checkIdentity();

            if (!result.match && !result.noFace) {
                // Different person detected!
                await onPersonChanged(result);
            }
        }, CONFIG.CHECK_INTERVAL_MS);
    }

    // Stop security checks
    function stopSecurityCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    // Handle person change detection - K greets the new person verbally
    async function onPersonChanged(result) {
        console.log('👤 NEW PERSON DETECTED!');
        isSecurityPaused = true;

        // Check if user is LOGGED IN (has account)
        const authToken = localStorage.getItem('kelion_auth_token');
        const userEmail = localStorage.getItem('kelion_user_email');
        const userName = localStorage.getItem('kelion_user_name');

        // For LOGGED IN users: use account name, no modal needed
        if (authToken && (userName || userEmail)) {
            const displayName = userName || userEmail.split('@')[0];
            console.log('👤 Logged user detected:', displayName);

            // Capture photo and save face linked to account
            const photoData = await captureSecurityPhoto();
            const video = getVideoElement();

            if (video && video.srcObject) {
                try {
                    const detection = await faceapi
                        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks(true)
                        .withFaceDescriptor();

                    if (detection) {
                        // Link face to account name
                        addKnownFace(displayName, detection.descriptor);
                        console.log('📚 Face linked to account:', displayName);
                    }
                } catch (e) {
                    console.warn('Could not capture face for logged user:', e);
                }
            }

            // Log security event
            await logSecurityEvent({
                type: 'logged_user_recognized',
                user_name: displayName,
                user_email: userEmail,
                photo_data: photoData,
                timestamp: new Date().toISOString(),
                approved: true
            });

            // Resume - no modal needed for logged users
            isSecurityPaused = false;

            // Greet by name if recognized
            greetReturningUser(displayName);
            return;
        }

        // For FREE TRIAL / anonymous users: show modal to ask name
        const photoData = await captureSecurityPhoto();

        // NO AUTOMATIC VOICE - just show modal

        // Show modal for FREE TRIAL users only
        showNewPersonModal(photoData);
    }

    // Show friendly modal to ask new person's name
    function showNewPersonModal(photoData) {
        document.getElementById('kelion-security-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'kelion-security-modal';
        modal.innerHTML = `
            <div class="security-overlay"></div>
            <div class="security-modal friendly">
                <div class="security-icon">👋</div>
                <h2>Welcome!</h2>
                <p class="security-message">I noticed you're new here. What's your name?</p>
                
                <div class="security-form">
                    <input type="text" id="security-name-input" placeholder="Enter your name" autocomplete="off">
                    <button onclick="window.kelionFaceSecurity.saveNewPerson()" class="security-btn approve">
                        ✓ Nice to meet you!
                    </button>
                </div>
                
                <p class="security-note">I'll remember you for next time.</p>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #kelion-security-modal .security-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.85); z-index: 100001;
            }
            #kelion-security-modal .security-modal.friendly {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid #d4af37; border-radius: 20px;
                padding: 40px; text-align: center; z-index: 100002;
                max-width: 400px; width: 90%;
                box-shadow: 0 0 50px rgba(212,175,55,0.3);
            }
            #kelion-security-modal .security-icon { font-size: 4rem; margin-bottom: 15px; }
            #kelion-security-modal h2 { color: #d4af37; margin: 0 0 15px; font-size: 1.8rem; }
            #kelion-security-modal .security-message { color: #fff; font-size: 1.1rem; margin: 0 0 20px; }
            #kelion-security-modal .security-form { margin: 20px 0; }
            #kelion-security-modal input {
                width: 100%; padding: 15px; border-radius: 12px;
                border: 1px solid #d4af37; background: #0a0a15; color: #fff;
                font-size: 1.1rem; margin-bottom: 15px; box-sizing: border-box;
                text-align: center;
            }
            #kelion-security-modal .security-btn.approve {
                padding: 15px 30px; border-radius: 12px; border: none;
                font-size: 1.1rem; cursor: pointer;
                background: linear-gradient(135deg, #d4af37, #b8960c);
                color: #000; font-weight: bold;
            }
            #kelion-security-modal .security-note { color: #666; font-size: 0.8rem; margin-top: 20px; }
        `;
        modal.appendChild(style);
        document.body.appendChild(modal);

        // Store photo for later save
        modal.dataset.photoData = photoData || '';

        setTimeout(() => document.getElementById('security-name-input')?.focus(), 100);
    }

    // Save new person with name and photo - also add to known faces
    async function saveNewPerson() {
        const nameInput = document.getElementById('security-name-input');
        const name = nameInput?.value?.trim();
        const modal = document.getElementById('kelion-security-modal');
        const photoData = modal?.dataset?.photoData || await captureSecurityPhoto();

        if (!name) {
            nameInput.style.borderColor = '#ff4444';
            nameInput.placeholder = 'Please tell me your name';
            return;
        }

        const timestamp = new Date().toISOString();

        // Get current face descriptor and save to known faces for future recognition
        const video = getVideoElement();
        if (video && video.srcObject) {
            try {
                const detection = await faceapi
                    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

                if (detection) {
                    addKnownFace(name, detection.descriptor);
                    console.log('📚 Face linked to name:', name);
                }
            } catch (e) {
                console.warn('Could not capture face descriptor:', e);
            }
        }

        // Log security event with full details
        await logSecurityEvent({
            type: 'new_person_introduced',
            new_person_name: name,
            photo_data: photoData,
            original_user: originalUserEmail,
            timestamp: timestamp,
            approved: true,
            details: {
                date: new Date().toLocaleDateString(),
                time: new Date().toLocaleTimeString(),
                seconds: new Date().getSeconds()
            }
        });

        // Close modal
        modal?.remove();
        isSecurityPaused = false;

        // Make K say welcome with their name
        if (typeof KelionSubscription !== 'undefined') {
            KelionSubscription.showSuccess(`Nice to meet you, ${name}! I'll remember you.`);
        }

        console.log(`✅ New person saved: ${name} at ${timestamp}`);
    }

    // Show security alert modal
    function showSecurityModal(confidence) {
        // Remove existing modal if any
        document.getElementById('kelion-security-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'kelion-security-modal';
        modal.innerHTML = `
            <div class="security-overlay"></div>
            <div class="security-modal">
                <div class="security-icon">🔒</div>
                <h2>Security Alert</h2>
                <p class="security-message">You don't appear to be the account holder.</p>
                <p class="security-sub">The account owner must approve your access.</p>
                
                <div class="security-form" id="security-new-person-form">
                    <p>Please enter your name to continue:</p>
                    <input type="text" id="security-name-input" placeholder="Your name" autocomplete="off">
                    <button onclick="window.kelionFaceSecurity.approveNewPerson()" class="security-btn approve">
                        ✓ Request Access
                    </button>
                    <button onclick="window.kelionFaceSecurity.denyAccess()" class="security-btn deny">
                        ✗ Cancel
                    </button>
                </div>
                
                <p class="security-note">This event will be logged for security.</p>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #kelion-security-modal .security-overlay {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.9); z-index: 100001;
            }
            #kelion-security-modal .security-modal {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid #ff4444; border-radius: 20px;
                padding: 40px; text-align: center; z-index: 100002;
                max-width: 400px; width: 90%;
                box-shadow: 0 0 50px rgba(255,68,68,0.3);
            }
            #kelion-security-modal .security-icon { font-size: 4rem; margin-bottom: 15px; }
            #kelion-security-modal h2 { color: #ff4444; margin: 0 0 15px; font-size: 1.8rem; }
            #kelion-security-modal .security-message { color: #fff; font-size: 1.1rem; margin: 0 0 10px; }
            #kelion-security-modal .security-sub { color: #888; font-size: 0.9rem; margin: 0 0 25px; }
            #kelion-security-modal .security-form { margin: 20px 0; }
            #kelion-security-modal .security-form p { color: #ccc; margin-bottom: 15px; }
            #kelion-security-modal input {
                width: 100%; padding: 12px 15px; border-radius: 10px;
                border: 1px solid #444; background: #0a0a15; color: #fff;
                font-size: 1rem; margin-bottom: 15px; box-sizing: border-box;
            }
            #kelion-security-modal .security-btn {
                padding: 12px 25px; border-radius: 10px; border: none;
                font-size: 1rem; cursor: pointer; margin: 5px;
                transition: all 0.3s;
            }
            #kelion-security-modal .security-btn.approve {
                background: linear-gradient(135deg, #00cc6a, #00aa55);
                color: #fff;
            }
            #kelion-security-modal .security-btn.deny {
                background: transparent; border: 1px solid #666; color: #888;
            }
            #kelion-security-modal .security-note { color: #666; font-size: 0.75rem; margin-top: 20px; }
        `;
        modal.appendChild(style);
        document.body.appendChild(modal);

        // Focus on input
        setTimeout(() => document.getElementById('security-name-input')?.focus(), 100);
    }

    // Approve new person access
    async function approveNewPerson() {
        const nameInput = document.getElementById('security-name-input');
        const name = nameInput?.value?.trim();

        if (!name) {
            nameInput.style.borderColor = '#ff4444';
            nameInput.placeholder = 'Please enter your name';
            return;
        }

        // Capture photo
        const photoData = await captureSecurityPhoto();

        // Log security event
        await logSecurityEvent({
            type: 'person_change_approved',
            new_person_name: name,
            photo_data: photoData,
            original_user: originalUserEmail,
            timestamp: new Date().toISOString(),
            approved: true
        });

        // Close modal and resume
        document.getElementById('kelion-security-modal')?.remove();
        isSecurityPaused = false;

        // Show confirmation
        if (typeof KelionSubscription !== 'undefined') {
            KelionSubscription.showSuccess(`Welcome, ${name}! Access granted.`);
        }

        console.log(`✅ New person approved: ${name}`);
    }

    // Deny access
    async function denyAccess() {
        await logSecurityEvent({
            type: 'person_change_denied',
            original_user: originalUserEmail,
            timestamp: new Date().toISOString(),
            approved: false
        });

        document.getElementById('kelion-security-modal')?.remove();

        // Redirect to GDPR/start
        window.location.href = '/gdpr.html';
    }

    // Capture security photo
    async function captureSecurityPhoto() {
        const video = getVideoElement();
        if (!video) return null;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);

            return canvas.toDataURL('image/jpeg', 0.8);
        } catch (e) {
            console.error('Failed to capture security photo:', e);
            return null;
        }
    }

    // Log security event to server
    async function logSecurityEvent(event) {
        try {
            const authToken = localStorage.getItem('kelion_auth_token');

            // Skip if not authenticated - memory requires auth
            if (!authToken) {
                console.log('📝 Skipping security log - user not authenticated');
                return;
            }

            await fetch('/.netlify/functions/memory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    action: 'security_event',
                    event: event
                })
            });

            console.log('📝 Security event logged:', event.type);
        } catch (e) {
            console.error('Failed to log security event:', e);
            // Store locally as fallback
            const events = JSON.parse(localStorage.getItem('kelion_security_events') || '[]');
            events.push(event);
            localStorage.setItem('kelion_security_events', JSON.stringify(events));
        }
    }

    // Main initialization
    async function init() {
        // Wait for face-api.js to load
        if (typeof faceapi === 'undefined') {
            console.warn('🔐 face-api.js not loaded, face security disabled');
            return false;
        }

        const modelsLoaded = await initModels();
        if (!modelsLoaded) return false;

        // Load previously saved known faces
        loadKnownFaces();

        // Delay enrollment to ensure camera is ready
        setTimeout(enrollFace, CONFIG.ENROLLMENT_DELAY_MS);

        return true;
    }

    // Expose globally
    window.kelionFaceSecurity = {
        init,
        enrollFace,
        checkIdentity,
        startSecurityCheck,
        stopSecurityCheck,
        approveNewPerson,
        saveNewPerson,
        denyAccess,
        isActive: () => !!checkInterval,
        isPaused: () => isSecurityPaused
    };

    console.log('🔐 Kelion Face Security module loaded');
})();
