// main.js
import { loadNews, loadGallery, BASE_URL } from './data-loader.js';
import { checkUrlHash, showNextImage, showPrevImage, closeLightbox, openGridOverlay } from './gallery.js';
import { checkNewsHash, openNewsModal, navigateNews } from './news.js'; 
// ---- הגדרות כלליות ----
const footerYearElement = document.querySelector('footer p');
const footerYear = document.getElementById('footer-year');
const newsPrevBtn = document.getElementById('news-prev-btn'); 
const newsNextBtn = document.getElementById('news-next-btn'); 
const dateTimeDisplay = document.getElementById('date-time-display');
const hebrewYearDisplay = document.getElementById('hebrew-year-display');
const themeToggle = document.getElementById('theme-toggle');
const contactForm = document.getElementById('contact-form');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
let backToTopButton = document.getElementById("back-to-top-btn");

// ---- פונקציות כלליות ----
// [חדש] פונקציה לעדכון תאריך ושעה בזמן אמת
    function updateDateTime() {
    const now = new Date();
    const gregorianDate = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    // [מתוקן] הסרנו את התאריך העברי
    dateTimeDisplay.textContent = `${gregorianDate} | ${time}`;
}
    // [חדש] פונקציה לקבלת השנה העברית הנוכחית
    function getHebrewYear() {
    const now = new Date();
    // יצירת פורמט עברי (מספרים עבריים)
    const hebrewDate = now.toLocaleDateString('he-IL-u-ca-hebrew', { year: 'numeric' });
    // לצרכי פשטות, נשתמש בפורמט המספרי העברי:
    return hebrewDate;
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
    backToTopButton.addEventListener("click", () => window.scrollTo({top: 0, behavior: 'smooth'}) );
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
        
        // הסר כל הודעה קודמת
        let statusMessage = contactForm.querySelector('.form-status');
        if (statusMessage) statusMessage.remove();
        
        statusMessage = document.createElement('p');
        statusMessage.className = 'form-status';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.marginTop = '10px';
        
        const response = await fetch(contactForm.action, {
            method: contactForm.method,
            body: new FormData(contactForm),
            headers: {'Accept': 'application/json'}
        });
        
        // 2. טיפול בתגובה
        if (response.ok) {
            statusMessage.textContent = "ההודעה נשלחה בהצלחה! תודה רבה.";
            statusMessage.style.color = 'green';
            contactForm.reset();
        } else {
            statusMessage.textContent = "אירעה שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר.";
            statusMessage.style.color = 'red';
        }
        
        // 3. הצגת הודעה סופית ושחזור כפתור
        contactForm.appendChild(statusMessage);
        
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = originalButtonHtml; // שחזור המצב המקורי
            statusMessage.remove(); // הסרת ההודעה אחרי 5 שניות
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
if (footerYearElement) {
    // ניתן לשנות ישירות את ה-HTML או לעדכן את הטקסט
    // נניח ש-index.html השתנה ל- <span id="gregorian-year"></span>
    // אם לא, נתעלם משורה זו. נשאיר את השנה העברית בלבד. 
}
(async function() {
    'use strict';
    updateDateTime();

    setInterval(updateDateTime, 1000);
    // מפעיל את טעינת החדשות והגלריה
    loadNews();
    await loadGallery(); 

    // בדיקות Deep Link ראשוניות לאחר טעינת כל הנתונים
    checkUrlHash(); 
    checkNewsHash(); 
     if (hebrewYearDisplay) hebrewYearDisplay.textContent = getHebrewYear();
})();  
// סוף ה-IIFE הראשי והיחיד