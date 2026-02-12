/**
 * Agent Dashboard — K agent status and activity overview
 * Tracks AI model usage, response times, active features
 */

(function () {
    'use strict';
    if (window.KAgentDashboard) return;

    window.KAgentDashboard = {
        stats: {
            requests: 0,
            errors: 0,
            totalLatency: 0,
            modelsUsed: {},
            sessionStart: new Date().toISOString()
        },

        /**
         * Log an API request
         * @param {string} model - AI model/endpoint used
         * @param {number} latencyMs - Response time
         * @param {boolean} success
         */
        log(model, latencyMs, success = true) {
            this.stats.requests++;
            this.stats.totalLatency += latencyMs;
            if (!success) this.stats.errors++;

            if (!this.stats.modelsUsed[model]) {
                this.stats.modelsUsed[model] = { count: 0, totalMs: 0, errors: 0 };
            }
            this.stats.modelsUsed[model].count++;
            this.stats.modelsUsed[model].totalMs += latencyMs;
            if (!success) this.stats.modelsUsed[model].errors++;
        },

        /**
         * Get dashboard summary
         */
        getSummary() {
            const uptime = Date.now() - new Date(this.stats.sessionStart).getTime();
            return {
                session_start: this.stats.sessionStart,
                uptime_minutes: Math.round(uptime / 60000),
                total_requests: this.stats.requests,
                total_errors: this.stats.errors,
                avg_latency_ms: this.stats.requests > 0
                    ? Math.round(this.stats.totalLatency / this.stats.requests)
                    : 0,
                models: Object.entries(this.stats.modelsUsed).map(([name, data]) => ({
                    model: name,
                    calls: data.count,
                    avg_ms: Math.round(data.totalMs / data.count),
                    errors: data.errors
                }))
            };
        },

        /**
         * Get active features status
         */
        getFeatureStatus() {
            return {
                voice: !!window.kelionRealtime?.isConnected?.(),
                vision: !!window.kelionVision?.isEnabled?.(),
                weather: !!window.kelionWeather,
                workspace: !!window.kWorkspace,
                gestures: !!window.KelionGestures,
                ambient_sound: !!window.kelionAmbientSound?.isRunning?.(),
                visual_memory: !!window.kelionVisualMemory?.isRunning?.(),
                face_security: !!window.kelionFaceSecurity?.isActive?.()
            };
        },

        /**
         * Reset stats
         */
        reset() {
            this.stats = {
                requests: 0,
                errors: 0,
                totalLatency: 0,
                modelsUsed: {},
                sessionStart: new Date().toISOString()
            };
        }
    };

    console.log('📊 K Agent Dashboard loaded');
})();
