// ---- גלריה.js ----
import { BASE_URL, allLoadedAlbums } from './data-loader.js';
import { cleanPath, focusLock } from './utils.js';
import {
    gridOverlay, lightbox, downloadBtn, lightboxCloseBtn,
    nextBtn, prevBtn, gridCloseBtn, thumbnailGrid,
    gridAlbumTitle, lightboxImg, shareBtn, albumShareBtn,
    albumDownloadBtn, updateDynamicMetadata // משתנים שמוגדרים ב-main.js
} from './main.js';
export let currentAlbumData = null;
export let currentIndex = 0;
export let currentAlbumImages = [];

// ---- פונקציות גלריה ----
export function openGridOverlay(albumData) {
    currentAlbumData = albumData; // [חדש] שמירת נתוני האלבום

    thumbnailGrid.textContent = '';
    gridAlbumTitle.textContent = albumData.title;
    updateDynamicMetadata(`גלריה: ${albumData.title}`);
    currentAlbumImages = (albumData.images || []).map((imgSrc, index) => ({
        src: cleanPath(imgSrc),
        alt: `${albumData.title} - תמונה ${index + 1}`,
        albumSlug: albumData.slug
    }));
    setupAlbumControls(albumData);

    if (currentAlbumImages.length === 0) {
        thumbnailGrid.textContent = 'לא נמצאו תמונות באלבום זה.';
        thumbnailGrid.style.color = 'white';
        thumbnailGrid.style.textAlign = 'center';
    } else {
        // [שינוי] הצג Skeleton Loader מיידית
        for (let i = 0; i < 1; i++) { // הצג 12 מקומות ריקים
            const loader = document.createElement('div');
            loader.className = 'loading-thumbnail';
            thumbnailGrid.appendChild(loader);
        }
        setTimeout(() => {
            thumbnailGrid.textContent = ''; // נקה את ה-Skeleton
            currentAlbumImages.forEach((imgData, index) => {
                const thumb = document.createElement('img');
                thumb.className = 'lazy-load';
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
                    lightbox.setAttribute('aria-modal', 'true');
                    focusLock(lightbox, lightboxCloseBtn);
                });
                thumbnailGrid.appendChild(thumb);

                setTimeout(() => {
                    thumb.classList.add('visible');
                }, index * 50);
            });
        }, 300); // 300ms השהייה קטנה
    }
    gridOverlay.classList.add('active');
    document.body.classList.add('no-scroll');
}

// [חדש] לוגיקה לכפתורי שיתוף והורדה של כל האלבום
export function setupAlbumControls(albumData) {
    const albumSlug = albumData.slug;

    // 1. כפתור שיתוף
    if (albumShareBtn) {
        albumShareBtn.style.display = 'flex';
        albumShareBtn.onclick = async () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}#gallery/${albumSlug}`;
            const shareData = {
                title: `גלריית תמונות: ${albumData.title}`,
                text: `צפו בגלריית התמונות המלאה של ישיבת בית הלוי - ${albumData.title}`,
                url: shareUrl
            };

            if (navigator.share) {
                try {
                    await navigator.share(shareData);
} catch {
                }
            } else {
                // גיבוי: העתקה ללוח
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert('הקישור הועתק ללוח!');
} catch {
                }
            }
        };
    }

    // 2. כפתור הורדת הכל (עם אישור)
    if (albumDownloadBtn) {
        albumDownloadBtn.onclick = async () => {
            if (!confirm(`האם אתה בטוח שברצונך להוריד ${currentAlbumImages.length} תמונות מהאלבום "${albumData.title}"?`)) {
                return;
            }

            albumDownloadBtn.disabled = true;
            albumDownloadBtn.textContent = 'מכין הורדה...';

            try {
                // 1. טעינת ספריית JSZip באופן דינמי
                if (typeof JSZip === 'undefined') {
                    albumDownloadBtn.textContent = 'טוען מנהל כיווץ...';
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
                        script.onload = resolve;
                        script.onerror = () => reject(new Error("שגיאה בטעינת ספריית הכיווץ (JSZip)"));
                        document.head.appendChild(script);
                    });
                }

                // 2. הורדת התמונות ברקע ויצירת קובץ ה-ZIP
                const zip = new JSZip();
                const folder = zip.folder(albumSlug);
                let successCount = 0;

                for (let i = 0; i < currentAlbumImages.length; i++) {
                    const img = currentAlbumImages[i];
                    albumDownloadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> מוריד (${i + 1}/${currentAlbumImages.length})`;
                    try {
                        const res = await fetch(img.src);
                        if (!res.ok) throw new Error("CORS or HTTP Error");
                        const blob = await res.blob();
                        
                        // גילוי סיומת התמונה
                        let extension = 'jpg';
                        if (img.src.includes('png')) extension = 'png';
                        else if (img.src.includes('gif')) extension = 'gif';
                        else if (img.src.includes('webp')) extension = 'webp';

                        const filename = `${albumSlug}-${i + 1}.${extension}`;
                        folder.file(filename, blob);
                        successCount++;
                    } catch (err) {
                        console.warn(`Failed to fetch image for ZIP: ${img.src}`, err);
                    }
                }

                // 3. יצירת והורדת קובץ ה-ZIP
                if (successCount > 0) {
                    albumDownloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מייצר קובץ ZIP...';
                    const content = await zip.generateAsync({ type: "blob" });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(content);
                    link.download = `${albumSlug}.zip`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                } else {
                    throw new Error("CORS_BLOCK");
                }
            } catch (err) {
                console.warn("Dynamic ZIP creation failed or blocked by CORS, using fallback sequential download", err);
                alert("עקב הגדרות אבטחה של הדפדפן, התמונות יורדו כעת כקבצים נפרדים בזה אחר זה. נא לאשר הורדה של קבצים מרובים אם תתבקש על ידי הדפדפן.");

                const batchSize = 5;
                for (let i = 0; i < currentAlbumImages.length; i += batchSize) {
                    const batch = currentAlbumImages.slice(i, i + batchSize);
                    let j = 0;
                    for (const img of batch) {
                        const link = document.createElement('a');
                        link.href = img.src;
                        link.download = `${albumSlug}-${i + j + 1}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        j++;
                    }
                    if (i + batchSize < currentAlbumImages.length) {
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                }
            } finally {
                albumDownloadBtn.disabled = false;
                albumDownloadBtn.innerHTML = '<i class="fas fa-file-archive"></i> הורד הכל';
            }
        };
    }
}

// [שינוי] פונקציה להצגת תמונה ב-Lightbox ועדכון ה-URL
export function showLightboxImage(isFirstLoad = false) {
    if (!currentAlbumImages[currentIndex]) return;
    const currentImage = currentAlbumImages[currentIndex];

    lightboxImg.src = currentImage.src;
    lightboxImg.alt = currentImage.alt;
    updateDynamicMetadata(`${currentImage.alt} (תמונה ${currentIndex + 1})`);

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
    if (shareBtn) {
        shareBtn.style.display = 'block';
        shareBtn.onclick = async () => {
            const shareUrl = `${window.location.origin}${window.location.pathname}#gallery/${currentImage.albumSlug}/${currentIndex + 1}`;
            const shareData = {
                title: `תמונה: ${currentImage.alt} (מס' ${currentIndex + 1})`,
                text: `צפו בתמונה זו מאלבום ${currentImage.alt} של ישיבת בית הלוי.`,
                url: shareUrl
            };

            if (navigator.share) {
                try {
                    await navigator.share(shareData);
} catch {
                }
            } else {
                // גיבוי: העתקה ללוח
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    alert('הקישור הועתק ללוח!');
} catch {
                }
            }
        };
    }
}

// [שינוי] פונקציה לסגירת ה-Lightbox ועדכון ה-URL
export function closeLightbox() {
    lightbox.classList.remove('active');
    // אם ה-Grid עדיין פתוח (זה קורה רק אם נכנסנו דרך ה-Grid), לא משחררים את ה-scroll
    if (!gridOverlay.classList.contains('active')) {
        document.body.classList.remove('no-scroll');
    }
    // [שינוי] במקום hash '#', נחזיר ל-hash של האלבום אם הוא פתוח ברקע
    const albumSlug = currentAlbumData ? currentAlbumData.slug : '';
    window.history.pushState(null, null, albumSlug ? `#gallery/${albumSlug}` : '#');
    if (currentAlbumData) {
        updateDynamicMetadata(`גלריה: ${currentAlbumData.title}`);
    } else {
        updateDynamicMetadata('ישיבת בית הלוי - ראש העין');
    }
}

export function showNextImage() {
    if (currentIndex < currentAlbumImages.length - 1) {
        currentIndex++;
        showLightboxImage(false);
    }
}

export function showPrevImage() {
    if (currentIndex > 0) {
        currentIndex--;
        showLightboxImage(false);
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
            document.body.classList.add('no-scroll');
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
// [חדש] פונקציה לאתחול אירועי DOM (מיוצאת ל-main.js)
export function initGalleryEvents() {
    // ---- חיבור אירועי Lightbox ו-Grid (מקומי) ----
    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (nextBtn) nextBtn.addEventListener('click', showNextImage);
    if (prevBtn) prevBtn.addEventListener('click', showPrevImage);
    if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    if (gridCloseBtn) gridCloseBtn.addEventListener('click', () => {
        gridOverlay.classList.remove('active');
        document.body.classList.remove('no-scroll');
        currentAlbumImages = [];
        gridOverlay.removeAttribute('aria-modal');
        window.history.pushState(null, null, '#');
        currentAlbumData = null;
        updateDynamicMetadata('ישיבת בית הלוי - ראש העין');
    });

    // [חדש] טיפול בכפתורי המקלדת
    document.addEventListener('keydown', (e) => {
        if (lightbox && lightbox.classList.contains('active')) {
            if (e.key === 'ArrowRight') showPrevImage(); // [שינוי] הפוך ל-RTL
            else if (e.key === 'ArrowLeft') showNextImage(); // [שינוי] הפוך ל-RTL
            else if (e.key === 'Escape') closeLightbox();
        }
    });

    // [חדש] תמיכה בהחלקה (Swipe) למכשירי מגע בלייטבוקס
    if (lightbox) {
        let touchStartX = 0;
        let touchStartY = 0;
        const SWIPE_THRESHOLD = 50;  // פיקסלים מינימלי לזיהוי החלקה
        const VERTICAL_LIMIT = 80;   // מניעת טריגר על גלילה אנכית

        lightbox.addEventListener('touchstart', (e) => {
            // לא מפעילים אם יש יותר מאצבע אחת (pinch-to-zoom)
            if (e.touches.length > 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        lightbox.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 0) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;

            // מתעלמים אם ההחלקה הייתה אנכית יותר מאופקית
            if (Math.abs(dy) > VERTICAL_LIMIT) return;
            if (Math.abs(dx) < SWIPE_THRESHOLD) return;

            // ב-RTL: החלקה שמאלה = תמונה הבאה, ימינה = קודמת
            if (dx < 0) {
                showNextImage(); // החלקה שמאלה → הבא
            } else {
                showPrevImage(); // החלקה ימינה → קודם
            }
        }, { passive: true });
    }
}
