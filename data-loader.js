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

    // ---- פונקציות טעינה ועיבוד ----
    async function fetchAndParse(path) {
    // [שינוי קריטי]: עכשיו קורא ל-JSON מוכן במקום לבנות אותו מ-GitHub API
    
    // אם הנתיב מכיל news, קרא את קובץ news.json
    if (path.includes('news')) {
        return fetchStaticJson('news');
    }
    // אם הנתיב מכיל gallery, קרא את קובץ gallery.json
    if (path.includes('gallery')) {
        return fetchStaticJson('gallery');
    }

    // אם הנתיב לא מוכר, החזר שגיאה
    return { error: true, message: 'נתיב נתונים לא חוקי. יש צורך בקובץ news.json או gallery.json.' };
}
    // ---- פונקציית טעינת גלריה ----
    export async function loadGallery() {
        const albumContainer = document.getElementById('album-grid-container');
        if (!albumContainer) return;

        const response = await fetchAndParse('_posts/gallery');
        if (response === null || response.error) {
            albumContainer.innerHTML = `<p style="text-align:center; color: red;">${response?.message || 'שגיאה בטעינת האלבומים.'}</p>`;
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
            albumElement.innerHTML = `<img loading="lazy" src="${cleanPath(albumData.thumbnail)}" alt="${albumData.title}"><div class="album-title">${albumData.title}</div>`;
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

    // הצג הודעת טעינה רק אם הקונטיינר ריק
    if (!loadMore) {
        newsContainer.innerHTML = '<p style="text-align:center;">טוען עדכונים...</p>';
    }

    const response = await fetchAndParse('_posts/news'); // עכשיו קורא ל-news.json
    
    if (response === null || response.error) {
        newsContainer.innerHTML = `<p style="text-align:center; color: red;">${response?.message || 'שגיאה בטעינת העדכונים. ודא שקובץ data/news.json קיים.'}</p>`;
        return;
    }
    const items = response;

    // [שינוי] שמירת החדשות הגלובלי לצורך שימוש ב-Deep Linking ו-Modal
    allLoadedNews = items
        .map(item => ({ 
            ...item.data, 
            body: item.content,
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
    newsElement.innerHTML = `<h3>${item.title}</h3><p><strong>פורסם בתאריך: ${formattedDate}</strong></p><div>${marked.parse(item.body).slice(0, 150)}... <span>קרא עוד</span></div>`;
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
        });
        newsContainer.appendChild(loadMoreButton);
    }
}