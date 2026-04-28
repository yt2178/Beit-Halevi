const CACHE_NAME = 'beit-halevi-v26';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './admin.html',
    './style.css',
    './base.css',
    './header.css',
    './footer.css',
    './layout.css',
    './gallery.css',
    './news.css',
    './zmanim.css',
    './notifications.css',
    './contact.css',
    './components.css',
    './animations.css',
    './responsive.css',
    './admin.css',
    './main.js',
    './admin.js',
    './admin-core.js',
    './admin-gallery.js',
    './admin-site-editor.js',
    './admin-tasks.js',
    './data-loader.js',
    './gallery.js',
    './news.js',
    './utils.js',
    './zmanim.js',
    './manifest.json'
];

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=Heebo:wght@300;400;700;900&family=Amiri:wght@400;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const internalPromise = Promise.all(
                ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn("Failed to cache internal asset:", url, err)))
            );
            const externalPromise = Promise.all(
                EXTERNAL_ASSETS.map(url => cache.add(url).catch(err => console.warn("Failed to cache external asset:", url, err)))
            );
            return Promise.all([internalPromise, externalPromise]);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    const url = new URL(event.request.url);

    // ׳׳¡׳˜׳¨׳˜׳’׳™׳” ׳¢׳‘׳•׳¨ ׳§׳‘׳¦׳™ ׳ ׳×׳•׳ ׳™׳ ׳•-Google Drive
    if (url.hostname.includes('github') || url.hostname.includes('googleusercontent') || url.hostname.includes('googleapis')) {
        event.respondWith(
            fetch(event.request).then((response) => {
                if (response && (response.status === 200 || response.status === 0)) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Stale-While-Revalidate ׳¢׳‘׳•׳¨ ׳›׳ ׳”׳©׳׳¨
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => { /* offline */ });

            return cachedResponse || fetchPromise;
        })
    );
});

