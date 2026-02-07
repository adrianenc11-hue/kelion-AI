// K Keyword Triggers Module
// Detects special keywords in user messages and routes to appropriate AI functions
// Used by k-brain.js to enhance user messages before processing

const KEYWORD_TRIGGERS = {
    // DALL-E 3 Image Generation
    dalle: {
        keywords: ['generează imagine', 'creează poză', 'desenează', 'fă o imagine', 'generează o imagine', 'creează o poză'],
        endpoint: '/.netlify/functions/dalle',
        description: 'Generare imagini din text'
    },

    // Whisper Transcription
    whisper: {
        keywords: ['transcrie', 'scrie ce zic', 'dictează', 'transcrie audio'],
        endpoint: '/.netlify/functions/whisper',
        description: 'Transcriere audio în text'
    },

    // Sound Effects
    soundEffects: {
        keywords: ['sunet de', 'efect sonor', 'fă un sunet', 'generează sunet'],
        endpoint: '/.netlify/functions/sound-effects',
        description: 'Generare efecte sonore'
    },

    // Voice Cloning
    voiceClone: {
        keywords: ['clonează voce', 'copiază vocea', 'învață vocea mea', 'clonează vocea'],
        endpoint: '/.netlify/functions/voice-clone',
        description: 'Clonare voce din sample audio'
    },

    // Deep Research
    deepResearch: {
        keywords: ['cercetează', 'analizează detaliat', 'raport despre', 'investigează'],
        endpoint: '/.netlify/functions/deep-research',
        mode: 'research',
        description: 'Cercetare aprofundată cu surse'
    },

    // Reasoning
    reasoning: {
        keywords: ['gândește', 'raționează', 'analizează logic', 'gândește logic'],
        endpoint: '/.netlify/functions/deep-research',
        mode: 'reasoning',
        description: 'Analiză logică pas cu pas'
    },

    // Web Search (existing)
    webSearch: {
        keywords: ['caută pe net', 'caută online', 'ce zice internetul', 'caută pe internet'],
        endpoint: '/.netlify/functions/web-search',
        description: 'Căutare informații actualizate'
    },

    // Location (existing)
    location: {
        keywords: ['unde sunt', 'locația mea', 'ce e în zona mea', 'locație'],
        useGPS: true,
        description: 'Detectare locație'
    },

    // Vision (existing)
    vision: {
        keywords: ['ce vezi', 'analizează imaginea', 'descrie ce observi', 'uită-te'],
        useCamera: true,
        description: 'Analiză vizuală'
    },

    // Memory (existing)
    memory: {
        keywords: ['ține minte', 'memorează', 'nu uita că', 'amintește-ți'],
        endpoint: '/.netlify/functions/memory',
        description: 'Salvare în memorie'
    }
};

/**
 * Detect if user message contains keyword triggers
 * @param {string} message - User's message
 * @returns {Object|null} - Trigger info or null if no match
 */
function detectTrigger(message) {
    const lowerMessage = message.toLowerCase();

    for (const [name, config] of Object.entries(KEYWORD_TRIGGERS)) {
        for (const keyword of config.keywords) {
            if (lowerMessage.includes(keyword.toLowerCase())) {
                return {
                    name,
                    keyword,
                    ...config,
                    // Extract the prompt (text after keyword)
                    prompt: message.substring(lowerMessage.indexOf(keyword.toLowerCase()) + keyword.length).trim()
                };
            }
        }
    }

    return null;
}

/**
 * Execute a triggered function
 * @param {Object} trigger - Trigger info from detectTrigger
 * @param {Object} context - Additional context (userId, etc)
 * @returns {Object} - Result from the function
 */
async function executeTrigger(trigger, context = {}) {
    if (!trigger || !trigger.endpoint) {
        return { success: false, error: 'Invalid trigger' };
    }

    try {
        const body = {
            prompt: trigger.prompt,
            query: trigger.prompt,
            text: trigger.prompt,
            ...context
        };

        if (trigger.mode) {
            body.mode = trigger.mode;
        }

        const response = await fetch(trigger.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            triggerName: trigger.name,
            description: trigger.description,
            ...data
        };

    } catch (error) {
        console.error('Trigger execution error:', error);
        return {
            success: false,
            triggerName: trigger.name,
            error: error.message
        };
    }
}

/**
 * Get all available triggers for display in UI
 */
function getAllTriggers() {
    return Object.entries(KEYWORD_TRIGGERS).map(([name, config]) => ({
        name,
        keywords: config.keywords,
        description: config.description
    }));
}

// Export for use in other modules
if (typeof module !== 'undefined') {
    module.exports = { KEYWORD_TRIGGERS, detectTrigger, executeTrigger, getAllTriggers };
}

// Also attach to window for browser use
if (typeof window !== 'undefined') {
    window.KKeywords = { KEYWORD_TRIGGERS, detectTrigger, executeTrigger, getAllTriggers };
}
