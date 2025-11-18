(async function() { 
    'use strict';
    
    // ---- פונקציית עזר לניקוי נתיבים ----
    function cleanPath(path) {
        if (!path) return '';
        let p = String(path).trim();
        if (p.startsWith('- ')) p = p.slice(2).trim();
        p = p.replace(/^['"]|['"]$/g, '').trim();
        p = p.replace(/^(?:\.\/|\/)+/, '');
        try { p = decodeURIComponent(p); } catch (e) { /* silent */ }
        return p;
    }
    
    // ---- הגדרות כלליות ----
    const repoOwner = 'yt2178';
    const repoName = 'Beit-Halevi';

    // ---- משתנים גלובליים ----
    const gridOverlay = document.getElementById('grid-overlay');
    const gridCloseBtn = document.querySelector('.grid-close');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const gridAlbumTitle = document.getElementById('grid-album-title');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const downloadBtn = document.getElementById('download-btn'); 
    const shareBtn = document.getElementById('share-btn'); 
    let currentAlbumImages = [];
    const lightboxCloseBtn = lightbox.querySelector('.lightbox-close');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    let currentIndex = 0;
    let allLoadedAlbums = [];
    const albumShareBtn = document.getElementById('album-share-btn');
    const albumDownloadBtn = document.getElementById('album-download-btn');
    let currentAlbumData = null; // ישמור את ה-data של האלבום הפתוח
    const newsModal = document.getElementById('news-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalBody = document.getElementById('modal-body');
    const newsShareBtn = document.getElementById('news-share-btn');
    let allLoadedNews = []; // [חדש] מערך גלובלי לכל החדשות

    // ---- קוד כפתור "חזרה למעלה" ----
    let backToTopButton = document.getElementById("back-to-top-btn");
    if (backToTopButton) {
        window.onscroll = () => {
            if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) { backToTopButton.style.display = "flex"; } else { backToTopButton.style.display = "none"; }
        };
        backToTopButton.addEventListener("click", () => window.scrollTo({top: 0, behavior: 'smooth'}) );
    }

    // ---- פונקציה פשוטה לפירוק Front Matter ----
    function parseFrontMatter(content) {
        const match = /^---\s*([\s\S]+?)\s*---/.exec(content);
        if (!match) return { data: {}, content };

        const yamlText = match[1];
        const body = content.slice(match[0].length).trim();

        const data = {};
        let currentListKey = null;

        yamlText.trim().split('\n').forEach(line => {
            const keyValueMatch = line.match(/^([^:]+):(.*)/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim();
                if (value) {
                    data[key] = value.replace(/^['"]|['"]$/g, '');
                    currentListKey = null;
                } else {
                    data[key] = [];
                    currentListKey = key;
                }
            } else if (currentListKey && line.trim().startsWith('- ')) {
                const listItemMatch = line.match(/-\s*['"]?([^'"]+)['"]?$/);
                if (listItemMatch && listItemMatch[1]) {
                    data[currentListKey].push(listItemMatch[1].trim());
                }
            }
        });
        return { data, content: body };
    }

    // ---- פונקציות טעינה ועיבוד ----
    async function fetchAndParse(path) {
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (!response.ok) throw new Error(`Network response error for ${path}`);
            const data = await response.json();
            if (!Array.isArray(data)) return [];

            const parsedItems = await Promise.all(data
                .filter(file => file.type === 'file') // מקבל כל קובץ, לא רק עם סיומת .md
                .map(async file => {
                   try {
                        const fileResponse = await fetch(file.download_url);
                        if (!fileResponse.ok) return null;
                        const content = await fileResponse.text();
                        // מנסה לפרסר את הקובץ כ-MD, אם זה לא עובד מחזיר null
                        const parsed = parseFrontMatter(content);
                        // בודק אם יש front matter תקין
                        if (!parsed.data || Object.keys(parsed.data).length === 0) return null;
                        return parsed;
                    } catch { return null; }
                })
            );
            return parsedItems.filter(item => item !== null);
        } catch (error) {
            console.error(`Error processing ${path}:`, error);
            return { error: true, message: 'אירעה שגיאה בטעינת הנתונים. נא לנסות שוב מאוחר יותר.' };
        }
    }

    async function loadNews(loadMore = false) {
        const newsContainer = document.getElementById('news-container');
        if (!newsContainer) return;

        // הצג הודעת טעינה רק אם הקונטיינר ריק
        if (!loadMore) {
            newsContainer.innerHTML = '<p style="text-align:center;">טוען עדכונים...</p>';
        }

        const response = await fetchAndParse('_posts/news');
        if (response === null || response.error) {
            newsContainer.innerHTML = `<p style="text-align:center; color: red;">${response?.message || 'שגיאה בטעינת העדכונים.'}</p>`;
            return;
        }
        const items = response;

        // [שינוי] שמירת החדשות הגלובלי לצורך שימוש ב-Deep Linking ו-Modal
        allLoadedNews = items
            .map(item => ({ 
                ...item.data, 
                body: item.content,
                // [חדש] יצירת slug ייחודי
                slug: `${item.data.date}-${item.data.title.replace(/\s/g, '-').replace(/[^\w-]/g, '')}`
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
        
        // [מתוקן] הסרנו את התאריך העברי
        newsElement.innerHTML = `<h3>${item.title}</h3><p><strong>פורסם בתאריך: ${formattedDate}</strong></p><div>${marked.parse(item.body).slice(0, 150)}... <span>קרא עוד</span></div>`;
        newsContainer.appendChild(newsElement);
        
        setTimeout(() => { newsElement.classList.add('visible'); }, 50 + index * 100);
    });
        
  const oldButton = newsContainer.querySelector('.load-more-button');
        if (oldButton) {
            oldButton.remove();
        }

        const totalDisplayed = newsContainer.querySelectorAll('.news-item').length;
        if (totalDisplayed < allLoadedNews.length) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.className = 'load-more-button';
            loadMoreButton.textContent = 'חדשות נוספות';
            loadMoreButton.addEventListener('click', () => loadNews(true));
            newsContainer.appendChild(loadMoreButton);
        }

    }
    
 async function loadGallery() {
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
                slug: item.data.title.replace(/\s/g, '-') 
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


    function openGridOverlay(albumData) {
    currentAlbumData = albumData; // [חדש] שמירת נתוני האלבום
    
    thumbnailGrid.innerHTML = '';
    gridAlbumTitle.textContent = albumData.title;
    currentAlbumImages = (albumData.images || []).map(imgSrc => ({ 
        src: cleanPath(imgSrc), 
        alt: albumData.title,
        albumSlug: albumData.slug
    }));
 // [חדש] חיבור כפתורי השיתוף וההורדה
    setupAlbumControls(albumData);
    
        if (currentAlbumImages.length === 0) {
             thumbnailGrid.innerHTML = '<p style="color:white; text-align:center;">לא נמצאו תמונות באלבום זה.</p>';
        } else {
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
                });
                thumbnailGrid.appendChild(thumb);
                
                setTimeout(() => {
                    thumb.classList.add('visible');
                }, index * 50);
            });
        }
        gridOverlay.classList.add('active');
    }
// ... (בסוף הקטע של פונקציות הגלריה) ...

// [חדש] פונקציה לבדיקת ה-URL Hash עבור חדשות
function checkNewsHash() {
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
    // [חדש] פתיחת חלון קופץ עבור ידיעה אחת
function openNewsModal(newsItem) {
    if (!newsModal) return;

    const date = new Date(newsItem.date);
    const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

    modalTitle.textContent = newsItem.title;
    modalDate.textContent = `פורסם בתאריך: ${formattedDate}`;
    modalBody.innerHTML = marked.parse(newsItem.body);

    // לוגיקת שיתוף
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

    newsModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // מונע גלילה ברקע
}

// [חדש] סגירת חלון קופץ עבור ידיעה אחת
function closeNewsModal() {
    newsModal.classList.remove('active');
    document.body.style.overflow = '';
    // ניקוי ה-hash לכתובת הבסיס של #news
    window.history.pushState(null, null, '#'); 
}
// [חדש] לוגיקה לכפתורי שיתוף והורדה של כל האלבום
function setupAlbumControls(albumData) {
    const albumSlug = albumData.slug;

    // 1. כפתור שיתוף
    if (albumShareBtn && navigator.share) {
        albumShareBtn.style.display = 'flex';
        albumShareBtn.onclick = () => {
            navigator.share({
                title: `גלריית תמונות: ${albumData.title}`,
                text: `צפו בגלריית התמונות המלאה של ישיבת בית הלוי - ${albumData.title}`,
                url: `${window.location.origin}/#gallery/${albumSlug}`
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
function showLightboxImage(isFirstLoad = false) { 
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
                url: window.location.href 
            }).catch(error => console.log('Error sharing:', error));
        };
    } else if (shareBtn) {
        shareBtn.style.display = 'none';
    }
}

    function closeLightbox() { 
        lightbox.classList.remove('active'); 
        // [שינוי] במקום hash '#', נחזיר ל-hash של האלבום אם הוא פתוח ברקע
        const albumSlug = currentAlbumData ? currentAlbumData.slug : '';
        window.history.pushState(null, null, albumSlug ? `#gallery/${albumSlug}` : '#'); 
    }
    
    function showNextImage() { 
        if (currentIndex < currentAlbumImages.length - 1) { 
            currentIndex++; 
            showLightboxImage(false); // [שינוי] false = replaceState
        } 
    }
    
    function showPrevImage() { 
        if (currentIndex > 0) { 
            currentIndex--; 
            showLightboxImage(false); // [שינוי] false = replaceState
        } 
    }

    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (nextBtn) nextBtn.addEventListener('click', showNextImage);
    if (prevBtn) prevBtn.addEventListener('click', showPrevImage);
    if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    if (gridCloseBtn) gridCloseBtn.addEventListener('click', () => { 
        gridOverlay.classList.remove('active'); 
        currentAlbumImages = [];
        window.history.pushState(null, null, '#'); // [שינוי] מנקה את ה-URL hash
        currentAlbumData = null; // [חדש] איפוס נתוני האלבום
    });
if (newsModal) {
    const modalCloseBtn = newsModal.querySelector('.modal-close');
    modalCloseBtn.addEventListener('click', closeNewsModal);
    // סגירה בלחיצה מחוץ למודאל
    newsModal.addEventListener('click', (e) => {
        if (e.target === newsModal) closeNewsModal();
    });
}
    document.addEventListener('keydown', (e) => {
        if (lightbox && lightbox.classList.contains('active')) {
            if (e.key === 'ArrowRight') showNextImage();
            else if (e.key === 'ArrowLeft') showPrevImage();
            else if (e.key === 'Escape') closeLightbox();
        }
    });

    const dateTimeDisplay = document.getElementById('date-time-display');
  function updateDateTime() {
    const now = new Date();
    const gregorianDate = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // [מתוקן] הסרנו את התאריך העברי
    dateTimeDisplay.textContent = `${gregorianDate} | ${time}`;
}
    // ... (נשאר הקוד של ה-dateTimeDisplay)

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    const themeIcon = themeToggle.querySelector('i');
    const savedTheme = localStorage.getItem('theme');
    
    // [שינוי] ברירת מחדל למצב בהיר. אם שמור כהה - מפעיל.
    const isDark = savedTheme === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        // ודא שמצב בהיר הוא ברירת המחדל (אם לא נשמר כלום, או נשמר 'light')
        document.body.classList.remove('dark-mode');
        if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isCurrentlyDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isCurrentlyDark ? 'dark' : 'light');
        if (themeIcon) themeIcon.classList.replace(isCurrentlyDark ? 'fa-moon' : 'fa-sun', isCurrentlyDark ? 'fa-sun' : 'fa-moon');
    });
}

// ... (שאר הקוד נשאר כפי שהוא)
// [חדש] טיפול בשליחת טופס צור קשר (תיקון באג חסר)
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const button = contactForm.querySelector('button[type="submit"]');
        button.disabled = true;
        
        const response = await fetch(contactForm.action, {
            method: contactForm.method,
            body: new FormData(contactForm),
            headers: {'Accept': 'application/json'}
        });
        
        const statusMessage = document.createElement('p');
        statusMessage.style.textAlign = 'center';
        statusMessage.style.marginTop = '10px';
        
        if (response.ok) {
            statusMessage.textContent = "ההודעה נשלחה בהצלחה! תודה רבה.";
            statusMessage.style.color = 'green';
            contactForm.reset();
        } else {
            statusMessage.textContent = "אירעה שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר.";
            statusMessage.style.color = 'red';
        }
        
        contactForm.appendChild(statusMessage);
        button.disabled = false;
        setTimeout(() => statusMessage.remove(), 5000);
    });
}
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (menuToggle && navLinks) {
        const icon = menuToggle.querySelector('i');
        const closeMenu = () => {
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        };
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                closeMenu();
            }
        });
        navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
        document.addEventListener('click', (e) => {
            if (!menuToggle.contains(e.target) && !navLinks.contains(e.target)) {
                closeMenu();
            }
        });
    }
// [חדש] פונקציה לטעינת גלריה ספציפית
function openAlbumFromSlug(albumSlug, imageIndex) {
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
function checkUrlHash() {
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

// [חדש] טיפול בכפתורי Back/Forward של הדפדפן
window.addEventListener('popstate', () => {
    checkUrlHash(); // בדיקת גלריה (שכבר קיימת)
    checkNewsHash(); // [חדש] בדיקת חדשות
});

// ---- הפעלת לוגיקה ראשית (עכשיו הכל ב-async) ----

updateDateTime();
setInterval(updateDateTime, 1000);
loadNews();

// מחכים לטעינת האלבומים כדי לבדוק את ה-hash (ה-await עובד כי הפונקציה הראשית היא async)
await loadGallery(); 

// רק עכשיו, אחרי ש-allLoadedAlbums מלא, אפשר לבדוק את ה-hash
checkUrlHash(); 
checkNewsHash(); // [חדש] בדיקת חדשות

})(); // סוף ה-IIFE הראשי והיחיד
