/**
 * Kelion Weather — Weather data fetcher and display
 * Calls /.netlify/functions/weather for weather data
 * Exposes window.kelionWeather for use by realtime-voice.js and app.html
 * 
 * Note: realtime-voice.js sets window.kelionWeather with pre-fetched data.
 * This module provides the fetch+display layer when no pre-fetched data exists.
 */

(function () {
    'use strict';

    // Prevent duplicate — realtime-voice.js may already set kelionWeather data
    if (window.KelionWeatherModule) return;

    const KelionWeatherModule = {

        /**
         * Fetch weather for coordinates
         * @param {number} lat
         * @param {number} lng
         * @returns {Object|null} Weather data
         */
        async getWeather(lat, lng) {
            try {
                const res = await fetch('/.netlify/functions/weather', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lon: lng })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                if (data.success || data.weather) {
                    // Cache for other modules (realtime-voice.js reads this)
                    window.kelionWeather = data.weather || data;
                    console.log('🌤️ Weather fetched:', data);
                    return data;
                }

                return null;
            } catch (err) {
                console.error('🌤️ Weather fetch error:', err.message);
                return null;
            }
        },

        /**
         * Get weather for user's current GPS position
         */
        async getWeatherHere() {
            if (window.kelionLocation) {
                const lat = window.kelionLocation.lat || window.kelionLocation.latitude;
                const lon = window.kelionLocation.lon || window.kelionLocation.longitude;
                return await this.getWeather(lat, lon);
            }
            console.warn('🌤️ GPS data not available (pre-fetch not completed)');
            return null;
        },

        /**
         * Display weather in workspace map
         */
        showWeatherMap(lat, lng) {
            if (window.kWorkspace && typeof window.kWorkspace.showWeatherMap === 'function') {
                window.kWorkspace.showWeatherMap(lat, lng);
            }
        }
    };

    window.KelionWeatherModule = KelionWeatherModule;
    console.log('🌤️ Kelion Weather module loaded');
})();
