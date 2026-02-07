// Kelion Language Learning - Intelligent Language Detection & Memory
// Prevents language mixing, remembers user preference

import franc from 'franc-min';

class LanguageLearning {
    constructor() {
        this.userLanguage = null;
        this.detectionHistory = [];
        this.lockThreshold = 3;  // Lock language after 3 detections
        this.isLocked = false;
        this.storageKey = 'kelion_user_language';

        // Load saved preference
        this.loadPreference();
    }

    // Detect language from text
    detect(text) {
        if (!text || text.length < 10) {
            console.warn('[LangLearn] Text too short for detection');
            return this.userLanguage || 'eng';
        }

        // If already locked, return locked language
        if (this.isLocked && this.userLanguage) {
            console.log(`🔒 [LangLearn] Language locked to: ${this.userLanguage}`);
            return this.userLanguage;
        }

        // Detect language using franc
        const detected = franc(text);
        console.log(`🔍 [LangLearn] Detected: ${detected}`);

        // Add to history
        this.detectionHistory.push(detected);

        // Lock language after threshold
        if (this.detectionHistory.length >= this.lockThreshold) {
            this.lockLanguage();
        }

        return this.isoToWhisper(detected);
    }

    // Lock to most common language
    lockLanguage() {
        const languageCounts = {};
        this.detectionHistory.forEach(lang => {
            languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        });

        const mostCommon = Object.keys(languageCounts).reduce((a, b) =>
            languageCounts[a] > languageCounts[b] ? a : b
        );

        this.userLanguage = this.isoToWhisper(mostCommon);
        this.isLocked = true;
        this.savePreference();

        console.log(`✅ [LangLearn] Language locked to: ${this.userLanguage}`);
    }

    // Convert franc ISO 639-3 to Whisper ISO 639-1
    isoToWhisper(iso639_3) {
        const map = {
            'eng': 'en',   // English
            'ron': 'ro',   // Romanian
            'fra': 'fr',   // French
            'spa': 'es',   // Spanish
            'deu': 'de',   // German
            'ita': 'it',   // Italian
            'por': 'pt',   // Portuguese
            'rus': 'ru',   // Russian
            'jpn': 'ja',   // Japanese
            'kor': 'ko',   // Korean
            'zho': 'zh',   // Chinese
            'ara': 'ar',   // Arabic
            'und': 'en'    // Undefined → default English
        };
        return map[iso639_3] || 'en';
    }

    // Save preference to localStorage
    savePreference() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                language: this.userLanguage,
                locked: this.isLocked,
                timestamp: Date.now()
            }));
            console.log(`💾 [LangLearn] Saved preference: ${this.userLanguage}`);
        } catch (e) {
            console.error('[LangLearn] Failed to save preference:', e);
        }
    }

    // Load preference from localStorage
    loadPreference() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                this.userLanguage = data.language;
                this.isLocked = data.locked;
                console.log(`📂 [LangLearn] Loaded preference: ${this.userLanguage}`);
            }
        } catch (e) {
            console.error('[LangLearn] Failed to load preference:', e);
        }
    }

    // Reset learning (for testing or user preference change)
    reset() {
        this.userLanguage = null;
        this.detectionHistory = [];
        this.isLocked = false;
        localStorage.removeItem(this.storageKey);
        console.log('[LangLearn] Reset complete');
    }

    // Get current stats
    getStats() {
        return {
            userLanguage: this.userLanguage,
            isLocked: this.isLocked,
            detectionsCount: this.detectionHistory.length,
            history: this.detectionHistory
        };
    }

    // Force set language (for manual override)
    forceLanguage(lang) {
        this.userLanguage = lang;
        this.isLocked = true;
        this.savePreference();
        console.log(`🔧 [LangLearn] Forced language to: ${lang}`);
    }
}

// Export globally
window.LanguageLearning = LanguageLearning;
console.log('✅ Language Learning module loaded');
