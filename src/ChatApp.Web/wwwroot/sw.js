// ChatApp Service Worker
const CACHE_NAME = 'chatapp-v1';
const OFFLINE_URL = '/offline.html';

const CACHE_ASSETS = [
    '/',
    '/css/app.css',
    '/css/vazirmatn.css',
    '/js/app.js',
    '/manifest.webmanifest',
    '/favicon.png'
];

// Install
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_ASSETS).catch(() => {}))
    );
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Skip non-GET
    if (req.method !== 'GET') return;

    // Skip SignalR and API
    const url = new URL(req.url);
    if (url.pathname.startsWith('/hubs') || url.pathname.startsWith('/api') || url.pathname.startsWith('/_blazor')) {
        return;
    }

    // Network-first with cache fallback
    event.respondWith(
        fetch(req)
            .then(resp => {
                // Cache successful responses for HTML/CSS/JS
                if (resp.ok && (req.destination === 'document' || req.destination === 'style' || req.destination === 'script')) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                }
                return resp;
            })
            .catch(() => {
                // Try cache
                return caches.match(req).then(cached => {
                    if (cached) return cached;
                    // Offline fallback for navigations
                    if (req.destination === 'document') {
                        return caches.match('/');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Push notifications
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }

    const options = {
        body: data.body || 'پیام جدید',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'ChatApp', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
