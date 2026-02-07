// Kelion WebRTC Real-time Voice Module
// Direct connection to OpenAI Realtime API for lowest latency
// With K animation sync

(function () {
    'use strict';

    // Initialize Professional Modules
    let smartExecutor = null;
    let languageLearner = null;
    let advancedVAD = null;
    let wakeWordDetector = null; // 🆕 Wake Word
    let screenShare = null; // 🆕 Screen Sharing

    // Wait for modules to load
    window.addEventListener('DOMContentLoaded', () => {
        if (window.SmartFunctionExecutor) {
            smartExecutor = new window.SmartFunctionExecutor();
            console.log('✅ Smart Function Executor initialized');
        }
        if (window.LanguageLearning) {
            languageLearner = new window.LanguageLearning();
            console.log('✅ Language Learning initialized');
        }
        if (window.KelionAdvancedVAD) {
            advancedVAD = new window.KelionAdvancedVAD();
            console.log('✅ Advanced VAD ready (will init on voice start)');
        }

        // 🆕 WAKE WORD INITIALIZATION
        if (window.KelionWakeWord) {
            wakeWordDetector = new window.KelionWakeWord(() => {
                console.log('🎙️ Wake word triggered - activating K!');
                if (!isActive) {
                    startRealtimeSession();
                }
            });

            // Fetch Access Key and start listening
            fetch('/.netlify/functions/get-porcupine-key')
                .then(r => r.json())
                .then(data => {
                    if (data.key) {
                        wakeWordDetector.start(data.key);
                    }
                })
                .catch(err => console.warn('Wake word init failed:', err));
        }

        // 🆕 SCREEN SHARE INITIALIZATION
        if (window.KelionScreenShare) {
            screenShare = new window.KelionScreenShare();
            console.log('✅ Screen Share ready (user can start sharing)');

            // Expose global function for K to receive visual context
            window.sendVisualContext = (insights) => {
                if (isActive && dc && dc.readyState === 'open') {
                    // Send visual context via data channel
                    dc.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                            type: 'message',
                            role: 'user',
                            content: [{
                                type: 'input_text',
                                text: `[Visual Context] ${insights}`
                            }]
                        }
                    }));
                    console.log('👁️ Sent visual context to K');
                }
            };
        }
    });

    let pc = null;
    let dc = null;
    let localStream = null;
    let remoteAudio = null;
    let isActive = false;
    let isKResponding = false; // Track if K has an active response (to prevent cancel errors)

    // Audio analysis for K animation
    let audioContext = null;
    let analyser = null;
    let volumeCheckInterval = null;
    let isKSpeaking = false;
    let speakingDebounceTimer = null; // Debounce timer for smooth animation
    const SPEAKING_DEBOUNCE_MS = 300; // Wait 300ms of silence before stopping animation

    // Create remote audio element
    function createRemoteAudio() {
        if (remoteAudio) return remoteAudio;
        remoteAudio = document.createElement('audio');
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
        remoteAudio.id = 'kelion-realtime-audio';
        document.body.appendChild(remoteAudio);
        return remoteAudio;
    }

    // Setup audio analysis for animation sync
    function setupAudioAnalyzer(stream) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            source.connect(analyser);
            // Don't connect to destination - we just analyze

            console.log('🎙️ Audio analyzer ready for K animation');

            // Start monitoring volume
            startVolumeMonitor();
        } catch (e) {
            console.warn('🎙️ Audio analyzer failed:', e.message);
        }
    }

    // Monitor audio volume and control K's mouth
    function startVolumeMonitor() {
        if (volumeCheckInterval) return;
        if (!analyser) {
            console.warn('🎙️ Cannot start volume monitor - no analyser');
            return;
        }

        try {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            volumeCheckInterval = setInterval(() => {
                try {
                    if (!analyser || !isActive) return;

                    analyser.getByteFrequencyData(dataArray);

                    // Calculate average volume (0-255)
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avgVolume = sum / dataArray.length;
                    const normalizedVolume = avgVolume / 255; // 0-1

                    // Threshold for "speaking" detection
                    const SPEAK_THRESHOLD = 0.05;

                    if (normalizedVolume > SPEAK_THRESHOLD) {
                        // Cancel any pending "stop speaking" timer
                        if (speakingDebounceTimer) {
                            clearTimeout(speakingDebounceTimer);
                            speakingDebounceTimer = null;
                        }

                        if (!isKSpeaking) {
                            isKSpeaking = true;
                            triggerKSpeaking(true, normalizedVolume);
                        } else {
                            // Update volume for mouth animation intensity
                            updateMouthIntensity(normalizedVolume);
                        }
                    } else {
                        // Volume dropped - use debounce before stopping animation
                        if (isKSpeaking && !speakingDebounceTimer) {
                            speakingDebounceTimer = setTimeout(() => {
                                isKSpeaking = false;
                                triggerKSpeaking(false, 0);
                                speakingDebounceTimer = null;
                            }, SPEAKING_DEBOUNCE_MS);
                        }
                    }
                } catch (e) {
                    // Silently ignore interval errors
                }
            }, 50); // Check 20 times per second

            console.log('🎙️ Volume monitor started');
        } catch (e) {
            console.warn('🎙️ Failed to start volume monitor:', e.message);
        }
    }

    function stopVolumeMonitor() {
        if (volumeCheckInterval) {
            clearInterval(volumeCheckInterval);
            volumeCheckInterval = null;
        }
        if (audioContext) {
            audioContext.close().catch(() => { });
            audioContext = null;
        }
        analyser = null;
        isKSpeaking = false;
    }

    // Trigger K speaking animation
    function triggerKSpeaking(speaking, volume) {
        // Call app.html functions if they exist
        if (typeof window.setSpeaking === 'function') {
            window.setSpeaking(speaking);
        }

        if (speaking) {
            // Start lip sync
            if (typeof window.startLipSyncWithMorphTargets === 'function') {
                window.startLipSyncWithMorphTargets();
            }
            console.log('🎭 K speaking: ON');
        } else {
            // Stop lip sync
            if (typeof window.stopLipSyncWithMorphTargets === 'function') {
                window.stopLipSyncWithMorphTargets();
            }
            console.log('🎭 K speaking: OFF');
        }
    }

    // Update mouth animation intensity based on volume
    function updateMouthIntensity(volume) {
        // If app.html has a mouth volume control, use it
        if (typeof window.updateMouthVolume === 'function') {
            window.updateMouthVolume(volume);
        }
    }

    // NOTE: Duplicate setupAudioAnalyzer removed — uses version at line ~103 with proper
    // debouncing and single AudioContext. The duplicate was creating a second AudioContext
    // and triggering K speaking on/off rapidly without debounce, causing audio overlap.

    // Start WebRTC session with direct OpenAI connection
    let isConnecting = false; // Prevent concurrent connection attempts

    async function startRealtimeSession() {
        if (isActive) {
            console.log('🎙️ Realtime session already active');
            return;
        }

        if (isConnecting) {
            console.log('🎙️ Connection already in progress, skipping');
            return;
        }

        isConnecting = true;
        console.log('🎙️ Starting direct WebRTC realtime session...');
        // Note: isActive is set to true only AFTER successful connection (see below)
        updateVoiceUI(true);

        try {
            // Step 1: Get ephemeral token from our backend
            console.log('🎙️ Fetching ephemeral token...');

            // Read locked language from Language Learning
            let userLanguage = 'auto';
            if (languageLearner) {
                const stats = languageLearner.getStats();
                if (stats.isLocked && stats.userLanguage) {
                    userLanguage = stats.userLanguage;
                    console.log(`🔒 [LangLearn] Sending locked language to backend: ${userLanguage}`);
                }
            }

            const tokenResp = await fetch('/.netlify/functions/realtime-token', {
                headers: {
                    'x-user-language': userLanguage
                }
            });
            if (!tokenResp.ok) {
                throw new Error('Failed to get realtime token');
            }
            const tokenData = await tokenResp.json();
            const ephemeralKey = tokenData.client_secret?.value;

            if (!ephemeralKey) {
                throw new Error('No client_secret in token response');
            }
            console.log('🎙️ Token received, expires:', tokenData.expires_at);

            // Step 2: Create PeerConnection
            pc = new RTCPeerConnection();

            // Monitor connection state for debugging
            pc.onconnectionstatechange = () => {
                console.log('🎙️ Connection state:', pc.connectionState);
                if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                    console.error('🎙️ Connection lost:', pc.connectionState);
                    stopRealtimeSession();
                }
            };
            pc.oniceconnectionstatechange = () => {
                console.log('🎙️ ICE state:', pc.iceConnectionState);
            };

            // Step 3: Create remote audio element
            createRemoteAudio();

            // Step 4: Handle remote track (AI voice) + setup animation sync
            pc.ontrack = (e) => {
                const stream = e.streams[0];
                console.log('🎙️ AI audio stream attached');

                // ALWAYS set the audio element first (required for playback)
                remoteAudio.srcObject = stream;
                remoteAudio.volume = 1.0;

                // Try to play immediately
                remoteAudio.play().then(() => {
                    console.log('🔊 Audio playback started');
                }).catch(err => {
                    console.warn('🔊 Autoplay blocked, will play on interaction:', err.message);
                });

                // Apply 10% volume boost using GainNode (enhancement)
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    // Resume AudioContext if suspended (browser autoplay policy)
                    if (ctx.state === 'suspended') {
                        ctx.resume().then(() => console.log('🔊 AudioContext resumed'));
                    }
                    const source = ctx.createMediaStreamSource(stream);
                    const gainNode = ctx.createGain();
                    gainNode.gain.value = 1.1; // 10% volume boost
                    source.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    console.log('🔊 Volume boosted +10%');
                } catch (err) {
                    console.warn('🔊 Volume boost failed (audio still works):', err.message);
                }

                // Setup volume analyzer for K animation
                setupAudioAnalyzer(stream);
            };

            // Step 5: Get mic + camera access (camera for vision analysis)
            try {
                localStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    }
                });

                // Add audio tracks to WebRTC
                localStream.getAudioTracks().forEach(track => pc.addTrack(track, localStream));
                console.log('🎙️ Microphone added to connection');

                // Initialize Advanced VAD (Silero ML) for client-side metrics
                if (advancedVAD && !advancedVAD.isActive) {
                    try {
                        await advancedVAD.init({
                            onSpeechStart: (audio) => {
                                console.log('✅ [Silero] Speech detected - confidence high');
                                // Visual feedback: User is speaking clearly
                            },
                            onSpeechEnd: (audio) => {
                                console.log('🔇 [Silero] Speech ended');
                                // Log learned silence pattern
                                const stats = advancedVAD.getStats();
                                console.log(`📊 [Silero] Learned silence: ${stats.avgSilenceDuration}ms`);
                            },
                            onVADMisfire: () => {
                                console.warn('⚠️ [Silero] False positive - background noise');
                            }
                        });
                        advancedVAD.start();
                        console.log('✅ Advanced VAD (Silero) running in parallel with OpenAI');
                    } catch (vadErr) {
                        console.warn('⚠️ Advanced VAD failed to start:', vadErr);
                        // Continue without VAD - OpenAI's VAD still works
                    }
                }

                // Create hidden video element for vision analysis
                let videoEl = document.querySelector('video#kelion-vision-feed');
                if (!videoEl) {
                    videoEl = document.createElement('video');
                    videoEl.id = 'kelion-vision-feed';
                    videoEl.autoplay = true;
                    videoEl.playsInline = true;
                    videoEl.muted = true;
                    videoEl.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
                    document.body.appendChild(videoEl);
                }
                videoEl.srcObject = localStream;
                console.log('👁️ Camera ready for vision analysis');

            } catch (e) {
                console.error('🎙️ Microphone/Camera denied:', e.message);
                // Try audio-only fallback
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                    console.log('🎙️ Audio-only mode (camera denied)');
                } catch (e2) {
                    console.error('🎙️ All media denied:', e2.message);
                    stopRealtimeSession();
                    return;
                }
            }

            // Step 6: Create data channel for events
            dc = pc.createDataChannel('oai-events');
            dc.onopen = async () => {
                console.log('🎙️ DataChannel open - pre-fetching location and weather...');

                // === PRE-FETCH GPS + WEATHER ===
                let locationInfo = 'Location unknown';
                let weatherInfo = 'Weather unknown';

                try {
                    let lat, lon, city, address;

                    // Method 1: Browser GPS (most accurate for mobile)
                    try {
                        console.log('📍 Trying browser GPS (high accuracy)...');
                        const pos = await new Promise((res, rej) =>
                            navigator.geolocation.getCurrentPosition(res, rej, {
                                enableHighAccuracy: true,
                                timeout: 10000,
                                maximumAge: 0
                            }));
                        lat = pos.coords.latitude;
                        lon = pos.coords.longitude;
                        console.log('📍 Browser GPS obtained:', lat, lon, 'accuracy:', pos.coords.accuracy, 'm');
                    } catch (gpsErr) {
                        console.warn('📍 Browser GPS failed:', gpsErr.message);
                    }

                    // Method 2: IP-based geolocation (fallback for desktop)
                    if (!lat || !lon) {
                        try {
                            console.log('📍 Trying IP-based geolocation (fallback)...');
                            const ipRes = await fetch('http://ip-api.com/json/?fields=lat,lon,city,regionName,country');
                            const ipData = await ipRes.json();
                            if (ipData.lat && ipData.lon) {
                                lat = ipData.lat;
                                lon = ipData.lon;
                                city = ipData.city || 'Unknown';
                                address = `${ipData.city}, ${ipData.regionName}, ${ipData.country}`;
                                console.log('📍 IP-based location:', lat, lon, city);
                            }
                        } catch (ipErr) {
                            console.warn('📍 IP geolocation failed:', ipErr.message);
                        }
                    }

                    // Reverse geocoding for full address
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=18`);
                    const geoData = await geoRes.json();
                    address = geoData.display_name || address || 'Unknown location';
                    city = geoData.address?.city || geoData.address?.town || geoData.address?.village || city || 'Unknown';
                    const postcode = geoData.address?.postcode || '';
                    locationInfo = `${address} (${city}, ${postcode})`;
                    console.log('📍 Final Address:', locationInfo);

                    // Get weather
                    const weatherRes = await fetch(`/.netlify/functions/weather?lat=${lat}&lon=${lon}`);
                    const weatherData = await weatherRes.json();
                    if (weatherData.success && weatherData.data) {
                        const w = weatherData.data;
                        weatherInfo = `${w.temp}°C, ${w.description}, feels like ${w.feels_like}°C, humidity ${w.humidity}%, wind ${w.wind_speed} m/s`;
                        console.log('🌤️ Weather:', weatherInfo);

                        // NOTE: Weather map NOT shown at startup - only when user asks
                        // showWeatherWorkspace(lat, lon, `${city}: ${w.temp}°C ${w.description}`);
                    }

                    // Store for later use
                    window.kelionLocation = { lat, lon, city, address, postcode };
                    window.kelionWeather = weatherData.data;

                } catch (e) {
                    console.warn('⚠️ Pre-fetch failed:', e.message);
                }

                // Inject real data into conversation context
                sendEvent({
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'system',
                        content: [{
                            type: 'text', text: `[REAL-TIME DATA - USE THIS, DO NOT GUESS]
User's EXACT location: ${locationInfo}
Current weather: ${weatherInfo}
When user asks about weather or location, use THIS data. Do not make up different data.` }]
                    }
                });

                // AUTO-GREETING DISABLED - K waits silently until user speaks first
                // No automatic voice at startup
            };
            dc.onclose = () => console.log('🎙️ DataChannel closed');
            dc.onerror = (e) => console.error('🎙️ DataChannel error:', e);
            dc.onmessage = (e) => handleRealtimeEvent(e.data);

            // Step 7: Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Step 8: Send offer directly to OpenAI Realtime API
            console.log('🎙️ Connecting directly to OpenAI Realtime...');
            const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ephemeralKey}`,
                    'Content-Type': 'application/sdp'
                },
                body: offer.sdp
            });

            if (!sdpResp.ok) {
                const errText = await sdpResp.text();
                console.error('🎙️ OpenAI SDP error:', errText);
                throw new Error('OpenAI connection failed');
            }

            // Step 9: Set remote description
            const answerSdp = await sdpResp.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            console.log('🎙️ ✅ REALTIME VOICE ACTIVE - Direct connection with animation sync');
            // NOW set isActive = true (connection fully established)
            isActive = true;
            isConnecting = false;

        } catch (error) {
            console.error('🎙️ Realtime session error:', error);
            isConnecting = false;
            stopRealtimeSession();
        }
    }

    // Stop session
    function stopRealtimeSession() {
        console.log('🎙️ Stopping realtime session...');
        isActive = false;

        // Stop animation
        triggerKSpeaking(false, 0);
        stopVolumeMonitor();

        try { dc && dc.close(); } catch { }
        try { pc && pc.close(); } catch { }

        if (localStream) {
            for (const t of localStream.getTracks()) t.stop();
        }

        dc = null;
        pc = null;
        localStream = null;

        updateVoiceUI(false);
        console.log('🎙️ Session stopped');
    }

    // Mute/unmute microphone to prevent echo feedback
    function muteMicrophone(mute) {
        if (!localStream) return;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !mute;
        });
        console.log('🎙️ Microphone:', mute ? 'MUTED (K speaking)' : 'UNMUTED');
    }

    // Interrupt K immediately (barge-in)
    function interruptNow(source = 'manual') {
        if (!dc || dc.readyState !== 'open') return;

        // Stop animation immediately
        triggerKSpeaking(false, 0);

        // For brain-takeover, ALWAYS cancel any pending/in-progress response
        if (source === 'brain-takeover') {
            sendEvent({ type: 'response.cancel' });
            isKResponding = false;
            console.log('🧠 BRAIN TAKEOVER: GPT response cancelled!');
        } else if (isKResponding) {
            // Normal interrupt - only cancel if responding
            sendEvent({ type: 'response.cancel' });
            isKResponding = false;
        }

        // Clear audio output buffer
        sendEvent({ type: 'output_audio_buffer.clear' });

        // Briefly mute for instant feel
        if (remoteAudio) {
            remoteAudio.muted = true;
            setTimeout(() => { if (remoteAudio) remoteAudio.muted = false; }, 300);
        }

        console.log('🎙️ Interrupted:', source);
    }

    // Send event to OpenAI via DataChannel
    function sendEvent(obj) {
        if (!dc || dc.readyState !== 'open') return;
        try {
            dc.send(JSON.stringify(obj));
        } catch (e) {
            console.error('🎙️ Send failed:', e.message);
        }
    }

    // Handle incoming events from OpenAI
    async function handleRealtimeEvent(raw) {
        let evt = null;
        try { evt = JSON.parse(raw); } catch { return; }

        if (!evt || !evt.type) return;

        // K started responding - MUTE mic to prevent echo loop
        if (evt.type === 'response.created') {
            isKResponding = true;
            muteMicrophone(true);
            return;
        }

        // K finished responding - UNMUTE mic
        if (evt.type === 'response.done') {
            isKResponding = false;
            muteMicrophone(false);
            return;
        }

        // Barge-in: user started speaking
        if (evt.type === 'input_audio_buffer.speech_started') {
            interruptNow('barge-in');
            return;
        }

        // User transcript (what user said) - TOTUL TRECE PRIN KIMI
        if (evt.type === 'conversation.item.input_audio_transcription.completed' && evt.transcript) {
            console.log('🎙️ YOU:', evt.transcript);
            addMessageToChat('user', evt.transcript);

            // Language Learning: Detect and lock after 3 inputs
            if (languageLearner && evt.transcript) {
                const detectedLang = languageLearner.detect(evt.transcript);
                const stats = languageLearner.getStats();

                if (stats.isLocked) {
                    console.log(`🔒 [LangLearn] Locked to: ${stats.userLanguage}`);
                } else {
                    console.log(`🌍 [LangLearn] Detected: ${detectedLang} (${stats.detectionsCount}/3)`);
                }
            }

            const msg = evt.transcript.toLowerCase().trim();

            // Șterg popup vechi dacă există
            const oldPopup = document.getElementById('brain-workspace-panel');
            if (oldPopup) oldPopup.remove();

            // OPREȘTE GPT-4o din a răspunde - KIMI preia controlul
            interruptNow('kimi-takeover');

            // TOTUL TRECE PRIN KIMI
            console.log('🟡 KIMI: Preia controlul complet...');
            try {
                const kimiResponse = await fetch('/.netlify/functions/supreme-brain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        question: evt.transcript,
                        context: `User location: ${window.kelionLocation?.city || 'unknown'}. Weather: ${JSON.stringify(window.kelionWeather) || 'unknown'}.`
                    })
                });

                const kimiData = await kimiResponse.json();
                const answer = kimiData.answer || kimiData.response || 'Nu am putut procesa cererea.';

                console.log('🟡 KIMI răspunde:', answer);
                addMessageToChat('assistant', answer);

                // Execută acțiunile UI de la Kimi
                if (kimiData.actions && kimiData.actions.length > 0) {
                    executeKimiActions(kimiData.actions);
                }

                // Trimite răspunsul Kimi în OpenAI Realtime ca să-l vorbească K
                // NU apelăm speakWithTTS pentru a evita voci multiple
                sendEvent({
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'assistant',
                        content: [{ type: 'text', text: answer }]
                    }
                });
                sendEvent({ type: 'response.create' });

            } catch (err) {
                console.error('🟡 KIMI error:', err);
                addMessageToChat('assistant', 'Eroare la procesare. Încearcă din nou.');
            }

            return;
        }

        // AI transcript (what K said)
        if (evt.type === 'response.audio_transcript.done' && evt.transcript) {
            console.log('🎙️ K:', evt.transcript);
            addMessageToChat('assistant', evt.transcript);
            return;
        }

        // Error handling
        if (evt.type === 'error') {
            console.error('🎙️ Realtime error:', evt.error?.message || 'unknown');
            return;
        }

        // Function call requested by K
        if (evt.type === 'response.function_call_arguments.done') {
            handleFunctionCall(evt);
            return;
        }

        // Session created confirmation
        if (evt.type === 'session.created') {
            console.log('🎙️ Session confirmed by OpenAI');
            // Send initial context (location if available)
            sendInitialContext();
            return;
        }
    }

    // Handle function calls from K
    async function handleFunctionCall(evt) {
        const fnName = evt.name;
        const args = JSON.parse(evt.arguments || '{}');
        const callId = evt.call_id;

        console.log('🎙️ Function call:', fnName, args);

        let result = '';

        try {
            // Use Smart Executor if available (professional mode with retry/timeout)
            if (smartExecutor) {
                console.log('🚀 Using Smart Executor:', fnName);
                const execResult = await smartExecutor.execute(fnName, args);
                result = execResult.success ? JSON.stringify(execResult.data) : execResult.userMessage;
            } else {
                // Fallback to manual handling
                switch (fnName) {
                    case 'generate_image':
                        const imgResponse = await fetch('/.netlify/functions/generate-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: args.prompt })
                        });
                        const imgData = await imgResponse.json();
                        if (imgData.success && imgData.imageUrl) {
                            showImageWorkspace(imgData.imageUrl, args.prompt);
                            result = `Image generated: ${imgData.revisedPrompt || args.prompt}`;
                        } else {
                            result = 'Image generation failed';
                        }
                        break;

                    case 'generate_video':
                        result = 'Generating video... This may take up to 2 minutes.';
                        sendFunctionResult(callId, result);
                        const vidResponse = await fetch('/.netlify/functions/generate-video', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: args.prompt })
                        });
                        const vidData = await vidResponse.json();
                        if (vidData.success && vidData.videoUrl) {
                            showVideoWorkspace(vidData.videoUrl, args.prompt);
                            result = 'Video generated successfully!';
                        } else {
                            result = 'Video generation failed';
                        }
                        break;

                    default:
                        result = 'Function not implemented';
                }
            }
        } catch (e) {
            console.error('❌ Function error:', fnName, e);
            result = 'Error: ' + e.message;
        }

        // Send result back to K
        sendFunctionResult(callId, result);
    }

    // ============ EXECUTE KIMI UI ACTIONS ============
    // Acțiuni UI primite de la supreme-brain.js
    function executeKimiActions(actions) {
        if (!actions || !Array.isArray(actions)) return;

        console.log('🎯 Executing Kimi actions:', actions);

        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'openWorkspace':
                        if (window.kWorkspace) {
                            window.kWorkspace.open();
                            console.log('🖥️ Workspace opened via Kimi');
                        }
                        break;

                    case 'showImage':
                        if (window.kWorkspace && action.url) {
                            window.kWorkspace.open();
                            window.kWorkspace.showImage(action.url, action.caption || 'Imagine generată');
                            console.log('🖼️ Image displayed:', action.url);
                        }
                        break;

                    case 'showVideo':
                        if (window.kWorkspace && action.url) {
                            window.kWorkspace.open();
                            window.kWorkspace.showVideo(action.url, action.caption || 'Video generat');
                            console.log('🎬 Video displayed:', action.url);
                        }
                        break;

                    case 'showWeatherMap':
                        if (action.lat && action.lon) {
                            showWeatherWorkspace(action.lat, action.lon, action.info || 'Hartă meteo');
                            console.log('🌤️ Weather map displayed:', action.lat, action.lon);
                        }
                        break;

                    case 'showLocation':
                        navigator.geolocation.getCurrentPosition(
                            pos => showLocationWorkspace(pos.coords.latitude, pos.coords.longitude, 'Locația ta'),
                            err => console.warn('📍 Location failed:', err.message)
                        );
                        break;

                    case 'navigate':
                        if (action.destination) {
                            navigator.geolocation.getCurrentPosition(
                                pos => handleNavigation(action.destination, pos.coords.latitude, pos.coords.longitude, 'driving'),
                                err => console.warn('🗺️ Navigation failed:', err.message)
                            );
                        }
                        break;

                    default:
                        console.log('❓ Unknown action type:', action.type);
                }
            } catch (e) {
                console.error('❌ Action execution failed:', action.type, e.message);
            }
        }
    }

    // ============ BRAIN ORCHESTRATOR ============
    // LOGICĂ STRICTĂ:
    // - Conversație simplă → SKIP complet, GPT răspunde singur
    // - Căutări/decizii complexe → Brain preia EXCLUSIV, GPT nu răspunde
    async function brainOrchestrator(userMessage) {
        const msg = userMessage.toLowerCase().trim();
        console.log('🧠 BRAIN: Analiză cerere:', userMessage);

        // Șterg popup-ul vechi dacă există
        const oldPopup = document.getElementById('brain-workspace-panel');
        if (oldPopup) oldPopup.remove();

        // === DETECTARE: Ce necesită căutare/procesare? ===
        const needsBrain = /vreme|weather|grade|temperatura|cauta|search|find|gaseste|unde e|where is|distanta|distance|cat de|how far|how much|cine e|who is|ce este|what is|pret|price|stiri|news|info|spune-mi despre|arata-mi|show me|afla|lidl|tesco|magazin|shop|ora|time|data|date/i.test(msg);

        // === WORKSPACE: Deschide zona de lucru prin voce ===
        const workspaceTriggers = ['deschide zona de lucru', 'open workspace', 'deschide workspace',
            'zona de lucru', 'workspace', 'k deschide zona', 'k open workspace'];
        const isWorkspaceRequest = workspaceTriggers.some(t => msg.includes(t));

        if (isWorkspaceRequest) {
            console.log('🖥️ BRAIN: Workspace request detected via voice!');
            if (window.kWorkspace) {
                window.kWorkspace.open();
                window.kWorkspace.showText('Zona de lucru este deschisă prin comandă vocală.\n\nPoți folosi butoanele din toolbar:\n• Upload - încarcă fișiere\n• Download - descarcă conținut\n• Copy - copiază în clipboard\n• Fullscreen - ecran complet', 'K Workspace');
            }
            // Spune utilizatorului
            speakWithTTS('Am deschis zona de lucru pentru tine.');
            return 'HANDLED'; // Brain a preluat
        }

        // === Verifică dacă e conversație simplă (salutări, da/nu, etc.) ===
        const isGreeting = /^(bun[aă]|salut|hello|hi|hey|seara|diminea[tț]a|ziua|noapte)/i.test(msg);
        const isCourtesy = /^(ce faci|cum e[șs]ti|how are|mul[tț]umesc|mersi|thanks|ok|okay|da|nu|pa|bye|la revedere|good|bine|super|perfect|gata)[^\w]*$/i.test(msg);
        const isShort = msg.length < 20 && !needsBrain;

        // === CONVERSAȚIE SIMPLĂ: GPT răspunde singur ===
        if ((isGreeting || isCourtesy || isShort) && !needsBrain) {
            console.log('💬 BRAIN: Conversație simplă detectată - GPT răspunde singur');
            return null; // null = Brain NU preia, GPT răspunde
        }

        // === CERERE COMPLEXĂ: Brain preia EXCLUSIV ===
        console.log('🧠 BRAIN: Cerere complexă - Brain preia controlul exclusiv');

        try {
            // === PASUL 0: OBȚINE GPS REAL ÎN PRIMUL RÂND ===
            console.log('📍 BRAIN: Obțin GPS real...');
            let realLat = null, realLon = null, realCity = 'necunoscut';
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 8000
                    });
                });
                realLat = position.coords.latitude;
                realLon = position.coords.longitude;
                console.log('📍 BRAIN: GPS REAL obținut:', realLat, realLon);

                // Reverse geocoding pentru oraș
                try {
                    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${realLat}&lon=${realLon}&format=json`);
                    const geoData = await geoRes.json();
                    realCity = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'locația ta';
                    console.log('📍 BRAIN: Oraș detectat:', realCity);
                } catch (geoErr) {
                    console.warn('📍 Reverse geocoding eșuat:', geoErr.message);
                }

                // Salvează pentru tot fluxul
                window.kelionLocation = {
                    latitude: realLat, lat: realLat,
                    longitude: realLon, lon: realLon,
                    city: realCity
                };
            } catch (gpsErr) {
                console.error('📍 BRAIN: GPS eșuat - nu pot oferi date fără locație reală:', gpsErr.message);
                // NU folosim fallback - returnăm mesaj politicos
                return {
                    toolResult: "I'm sorry, I cannot provide location-specific information at the moment. Please ensure GPS is enabled and try again.",
                    toolType: 'error'
                };
            }

            // === PASUL 1: Trimite la Smart Brain pentru analiză + verificare ===
            console.log('🧠 BRAIN: Trimit la Smart Brain (GPT-4o + Claude)...');
            const brainResponse = await fetch('/.netlify/functions/smart-brain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: userMessage,
                    context: `User location: ${window.kelionLocation ? JSON.stringify(window.kelionLocation) : 'unknown'}`,
                    requireVerification: true
                })
            });

            let brainData = null;
            if (brainResponse.ok) {
                brainData = await brainResponse.json();
                console.log('🧠 BRAIN: Răspuns de la Smart Brain:', brainData);
            }

            // === PASUL 2: Detectăm dacă e nevoie de tool-uri speciale ===
            const msg = userMessage.toLowerCase();
            let toolResult = null;
            let toolType = 'general';

            // Detectare tip cerere
            if (/vreme|grade|temperatur|afara|ploaie|weather|degrees|forecast/i.test(msg)) {
                toolType = 'weather';
                console.log('🌤️ BRAIN: Detectat VREME - iau date de la API cu GPS:', realLat, realLon);
                // FOLOSEȘTE API WEATHER CU COORDONATELE GPS!
                try {
                    const weatherRes = await fetch(`/.netlify/functions/weather?lat=${realLat}&lon=${realLon}`);
                    const weatherData = await weatherRes.json();
                    if (weatherData.success && weatherData.data) {
                        const w = weatherData.data;
                        toolResult = `Vremea în ${w.city || realCity}: ${w.temp}°C, ${w.description || 'N/A'}. Simte ca ${w.feels_like}°C. Umiditate: ${w.humidity}%. Vânt: ${w.wind_speed} m/s.`;
                        // AFIȘEAZĂ HARTA METEO în panoul din dreapta!
                        showWeatherWorkspace(realLat, realLon, toolResult);
                    } else {
                        toolResult = await executeWebSearch('vremea acum live temperatura ' + realCity);
                    }
                } catch (e) {
                    console.warn('🌤️ Weather API failed:', e.message);
                    toolResult = await executeWebSearch('vremea acum live temperatura ' + realCity);
                }
            } else if (/unde (ma aflu|sunt)|locati|where am i|my location|gps/i.test(msg)) {
                toolType = 'location';
                console.log('📍 BRAIN: Detectat LOCAȚIE - obțin GPS...');
                // GPS deja obținut la PASUL 0
                toolResult = `Coordonate: ${realLat}, ${realLon}\nOraș: ${realCity}`;
            } else if (/distanta|distance|cat e pana|how far|du-ma|take me|navighe|navigate|ruta|route|lidl|tesco|magazin|shop/i.test(msg)) {
                toolType = 'distance';
                console.log('📏 BRAIN: Detectat NAVIGAȚIE - caut rută...');
                toolResult = await executeWebSearch(userMessage + ' distanță rută de la ' + realCity);
            } else if (/deseneaz[aă]|genereaz[aă] (o )?imagin|creeaz[aă] (o )?poz|fa-mi (o )?poza|draw|create image|generate image|make (a )?picture|imagine cu|poza cu/i.test(msg)) {
                toolType = 'image';
                console.log('🎨 BRAIN: Detectat IMAGINE - generez cu DALL-E...');
                // Extrage promptul pentru imagine
                const imagePrompt = userMessage.replace(/deseneaz[aă]|genereaz[aă]|creeaz[aă]|fa-mi|draw|create|generate|make/gi, '').trim();
                toolResult = imagePrompt || userMessage;
            } else if (/python|cod|code|script|program|execut[aă]|run code|scrie cod/i.test(msg)) {
                toolType = 'code';
                console.log('💻 BRAIN: Detectat COD - deschid editor Python...');
                toolResult = '# Python code generated by K\nprint("Hello from K!")';
            } else if (/document|word|excel|pdf|powerpoint|ppt|fisier|file|upload|incarca|încarcă|deschide|open file|edit[aă]|editeaz[aă]|citeste|read|vizualizeaz[aă]|view/i.test(msg)) {
                toolType = 'document';
                console.log('📄 BRAIN: Detectat DOCUMENT - deschid editor...');
                toolResult = 'Document editor ready - Formate suportate: Word (.docx), Excel (.xlsx), PDF, Video (.mp4)';
            } else if (/microscop|scaneaz[aă]|scan|camera|webcam|usb|captur[aă]|poz[aă]|fotografie|înregistreaz[aă]|record/i.test(msg)) {
                toolType = 'scan';
                console.log('📷 BRAIN: Detectat SCAN/MICROSCOP - deschid camera...');
                toolResult = 'Camera/Microscop ready';
            } else if (/salveaz[aă]|save|download|descarc[aă]|export/i.test(msg)) {
                toolType = 'action_download';
                console.log('💾 BRAIN: Detectat SALVARE/DOWNLOAD...');
                toolResult = 'Downloading content...';
            } else if (/copiaz[aă]|copy|clipboard/i.test(msg)) {
                toolType = 'action_copy';
                console.log('📋 BRAIN: Detectat COPIERE...');
                toolResult = 'Copied to clipboard!';
            } else if (/încarcă|upload|deschide fisier|open file/i.test(msg)) {
                toolType = 'action_upload';
                console.log('📤 BRAIN: Detectat UPLOAD...');
                toolResult = 'Opening file picker...';
            } else if (/cauta|search|find|gaseste|info despre|cine e|what is|who is/i.test(msg)) {
                toolType = 'search';
                console.log('🔍 BRAIN: Detectat CĂUTARE...');
                toolResult = await executeWebSearch(userMessage);
            } else {
                // Căutare generală pentru orice altă cerere
                console.log('🔍 BRAIN: Cerere generală - caut pe net...');
                toolResult = await executeWebSearch(userMessage);
            }

            // === Rezultat - K răspunde prin vocea principală OpenAI ===
            console.log('🧠 BRAIN: Rezultat obținut:', toolResult);

            return { brainData, toolResult, toolType };

        } catch (error) {
            console.error('🧠 BRAIN ERROR:', error);
            // În caz de eroare, lasă OpenAI să răspundă direct
            return null;
        }
    }

    // ============ TTS - Brain spune lui K ce să zică ============
    async function speakWithTTS(text) {
        try {
            console.log('🔊 TTS: Generez audio pentru K...');

            const response = await fetch('/.netlify/functions/speak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    voice: 'alloy' // Vocea lui K - aceeași peste tot
                })
            });

            if (!response.ok) {
                throw new Error('TTS failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Sincronizează animația K cu vorbirea
            audio.onplay = () => {
                console.log('🔊 K vorbește...');
                if (window.setKSpeaking) window.setKSpeaking(true);
            };

            audio.onended = () => {
                console.log('🔊 K a terminat de vorbit');
                if (window.setKSpeaking) window.setKSpeaking(false);
                URL.revokeObjectURL(audioUrl);
            };

            await audio.play();

        } catch (error) {
            console.error('🔊 TTS ERROR:', error);
            // Fallback: lasă OpenAI să răspundă
        }
    }

    // ============ WORKSPACE - Panoul din DREAPTA (integrat, nu popup) ============
    function showWorkspacePanel(title, content) {
        console.log('📋 WORKSPACE: Afișez în panoul din dreapta:', title);

        // Creează panoul dacă nu există - ANCORAT PE DREAPTA
        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed;
                top: 0;
                right: 0;
                width: 380px;
                height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px);
                border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500;
                overflow: hidden;
                font-family: 'Segoe UI', Tahoma, sans-serif;
                display: flex;
                flex-direction: column;
                transform: translateX(100%);
                transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        // Formatează conținutul (doar rezultat, fără procesare)
        let contentHtml = '';
        if (typeof content === 'string') {
            contentHtml = content.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
        } else if (typeof content === 'object') {
            contentHtml = `<pre style="white-space: pre-wrap; color: #00ff88; font-size: 0.85rem;">${JSON.stringify(content, null, 2)}</pre>`;
        }

        // Populează panoul - TITLU + CONȚINUT DOAR
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 100, 200, 0.1)); border-bottom: 1px solid rgba(0, 255, 255, 0.2);">
                <span style="color: #00ffff; font-weight: 600; font-size: 1.1rem;">${title}</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-size: 1rem;">✕</button>
            </div>
            <div style="flex: 1; padding: 20px; color: #e0e0e0; overflow-y: auto; font-size: 0.9rem; line-height: 1.6;">
                ${contentHtml}
            </div>
        `;

        // Afișează cu animație
        panel.style.transform = 'translateX(0)';
        console.log('📋 WORKSPACE: Panou DREAPTA afișat!');
    }

    // ============ WORKSPACE VREME - Afișează hartă meteo cu GPS REAL ============
    async function showWeatherWorkspace(inputLat, inputLon, weatherInfo) {
        console.log('🌤️ WORKSPACE: Primesc coordonate:', inputLat, inputLon);

        let lat = inputLat;
        let lon = inputLon;

        // Dacă nu avem coordonate, încearcă GPS real
        if (!lat || !lon) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000
                    });
                });
                lat = position.coords.latitude;
                lon = position.coords.longitude;
                console.log('📍 GPS REAL obținut:', lat, lon);
            } catch (e) {
                console.error('📍 GPS EȘUAT - nu pot afișa harta fără coordonate reale:', e.message);
                // NU folosim fallback - doar date reale!
                return;
            }
        }

        // Verificare finală - trebuie coordonate valide
        if (!lat || !lon) {
            console.error('📍 Coordonate invalide - nu afișez harta');
            return;
        }

        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed; top: 0; right: 0; width: 400px; height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px); border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500; overflow: hidden; font-family: 'Segoe UI', sans-serif;
                display: flex; flex-direction: column;
                transform: translateX(100%); transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: linear-gradient(135deg, rgba(255, 200, 0, 0.2), rgba(255, 100, 0, 0.1)); border-bottom: 1px solid rgba(255, 200, 0, 0.3);">
                <span style="color: #ffcc00; font-weight: 600; font-size: 1.1rem;">🌤️ Vremea Acum (${lat.toFixed(2)}, ${lon.toFixed(2)})</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 15px; color: #e0e0e0; font-size: 0.9rem; line-height: 1.6;">
                ${weatherInfo || 'Se încarcă datele meteo...'}
            </div>
            <iframe src="https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=10&level=surface&overlay=temp&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" 
                style="flex: 1; border: none; width: 100%;" allowfullscreen></iframe>
        `;

        panel.style.transform = 'translateX(0)';
        console.log('🌤️ WORKSPACE: Hartă meteo afișată cu GPS:', lat, lon);

        // Auto-close after 15 seconds
        if (window.workspaceAutoCloseTimer) {
            clearTimeout(window.workspaceAutoCloseTimer);
        }
        window.workspaceAutoCloseTimer = setTimeout(() => {
            const ws = document.getElementById('kelion-workspace');
            if (ws) {
                ws.style.transform = 'translateX(100%)';
                console.log('🌤️ WORKSPACE: Auto-închis după 15 secunde');
            }
        }, 15000);
    }

    // ============ WORKSPACE LOCAȚIE - Afișează Google Maps ============
    function showLocationWorkspace(lat, lon, address) {
        console.log('📍 WORKSPACE: Afișez Google Maps pentru', lat, lon);

        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed; top: 0; right: 0; width: 400px; height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px); border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500; overflow: hidden; font-family: 'Segoe UI', sans-serif;
                display: flex; flex-direction: column;
                transform: translateX(100%); transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: linear-gradient(135deg, rgba(0, 200, 100, 0.2), rgba(0, 150, 200, 0.1)); border-bottom: 1px solid rgba(0, 200, 100, 0.3);">
                <span style="color: #00ff88; font-weight: 600; font-size: 1.1rem;">📍 Locația Ta</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 15px; color: #e0e0e0; font-size: 0.9rem; line-height: 1.6;">
                <strong>📍 Coordonate:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}<br>
                <strong>📫 Adresa:</strong> ${address || 'Se determină...'}
            </div>
            <iframe src="https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed" 
                style="flex: 1; border: none; width: 100%;" allowfullscreen></iframe>
        `;

        panel.style.transform = 'translateX(0)';
        console.log('📍 WORKSPACE: Google Maps afișat!');

        // Auto-close after 15 seconds
        if (window.workspaceAutoCloseTimer) {
            clearTimeout(window.workspaceAutoCloseTimer);
        }
        window.workspaceAutoCloseTimer = setTimeout(() => {
            const ws = document.getElementById('kelion-workspace');
            if (ws) {
                ws.style.transform = 'translateX(100%)';
                console.log('📍 WORKSPACE: Auto-închis după 15 secunde');
            }
        }, 15000);
    }

    // ============ WORKSPACE NAVIGAȚIE - Afișează rută ============
    function showNavigationWorkspace(fromLat, fromLon, destination, routeInfo) {
        console.log('🧭 WORKSPACE: Afișez rută către', destination);

        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed; top: 0; right: 0; width: 400px; height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px); border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500; overflow: hidden; font-family: 'Segoe UI', sans-serif;
                display: flex; flex-direction: column;
                transform: translateX(100%); transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: linear-gradient(135deg, rgba(100, 100, 255, 0.2), rgba(200, 100, 255, 0.1)); border-bottom: 1px solid rgba(100, 100, 255, 0.3);">
                <span style="color: #88aaff; font-weight: 600; font-size: 1.1rem;">🧭 Navigație</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 15px; color: #e0e0e0; font-size: 0.9rem; line-height: 1.6;">
                <strong>📍 De la:</strong> Locația ta actuală<br>
                <strong>🎯 Către:</strong> ${destination}<br>
                ${routeInfo || ''}
            </div>
            <iframe src="https://maps.google.com/maps?saddr=${fromLat},${fromLon}&daddr=${encodeURIComponent(destination)}&output=embed" 
                style="flex: 1; border: none; width: 100%;" allowfullscreen></iframe>
        `;

        panel.style.transform = 'translateX(0)';
        console.log('🧭 WORKSPACE: Rută afișată!');
    }

    // ============ WORKSPACE IMAGINE - Afișează imaginea generată ============
    function showImageWorkspace(imageUrl, prompt) {
        console.log('🎨 WORKSPACE: Afișez imagine generată');

        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed; top: 0; right: 0; width: 450px; height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px); border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500; overflow: hidden; font-family: 'Segoe UI', sans-serif;
                display: flex; flex-direction: column;
                transform: translateX(100%); transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: linear-gradient(135deg, rgba(255, 100, 200, 0.2), rgba(200, 100, 255, 0.1)); border-bottom: 1px solid rgba(255, 100, 200, 0.3);">
                <span style="color: #ff88cc; font-weight: 600; font-size: 1.1rem;">🎨 Imagine Generată</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 15px; color: #e0e0e0; font-size: 0.85rem; line-height: 1.5; max-height: 80px; overflow-y: auto;">
                <strong>📝 Prompt:</strong> ${prompt || 'AI Generated Image'}
            </div>
            <div style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <img src="${imageUrl}" style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);" alt="Generated image" />
            </div>
            <div style="padding: 15px; display: flex; gap: 10px; justify-content: center;">
                <a href="${imageUrl}" download="kelion-image.png" style="background: linear-gradient(135deg, #00ff88, #00cc66); color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    💾 Download
                </a>
                <button onclick="navigator.clipboard.writeText('${imageUrl}'); this.textContent='✓ Copied!'" style="background: rgba(100, 100, 255, 0.3); color: #88aaff; border: 1px solid rgba(100, 100, 255, 0.5); padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    📋 Copy URL
                </button>
            </div>
        `;

        panel.style.transform = 'translateX(0)';
        console.log('🎨 WORKSPACE: Imagine afișată!');

        // Auto-close after 30 seconds
        if (window.workspaceAutoCloseTimer) clearTimeout(window.workspaceAutoCloseTimer);
        window.workspaceAutoCloseTimer = setTimeout(() => {
            const ws = document.getElementById('kelion-workspace');
            if (ws) ws.style.transform = 'translateX(100%)';
        }, 30000);
    }

    // ============ WORKSPACE VIDEO - Afișează video generat ============
    function showVideoWorkspace(videoUrl, prompt) {
        console.log('🎬 WORKSPACE: Afișez video generat');

        let panel = document.getElementById('kelion-workspace');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'kelion-workspace';
            panel.style.cssText = `
                position: fixed; top: 0; right: 0; width: 450px; height: 100vh;
                background: linear-gradient(180deg, rgba(10, 15, 30, 0.98), rgba(5, 10, 20, 0.98));
                backdrop-filter: blur(30px); border-left: 1px solid rgba(0, 255, 255, 0.3);
                z-index: 1500; overflow: hidden; font-family: 'Segoe UI', sans-serif;
                display: flex; flex-direction: column;
                transform: translateX(100%); transition: transform 0.3s ease-out;
            `;
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: linear-gradient(135deg, rgba(100, 200, 255, 0.2), rgba(100, 100, 255, 0.1)); border-bottom: 1px solid rgba(100, 200, 255, 0.3);">
                <span style="color: #88ccff; font-weight: 600; font-size: 1.1rem;">🎬 Video Generat</span>
                <button onclick="document.getElementById('kelion-workspace').style.transform='translateX(100%)'" style="background: transparent; border: 1px solid rgba(255, 100, 100, 0.5); color: #ff6b6b; width: 30px; height: 30px; border-radius: 6px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 15px; color: #e0e0e0; font-size: 0.85rem; line-height: 1.5; max-height: 80px; overflow-y: auto;">
                <strong>📝 Prompt:</strong> ${prompt || 'AI Generated Video'}
            </div>
            <div style="flex: 1; padding: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                <video src="${videoUrl}" controls autoplay loop style="max-width: 100%; max-height: 100%; border-radius: 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);"></video>
            </div>
            <div style="padding: 15px; display: flex; gap: 10px; justify-content: center;">
                <a href="${videoUrl}" download="kelion-video.mp4" style="background: linear-gradient(135deg, #00ff88, #00cc66); color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    💾 Download
                </a>
                <button onclick="navigator.clipboard.writeText('${videoUrl}'); this.textContent='✓ Copied!'" style="background: rgba(100, 100, 255, 0.3); color: #88aaff; border: 1px solid rgba(100, 100, 255, 0.5); padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    📋 Copy URL
                </button>
            </div>
        `;

        panel.style.transform = 'translateX(0)';
        console.log('🎬 WORKSPACE: Video afișat!');

        // Auto-close after 60 seconds (videos are longer to watch)
        if (window.workspaceAutoCloseTimer) clearTimeout(window.workspaceAutoCloseTimer);
        window.workspaceAutoCloseTimer = setTimeout(() => {
            const ws = document.getElementById('kelion-workspace');
            if (ws) ws.style.transform = 'translateX(100%)';
        }, 60000);
    }

    // Deep Verify: GPT-4o answers, Claude verifies automatically
    async function deepVerify(question, context = '') {
        console.log('🧠 Deep Verify:', question);

        try {
            const response = await fetch('/.netlify/functions/smart-brain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, context, requireVerification: true })
            });

            const data = await response.json();

            if (data.success) {
                let result = data.answer;

                // Add confidence indicator
                if (data.verified) {
                    const emoji = data.confidence >= 90 ? '✅' : data.confidence >= 75 ? '🔍' : '⚠️';
                    result += `\n\n${emoji} Confidence: ${data.confidence}% (${data.source})`;
                }

                console.log('🧠 Deep Verify result:', data.confidence + '% confidence');
                return result;
            }

            return 'Verificare eșuată: ' + (data.error || 'Unknown error');
        } catch (e) {
            console.error('🧠 Deep Verify error:', e);
            return 'Eroare la verificare: ' + e.message;
        }
    }

    // Verify a factual claim with Claude Opus 4
    async function verifyFact(question, context = '') {
        console.log('🔍 Verify Fact:', question);

        try {
            const response = await fetch('/.netlify/functions/smart-brain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, context, requireVerification: true })
            });

            const data = await response.json();

            if (data.success) {
                const emoji = data.confidence >= 90 ? '✅' : data.confidence >= 75 ? '🔍' : '⚠️';
                console.log('🔍 Verification:', data.confidence + '% confidence');
                return `${data.answer} ${emoji} (${data.confidence}% verified)`;
            }

            return data.answer || 'Could not verify this claim.';
        } catch (e) {
            console.error('🔍 Verify Fact error:', e);
            return 'Verification unavailable: ' + e.message;
        }
    }

    // Recall ALL memories (regular + visual + emotions)
    async function recallAllMemories() {
        console.log('🧠 Recall All Memories');
        const token = localStorage.getItem('kelion_auth_token');

        if (!token) {
            // Fallback to localStorage
            const localMems = JSON.parse(localStorage.getItem('kelion_memories') || '[]');
            return localMems.length > 0
                ? 'Local memories: ' + localMems.join('; ')
                : 'No memories stored yet.';
        }

        try {
            // Fetch regular memories
            const memResp = await fetch('/.netlify/functions/memory', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const memData = await memResp.json();
            const regularMems = memData.memories || [];

            // Fetch visual memories (emotions, appearance, context)
            const visResp = await fetch('/.netlify/functions/vision-memory', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const visData = await visResp.json();
            const visualMems = visData.memories || [];

            // Compile comprehensive memory report
            let report = '';

            if (regularMems.length > 0) {
                report += '📝 FACTS I REMEMBER:\n';
                regularMems.slice(0, 10).forEach(m => {
                    report += `- ${m.fact || m.content}\n`;
                });
            }

            if (visData.latestEmotion) {
                report += `\n😊 LAST EMOTION: ${visData.latestEmotion}\n`;
            }

            if (visData.currentContext) {
                report += `📍 CONTEXT: ${visData.currentContext}\n`;
            }

            if (visualMems.length > 0) {
                report += '\n👁️ VISUAL OBSERVATIONS:\n';
                visualMems.slice(0, 5).forEach(m => {
                    report += `- ${m.observation} (${new Date(m.created_at).toLocaleDateString()})\n`;
                });
            }

            if (visData.knownFaces && visData.knownFaces.length > 0) {
                report += `\n👤 KNOWN FACES: ${visData.knownFaces.join(', ')}\n`;
            }

            return report || 'No memories stored yet about this user.';
        } catch (e) {
            console.error('🧠 Recall All error:', e);
            return 'Could not access memories: ' + e.message;
        }
    }
    async function executeWebSearch(query) {
        console.log('🌐 Searching:', query);
        try {
            const resp = await fetch('/.netlify/functions/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await resp.json();
            return data.answer || data.result || 'No results found';
        } catch (e) {
            return 'Search failed: ' + e.message;
        }
    }

    // Get user location with full address (street + number)
    async function getLocationInfo() {
        // Use cached location data if available
        if (window.kelionLocation) {
            return JSON.stringify(window.kelionLocation);
        }

        // Try to get fresh location
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000
                });
            });

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            // Reverse geocode for address
            const geoResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
            const geoData = await geoResp.json();

            const addr = geoData.address || {};
            const location = {
                latitude: lat,
                longitude: lon,
                street: addr.road || addr.street || '',
                number: addr.house_number || '',
                city: addr.city || addr.town || addr.village || '',
                country: addr.country || '',
                full_address: geoData.display_name || ''
            };

            window.kelionLocation = location;
            console.log('📍 Location:', location.full_address);
            return JSON.stringify(location);
        } catch (e) {
            return JSON.stringify({ error: 'Location not available', message: e.message });
        }
    }

    // Save memory - uses Supabase if logged in, localStorage as fallback
    async function saveMemory(fact) {
        const authToken = localStorage.getItem('kelion_auth_token');

        // If logged in, save to Supabase
        if (authToken) {
            try {
                const resp = await fetch('/.netlify/functions/memory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ content: fact, memory_type: 'fact' })
                });
                if (resp.ok) {
                    console.log('🧠 Memory saved to Supabase:', fact);
                    return 'Am memorat permanent: ' + fact;
                }
            } catch (e) {
                console.warn('🧠 Supabase save failed, using localStorage:', e.message);
            }
        }

        // Fallback to localStorage
        const memories = JSON.parse(localStorage.getItem('kelion_memories') || '[]');
        memories.push({ fact, timestamp: new Date().toISOString() });
        localStorage.setItem('kelion_memories', JSON.stringify(memories));
        console.log('🧠 Memory saved to localStorage:', fact);
        return 'Am memorat: ' + fact;
    }

    // Get memories - from Supabase if logged in, localStorage as fallback
    async function getMemories() {
        const authToken = localStorage.getItem('kelion_auth_token');

        // If logged in, get from Supabase
        if (authToken) {
            try {
                const resp = await fetch('/.netlify/functions/memory', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    if (data.memories && data.memories.length > 0) {
                        const facts = data.memories.map(m => m.content).join('; ');
                        console.log('🧠 Memories from Supabase:', facts);
                        return 'Știu despre tine: ' + facts;
                    }
                }
            } catch (e) {
                console.warn('🧠 Supabase read failed, using localStorage:', e.message);
            }
        }

        // Fallback to localStorage
        const memories = JSON.parse(localStorage.getItem('kelion_memories') || '[]');
        if (memories.length === 0) {
            return 'Nu am amintiri anterioare despre tine.';
        }
        const facts = memories.map(m => m.fact).join('; ');
        console.log('🧠 Memories from localStorage:', facts);
        return 'Știu despre tine: ' + facts;
    }

    // Analyze camera using GPT-4o Vision - ENHANCED with emotion & context detection
    async function analyzeCamera(question) {
        console.log('👁️ Analyzing camera for:', question);

        // Capture frame from video
        const video = document.querySelector('video');
        if (!video || !video.srcObject) {
            console.warn('👁️ No video element or stream available');
            return 'Camera is not available right now. Please enable camera access.';
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            console.log('👁️ Frame captured:', imageData.length, 'bytes');

            // Determine analysis type based on question
            const lowerQ = (question || '').toLowerCase();
            const isEmotionQ = /emoți|cum arăt|feeling|mood|fericit|trist|supărat|obosit|emotion|how do i look/i.test(lowerQ);
            const isAppearanceQ = /ce port|îmbrăcat|culoare|haine|clothes|wearing|outfit|appearance/i.test(lowerQ);

            // Enhanced prompt for rich analysis
            const analysisPrompt = isEmotionQ
                ? 'Analyze the person\'s emotional state. Describe their expression, mood, and energy level. Be specific about emotions you detect.'
                : isAppearanceQ
                    ? 'Describe what the person is wearing in detail. Include colors, style, and any notable accessories.'
                    : question || 'Describe what you see in detail. Include the person\'s appearance, expression, and surroundings.';

            // Use vision.js for dedicated GPT-4o Vision analysis
            const response = await fetch('/.netlify/functions/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    question: analysisPrompt
                })
            });

            if (!response.ok) {
                // Fallback to chat if vision fails
                console.warn('👁️ Vision API failed, trying chat fallback');
                const chatResp = await fetch('/.netlify/functions/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [
                            { role: 'system', content: 'You are K, analyzing camera images. Be descriptive.' },
                            { role: 'user', content: analysisPrompt }
                        ],
                        image: imageData
                    })
                });
                const chatData = await chatResp.json();
                return chatData.choices?.[0]?.message?.content || 'Could not analyze.';
            }

            const data = await response.json();
            const result = data.description || data.text || 'Could not analyze the image.';

            console.log('👁️ Vision result:', result.substring(0, 80) + '...');

            // Smart emotion detection from result
            const detectedEmotion = detectEmotionFromText(result);
            const detectedContext = detectContextFromText(result);
            const detectedObjects = extractObjectsFromText(result);

            // Save to visual memory with ENHANCED types
            const token = localStorage.getItem('kelion_auth_token');
            if (token && result) {
                // Determine memory type based on what was asked
                const memoryType = isEmotionQ ? 'emotion' : isAppearanceQ ? 'appearance' : 'visual';

                fetch('/.netlify/functions/vision-memory', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        observation: result,
                        type: memoryType,
                        emotion: detectedEmotion,
                        objects: detectedObjects,
                        location_type: detectedContext,
                        context: 'realtime_vision_manual'
                    })
                }).then(r => r.json()).then(d => {
                    console.log('👁️ Memory saved:', d.action, '| Type:', memoryType, '| Emotion:', detectedEmotion);
                }).catch(e => console.warn('👁️ Failed to save visual memory:', e.message));
            }

            return result;

        } catch (e) {
            console.error('👁️ Camera analysis failed:', e);
            return 'I could not analyze the camera right now. Error: ' + e.message;
        }
    }

    // Helper: Detect emotion from analysis text
    function detectEmotionFromText(text) {
        const lower = text.toLowerCase();
        if (/happy|smiling|joyful|cheerful|fericit|bucuros|vesel|zâmbet/i.test(lower)) return 'happy';
        if (/sad|unhappy|down|trist|supărat|melancolic/i.test(lower)) return 'sad';
        if (/focused|concentrated|attentive|concentrat|atent|serios/i.test(lower)) return 'focused';
        if (/tired|exhausted|sleepy|obosit|somnoros/i.test(lower)) return 'tired';
        if (/angry|frustrated|irritated|nervos|furios|iritat/i.test(lower)) return 'angry';
        if (/surprised|shocked|surprins|șocat/i.test(lower)) return 'surprised';
        if (/neutral|calm|relaxed|calm|relaxat/i.test(lower)) return 'neutral';
        return null;
    }

    // Helper: Detect context/location from text
    function detectContextFromText(text) {
        const lower = text.toLowerCase();
        if (/office|desk|computer|monitor|birou|calculator|ecran/i.test(lower)) return 'office';
        if (/home|couch|sofa|bedroom|living|acasă|canapea|dormitor/i.test(lower)) return 'home';
        if (/car|driving|vehicle|mașină|conduc/i.test(lower)) return 'car';
        if (/outside|outdoor|nature|street|afară|natură|stradă/i.test(lower)) return 'outside';
        return null;
    }

    // Helper: Extract objects from text
    function extractObjectsFromText(text) {
        const objects = [];
        const patterns = [
            /wearing a? ?(\w+ \w+|\w+)/gi,      // clothes
            /holding a? ?(\w+)/gi,               // held items
            /(\w+) on the desk/gi,               // desk items
            /(\w+) in the background/gi          // background items
        ];

        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && match[1].length > 2) {
                    objects.push(match[1].toLowerCase());
                }
            }
        }
        return [...new Set(objects)].slice(0, 5); // Max 5 unique objects
    }

    // Afișează harta meteo în workspace
    async function showWeatherMap(lat, lon, info) {
        console.log('🗺️ Show weather map:', lat, lon, info);

        try {
            // Dispatch event pentru workspace să deschidă harta
            const event = new CustomEvent('kelion-show-weather-map', {
                detail: { lat, lon, info }
            });
            window.dispatchEvent(event);

            // Fallback: încearcă funcțiile globale
            if (typeof window.showWorkspaceMap === 'function') {
                window.showWorkspaceMap(lat, lon, info);
            } else if (typeof window.openWeatherMap === 'function') {
                window.openWeatherMap(lat, lon, info);
            }

            return 'Harta meteo afișată: ' + (info || `${lat}, ${lon}`);
        } catch (e) {
            console.error('🗺️ Weather map error:', e);
            return 'Nu am putut afișa harta: ' + e.message;
        }
    }

    // Afișează harta Google cu poziția curentă în workspace
    async function showMyLocationMap() {
        console.log('📍 Showing my location map in workspace');

        try {
            // Get current GPS position
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000
                });
            });

            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            // Get address via reverse geocoding
            let address = '';
            try {
                const geoResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
                const geoData = await geoResp.json();
                address = geoData.display_name || '';
            } catch (e) {
                console.warn('Reverse geocoding failed:', e);
            }

            // Dispatch event pentru workspace să deschidă harta
            const event = new CustomEvent('kelion-show-location-map', {
                detail: { lat, lon, address }
            });
            window.dispatchEvent(event);

            // Fallback: încearcă funcțiile globale
            if (typeof window.showWorkspaceMap === 'function') {
                window.showWorkspaceMap(lat, lon, address);
            } else if (typeof window.showLocationInWorkspace === 'function') {
                window.showLocationInWorkspace(lat, lon, address);
            }

            return `Locație afișată: ${address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`}`;
        } catch (e) {
            console.error('📍 Location map error:', e);
            return 'Nu am putut obține locația: ' + e.message;
        }
    }

    // Handle navigation request from K
    async function handleNavigation(destination, lat, lon, mode = 'driving') {
        console.log('🧭 Navigation request:', destination, lat, lon, mode);

        try {
            // If we have coordinates, show map first
            if (lat && lon) {
                // Show map panel with navigation buttons
                if (typeof window.showMap === 'function') {
                    window.showMap(lat, lon, `📍 ${destination}`);
                }
                return `Opening navigation to ${destination}. Use the navigation buttons on the map to choose: Auto, Pieton, Bike, or Waze.`;
            }

            // If no coordinates, try to search for the destination
            // First get the address via geocoding
            const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`;
            const resp = await fetch(geocodeUrl);
            const results = await resp.json();

            if (results && results.length > 0) {
                const result = results[0];
                const destLat = parseFloat(result.lat);
                const destLon = parseFloat(result.lon);

                // Show map with the destination
                if (typeof window.showMap === 'function') {
                    window.showMap(destLat, destLon, `📍 ${destination}`);
                }

                return `Found ${destination} at ${result.display_name}. Use the navigation buttons on the map to choose your travel mode.`;
            }

            return `Could not find location: ${destination}. Please try with a more specific address.`;
        } catch (e) {
            console.error('🧭 Navigation error:', e);
            return 'Navigation error: ' + e.message;
        }
    }

    // Send function result back to K
    function sendFunctionResult(callId, result) {
        if (!dc || dc.readyState !== 'open') return;

        const event = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: result
            }
        };
        dc.send(JSON.stringify(event));

        // Trigger response generation
        dc.send(JSON.stringify({ type: 'response.create' }));
        console.log('🎙️ Function result sent');
    }

    // Send initial context when session starts
    function sendInitialContext() {
        // Get location in background and store it
        getLocationInfo().then(loc => {
            console.log('🎙️ Location cached for session');
        }).catch(() => { });
    }

    // Add message to chat UI (if chat panel exists)
    function addMessageToChat(role, text) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;
        msgDiv.innerHTML = `
            <div class="message-content">
                <span class="message-role">${role === 'user' ? 'Tu' : 'K'}</span>
                <p>${text}</p>
            </div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 🆕 VOICE HISTORY: Save to localStorage
        try {
            const history = JSON.parse(localStorage.getItem('k_conversation_history') || '[]');
            history.push({ role, message: text, timestamp: Date.now() });
            if (history.length > 20) history.splice(0, history.length - 20);
            localStorage.setItem('k_conversation_history', JSON.stringify(history));
            console.log(`📚 Saved to history (${history.length}/20)`);
        } catch (e) {
            console.warn('Failed to save history:', e);
        }
    }

    // Update voice UI indicator
    function updateVoiceUI(active) {
        const indicator = document.getElementById('voice-indicator');
        if (indicator) {
            indicator.style.background = active ? '#00ff88' : '#ff6b6b';
            indicator.title = active ? 'Realtime Voice Active' : 'Voice Inactive';
        }
    }

    // Toggle session on/off
    function toggleRealtimeSession() {
        if (isActive) {
            stopRealtimeSession();
        } else {
            startRealtimeSession();
        }
    }

    // Expose globally
    window.kelionRealtime = {
        start: startRealtimeSession,
        stop: stopRealtimeSession,
        toggle: toggleRealtimeSession,
        interrupt: interruptNow,
        isActive: () => isActive
    };

    console.log('🎙️ Kelion Realtime Voice module loaded (direct OpenAI + animation sync)');
})();

