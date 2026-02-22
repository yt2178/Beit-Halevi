const CACHE_NAME = 'beit-halevi-v4';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './utils.js',
    './data-loader.js',
    './gallery.js',
    './news.js',
    './zmanim.js',
    './manifest.json',
    './assets/icons/icon-192x192.png',
    './assets/icons/icon-512x512.png',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// התקנת ה-Service Worker וביצוע Cache לקבצים
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('מטמון פתוח');
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
        })
    );
});

// יירוט בקשות רשת (Fetch)
self.addEventListener('fetch', (event) => {
    // דילוג על בקשות שאינן GET או שאינן http/https
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    // [שיפור] אל תיירט קריאות ל-API של גוגל או גיטהאב - הן צריכות ללכת ישירות לרשת
    const url = event.request.url;
    if (url.includes('googleapis.com') || url.includes('github.com') || url.includes('google.com')) {
        return;
    }

    // אסטרטגיה: Stale-While-Revalidate עבור נכסים מוכרים
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // שמירה דינמית של קבצי JSON ותמונות
                    if (networkResponse.ok && (event.request.url.includes('.json') || event.request.url.includes('googleusercontent.com'))) {
                        const responseToCache = networkResponse.clone(); // היפוך: שיבוט מיידי לפני שהגוף נצרך
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // במקרה של שגיאת רשת, אם יש cachedResponse הוא יחזור
                });

                return cachedResponse || fetchPromise;
            })
    );
});
