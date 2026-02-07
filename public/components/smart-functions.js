// Kelion Smart Function Executor - Professional Edition
// Handles retry logic, timeouts, parallel execution, and graceful failures

class SmartFunctionExecutor {
    constructor() {
        this.concurrentLimit = 3;  // Max 3 functions in parallel
        this.retryCount = 2;       // Retry failed functions twice
        this.timeout = 10000;      // 10s timeout per function
        this.queue = [];
        this.executing = new Map();
    }

    // Execute single function with retry + timeout
    async execute(functionName, args, attempt = 0) {
        console.log(`🔧 [SmartExecutor] Executing ${functionName} (attempt ${attempt + 1}/${this.retryCount + 1})`);

        try {
            // Timeout wrapper
            const result = await Promise.race([
                this.callFunction(functionName, args),
                this.timeoutPromise(this.timeout, functionName)
            ]);

            // Validate result
            if (this.isValidResult(result)) {
                console.log(`✅ [SmartExecutor] ${functionName} succeeded`);
                return { success: true, data: result, function: functionName };
            }

            throw new Error('Invalid result format');

        } catch (error) {
            console.warn(`⚠️ [SmartExecutor] ${functionName} failed:`, error.message);

            // Retry logic
            if (attempt < this.retryCount) {
                const delay = 500 * (attempt + 1); // Exponential backoff: 500ms, 1000ms, 1500ms
                console.log(`⏳ Retrying ${functionName} in ${delay}ms...`);
                await this.delay(delay);
                return this.execute(functionName, args, attempt + 1);
            }

            // Final fallback after all retries
            return this.fallbackResponse(functionName, error);
        }
    }

    // Execute multiple functions in parallel (chunked)
    async executeMany(functionCalls) {
        console.log(`🚀 [SmartExecutor] Executing ${functionCalls.length} functions (${this.concurrentLimit} parallel)`);

        const chunks = this.chunk(functionCalls, this.concurrentLimit);
        const results = [];

        for (const chunk of chunks) {
            const promises = chunk.map(fc => this.execute(fc.name, fc.args));
            const chunkResults = await Promise.allSettled(promises);
            results.push(...chunkResults.map((r, i) => ({
                name: chunk[i].name,
                status: r.status,
                value: r.value || null,
                reason: r.reason || null
            })));
        }

        console.log(`✅ [SmartExecutor] Completed ${results.length} functions`);
        return results;
    }

    // Call the actual function
    async callFunction(name, args) {
        switch (name) {
            case 'web_search':
                return await this.webSearch(args.query);

            case 'get_weather':
                return await this.getWeather(args.location);

            case 'remember_fact':
            case 'remember':
                return await this.rememberFact(args.fact, args.category);

            case 'recall_all':
            case 'recall':
                return await this.recallAll();

            case 'verify_fact':
                return await this.verifyFact(args.claim);

            case 'show_workspace':
                return this.showWorkspace(args.type, args.data);

            case 'generate_image':
                return await this.generateImage(args.prompt);

            case 'generate_video':
                return await this.generateVideo(args.prompt);

            case 'show_weather_map':
                return await this.showWeatherMap(args.lat, args.lon, args.info);

            case 'show_my_location':
                return await this.showMyLocation();

            case 'analyze_camera':
                return await this.analyzeCamera(args.question);

            case 'navigate_to':
                return await this.navigateTo(args.destination, args.lat, args.lon, args.mode);

            case 'get_location':
                return await this.getLocation();

            case 'open_url':
                return await this.openUrl(args.url);

            default:
                throw new Error(`Unknown function: ${name}`);
        }
    }

    // Individual function implementations
    async webSearch(query) {
        const response = await fetch('/api/web-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async getWeather(location) {
        const response = await fetch('/api/weather', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ location })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async rememberFact(fact, category) {
        const response = await fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fact, category, type: 'remember' })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async recallAll() {
        const response = await fetch('/api/memory?type=recall');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async verifyFact(claim) {
        const response = await fetch('/api/verify-fact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claim })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    showWorkspace(type, data) {
        if (window.KWorkspacePanel) {
            KWorkspacePanel.showContent(type, data);
            return { success: true, message: 'Workspace displayed' };
        }
        throw new Error('Workspace unavailable');
    }

    async generateImage(prompt) {
        const response = await fetch('/.netlify/functions/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.imageUrl) {
            // Show in workspace
            if (window.KWorkspacePanel) {
                window.KWorkspacePanel.showImage(data.imageUrl, prompt);
            }
            return { success: true, imageUrl: data.imageUrl, prompt: data.revisedPrompt || prompt };
        }
        throw new Error(data.error || 'Image generation failed');
    }

    async generateVideo(prompt) {
        const response = await fetch('/.netlify/functions/generate-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.videoUrl) {
            // Show in workspace
            if (window.KWorkspacePanel) {
                window.KWorkspacePanel.showVideo(data.videoUrl, prompt);
            }
            return { success: true, videoUrl: data.videoUrl, prompt };
        }
        throw new Error(data.error || 'Video generation failed');
    }

    async showWeatherMap(lat, lon, info) {
        // Get GPS if not provided
        if (!lat || !lon) {
            const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(
                    p => resolve(p.coords),
                    reject,
                    { timeout: 5000 }
                )
            );
            lat = pos.latitude;
            lon = pos.longitude;
        }

        // Show weather workspace
        if (window.KWorkspacePanel) {
            window.KWorkspacePanel.showWeather(lat, lon, info || 'Weather Map');
        }
        return { success: true, lat, lon, info };
    }

    async showMyLocation() {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
                p => resolve(p.coords),
                reject,
                { timeout: 10000 }
            )
        );

        // Show location workspace
        if (window.KWorkspacePanel) {
            window.KWorkspacePanel.showLocation(pos.latitude, pos.longitude, 'Your Location');
        }
        return { success: true, lat: pos.latitude, lon: pos.longitude };
    }

    async analyzeCamera(question) {
        const response = await fetch('/.netlify/functions/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async navigateTo(destination, lat, lon, mode) {
        // Navigation logic (would open Google Maps or similar)
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=${mode || 'driving'}`;
        window.open(url, '_blank');
        return { success: true, destination, lat, lon, mode };
    }

    async getLocation() {
        const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
                p => resolve(p.coords),
                reject,
                { timeout: 10000 }
            )
        );
        return { success: true, lat: pos.latitude, lon: pos.longitude };
    }

    async openUrl(url) {
        // Validate and normalize URL
        try {
            const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
            window.open(normalizedUrl, '_blank');
            console.log(`🌐 Opened: ${normalizedUrl}`);
            return { success: true, url: normalizedUrl, message: `Opened ${normalizedUrl}` };
        } catch (error) {
            throw new Error(`Invalid URL: ${url}`);
        }
    }

    // Validation
    isValidResult(result) {
        return result !== null && result !== undefined && typeof result === 'object';
    }

    // Fallback response when all retries fail
    fallbackResponse(functionName, error) {
        console.error(`❌ [SmartExecutor] ${functionName} failed permanently:`, error);

        const userFriendlyMessage = {
            'web_search': 'Could not search the web right now. Please try again.',
            'get_weather': 'Weather data unavailable. Please check your connection.',
            'remember_fact': 'Could not save that. Please try again.',
            'remember': 'Could not save that. Please try again.',
            'recall_all': 'Could not retrieve memories right now.',
            'recall': 'Could not retrieve memories right now.',
            'verify_fact': 'Fact verification service is busy. Try again soon.',
            'show_workspace': 'Workspace display error.',
            'generate_image': 'Image generation failed. Please try again.',
            'generate_video': 'Video generation failed. This may take time, please retry.',
            'show_weather_map': 'Could not show weather map. Check GPS permissions.',
            'show_my_location': 'Could not get your location. Enable GPS permissions.',
            'analyze_camera': 'Camera analysis failed. Check camera permissions.',
            'navigate_to': 'Navigation failed. Check destination coordinates.',
            'get_location': 'Could not get GPS location. Enable location services.'
        };

        return {
            success: false,
            error: error.message,
            userMessage: userFriendlyMessage[functionName] || 'Function failed. Please try again.',
            function: functionName
        };
    }

    // Utility: timeout promise
    timeoutPromise(ms, functionName) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${functionName} timed out after ${ms}ms`)), ms)
        );
    }

    // Utility: delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Utility: chunk array
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    // Get stats for debugging
    getStats() {
        return {
            concurrentLimit: this.concurrentLimit,
            retryCount: this.retryCount,
            timeout: this.timeout,
            queueSize: this.queue.length,
            executing: this.executing.size
        };
    }
}

// Export globally
window.SmartFunctionExecutor = SmartFunctionExecutor;
console.log('✅ Smart Function Executor loaded');
