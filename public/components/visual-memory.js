// Kelion AI — Visual Memory Module
// Persistent object/face recognition across sessions
// Uses Gemini Vision API for analysis, localStorage + Supabase for storage

(function () {
    'use strict';

    const CONFIG = {
        ANALYSIS_COOLDOWN: 30000,    // 30s between analyses
        MEMORY_KEY: 'kelion_visual_memory',
        MAX_MEMORY_ITEMS: 200,
        CONFIDENCE_THRESHOLD: 0.6,
        AUTO_ANALYZE_INTERVAL: 45000, // 45s for background analysis
        VISION_ENDPOINT: '/.netlify/functions/vision'
    };

    let isRunning = false;
    let analysisInterval = null;
    let lastAnalysisTime = 0;
    let videoElement = null;
    let memoryDB = [];

    // ═══ MEMORY PERSISTENCE ═══

    function loadMemory() {
        try {
            const stored = localStorage.getItem(CONFIG.MEMORY_KEY);
            memoryDB = stored ? JSON.parse(stored) : [];
            console.log(`🧠 Visual memory loaded: ${memoryDB.length} items`);
        } catch (e) {
            memoryDB = [];
        }
    }

    function saveMemory() {
        try {
            // Keep only last MAX_MEMORY_ITEMS
            if (memoryDB.length > CONFIG.MAX_MEMORY_ITEMS) {
                memoryDB = memoryDB.slice(-CONFIG.MAX_MEMORY_ITEMS);
            }
            localStorage.setItem(CONFIG.MEMORY_KEY, JSON.stringify(memoryDB));
        } catch (e) {
            console.warn('🧠 Memory save failed:', e);
        }
    }

    function addMemory(item) {
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            objects: item.objects || [],
            scene: item.scene || '',
            people: item.people || 0,
            colors: item.colors || [],
            mood: item.mood || 'neutral',
            raw: item.description || ''
        };
        memoryDB.push(entry);
        saveMemory();
        console.log('🧠 Memory added:', entry.scene);
        return entry;
    }

    // ═══ RECALL — search memory ═══

    function recall(query) {
        const q = query.toLowerCase();
        return memoryDB.filter(m => {
            const searchable = [
                m.scene,
                m.raw,
                ...m.objects,
                ...m.colors,
                m.mood
            ].join(' ').toLowerCase();
            return searchable.includes(q);
        });
    }

    function getRecentObjects() {
        const recent = memoryDB.slice(-10);
        const objects = new Set();
        recent.forEach(m => m.objects.forEach(o => objects.add(o)));
        return Array.from(objects);
    }

    function getFrequentObjects() {
        const counts = {};
        memoryDB.forEach(m => {
            m.objects.forEach(o => {
                counts[o] = (counts[o] || 0) + 1;
            });
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([obj, count]) => ({ object: obj, count }));
    }

    // ═══ FRAME CAPTURE ═══

    function getVideoElement() {
        if (videoElement && videoElement.srcObject) return videoElement;
        // Try to find existing video
        const vid = document.querySelector('video');
        if (vid && vid.srcObject) return vid;
        return null;
    }

    function captureFrame(video) {
        if (!video || video.videoWidth === 0) return null;
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.min(video.videoHeight, 480);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.6);
    }

    // ═══ VISION ANALYSIS ═══

    async function analyzeFrame() {
        const now = Date.now();
        if (now - lastAnalysisTime < CONFIG.ANALYSIS_COOLDOWN) return null;

        const video = getVideoElement();
        if (!video) return null;

        const imageData = captureFrame(video);
        if (!imageData) return null;

        lastAnalysisTime = now;

        try {
            const response = await fetch(CONFIG.VISION_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    question: `Analyze this image and respond ONLY in this exact JSON format (no markdown, no extra text):
{"objects":["list","of","objects"],"scene":"brief scene description","people":0,"colors":["dominant","colors"],"mood":"calm/happy/busy/dark/bright","clothing":"what person wears if visible","notable":"anything unusual or interesting"}`
                })
            });

            if (!response.ok) {
                console.warn('🧠 Vision API error:', response.status);
                return null;
            }

            const data = await response.json();
            if (!data.success || !data.analysis) return null;

            // Parse the structured response
            let parsed;
            try {
                // Try to extract JSON from response
                const jsonMatch = data.analysis.match(/\{[\s\S]*\}/);
                parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            } catch (e) {
                // Fallback: use raw text
                parsed = {
                    objects: [],
                    scene: data.analysis.substring(0, 200),
                    people: 0,
                    colors: [],
                    mood: 'neutral'
                };
            }

            if (!parsed) return null;

            // Check for returning objects (visual memory recall)
            const entry = addMemory({
                objects: parsed.objects || [],
                scene: parsed.scene || '',
                people: parsed.people || 0,
                colors: parsed.colors || [],
                mood: parsed.mood || 'neutral',
                description: data.analysis
            });

            // Generate K commentary based on memory
            const commentary = generateCommentary(parsed, entry);

            // Dispatch event for K to speak
            if (commentary) {
                window.dispatchEvent(new CustomEvent('kelion:visual-memory', {
                    detail: { commentary, entry, parsed }
                }));
            }

            return { entry, parsed, commentary };
        } catch (error) {
            console.error('🧠 Analysis error:', error);
            return null;
        }
    }

    // ═══ SMART COMMENTARY ═══

    function generateCommentary(current, entry) {
        // Check if we've seen these objects before
        const knownObjects = getFrequentObjects();
        const recognized = [];

        for (const obj of (current.objects || [])) {
            const known = knownObjects.find(k =>
                k.object.toLowerCase() === obj.toLowerCase() && k.count > 2
            );
            if (known) {
                recognized.push({ object: obj, seen: known.count });
            }
        }

        // Generate contextual comment
        if (recognized.length > 0) {
            const top = recognized[0];
            const phrases = [
                `I see your ${top.object} again! I've noticed it ${top.seen} times now.`,
                `Oh, the ${top.object} is back! You seem to like it.`,
                `There's that ${top.object} again — ${top.seen} sightings and counting!`
            ];
            return phrases[Math.floor(Math.random() * phrases.length)];
        }

        // New objects — first time seeing
        const newObjects = (current.objects || []).filter(obj => {
            return !knownObjects.some(k =>
                k.object.toLowerCase() === obj.toLowerCase()
            );
        });

        if (newObjects.length > 0 && Math.random() < 0.3) {
            return `Hmm, I notice a ${newObjects[0]} — that's new! I'll remember that.`;
        }

        // Scene-based comments (rarely)
        if (current.mood && Math.random() < 0.15) {
            const moodComments = {
                'bright': 'Nice bright environment you have there!',
                'dark': 'It seems a bit dark — want me to suggest better lighting?',
                'busy': 'Looks like a busy scene around you!',
                'calm': 'Such a calm and peaceful environment.',
                'happy': 'I can sense a happy vibe around you!'
            };
            return moodComments[current.mood] || null;
        }

        return null; // No comment this time — avoid annoyance
    }

    // ═══ SYNC TO SUPABASE ═══

    async function syncToCloud() {
        const token = localStorage.getItem('kelion_auth_token');
        if (!token || memoryDB.length === 0) return;

        try {
            const unsynced = memoryDB.filter(m => !m.synced).slice(0, 20);
            if (unsynced.length === 0) return;

            const response = await fetch('/.netlify/functions/memory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'store_visual',
                    memories: unsynced.map(m => ({
                        timestamp: m.timestamp,
                        objects: m.objects,
                        scene: m.scene,
                        mood: m.mood
                    }))
                })
            });

            if (response.ok) {
                unsynced.forEach(m => m.synced = true);
                saveMemory();
                console.log(`🧠 Synced ${unsynced.length} visual memories to cloud`);
            }
        } catch (e) {
            // Sync is best-effort, don't break anything
        }
    }

    // ═══ LIFECYCLE ═══

    function start(existingVideo = null) {
        if (isRunning) return;
        videoElement = existingVideo;
        loadMemory();
        isRunning = true;

        // Start periodic analysis
        analysisInterval = setInterval(() => {
            analyzeFrame().catch(() => { });
        }, CONFIG.AUTO_ANALYZE_INTERVAL);

        // Sync to cloud every 5 minutes
        setInterval(syncToCloud, 300000);

        console.log('🧠 Visual Memory started — I will remember what I see!');
    }

    function stop() {
        isRunning = false;
        if (analysisInterval) {
            clearInterval(analysisInterval);
            analysisInterval = null;
        }
        saveMemory();
        console.log('🧠 Visual Memory stopped');
    }

    // ═══ PUBLIC API ═══

    window.kelionVisualMemory = {
        start,
        stop,
        analyzeFrame,
        recall,
        getRecentObjects,
        getFrequentObjects,
        getMemory: () => [...memoryDB],
        getMemoryCount: () => memoryDB.length,
        clearMemory: () => { memoryDB = []; saveMemory(); },
        isRunning: () => isRunning,
        syncToCloud
    };

    // Auto-load memory on module load
    loadMemory();

    console.log('🧠 Visual Memory module loaded. Use kelionVisualMemory.start() to begin.');
})();
