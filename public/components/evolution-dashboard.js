/**
 * Evolution Dashboard — K self-improvement metrics
 * Tracks learning progress, feature discovery, usage patterns
 */

(function () {
    'use strict';
    if (window.KEvolutionDashboard) return;

    const STORAGE_KEY = 'kelion_evolution';

    function loadData() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaults();
        } catch {
            return getDefaults();
        }
    }

    function getDefaults() {
        return {
            version: '1.6',
            sessionsCount: 0,
            featuresDiscovered: [],
            toolsUsed: {},
            totalInteractions: 0,
            lastSession: null
        };
    }

    function save(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    window.KEvolutionDashboard = {
        /**
         * Record a new session
         */
        recordSession() {
            const data = loadData();
            data.sessionsCount++;
            data.lastSession = new Date().toISOString();
            save(data);
        },

        /**
         * Record tool usage
         * @param {string} toolId
         */
        recordToolUse(toolId) {
            const data = loadData();
            data.toolsUsed[toolId] = (data.toolsUsed[toolId] || 0) + 1;
            data.totalInteractions++;
            save(data);
        },

        /**
         * Record feature discovery
         * @param {string} featureId
         */
        recordDiscovery(featureId) {
            const data = loadData();
            if (!data.featuresDiscovered.includes(featureId)) {
                data.featuresDiscovered.push(featureId);
                save(data);
                console.log('🧬 New feature discovered:', featureId);
            }
        },

        /**
         * Get evolution summary
         */
        getSummary() {
            const data = loadData();
            const topTools = Object.entries(data.toolsUsed)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tool, count]) => ({ tool, count }));

            return {
                version: data.version,
                sessions: data.sessionsCount,
                total_interactions: data.totalInteractions,
                features_discovered: data.featuresDiscovered.length,
                top_tools: topTools,
                last_session: data.lastSession
            };
        },

        /**
         * Reset all evolution data
         */
        reset() {
            save(getDefaults());
        }
    };

    // Record this session
    window.KEvolutionDashboard.recordSession();

    console.log('🧬 K Evolution Dashboard loaded');
})();
