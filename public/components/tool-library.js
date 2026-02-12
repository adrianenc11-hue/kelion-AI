/**
 * Tool Library — Catalog of available K tools and capabilities
 * Provides tool discovery and documentation for AI and users
 */

(function () {
    'use strict';
    if (window.KToolLibrary) return;

    window.KToolLibrary = {
        tools: [
            { id: 'search', name: 'Web Search', icon: '🔍', desc: 'Search the internet for current information', endpoint: 'web-search' },
            { id: 'image', name: 'Image Generation', icon: '🎨', desc: 'Generate images with DALL-E 3', endpoint: 'dalle' },
            { id: 'translate', name: 'Translation', icon: '🌐', desc: 'Translate between languages', endpoint: 'translate' },
            { id: 'weather', name: 'Weather', icon: '🌤️', desc: 'Get current weather data', endpoint: 'weather' },
            { id: 'math', name: 'Math Solver', icon: '🔢', desc: 'Solve equations with Wolfram Alpha', endpoint: 'wolfram' },
            { id: 'music', name: 'Music Generation', icon: '🎵', desc: 'Generate music from text', endpoint: 'generate-music' },
            { id: 'video', name: 'Video Generation', icon: '🎬', desc: 'Generate short videos', endpoint: 'generate-video' },
            { id: 'vision', name: 'Vision Analysis', icon: '👁️', desc: 'Analyze images with AI', endpoint: 'vision' },
            { id: 'research', name: 'Deep Research', icon: '🔬', desc: 'Comprehensive topic research', endpoint: 'deep-research' },
            { id: 'presentation', name: 'Presentations', icon: '📊', desc: 'Generate slide presentations', endpoint: 'k-presentation' },
            { id: 'brain', name: 'Smart Brain', icon: '🧠', desc: 'Multi-AI reasoning engine', endpoint: 'smart-brain' },
            { id: 'memory', name: 'Memory', icon: '💾', desc: 'Save and recall information', endpoint: 'memory' },
            { id: 'email', name: 'Email', icon: '📧', desc: 'Send emails', endpoint: 'email-manager' },
            { id: 'calendar', name: 'Calendar', icon: '📅', desc: 'Manage events', endpoint: 'calendar' },
            { id: 'notes', name: 'Notes', icon: '📝', desc: 'Save and search notes', endpoint: 'notes' },
            { id: 'code', name: 'Code Interpreter', icon: '💻', desc: 'Execute code safely', endpoint: 'code-interpreter' },
            { id: 'ocr', name: 'OCR', icon: '📄', desc: 'Extract text from images', endpoint: 'ocr' },
            { id: 'tts', name: 'Text-to-Speech', icon: '🗣️', desc: 'Convert text to speech', endpoint: 'speak' }
        ],

        /**
         * Get all available tools
         */
        getAll() {
            return this.tools;
        },

        /**
         * Find a tool by ID
         */
        get(id) {
            return this.tools.find(t => t.id === id);
        },

        /**
         * Get tool endpoint URL
         */
        getEndpoint(id) {
            const tool = this.get(id);
            return tool ? `/.netlify/functions/${tool.endpoint}` : null;
        },

        /**
         * Search tools matching a query
         */
        search(query) {
            const q = query.toLowerCase();
            return this.tools.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.desc.toLowerCase().includes(q) ||
                t.id.includes(q)
            );
        }
    };

    console.log('🧰 K Tool Library loaded —', window.KToolLibrary.tools.length, 'tools available');
})();
