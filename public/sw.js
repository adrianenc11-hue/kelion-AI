const CACHE_NAME = 'kelion-v9';
const urlsToCache = [
    '/',
    '/app.html',
    '/manifest.json',
    '/hologram-192.png',
    '/hologram-512.png',
    '/components/realtime-voice.js',
    '/components/gemini-live-voice.js',
    '/components/smart-functions.js'
];

// Install - cache critical assets
self.addEventListener('install', (event) => {
    console.log('💾 Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Cached assets');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('❌ Cache install failed:', err);
            })
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return cached version
                if (response) {
                    return response;
                }
                // Clone request for network
                return fetch(event.request);
            })
            .catch(() => {
                // Offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('/app.html');
                }
            })
    );
});
