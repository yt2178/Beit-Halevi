// ---- גלריה.js ----

import { BASE_URL, allLoadedAlbums } from './data-loader.js';
import { cleanPath, focusLock } from './utils.js';

// ---- משתנים ואלמנטים לגלריה ----
   const gridOverlay = document.getElementById('grid-overlay');
    const lightbox = document.getElementById('lightbox');
    const downloadBtn = document.getElementById('download-btn'); 
    export let currentAlbumImages = []; // הפך ל-export
    const lightboxCloseBtn = lightbox.querySelector('.lightbox-close');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    const gridCloseBtn = document.querySelector('.grid-close');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const gridAlbumTitle = document.getElementById('grid-album-title');
    const lightboxImg = document.getElementById('lightbox-img');
    const shareBtn = document.getElementById('share-btn'); 
    export let currentIndex = 0; // הפך ל-export
 
    const albumShareBtn = document.getElementById('album-share-btn');
    const albumDownloadBtn = document.getElementById('album-download-btn');
    let currentAlbumData = null; 

    // ---- פונקציות גלריה ----
    export function openGridOverlay(albumData) {
    currentAlbumData = albumData; // [חדש] שמירת נתוני האלבום
    
    thumbnailGrid.innerHTML = '';
    gridAlbumTitle.textContent = albumData.title;
    currentAlbumImages = (albumData.images || []).map(imgSrc => ({ 
        src: cleanPath(imgSrc), 
        alt: albumData.title,
        albumSlug: albumData.slug
    }));
    setupAlbumControls(albumData);
    
        if (currentAlbumImages.length === 0) {
             thumbnailGrid.innerHTML = '<p style="color:white; text-align:center;">לא נמצאו תמונות באלבום זה.</p>';
        } else {
            // [שינוי] הצג Skeleton Loader מיידית
        for (let i = 0; i < 12; i++) { // הצג 12 מקומות ריקים
             const loader = document.createElement('div');
             loader.className = 'loading-thumbnail';
             thumbnailGrid.appendChild(loader);
        }
         setTimeout(() => {
             thumbnailGrid.innerHTML = ''; // נקה את ה-Skeleton
            currentAlbumImages.forEach((imgData, index) => {
                const thumb = document.createElement('img');
                thumb.loading = 'lazy';
                thumb.src = imgData.src;
                thumb.alt = imgData.alt;
                thumb.dataset.index = index;
                thumb.addEventListener('click', () => {
                    currentIndex = parseInt(thumb.dataset.index);
                    // [שינוי] פותח תמונה ומעדכן את ה-URL
                    showLightboxImage(true);
                    gridOverlay.classList.remove('active');
                    lightbox.classList.add('active');
                     gridOverlay.setAttribute('aria-modal', 'true');
    focusLock(gridOverlay, gridCloseBtn);
                });
                thumbnailGrid.appendChild(thumb);
                
                setTimeout(() => {
                    thumb.classList.add('visible');
                }, index * 50);
            });
        }, 300); // 300ms השהייה קטנה
    }
    gridOverlay.classList.add('active');
}
    // [חדש] לוגיקה לכפתורי שיתוף והורדה של כל האלבום
    export function setupAlbumControls(albumData) {
    const albumSlug = albumData.slug;

    // 1. כפתור שיתוף
    if (albumShareBtn && navigator.share) {
        albumShareBtn.style.display = 'flex';
        albumShareBtn.onclick = () => {
            navigator.share({
                title: `גלריית תמונות: ${albumData.title}`,
                text: `צפו בגלריית התמונות המלאה של ישיבת בית הלוי - ${albumData.title}`,
                url: `${BASE_URL}/#gallery/${albumSlug}`
            }).catch(error => console.log('Error sharing album:', error));
        };
    } else if (albumShareBtn) {
        // הסתר אם אין תמיכה ב-Share API
        albumShareBtn.style.display = 'none'; 
    }

    // 2. כפתור הורדת הכל (עם אישור)
    if (albumDownloadBtn) {
        albumDownloadBtn.onclick = async () => {
            if (!confirm(`האם אתה בטוח שברצונך להוריד ${currentAlbumImages.length} תמונות מהאלבום "${albumData.title}"?`)) {
                return;
            }

            // יצירת קובץ zip באופן אסינכרוני - לצורך הדגמה, נשתמש בלוגיקה של הורדת כל קובץ בנפרד
            // בפרויקט אמיתי יש להשתמש בספריית JSZip כדי ליצור קובץ ZIP.
            
            albumDownloadBtn.disabled = true;
            albumDownloadBtn.textContent = 'מוריד... אנא המתן';

            for (let i = 0; i < currentAlbumImages.length; i++) {
                const img = currentAlbumImages[i];
                // יצירת קישור זמני והורדה
                const link = document.createElement('a');
                link.href = img.src;
                link.download = `${albumSlug}-${i + 1}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // הפסקה קצרה כדי לא לחסום את הדפדפן (Browser Download Manager)
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            albumDownloadBtn.disabled = false;
            albumDownloadBtn.innerHTML = '<i class="fas fa-file-archive"></i> הורד הכל';
            alert('הורדת התמונות החלה. ייתכן שתצטרך לאשר הורדות נוספות בדפדפן.');
        };
    }
}
    // [שינוי] פונקציה להצגת תמונה ב-Lightbox ועדכון ה-URL
    export function showLightboxImage(isFirstLoad = false) { 
    if (!currentAlbumImages[currentIndex]) return;
    const currentImage = currentAlbumImages[currentIndex];
    
    lightboxImg.src = currentImage.src;
    lightboxImg.alt = currentImage.alt;
    
    // [חדש] עדכון ה-URL עם הקישור לתמונה הספציפית
    const newHash = `#gallery/${currentImage.albumSlug}/${currentIndex + 1}`;
    // משתמש ב-replaceState כדי לא למלא את היסטוריית הדפדפן בצעדי ניווט מיותרים
    if (!isFirstLoad) { 
        window.history.replaceState(null, null, newHash);
    } else {
        // בטעינה הראשונה (מלחיצה על תמונה קטנה), עושים pushState
        window.history.pushState(null, null, newHash);
    }

    // הגדרת כפתורי ניווט
    prevBtn.style.display = (currentIndex > 0) ? 'block' : 'none';
    nextBtn.style.display = (currentIndex < currentAlbumImages.length - 1) ? 'block' : 'none';
    
    // הגדרת כפתור הורדה
    if (downloadBtn) {
        downloadBtn.onclick = () => {
            const link = document.createElement('a');
            link.href = currentImage.src;
            link.download = currentImage.src.split('/').pop() || 'image.jpg'; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }
    
    // הגדרת כפתור שיתוף (משתף את הקישור לעמוד)
    if (shareBtn && navigator.share) {
        shareBtn.style.display = 'block';
        shareBtn.onclick = () => {
            navigator.share({
                title: `תמונה: ${currentImage.alt} (מס' ${currentIndex + 1})`,
                text: `צפו בתמונה זו מאלבום ${currentImage.alt} של ישיבת בית הלוי.`,
                // [שינוי] שיתוף הקישור המעודכן עם ה-Hash
               url: `${BASE_URL}/#gallery/${currentImage.albumSlug}/${currentIndex + 1}`
            }).catch(error => console.log('Error sharing:', error));
        };
    } else if (shareBtn) {
        shareBtn.style.display = 'none';
    }
}
    // [שינוי] פונקציה לסגירת ה-Lightbox ועדכון ה-URL
    export function closeLightbox() { 
        lightbox.classList.remove('active'); 
        // [שינוי] במקום hash '#', נחזיר ל-hash של האלבום אם הוא פתוח ברקע
        const albumSlug = currentAlbumData ? currentAlbumData.slug : '';
        window.history.pushState(null, null, albumSlug ? `#gallery/${albumSlug}` : '#'); 
}
    // [שינוי] פונקציות ניווט בתמונות
    export function showNextImage() { 
        if (currentIndex < currentAlbumImages.length - 1) { 
            currentIndex++; 
            showLightboxImage(false); // [שינוי] false = replaceState
        } 
}
    // [שינוי] פונקציות ניווט בתמונות
    export function showPrevImage() { 
        if (currentIndex > 0) { 
            currentIndex--; 
            showLightboxImage(false); // [שינוי] false = replaceState
        } 
}
    // [חדש] פונקציה לטעינת גלריה ספציפית
    export function openAlbumFromSlug(albumSlug, imageIndex) {
    const targetAlbum = allLoadedAlbums.find(album => album.slug === albumSlug);
    if (!targetAlbum) {
        console.error("Album not found for deep link:", albumSlug);
        return;
    }
    
    // פתיחת רשת התמונות הקטנות
    openGridOverlay(targetAlbum);
    
    // אם יש אינדקס תמונה חוקי, פותחים את ה-Lightbox
    if (imageIndex !== undefined && imageIndex >= 1 && imageIndex <= currentAlbumImages.length) {
        currentIndex = imageIndex - 1; // אינדקס הוא 0-based
        // setTimeout כדי לתת זמן למערכת להגיב
        setTimeout(() => { 
            gridOverlay.classList.remove('active'); 
            lightbox.classList.add('active'); 
            showLightboxImage(true); // true = pushState (כניסה חדשה)
        }, 50); 
    }
}
    // [חדש] פונקציה לבדיקת ה-URL Hash
    export function checkUrlHash() {
    const hash = window.location.hash;
    const match = hash.match(/^#gallery\/([^\/]+)(?:\/(\d+))?$/);

    if (match) {
        let albumSlug = match[1];
        // [תיקון קריטי] פענוח ה-URL כדי להתאים ל-slug שנוצר
        try {
            albumSlug = decodeURIComponent(albumSlug);
        } catch (e) {
            console.error("Failed to decode album slug", e);
        }
        
        const imageIndex = match[2] ? parseInt(match[2]) : undefined;
        openAlbumFromSlug(albumSlug, imageIndex);
    }
}

// ---- חיבור אירועי Lightbox ו-Grid (מקומי) ----
if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
if (nextBtn) nextBtn.addEventListener('click', showNextImage);
if (prevBtn) prevBtn.addEventListener('click', showPrevImage);
if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
if (gridCloseBtn) gridCloseBtn.addEventListener('click', () => { 
    gridOverlay.classList.remove('active'); 
    currentAlbumImages = [];
    gridOverlay.removeAttribute('aria-modal');
    window.history.pushState(null, null, '#'); 
    currentAlbumData = null; 
});
// [חדש] טיפול בכפתורי המקלדת (צריך לדעת אם ה-lightbox פתוח)
document.addEventListener('keydown', (e) => {
    if (lightbox && lightbox.classList.contains('active')) {
        if (e.key === 'ArrowRight') showNextImage();
        else if (e.key === 'ArrowLeft') showPrevImage();
        else if (e.key === 'Escape') closeLightbox();
    }
});