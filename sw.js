const CACHE_NAME = 'beit-halevi-v1';
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
    // דילוג על בקשות שאינן GET או שאינן http/https (כגון chrome-extension)
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // החזרת תשובה מה-Cache אם קיימת
                if (response) {
                    return response;
                }
                // אחרת, בצע בקשת רשת רגילה
                return fetch(event.request).then((networkResponse) => {
                    // אופציונלי: ניתן להוסיף כאן לוגיקה לשמירה דינמית ב-Cache
                    return networkResponse;
                });
            })
    );
});
