/**
 * KELION GPS — Simple, Non-Blocking GPS Module
 * 1 GPS call. 1 weather call. That's it.
 * 
 * Usage:
 *   KelionGPS.init()  — called once, non-blocking
 *   window.kelionLocation — GPS data (lat, lon, city, etc.)
 *   window.kelionWeather  — Weather data (temp, description)
 */

const KelionGPS = (() => {
    let _ready = false;
    let _initPromise = null;

    async function init() {
        // Already initialized or in progress — don't call twice
        if (_ready) return window.kelionLocation;
        if (_initPromise) return _initPromise;

        _initPromise = _doInit();
        return _initPromise;
    }

    async function _doInit() {
        console.log('📍 [GPS] Starting...');

        try {
            // === STEP 1: Get GPS coordinates (1 single call) ===
            const coords = await _getCoords();
            if (!coords) {
                console.warn('📍 [GPS] No coords available');
                _ready = true;
                return null;
            }

            const { lat, lon, accuracy } = coords;
            console.log('📍 [GPS] Got coords:', lat, lon, '±', accuracy, 'm');

            // === STEP 2: Reverse geocode (1 single call) ===
            let city = '', country = '', address = '';
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`, {
                    headers: { 'Accept-Language': 'ro,en' },
                    signal: AbortSignal.timeout(5000)
                });
                if (geoRes.ok) {
                    const geo = await geoRes.json();
                    city = geo.address?.city || geo.address?.town || geo.address?.village || '';
                    country = geo.address?.country || '';
                    address = geo.display_name || '';
                }
            } catch (e) {
                console.warn('📍 [GPS] Geocode failed:', e.message);
            }

            // === STEP 3: Get weather (1 single call) ===
            let weather = null;
            try {
                const wRes = await fetch(`/.netlify/functions/weather`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lon }),
                    signal: AbortSignal.timeout(5000)
                });
                if (wRes.ok) {
                    weather = await wRes.json();
                }
            } catch (e) {
                console.warn('📍 [GPS] Weather failed:', e.message);
            }

            // === STORE IN CACHE ===
            window.kelionLocation = {
                lat, lon,
                latitude: lat,
                longitude: lon,
                city, country, address,
                accuracy,
                source: 'gps',
                timestamp: Date.now()
            };

            window.kelionWeather = weather;
            _ready = true;

            console.log('📍 [GPS] ✅ Ready:', city || `${lat},${lon}`,
                weather ? `| ${weather.temp}°C ${weather.description}` : '');

            return window.kelionLocation;

        } catch (e) {
            console.error('📍 [GPS] Init failed:', e.message);
            _ready = true;
            return null;
        }
    }

    function _getCoords() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                console.warn('📍 [GPS] Geolocation not supported');
                // IP fallback
                _ipFallback().then(resolve).catch(() => resolve(null));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                }),
                (err) => {
                    console.warn('📍 [GPS] Permission denied or error:', err.message);
                    // IP fallback
                    _ipFallback().then(resolve).catch(() => resolve(null));
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
            );
        });
    }

    async function _ipFallback() {
        try {
            const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
            if (!res.ok) return null;
            const data = await res.json();
            return { lat: data.latitude, lon: data.longitude, accuracy: 5000 };
        } catch {
            return null;
        }
    }

    function getLocation() {
        return window.kelionLocation || null;
    }

    function getWeather() {
        return window.kelionWeather || null;
    }

    function getAIContext() {
        const loc = getLocation();
        const wth = getWeather();
        return {
            locationInfo: loc ? `${loc.address || loc.city || `${loc.lat}, ${loc.lon}`}` : 'Location unknown',
            weatherInfo: wth ? `${wth.temp}°C, ${wth.description}, feels like ${wth.feels_like}°C, humidity ${wth.humidity}%, wind ${wth.wind_speed} m/s` : 'Weather unknown'
        };
    }

    function isReady() { return _ready; }

    return { init, getLocation, getWeather, getAIContext, isReady };
})();

// Expose globally
window.KelionGPS = KelionGPS;

// Auto-init in background — NON-BLOCKING (no await, just fire and forget)
KelionGPS.init();
console.log('📍 [GPS] Module loaded, init fired (non-blocking)');
