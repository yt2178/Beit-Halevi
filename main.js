// main.js
import { applySiteConfig, loadNews, loadGallery, allLoadedNews, allLoadedAlbums, BASE_URL } from './data-loader.js';
import { checkUrlHash, initGalleryEvents } from './gallery.js';
import { checkNewsHash, initNewsEvents } from './news.js';
import { getHebrewYear } from './utils.js';
import { initZmanim } from './zmanim.js';
import { initSearch } from './search.js';

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

// [חדש] עדכון כותרת הדף ומטא-תגים בצורה דינמית
export function updateDynamicMetadata(title, description) {
    if (title) document.title = `${title} | ישיבת בית הלוי`;
    // כאן אפשר להוסיף עדכון של מטא-תגים עבור OG אם רוצים שיתוף מדויק יותר בסושיאל
}

// [חדש] ניהול באדג' (Badge) באייקון האפליקציה (PWA)
export function updateAppBadge(count) {
    if ('setAppBadge' in navigator) {
        if (count > 0) {
            navigator.setAppBadge(count).catch(console.error);
        } else {
            navigator.clearAppBadge().catch(console.error);
        }
    }
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
        
        // בדיקת האניפוט
        if (contactForm.honeypot && contactForm.honeypot.value !== "") {
            console.warn("Spam detected via honeypot");
            statusMessage.textContent = "ההודעה נשלחה בהצלחה! תודה רבה.";
            statusMessage.style.color = "green";
            button.disabled = false;
            button.innerHTML = originalButtonHtml;
            contactForm.appendChild(statusMessage);
            return;
        }

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
        navLinks.classList.remove('active');
        icon.classList.add('fa-bars');
        icon.classList.remove('fa-times');
    };
    
    // [ חדש] 2. טיפול בלחיצה על כפתור התפריט
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = navLinks.classList.contains('active');
        
        if (isActive) {
            closeMenu();
        } else {
            navLinks.classList.add('active');
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
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
    applySiteConfig(); // [פרימיום] החלת הגדרות אתר דינמיות
    
    checkUrlHash();
    checkNewsHash();
    
    // [חדש] אתחול חיפוש גלובלי
    initSearch('news-container', 'album-grid-container');

    // [חדש] תצפית על תמונות לטעינה חלקה (Lazy Loading Fade-in)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.addEventListener('load', () => img.classList.add('loaded'));
                if (img.complete) img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, { threshold: 0.1 });

    const observeNewImages = () => {
        document.querySelectorAll('img.lazy-load:not(.observed)').forEach(img => {
            img.classList.add('observed');
            observer.observe(img);
        });
    };
    observeNewImages();
    const mutationObserver = new MutationObserver(observeNewImages);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

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
                window.OneSignalDeferred.push(function (OneSignal) {
                    try {
                        OneSignal.init({
                            appId: config.oneSignalAppId,
                            safari_web_id: "web.onesignal.auto.bf458933-25d2-4522-9216-3b1a2072342c", // אופציונלי
                            notifyButton: {
                                enable: false, // נשתמש בכפתור שלנו
                            },
                            allowLocalhostAsSecureOrigin: true,
                            // [תיקון] הגדרות נתיב עבור GitHub Pages
                            serviceWorkerParam: { scope: '/Beit-Halevi/' },
                            serviceWorkerPath: '/Beit-Halevi/OneSignalSDKWorker.js',
                        }).catch(e => console.warn("OneSignal init error ignored:", e));
                    } catch(e) {
                         console.warn("OneSignal try-catch:", e);
                    }

                    // [חדש] פונקציה לעדכון מצב הכפתור
                    function updateSubscribeUI() {
                        const isSubscribed = OneSignal.User.PushSubscription.optedIn;
                        const subBtn = document.getElementById('subscribe-btn');
                        const modalP = document.querySelector('#subscribe-modal p');
                        const fabBtn = document.getElementById('fab-subscribe-btn');

                        if (isSubscribed) {
                            if (subBtn) {
                                subBtn.innerHTML = '<i class="fas fa-bell-slash"></i> בטל הרשמה';
                                subBtn.style.backgroundColor = '#e74c3c'; // צבע אדום
                            }
                            if (modalP) modalP.textContent = "אתה רשום בהצלחה להתראות האתר! לחץ למטה אם ברצונך לבטל.";
                            if (fabBtn) fabBtn.style.display = 'none'; // הסתר את הכפתור המעצבן
                        } else {
                            if (subBtn) {
                                subBtn.innerHTML = '<i class="fas fa-bell"></i> הרשם עכשיו';
                                subBtn.style.backgroundColor = ''; // חזור לצבע המקורי
                            }
                            if (modalP) modalP.textContent = "קבל עדכונים בזמן אמת על חדשות, אלבומים ואירועים בישיבה ישירות לדפדפן שלך.";
                            if (fabBtn) fabBtn.style.display = 'flex';
                        }
                    }

                    // מאזין לשינוי במצב ההרשמה
                    OneSignal.User.PushSubscription.addEventListener("change", updateSubscribeUI);
                    
                    // בדיקה ראשונית כשהדף עולה
                    updateSubscribeUI();
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

    // [חדש] לוגיקת הרשמה להתראות (FAB ומודאל)
    const fabSubscribeBtn = document.getElementById('fab-subscribe-btn');
    const subscribeModal = document.getElementById('subscribe-modal');
    const subscribeCloseBtn = document.querySelector('.subscribe-close');
    const subscribeBtn = document.getElementById('subscribe-btn');

    // סגירת הכפתור הצף באופן אוטומטי אם כבר אושר בדפדפן (ללא קשר ל-OneSignal)
    if ('Notification' in window && Notification.permission === 'granted') {
        if (fabSubscribeBtn) {
            fabSubscribeBtn.style.display = 'none';
        }
    }

    // פתיחת המודאל
    if (fabSubscribeBtn && subscribeModal) {
        fabSubscribeBtn.addEventListener('click', () => {
            if ('Notification' in window && Notification.permission === 'granted') {
                 const modalP = document.querySelector('#subscribe-modal p');
                 if (modalP) modalP.textContent = "אתה רשום בהצלחה להתראות האתר! (ביטול מתבצע דרך הגדרות הדפדפן)";
                 if (subscribeBtn) {
                     subscribeBtn.innerHTML = '<i class="fas fa-check"></i> רשום לאתר';
                     subscribeBtn.style.backgroundColor = '#2ecc71';
                 }
            }
            subscribeModal.classList.add('active');
            document.body.classList.add('no-scroll');
        });
    }

    // סגירת המודאל
    if (subscribeCloseBtn && subscribeModal) {
        subscribeCloseBtn.addEventListener('click', () => {
            subscribeModal.classList.remove('active');
            document.body.classList.remove('no-scroll');
        });
    }

    // סגירה בלחיצה מחוץ למודאל
    if (subscribeModal) {
        window.addEventListener('click', (e) => {
            if (e.target === subscribeModal) {
                subscribeModal.classList.remove('active');
                document.body.classList.remove('no-scroll');
            }
        });
    }

    // כפתור ההרשמה בתוך המודאל
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', async () => {
            // אם OneSignal נטען
            if (window.OneSignalDeferred) {
                window.OneSignalDeferred.push(async function (OneSignal) {
                    const isSubscribed = OneSignal.User.PushSubscription.optedIn;
                    
                    if (isSubscribed) {
                        await OneSignal.User.PushSubscription.optOut();
                        alert("ביטלת את הרשמתך להתראות בהצלחה.");
                    } else {
                        await OneSignal.User.PushSubscription.optIn();
                    }
                    if (subscribeModal) {
                        subscribeModal.classList.remove('active');
                        document.body.classList.remove('no-scroll');
                    }
                });
                return;
            }

            // [גיבוי] בדיקה אם הדפדפן תומך בהתראות (ללא OneSignal)
            if (!('Notification' in window)) {
                alert("הדפדפן שלך לא תומך בהתראות.");
                return;
            }
            // ... (שאר הקוד הישן נשאר כגיבוי)

            // [תיקון] בדיקה אם already granted
            if (Notification.permission === 'granted') {
                alert("אתה כבר רשום להתראות! תקבל עדכונים על חדשות וגלריות חדשות.");
                return;
            }

            if (Notification.permission === 'denied') {
                alert("ביטלת הרשמה להתראות. כדי להפעיל אותן, עדכן את הגדרות הדפדפן שלך.");
                return;
            }

            // בקשה להרשמה
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                localStorage.setItem('notificationsEnabled', 'true');
                if (fabSubscribeBtn) fabSubscribeBtn.style.display = 'none';

                new Notification('בית הלוי - התראות מופעלות', {
                    icon: './assets/icons/icon-192x192.png',
                    badge: './assets/icons/icon-192x192.png',
                    body: 'כעת תקבל עדכונים בזמן אמת על חדשות וגלריות חדשות בישיבה!',
                    tag: 'beit-halevi-welcome',
                    requireInteraction: false
                });

                alert("נרשמת בהצלחה להתראות! 🔔\n\nתקבל עדכונים כאשר:\n• יתווספו חדשות חדשות\n• יתווספו תמונות האירועים החדשים\n\nאתה יכול לבטל זאת בכל עת בהגדרות הדפדפן.");
                if (subscribeModal) {
                    subscribeModal.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            } else if (permission === 'denied') {
                alert("ביטלת הרשמה להתראות. כדי להפעיל אותן מאוחר יותר, עדכן את הגדרות הדפדפן.");
            }
        });
    }

    // --- PWA Install Prompt Logic ---
    let deferredPrompt;
    const pwaInstallBanner = document.getElementById('pwa-install-banner');
    const pwaInstallBtn = document.getElementById('pwa-install-btn');
    const pwaCloseBtn = document.getElementById('pwa-close-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        
        // Check if user already closed it recently
        const lastClosed = localStorage.getItem('pwa_banner_closed');
        if (!lastClosed || (Date.now() - parseInt(lastClosed)) > 86400000) {
            // Show the custom install banner
            if (pwaInstallBanner) pwaInstallBanner.style.display = 'flex';
        }
    });

    if (pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            // Show the install prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
        });
    }

    if (pwaCloseBtn) {
        pwaCloseBtn.addEventListener('click', () => {
            if (pwaInstallBanner) pwaInstallBanner.style.display = 'none';
            localStorage.setItem('pwa_banner_closed', Date.now().toString());
        });
    }

    // --- [חדש] לוגיקה לכותרת מצטמצמת בגלילה (Sticky Shrunk Header) ---
    const stickyWrapper = document.getElementById('sticky-header-wrapper');
    if (stickyWrapper) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                stickyWrapper.classList.add('scrolled');
            } else {
                stickyWrapper.classList.remove('scrolled');
            }
        });
    }

})();