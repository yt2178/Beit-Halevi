// data-loader.js
import { cleanPath, parseFrontMatter, fetchStaticJson, focusLock } from './utils.js';
import { openGridOverlay, checkUrlHash } from './gallery.js';
import { openNewsModal, checkNewsHash } from './news.js';
// ---- קבועים גלובליים ----
const repoOwner = 'yt2178';
const repoName = 'Beit-Halevi';
export const BASE_URL = window.location.origin + (window.location.hostname.endsWith('github.io') ? '/Beit-Halevi' : '');

// ---- משתנים גלובליים ----
export let allLoadedNews = [];
export let allLoadedAlbums = [];

export const fetchCache = new Map(); // Export for testing

// ---- פונקציות טעינה ועיבוד ----
async function fetchAndParse(path) {
    if (fetchCache.has(path)) {
        return fetchCache.get(path);
    }

    const fetchPromise = (async () => {
        // [שינוי קריטי]: עכשיו קורא ל-JSON מוכן במקום לבנות אותו מ-GitHub API

        // אם הנתיב מכיל news, קרא את קובץ news.json
        if (path.includes("news")) {
            return fetchStaticJson("news");
        }
    // אם הנתיב מכיל gallery, קרא את קובץ gallery.json
    if (path.includes('gallery')) {
        let data = await fetchStaticJson('gallery');
        // [תיקון קריטי ל-403]: המרה של לינקים ישנים במידה וקיימים
        if (Array.isArray(data)) {
            data.forEach(album => {
                if (album.data && album.data.images) {
                    album.data.images = album.data.images.map(img =>
                        img.includes('drive.google.com/uc') ?
                            img.replace(/uc\?export=view&id=([^&]+)/, 'thumbnail?id=$1&sz=w1200') : img
                    );
                }
                if (album.data && album.data.thumbnail) {
                    if (album.data.thumbnail.includes('drive.google.com/uc')) {
                        album.data.thumbnail = album.data.thumbnail.replace(/uc\?export=view&id=([^&]+)/, 'thumbnail?id=$1&sz=w800');
                    }
                }
            });
        }
        return data;
    }

    // אם הנתיב מכיל site-config, קרא את קובץ site-config.json
    if (path.includes('site-config')) {
        return fetchStaticJson('site-config');
    }

    // אם הנתיב לא מוכר, החזר שגיאה
    return { error: true, message: "נתיב נתונים לא חוקי. יש צורך בקובץ news.json או gallery.json." };
    })();

    fetchCache.set(path, fetchPromise);

    try {
        const result = await fetchPromise;
        if (result && result.error) {
            fetchCache.delete(path);
        }
        return result;
    } catch (e) {
        fetchCache.delete(path);
        throw e;
    }
}

// ---- פונקציית טעינת הגדרות אתר ----
export async function applySiteConfig() {
    try {
        const config = await fetchAndParse('site-config');
        if (!config || config.error) return;

        // עדכון טקסטים דינמיים
        if (config.texts) {
            const up = (id, val) => {
                const el = document.getElementById(id);
                if (el && val) el.textContent = val;
            };
            up('about-title-dynamic', config.texts.about_title);
            up('about-body-dynamic', config.texts.about_body);
            up('donation-title-dynamic', config.texts.donation_title);
            up('donation-body-dynamic', config.texts.donation_body);
            
            const donationLink = document.getElementById('donation-link-dynamic');
            if (donationLink && config.texts.donation_link) {
                donationLink.href = config.texts.donation_link;
            }
        }

        // עדכון צבע מיתוג
        if (config.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', config.primaryColor);
        }
    } catch (e) {
        console.error("Failed to apply site config", e);
    }
}
// ---- פונקציית טעינת גלריה ----
export async function loadGallery() {
    const albumContainer = document.getElementById('album-grid-container');
    if (!albumContainer) return;

    const response = await fetchAndParse('_posts/gallery');
    
    // Skeleton for albums
    if (!albumContainer.innerHTML || albumContainer.innerHTML.includes('טוען')) {
        albumContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const div = document.createElement('div');
            div.className = 'album-cover skeleton-box';
            div.style.height = '200px';
            albumContainer.appendChild(div);
        }
    }

    if (response === null || response.error) {
        const p = document.createElement('p');
        p.style.cssText = 'text-align:center; color: red;';
        p.textContent = response?.message || 'שגיאה בטעינת האלבומים.';
        albumContainer.innerHTML = '';
        albumContainer.appendChild(p);
        return;
    }
    const items = response;

    // [שינוי] שמירת האלבומים הגלובלי לצורך שימוש ב-Deep Linking
    allLoadedAlbums = items
        .map(item => ({
            ...item.data,
            // [חדש] יצירת slug (מזהה ידידותי ל-URL)
            slug: item.data.title.replace(/\s/g, '-').replace(/[^א-תa-zA-Z0-9-]/g, '')
        }))
        .filter(item => item.title && item.thumbnail);

    albumContainer.innerHTML = '';
    if (allLoadedAlbums.length === 0) {
        albumContainer.innerHTML = '<p style="text-align:center;">לא נמצאו אלבומים.</p>';
        return;
    }

    allLoadedAlbums.forEach((albumData, index) => {
        const albumElement = document.createElement('a');
        albumElement.className = 'album-cover';
        
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.className = 'lazy-load';
        img.src = cleanPath(albumData.thumbnail);
        img.alt = 'אלבום תמונות: ' + albumData.title;

        const titleDiv = document.createElement('div');
        titleDiv.className = 'album-title';
        titleDiv.textContent = albumData.title;

        albumElement.appendChild(img);
        albumElement.appendChild(titleDiv);

        albumElement.addEventListener('click', (e) => {
            e.preventDefault(); // מונע קפיצה של הדף
            // [שינוי] פותח גלריה ומעדכן את ה-URL
            openGridOverlay(albumData);
            // עדכון ה-URL עם ה-Slug של האלבום
            window.history.pushState(null, null, `#gallery/${albumData.slug}`);
        });
        albumContainer.appendChild(albumElement);

        setTimeout(() => {
            albumElement.classList.add('visible');
        }, index * 150);
    });

    checkUrlHash(); // [חדש] בדיקת ה-URL לאחר טעינת האלבומים
}
// ---- פונקציית טעינת חדשות ----
export async function loadNews(loadMore = false) {
    const newsContainer = document.getElementById('news-container');
    if (!newsContainer) return;

    // הצג סקלטון בזמן הטעינה
    if (!loadMore) {
        newsContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const item = document.createElement('div');
            item.className = 'skeleton-item';

            const title = document.createElement('div');
            title.className = 'skeleton-box skeleton-title';

            const text1 = document.createElement('div');
            text1.className = 'skeleton-box skeleton-text';

            const text2 = document.createElement('div');
            text2.className = 'skeleton-box skeleton-text short';

            item.appendChild(title);
            item.appendChild(text1);
            item.appendChild(text2);
            newsContainer.appendChild(item);
        }
    }

    const response = await fetchAndParse('_posts/news'); // עכשיו קורא ל-news.json

    if (response === null || response.error) {
        const p = document.createElement('p');
        p.style.cssText = 'text-align:center; color: red;';
        p.textContent = response?.message || 'שגיאה בטעינת העדכונים. ודא שקובץ data/news.json קיים.';
        newsContainer.innerHTML = '';
        newsContainer.appendChild(p);
        return;
    }
    const items = response;

    // [שינוי] שמירת החדשות הגלובלי לצורך שימוש ב-Deep Linking ו-Modal
    allLoadedNews = items
        .map(item => ({
            ...item.data,
            body: item.data.body,
            // [חדש] יצירת slug חזק: תאריך + כותרת מנוקה
            slug: `${item.data.date}-${item.data.title.replace(/\s/g, '-').replace(/[^א-תa-zA-Z0-9-]/g, '')}`
        }))
        .filter(item => item.title && item.date)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!loadMore) {
        newsContainer.innerHTML = '';
    }

    if (allLoadedNews.length === 0) {
        newsContainer.innerHTML = '<p style="text-align:center;">אין עדכונים חדשים כרגע.</p>';
        return;
    }

    const existingItemsCount = newsContainer.querySelectorAll('.news-item').length;
    const itemsToShow = allLoadedNews.slice(existingItemsCount, existingItemsCount + 3);

    itemsToShow.forEach((item, index) => {
        const date = new Date(item.date);
        const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
        const newsElement = document.createElement('div');
        newsElement.className = 'news-item';

        // [שינוי] הוספת Event Listener לפתיחת המודאל
        newsElement.addEventListener('click', () => {
            openNewsModal(item);
            window.history.pushState(null, null, `#news/${item.slug}`);
        });

        // הצגת תקציר (עד 150 תווים)
        const h3 = document.createElement('h3');
        h3.textContent = item.title;

        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'פורסם בתאריך: ' + formattedDate;
        p.appendChild(strong);

        const bodyDiv = document.createElement('div');
        const parsedHTML = DOMPurify.sanitize(marked.parse(item.body).slice(0, 150) + '... <span>קרא עוד</span>');
        bodyDiv.innerHTML = '';
        const fragment = document.createRange().createContextualFragment(parsedHTML);
        bodyDiv.appendChild(fragment);

        newsElement.appendChild(h3);
        newsElement.appendChild(p);
        newsElement.appendChild(bodyDiv);
        newsContainer.appendChild(newsElement);

        setTimeout(() => { newsElement.classList.add('visible'); }, 50 + index * 100);
    });

    const oldButton = newsContainer.querySelector('.load-more-button');
    if (oldButton) {
        oldButton.remove();
    }

    const totalDisplayed = newsContainer.querySelectorAll('.news-item').length;
    // [תיקון] רק אם יש עוד פריטים להצגה, צור את הכפתור
    if (totalDisplayed < allLoadedNews.length) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.className = 'load-more-button';
        loadMoreButton.textContent = 'חדשות נוספות';

        loadMoreButton.addEventListener('click', async () => {
            // [חדש] הצגת ספינר בזמן הטעינה
            loadMoreButton.disabled = true;
            loadMoreButton.innerHTML = '<span class="spinner"></span>טוען...';

            // [שינוי] משתמש ב-await כדי לחכות שהטעינה תסתיים
            await loadNews(true);
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = 'חדשות נוספות';
        });
        newsContainer.appendChild(loadMoreButton);
    }
}