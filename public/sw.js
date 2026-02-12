/**
 * Kelion AI — Service Worker
 * Handles push notifications and optional offline caching
 */

// ═══ PUSH NOTIFICATION EVENTS ═══

self.addEventListener('push', (event) => {
    let data = { title: 'Kelion AI', body: 'New notification', icon: '/hologram-192.png' };

    try {
        if (event.data) {
            const payload = event.data.json();
            data = {
                title: payload.title || 'Kelion AI',
                body: payload.body || payload.message || 'New update',
                icon: payload.icon || '/hologram-192.png',
                badge: payload.badge || '/hologram-192.png',
                data: { url: payload.url || '/' },
                tag: payload.tag || 'kelion-notification',
                renotify: true,
                requireInteraction: false,
                actions: [
                    { action: 'open', title: 'Open' },
                    { action: 'dismiss', title: 'Dismiss' }
                ]
            };
        }
    } catch (e) {
        data.body = event.data ? event.data.text() : 'New notification';
    }

    event.waitUntil(
        self.registration.showNotification(data.title, data)
    );
});

// ═══ NOTIFICATION CLICK ═══

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if open
            for (const client of clientList) {
                if (client.url.includes('kelionai.app') && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(url);
        })
    );
});

// ═══ INSTALL & ACTIVATE ═══

self.addEventListener('install', (event) => {
    console.log('[SW] Kelion AI Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Kelion AI Service Worker activated');
    event.waitUntil(clients.claim());
});
