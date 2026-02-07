// Gemini 2.0 Live API - Full-Duplex Voice Component
// WebSocket-based realtime voice interaction

class GeminiLiveVoice {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.isConnected = false;
        this.isSpeaking = false;
        this.audioQueue = [];
        this.sessionId = null;
    }

    async initialize() {
        console.log('🎤 Initializing Gemini 2.0 Live Voice...');

        try {
            // Get API key and WebSocket URL
            const tokenResponse = await fetch('/.netlify/functions/gemini-live-token');
            const { apiKey, wsUrl } = await tokenResponse.json();

            // Connect WebSocket
            await this.connect(wsUrl, apiKey);

            console.log('✅ Gemini Live Voice initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize:', error);
            throw error;
        }
    }

    async connect(wsUrl, apiKey) {
        return new Promise((resolve, reject) => {
            const url = `${wsUrl}?key=${apiKey}`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected to Gemini 2.0 Live');
                this.isConnected = true;
                this.sendSetup();
                resolve();
            };

            this.ws.onmessage = (event) => this.handleMessage(event);
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                reject(error);
            };
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnected = false;
            };

            // Timeout after 10s
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    sendSetup() {
        const setupMessage = {
            setup: {
                model: 'models/gemini-2.0-flash-exp',
                generation_config: {
                    response_modalities: ['AUDIO'],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: 'Charon' // Masculine voice
                            }
                        }
                    },
                    temperature: 0.7,
                    max_output_tokens: 2048
                },
                system_instruction: {
                    parts: [{
                        text: this.getSystemInstructions()
                    }]
                },
                tools: this.getTools()
            }
        };

        this.sendMessage(setupMessage);
        console.log('📤 Setup config sent to Gemini');
    }

    getSystemInstructions() {
        return `You are K (Kelion) - an autonomous AI agent. You execute tasks directly without greetings or small talk.

CURRENT TIME: ${new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })} UTC

LANGUAGE: 
- Match user's language exactly
- Romanian user → romanian

 response
- English user → english response

CRITICAL BEHAVIOR:
- NEVER say "hello", "how are you", "bună seara", "I'm here to help", etc.
- Go DIRECTLY to task execution
- Example: "fii preot" → immediately become priest, NO introduction
- Example: "cercetează cancer" → start research immediately, NO greeting

STYLE:
- Direct and concise
- Zero fluff
- Task-focused
- Like Antigravity agent

If user needs web search or current data → use tools immediately.
Never make up information - use tools or say "I'll search for that."`;
    }

    getTools() {
        return [{
            function_declarations: [
                {
                    name: 'web_search',
                    description: 'Caută pe web informații actuale, știri, vreme, prețuri',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            query: {
                                type: 'STRING',
                                description: 'Interogarea de căutare în română'
                            }
                        },
                        required: ['query']
                    }
                },
                {
                    name: 'get_weather',
                    description: 'Obține vremea curentă pentru o locație',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            location: {
                                type: 'STRING',
                                description: 'Oraș sau coordonate GPS'
                            }
                        },
                        required: ['location']
                    }
                },
                {
                    name: 'execute_autonomous_task',
                    description: 'Execute complex autonomous tasks using K AGI - can build websites, write code, research, create files, iterate until complete',
                    parameters: {
                        type: 'OBJECT',
                        properties: {
                            task: {
                                type: 'STRING',
                                description: 'Complex task like: "creează website despre pisici", "calculează fibonacci", "cercetează cancer"'
                            }
                        },
                        required: ['task']
                    }
                }
            ]
        }];
    }

    async startListening() {
        console.log('🎤 Starting microphone...');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.isConnected) {
                    this.sendAudioChunk(event.data);
                }
            };

            this.mediaRecorder.start(100); // Send chunks every 100ms for low latency
            console.log('✅ Microphone streaming active');

        } catch (error) {
            console.error('❌ Microphone error:', error);
            throw error;
        }
    }

    async sendAudioChunk(blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (!reader.result) {
                console.warn('⚠️ Empty audio chunk, skipping');
                return;
            }

            const base64Audio = reader.result.split(',')[1];
            if (!base64Audio) {
                console.warn('⚠️ Invalid audio data format');
                return;
            }

            const audioMessage = {
                realtime_input: {
                    media_chunks: [{
                        mime_type: 'audio/pcm',
                        data: base64Audio
                    }]
                }
            };

            this.sendMessage(audioMessage);
        };

        reader.onerror = (error) => {
            console.error('❌ Audio chunk read error:', error);
        };

        reader.readAsDataURL(blob);
    }

    handleMessage(event) {
        try {
            const response = JSON.parse(event.data);
            console.log('📨 Received:', response);

            // Handle setup complete
            if (response.setupComplete) {
                console.log('✅ Setup complete, ready for conversation');
                this.sessionId = response.setupComplete.sessionId;
                this.startListening();
                return;
            }

            // Handle server content (AI response)
            if (response.serverContent?.modelTurn?.parts) {
                response.serverContent.modelTurn.parts.forEach(part => {
                    // Audio response
                    if (part.inlineData?.mimeType?.startsWith('audio/')) {
                        this.playAudio(part.inlineData.data);
                    }

                    // Text response (for debugging)
                    if (part.text) {
                        console.log('💬 K (text):', part.text);
                    }

                    // Function call
                    if (part.functionCall) {
                        this.handleFunctionCall(part.functionCall);
                    }
                });
            }

            // Handle tool call request (deprecated - now handled via functionCall)
            // if (response.toolCall) {
            //     this.handleToolCall(response.toolCall);
            // }

        } catch (error) {
            console.error('❌ Message handling error:', error);
        }
    }

    async playAudio(base64Audio) {
        try {
            // Decode base64 to binary
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Decode audio
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

            // Play audio
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            this.isSpeaking = true;

            // Trigger K animation lip sync
            window.dispatchEvent(new CustomEvent('k-speaking', {
                detail: { audioBuffer, duration: audioBuffer.duration }
            }));

            source.onended = () => {
                this.isSpeaking = false;
                window.dispatchEvent(new Event('k-speaking-ended'));
                console.log('🔇 K finished speaking');
            };

            source.start(0);
            console.log('🔊 K speaking...');

        } catch (error) {
            console.error('❌ Audio playback error:', error);
        }
    }

    async handleFunctionCall(functionCall) {
        console.log('🔧 Function call:', functionCall.name, functionCall.args);

        let result;
        try {
            // Route complex queries through KIMI Supreme Brain
            if (['web_search', 'verify_fact', 'deep_research'].includes(functionCall.name)) {
                result = await this.callKIMI(functionCall);
            } else {
                switch (functionCall.name) {
                    case 'get_weather':
                    case 'show_weather_map':
                        result = await this.callWeather(functionCall.args.location);
                        // Trigger workspace weather display
                        window.dispatchEvent(new CustomEvent('show-weather-workspace', {
                            detail: { location: functionCall.args.location }
                        }));
                        break;
                    case 'analyze_camera':
                        result = await this.callVision(functionCall.args.question);
                        break;
                    case 'show_my_location':
                    case 'get_location':
                        result = await this.callLocation();
                        break;
                    case 'remember':
                        result = await this.callMemory('save', functionCall.args.fact);
                        break;
                    case 'recall':
                    case 'recall_all':
                        result = await this.callMemory('recall');
                        break;
                    case 'generate_image':
                        result = await this.callImageGen(functionCall.args.prompt);
                        break;
                    case 'generate_video':
                        result = await this.callVideoGen(functionCall.args.prompt);
                        break;
                    case 'execute_autonomous_task':
                        result = await this.callKAGI(functionCall.args.task);
                        break;
                    default:
                        result = { error: 'Unknown function' };
                }
            }
        } catch (error) {
            result = { error: error.message };
        }

        // Send function result back
        const responseMessage = {
            tool_response: {
                function_responses: [{
                    id: functionCall.id,
                    name: functionCall.name,
                    response: result
                }]
            }
        };

        this.sendMessage(responseMessage);
    }

    async callKIMI(functionCall) {
        const response = await fetch('/.netlify/functions/supreme-brain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: JSON.stringify(functionCall.args),
                source: 'gemini',
                toolName: functionCall.name
            })
        });
        return await response.json();
    }

    async callWeather(location) {
        try {
            const response = await fetch('/.netlify/functions/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ location })
            });

            if (!response.ok) {
                throw new Error(`Weather API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Weather fetch failed:', error);
            return { error: error.message };
        }
    }

    async callVision(question) {
        try {
            const response = await fetch('/.netlify/functions/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            if (!response.ok) {
                throw new Error(`Vision API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Vision fetch failed:', error);
            return { error: error.message };
        }
    }

    async callLocation() {
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                }),
                (error) => resolve({ error: error.message })
            );
        });
    }

    async callMemory(action, fact = null) {
        try {
            const response = await fetch('/.netlify/functions/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, fact })
            });

            if (!response.ok) {
                throw new Error(`Memory API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ Memory fetch failed:', error);
            return { error: error.message };
        }
    }

    async callImageGen(prompt) {
        const response = await fetch('/.netlify/functions/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        return await response.json();
    }

    async callVideoGen(prompt) {
        const response = await fetch('/.netlify/functions/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        return await response.json();
    }

    async callKAGI(task) {
        console.log('[K AGI] Executing autonomous task:', task);
        try {
            const response = await fetch('/.netlify/functions/k-agi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userRequest: task,
                    language: 'ro',
                    userId: 'voice-user'
                })
            });

            if (!response.ok) {
                throw new Error(`K AGI error: ${response.status}`);
            }

            const result = await response.json();
            console.log('[K AGI] Completed:', result);

            // Dispatch workspace events for any actions
            if (result.actions && result.actions.length > 0) {
                result.actions.forEach(action => {
                    window.dispatchEvent(new CustomEvent('k-agi-action', {
                        detail: action
                    }));
                });
            }

            return {
                answer: result.answer,
                iterations: result.iterations,
                toolsUsed: result.toolsUsed,
                success: true
            };
        } catch (error) {
            console.error('[K AGI] Error:', error);
            return { error: error.message, success: false };
        }
    }

    sendMessage(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ Cannot send message - not connected');
        }
    }

    stopListening() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            console.log('🎤 Microphone stopped');
        }
    }

    disconnect() {
        this.stopListening();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        console.log('👋 Gemini Live disconnected');
    }
}

// Expose class globally (initialization handled by app.html)
window.GeminiLiveVoice = GeminiLiveVoice;

console.log('📦 Gemini Live Voice component loaded');
