    // news.js 
    import { BASE_URL, allLoadedNews } from './data-loader.js';
    import { focusLock } from './utils.js';

    // ---- משתנים ואלמנטים לחדשות ----
   const newsModal = document.getElementById('news-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalBody = document.getElementById('modal-body');
    const newsShareBtn = document.getElementById('news-share-btn');
    const newsPrevBtn = document.getElementById('news-prev-btn'); 
    const newsNextBtn = document.getElementById('news-next-btn'); 
    export let currentNewsIndex = 0; 

    // [חדש] סגירת חלון קופץ עבור ידיעה אחת
    export function closeNewsModal() {
    newsModal.classList.remove('active');
    document.body.style.overflow = '';
    newsModal.removeAttribute('aria-modal');
    // ניקוי ה-hash לכתובת הבסיס של #news
    window.history.pushState(null, null, '#'); 
}
    // [חדש] פתיחת חלון קופץ עבור ידיעה אחת
    export function openNewsModal(newsItem) {
    if (!newsModal) return;

    // [שינוי] מצא את האינדקס של הידיעה הנוכחית
    currentNewsIndex = allLoadedNews.findIndex(item => item.slug === newsItem.slug);

    const date = new Date(newsItem.date);
    const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

    modalTitle.textContent = newsItem.title;
    modalDate.textContent = `פורסם בתאריך: ${formattedDate}`;
    modalBody.innerHTML = marked.parse(newsItem.body);

    // לוגיקת שיתוף (נשארת כפי שהייתה)
    if (newsShareBtn && navigator.share) {
        newsShareBtn.style.display = 'flex';
        newsShareBtn.onclick = () => {
            navigator.share({
                title: newsItem.title,
                text: `ידיעה חדשה מישיבת בית הלוי: ${newsItem.title}`,
                url: window.location.href 
            }).catch(error => console.log('Error sharing news:', error));
        };
    } else if (newsShareBtn) {
        newsShareBtn.style.display = 'none';
    }
// [חדש] לוגיקת ניווט: הצגת כפתורי הבא/קודם
    newsPrevBtn.style.display = (currentNewsIndex < allLoadedNews.length - 1) ? 'flex' : 'none';
    newsNextBtn.style.display = (currentNewsIndex > 0) ? 'flex' : 'none';

    newsModal.classList.add('active');
    document.body.style.overflow = 'hidden'; 
    newsModal.setAttribute('aria-modal', 'true');
    const modalCloseBtn = newsModal.querySelector('.modal-close');
    focusLock(newsModal, modalCloseBtn);
}
    // [חדש] פונקציה לבדיקת ה-URL Hash עבור חדשות
    export function checkNewsHash() {
    const hash = window.location.hash;
    const match = hash.match(/^#news\/([^\/]+)$/); // בודק #news/slug

    if (match) {
        let newsSlug = match[1];
        // פענוח ה-URL
        try {
            newsSlug = decodeURIComponent(newsSlug);
        } catch (e) {
            console.error("Failed to decode news slug", e);
        }

        // חפש את הפריט המלא
        const targetNews = allLoadedNews.find(item => item.slug === newsSlug);

        if (targetNews) {
            openNewsModal(targetNews);
            // גלילה אוטומטית לראש העמוד
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}
    // [חדש] פונקציה לניווט בין ידיעות חדשות
    export function navigateNews(direction) {
    let newIndex = currentNewsIndex + direction;
    if (newIndex >= 0 && newIndex < allLoadedNews.length) {
        const nextItem = allLoadedNews[newIndex];
        openNewsModal(nextItem);
        // עדכון ה-URL
        window.history.pushState(null, null, `#news/${nextItem.slug}`);
    }
}

if (newsPrevBtn) newsPrevBtn.addEventListener('click', () => navigateNews(1));
if (newsNextBtn) newsNextBtn.addEventListener('click', () => navigateNews(-1));
if (newsModal) {
    const modalCloseBtn = newsModal.querySelector('.modal-close');
    modalCloseBtn.addEventListener('click', closeNewsModal);
    newsModal.addEventListener('click', (e) => {
        if (e.target === newsModal) closeNewsModal();
    });
}