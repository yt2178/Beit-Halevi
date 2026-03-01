// main.js
import { loadNews, loadGallery, allLoadedNews, allLoadedAlbums, BASE_URL } from './data-loader.js';
// איחוד כל הפונקציות מ-gallery.js
import {
    checkUrlHash, showNextImage, showPrevImage, closeLightbox, openGridOverlay, initGalleryEvents
} from './gallery.js';
// איחוד כל הפונקציות מ-news.js
import {
    checkNewsHash, openNewsModal, navigateNews, initNewsEvents
} from './news.js';
import { getHebrewYear } from './utils.js';
import { initZmanim } from './zmanim.js';

// ---- משתנים ואלמנטים כלליים ---- 
export const dateTimeDisplay = document.getElementById('date-time-display');
export const hebrewYearDisplay = document.getElementById('hebrew-year-display');
export const themeToggle = document.getElementById('theme-toggle');
export const contactForm = document.getElementById('contact-form');
export const menuToggle = document.querySelector('.menu-toggle');
export const navLinks = document.querySelector('.nav-links');
export const backToTopButton = document.getElementById("back-to-top-btn");

// ---- משתנים ואלמנטים לגלריה ----
export const gridOverlay = document.getElementById('grid-overlay');
export const lightbox = document.getElementById('lightbox');
export const downloadBtn = document.getElementById('download-btn');
export const lightboxCloseBtn = lightbox.querySelector('.lightbox-close');
export const nextBtn = lightbox.querySelector('.lightbox-next');
export const prevBtn = lightbox.querySelector('.lightbox-prev');
export const gridCloseBtn = document.querySelector('.grid-close');
export const thumbnailGrid = document.getElementById('thumbnail-grid');
export const gridAlbumTitle = document.getElementById('grid-album-title');
export const lightboxImg = document.getElementById('lightbox-img');
export const shareBtn = document.getElementById('share-btn');
export const albumShareBtn = document.getElementById('album-share-btn');
export const albumDownloadBtn = document.getElementById('album-download-btn');

// ---- משתנים ואלמנטים לחדשות ----
export const newsModal = document.getElementById('news-modal');
export const modalTitle = document.getElementById('modal-title');
export const modalDate = document.getElementById('modal-date');
export const modalBody = document.getElementById('modal-body');
export const newsShareBtn = document.getElementById('news-share-btn');
export const newsPrevBtn = document.getElementById('news-prev-btn');
export const newsNextBtn = document.getElementById('news-next-btn');

// ---- פונקציות כלליות ----
// [חדש] פונקציה לעדכון תאריך ושעה בזמן אמת
function updateDateTime() {
    const now = new Date();
    const gregorianDate = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // [מתוקן] הסרנו את התאריך העברי
    dateTimeDisplay.textContent = `${gregorianDate} | ${time}`;
}
// כפתור חזרה למעלה
if (backToTopButton) {
    window.onscroll = () => {
        if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    };
    backToTopButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
// [שינוי] טיפול במצב כהה/בהיר עם שמירת העדפה ב-LocalStorage
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
    // [ חדש] טיפול בלחיצה על כפתור מצב כהה/בהיר
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isCurrentlyDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isCurrentlyDark ? 'dark' : 'light');
        if (themeIcon) themeIcon.classList.replace(isCurrentlyDark ? 'fa-moon' : 'fa-sun', isCurrentlyDark ? 'fa-sun' : 'fa-moon');
    });
}
// [שינוי] טיפול בשליחת טופס צור קשר (כולל הודעות UX)
if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const button = contactForm.querySelector('button[type="submit"]');
        const originalButtonHtml = button.innerHTML;

        // 1. מצב "שולח..."
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...'; // ספינר מ-Font Awesome

        // [ חדש] הסר כל הודעה קודמת
        let statusMessage = contactForm.querySelector('.form-status');
        if (statusMessage) statusMessage.remove();

        statusMessage = document.createElement('p');
        statusMessage.className = 'form-status';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.marginTop = '10px';

        // הכתובת של ה-Google Form (formResponse)
        const FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSei1Bf5tZILqekHD0nV2QsirdzryO8YEoOtkcl7rVB9HCKUog/formResponse";

        // מיפוי השדות (המשתמש יצטרך להוציא את ה-entry.ID מהטופס שלו)
        const formData = new FormData();
        formData.append('entry.659007933', contactForm.name.value);   // שם מלא
        formData.append('entry.627036351', contactForm.email.value);  // אימייל
        formData.append('entry.607110160', contactForm.message.value); // הודעה

        try {
            // שליחה ל-Google Forms
            await fetch(FORM_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });

            statusMessage.textContent = "ההודעה נשלחה בהצלחה! תודה רבה.";
            statusMessage.style.color = 'green';
            contactForm.reset();
        } catch (error) {
            console.error('Submission error:', error);
            statusMessage.textContent = "אירעה שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר.";
            statusMessage.style.color = 'red';
        }

        // [מתוקן] שחזור הכפתור מיד לאחר השליחה
        button.disabled = false;
        button.innerHTML = originalButtonHtml;
        contactForm.appendChild(statusMessage);

        // הסרת הודעת הסטטוס בלבד אחרי 5 שניות
        setTimeout(() => {
            if (statusMessage) statusMessage.remove();
        }, 5000);
    });
}
// [חדש] קוד לתפריט נייד
if (menuToggle && navLinks) {
    const icon = menuToggle.querySelector('i');
    const closeMenu = () => {
        if (navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            icon.classList.add('fa-bars');
            icon.classList.remove('fa-times');
        }
    };
    // [ חדש] 2. טיפול בלחיצה על כפתור התפריט
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
// [חדש] טיפול בכפתורי Back/Forward של הדפדפן
window.addEventListener('popstate', () => {
    checkUrlHash(); // בדיקת גלריה (שכבר קיימת)
    checkNewsHash(); // [חדש] בדיקת חדשות
});

// [חדש] קוד ליצירת השנה העברית הנוכחית
if (hebrewYearDisplay) {
    hebrewYearDisplay.textContent = getHebrewYear();
}

// [חדש] פונקציה ראשונית שופעת בהתחלה
(async function () {
    'use strict';
    updateDateTime();
    setInterval(updateDateTime, 1000);
    // [חדש] מפעיל את טעינת החדשות והגלריה
    loadNews();
    await loadGallery();
    initGalleryEvents(); // [חדש] רישום אירועי Gallery
    initNewsEvents(); // [חדש] רישום אירועי News
    initZmanim(); // [חדש] טעינת זמני היום
    // [חדש] בדיקות Deep Link ראשוניות לאחר טעינת כל הנתונים
    checkUrlHash();
    checkNewsHash();
    // [חדש] עדכון השנה העברית
    if (hebrewYearDisplay) hebrewYearDisplay.textContent = getHebrewYear();
    // [חדש] רישום Service Worker עבור PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // [חדש] טעינת הגדרות אתר (ערכת נושא וטקסטים)
    try {
        const configRes = await fetch('./data/site-config.json');
        if (configRes.ok) {
            const config = await configRes.json();
            if (config.theme && config.theme !== 'light') {
                document.body.className = `theme-${config.theme}`;
            }
            if (config.primaryColor) {
                document.documentElement.style.setProperty('--primary-color', config.primaryColor);
            }
            // עדכון טקסטים
            if (config.texts) {
                if (config.texts.about_title) document.querySelector('#about h2').textContent = config.texts.about_title;
                if (config.texts.about_body) document.querySelector('#about p').textContent = config.texts.about_body;
                if (config.texts.donation_title) document.querySelector('#donations h2').textContent = config.texts.donation_title;
                if (config.texts.donation_body) document.querySelector('#donations p').textContent = config.texts.donation_body;
            }

            // [חדש] אתחול OneSignal אם מוגדר
            if (config.oneSignalAppId) {
                window.OneSignalDeferred = window.OneSignalDeferred || [];
                // [Fix] דגל שיסמן אם OneSignal אותחל בהצלחה
                window._oneSignalReady = false;

                window.OneSignalDeferred.push(async function (OneSignal) {
                    const isGitHubPages = window.location.hostname.includes('github.io');
                    const basePath = isGitHubPages ? '/Beit-Halevi/' : '/';
                    console.log('[OneSignal] Initialization with basePath:', basePath);

                    try {
                        await OneSignal.init({
                            appId: config.oneSignalAppId,
                            safari_web_id: "web.onesignal.auto.bf458933-25d2-4522-9216-3b1a2072342c",
                            notifyButton: { enable: false },
                            allowLocalhostAsSecureOrigin: true,
                            // [תיקון] נתיב מלא למניעת שגיאת Invalid URL
                            serviceWorkerPath: basePath + "OneSignalSDKWorker.js",
                            serviceWorkerParam: { scope: basePath },
                        });
                        window._oneSignalReady = true;
                        console.log('[OneSignal] initialized successfully ✓');
                    } catch (initErr) {
                        window._oneSignalReady = false;
                        console.error('[OneSignal] init failed:', initErr);
                    }
                });

                // טעינת הסקריפט של OneSignal
                const script = document.createElement('script');
                script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            }
        }
    } catch (e) { console.log("No site-config.json found yet"); }
})();

// [תיקון] לוגיקת הרשמה להתראות - מחוץ ל-IIFE כדי להבטיח שתמיד תרוץ
// זה מבטיח שה-event listener יירשם גם אם site-config.json לא נטען
(function initSubscriptionButton() {
    'use strict';
    console.log('Initializing subscription button...');

    const fabSubscribeBtn = document.getElementById('fab-subscribe-btn');
    const subscribeModal = document.getElementById('subscribe-modal');
    const subscribeCloseBtn = document.querySelector('.subscribe-close');
    const subscribeBtn = document.getElementById('subscribe-btn');

    console.log('Subscribe button elements:', {
        fabBtn: !!fabSubscribeBtn,
        modal: !!subscribeModal,
        closeBtn: !!subscribeCloseBtn,
        subscribeBtn: !!subscribeBtn
    });

    // פתיחת המודאל
    if (fabSubscribeBtn && subscribeModal) {
        fabSubscribeBtn.addEventListener('click', () => {
            console.log('FAB button clicked, opening modal');
            subscribeModal.classList.add('active');
        });
    }

    // סגירת המודאל
    if (subscribeCloseBtn && subscribeModal) {
        subscribeCloseBtn.addEventListener('click', () => {
            console.log('Close button clicked, closing modal');
            subscribeModal.classList.remove('active');
        });
    }

    // סגירה בלחיצה מחוץ למודאל
    if (subscribeModal) {
        window.addEventListener('click', (e) => {
            if (e.target === subscribeModal) {
                console.log('Clicked outside modal, closing');
                subscribeModal.classList.remove('active');
            }
        });
    }

    // כפתור ההרשמה בתוך המודאל
    if (subscribeBtn) {
        console.log('Registering click event on subscribe button');
        subscribeBtn.addEventListener('click', async () => {
            console.log('Subscribe button clicked!');

            // בדיקה אם OneSignal אותחל בהצלחה (הדגל מוגדר ל-true רק אחרי init מוצלח)
            if (window._oneSignalReady === true) {
                console.log('OneSignal is ready, requesting subscription via OneSignal');
                window.OneSignalDeferred.push(async function (OneSignal) {
                    try {
                        console.log('Calling OneSignal.User.PushSubscription.optIn()');
                        await OneSignal.User.PushSubscription.optIn();
                        console.log('OneSignal subscription successful!');
                        alert("תודה שנרשמת! כעת תוכל לקבל עדכונים אמיתיים.");
                        if (subscribeModal) subscribeModal.classList.remove('active');
                    } catch (error) {
                        console.error('OneSignal subscription error:', error);
                        alert("אירעה שגיאה בהרשמה. אנא נסה שנית.");
                    }
                });
                return;
            }

            console.log('OneSignal not ready (init failed or not loaded), using native Notification API');

            console.log('OneSignal not available, using fallback Notification API');

            // [גיבוי] בדיקה אם הדפדפן תומך בהתראות (ללא OneSignal)
            if (!('Notification' in window)) {
                console.warn('Browser does not support notifications');
                alert("הדפדפן שלך לא תומך בהתראות.");
                return;
            }

            console.log('Current notification permission:', Notification.permission);

            // [תיקון] בדיקה אם already granted
            if (Notification.permission === 'granted') {
                console.log('Notification permission already granted');
                alert("אתה כבר רשום להתראות! תקבל עדכונים על חדשות וגלריות חדשות.");
                if (subscribeModal) subscribeModal.classList.remove('active');
                return;
            }

            if (Notification.permission === 'denied') {
                console.log('Notification permission denied');
                alert("ביטלת הרשמה להתראות. כדי להפעיל אותן, עדכן את הגדרות הדפדפן שלך.");
                return;
            }

            // בקשה להרשמה
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);

            if (permission === 'granted') {
                // [חדש] שמירת ה-subscription למכסן מקומי
                localStorage.setItem('notificationsEnabled', 'true');

                // [חדש] התראת החיוך
                new Notification('בית הלוי - התראות מופעלות', {
                    icon: './assets/icons/icon-192x192.png',
                    badge: './assets/icons/icon-192x192.png',
                    body: 'כעת תקבל עדכונים בזמן אמת על חדשות וגלריות חדשות בישיבה!',
                    tag: 'beit-halevi-welcome',
                    requireInteraction: false
                });

                alert("נרשמת בהצלחה להתראות! 🔔\n\nתקבל עדכונים כאשר:\n• יתווספו חדשות חדשות\n• יתווספו תמונות האירועים החדשים\n\nאתה יכול לבטל זאת בכל עת בהגדרות הדפדפן.");
                if (subscribeModal) subscribeModal.classList.remove('active');
            } else if (permission === 'denied') {
                alert("ביטלת הרשמה להתראות. כדי להפעיל אותן מאוחר יותר, עדכן את הגדרות הדפדפן.");
            }
        });
        console.log('Subscribe button event listener registered successfully');
    } else {
        console.error('Subscribe button not found! Check HTML for element with id="subscribe-btn"');
    }
})();