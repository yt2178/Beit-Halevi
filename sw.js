const CACHE_NAME = 'beit-halevi-v4';

// ... (assets list remains same)

// התקנת ה-Service Worker וביצוע Cache לקבצים
self.addEventListener('install', (event) => {
    self.skipWaiting(); // [חדש] כניסה לתוקף מיידית
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('מטמון פתוח v4');
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
                        console.log('מטמון ישן נמחק:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // [חדש] השתלטות מיידית על דפים פתוחים
    );
});

// יירוט בקשות רשת (Fetch)
self.addEventListener('fetch', (event) => {
    // דילוג על בקשות שאינן GET או שאינן http/https
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    // אסטרטגיה: Stale-While-Revalidate עבור נכסים מוכרים
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // ✅ Fix: Clone immediately before any body consumption
                const responseToCache = networkResponse.clone();

                if (networkResponse.ok && (event.request.url.includes('.json') || event.request.url.includes('googleusercontent.com'))) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Network error handled by fallback to cache
            });

            return cachedResponse || fetchPromise;
        })
    );
});
