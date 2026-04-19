const CACHE_NAME = 'beit-halevi-v5';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './admin.html',
    './style.css',
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
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700;800&family=Heebo:wght@300;400;700;900&family=Amiri:wght@400;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// התקנת ה-Service Worker וביצוע Cache לקבצים
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching Assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// הפעלת ה-Service Worker וניקוי Cache ישן
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// אסטרטגיית Fetch: Network First עם Fallback ל-Cache עבור דפי HTML, ו-Stale-While-Revalidate עבור נכסים אחרים
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    const url = new URL(event.request.url);

    // אסטרטגיה עבור קבצי נתונים (JSON) ומה שמגיע מ-GitHub/Drive
    if (url.pathname.endsWith('.json') || url.hostname.includes('github') || url.hostname.includes('googleusercontent')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // אסטרטגיית ברירת מחדל: Stale-While-Revalidate
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback handled by return cachedResponse
            });

            return cachedResponse || fetchPromise;
        })
    );
});
