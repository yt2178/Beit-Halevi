// ============================================================
// admin.js - ניהול חדשות דרך GitHub API
// ============================================================

import {
    REPO_OWNER, REPO_NAME, JSON_FILE_PATH, HISTORY_JSON_PATH, SITE_CONFIG_PATH,
    MESSAGES_SHEET_URL,
    GITHUB_TOKEN, GITHUB_USERNAME, updateGithubAuth,
    showStatus, hideStatus, encodeToBase64, decodeBase64ToUtf8,
    initGoogleLogin, googleLogin, logEvent,
    GOOGLE_CLIENT_ID, GOOGLE_SCOPES
} from './admin-core.js';
import { putWithShaRetry } from './admin-core.js';

import { loadAndRenderGallery, initGalleryAdminEvents } from './admin-gallery.js';
import { loadSiteConfig, saveAllSiteSettings } from './admin-site-editor.js';

const ADMIN_USER_CODES = {
    "12589": "ידידיה",
    "112233": "הרב סאו",
};

const GITHUB_TOKEN_KEY = 'admin_github_token';
const USER_CODE_KEY = 'admin_user_code';
const GITHUB_USERNAME_KEY = 'admin_github_username';

// Theme & Drafts keys
const DRAFT_KEY = 'news_draft_v1';
const THEME_KEY = 'admin_theme';

export let easyMDE;
export let allLoadedNews = []; // Cache for news items to avoid re-fetching

// Theme functions
function applyTheme(theme) {
    try {
        if (theme === 'dark') document.body.classList.add('dark-theme');
        else document.body.classList.remove('dark-theme');
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.textContent = theme === 'dark' ? '☀️ מצב בהיר' : '🌙 מצב כהה';
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
        // ignore localStorage issues
    }
}

function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Draft functions
function saveNewsDraft(showFeedback = false) {
    try {
        const title = document.getElementById('news-title').value || '';
        const date = document.getElementById('news-date').value || '';
        const body = easyMDE ? easyMDE.value() : document.getElementById('news-body').value || '';
        const draft = { title, date, body, savedAt: new Date().toISOString() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        // Only show toast if manual button click (not autosave)
        if (showFeedback) {
            showToast('✅ טיוטה נשמרה בהצלחה', 1500, 'success');
        }
    } catch (e) {
        if (showFeedback) showToast('❌ שגיאה בשמירה', 1500, 'error');
    }
}

function loadNewsDraft(showFeedback = true) {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) {
            if (showFeedback) showToast('⚠️ אין טיוטה שמורה', 1500);
            return;
        }
        const draft = JSON.parse(raw);
        if (draft.title) document.getElementById('news-title').value = draft.title;
        if (draft.date) document.getElementById('news-date').value = draft.date;
        if (easyMDE && typeof easyMDE.value === 'function') easyMDE.value(draft.body || '');
        else document.getElementById('news-body').value = draft.body || '';
        if (showFeedback) showToast('✅ טיוטה הוטענה', 1500, 'success');
    } catch (e) {
        if (showFeedback) showToast('❌ שגיאה בטעינה', 1500, 'error');
    }
}

function clearNewsDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
        showToast('✅ טיוטה נמחקה', 1500, 'success');
    } catch (e) {
        // ignore
    }
}

function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

// Toast notification (non-blocking side notification)
export function showToast(message, duration = 3000, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `premium-toast ${type}`;

    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('active'), 10);

    // Remove toast
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

function initDraftAutosave() {
    try {
        const titleEl = document.getElementById('news-title');
        const dateEl = document.getElementById('news-date');
        if (titleEl) titleEl.addEventListener('input', debounce(saveNewsDraft, 1000));
        if (dateEl) dateEl.addEventListener('input', debounce(saveNewsDraft, 1000));
        if (easyMDE && easyMDE.codemirror) {
            easyMDE.codemirror.on('change', debounce(saveNewsDraft, 1000));
        } else {
            const bodyEl = document.getElementById('news-body');
            if (bodyEl) bodyEl.addEventListener('input', debounce(saveNewsDraft, 1000));
        }
    } catch (e) {
        // ignore
    }
}

function undoEditor() {
    try { if (easyMDE && easyMDE.codemirror) easyMDE.codemirror.undo(); } catch (e) { }
}
function redoEditor() {
    try { if (easyMDE && easyMDE.codemirror) easyMDE.codemirror.redo(); } catch (e) { }
}

// Set default news date to today
function setDefaultNewsDate() {
    try {
        const dateInput = document.getElementById('news-date');
        if (dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
    } catch (e) {
        // ignore
    }
}

export let editingNewsSlug = null;
export let editingNewsSHA = null;
const cancelNewsBtn = document.getElementById('cancel-news-edit');

// אלמנטי DOM
const loginSection = document.getElementById('login-section');
const newsSection = document.getElementById('news-section');
const dashboardSection = document.getElementById('dashboard-section');
const gallerySection = document.getElementById('gallery-section');
const historySection = document.getElementById('history-section');
const messagesSection = document.getElementById('messages-section');
const siteSection = document.getElementById('site-section');
const loginForm = document.getElementById('login-form');
const addNewsForm = document.getElementById('add-news-form');
const loginMessage = document.getElementById('login-message');
const logoutBtn = document.getElementById('logout-btn');

// אלמנטי סטטוס
const closeStatusBtn = document.getElementById('close-status-btn');

function handleApiError(err) {
    // ✅ Fix: בצע logging בעיקול בלבד לא בproduction
    let msg = "שגיאה לא צפויה";
    if (err.message.includes("404")) msg = "הקובץ לא נמצא ב-GitHub";
    if (err.message.includes("401")) msg = "טוקן לא בתוקף או חסר הרשאות";
    if (err.message.includes("403")) msg = "אין הרשאה לביצוע הפעולה (ייתכן שהטוקן מוגבל)";
    if (err.message.includes("sha")) msg = "שגיאת סנכרון: הקובץ עודכן על ידי מישהו אחר. נא לרענן.";
    if (err.message.includes("Token client")) msg = "שגיאה בחיבור לגוגל. נא לרענן ולנסות שוב.";

    showStatus(`שגיאה: ${msg} (${err.message})`, null, true);
}


function generateSlug(title, date) {
    // [חובה] יש לוודא שהפונקציה הזו קיימת ב-admin.js
    // זה נותן slug חזק לשימוש ב-Commit Message ולחיפוש
    const filename_slug = title.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${date}-${filename_slug}`;
}

// [חדש] פונקציה לניקוי תווים שאינם באנגלית, עברית, מספרים או מקפים
function cleanSlug(title) {
    // [חדש] פונקציית עזר לניקוי תווי slug
    return title.replace(/\s/g, '-').replace(/[^a-z0-9\u05D0-\u05EA-]/gi, '');
}

// פונקציה לבניית Slug סופי
function getFinalSlug(title, date) {
    const titleSlug = cleanSlug(title);
    return `${date}-${titleSlug}`;
}

// ============================================================
// 6. פונקציות ראשיות (Main Functions)
// ============================================================

// הצגת/הסתרת פאנל הניהול
function showAdminPanel() {
    if (GITHUB_TOKEN && GITHUB_USERNAME) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

        // הסתרת כל השאר
        [newsSection, gallerySection, historySection, messagesSection, siteSection].forEach(s => {
            if (s) s.style.display = 'none';
        });

        logoutBtn.style.display = 'inline-block';

        loadAndRenderNewsList();
        loadAndRenderGallery();
    } else {
        [dashboardSection, newsSection, gallerySection, historySection, messagesSection, siteSection].forEach(s => {
            if (s) s.style.display = 'none';
        });
        loginSection.style.display = 'block';
        logoutBtn.style.display = 'none';
    }
}

function navigateTo(sectionId) {
    const sections = [dashboardSection, newsSection, gallerySection, historySection, messagesSection, siteSection];
    sections.forEach(s => { if (s) s.style.display = 'none'; });
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    if (sectionId === 'history-section') loadAndRenderHistory();
    if (sectionId === 'messages-section') loadAndRenderMessages();
    if (sectionId === 'news-section') {
        setDefaultNewsDate();
        initDraftAutosave();
    }
}
// Redundant functions removed as they are imported from admin-core.js

// ============================================================
// 7. פונקציות GitHub (GitHub Functions)
// ============================================================
// יציאה מהמערכת
function logout() {
    // ✅ Fix: הוסף confirmation כדי לא לצאת כן בטעות
    if (!confirm('האם אתה בטוח שברצונך להיכנס מהמערכת?')) return;

    showStatus('מתנתק מהמערכת... להתראות!', 100);
    setTimeout(() => {
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        localStorage.removeItem(GITHUB_USERNAME_KEY);
        localStorage.removeItem(USER_CODE_KEY);
        location.reload();
    }, 1000);
}

// [חדש] פונקציה לאימות הטוקן מול GitHub
async function verifyGitHubToken(token) {
    try {
        const p1 = "https://";
        const p2 = "api.github.com";
        const p3 = "/user";
        const url = (p1 + p2 + p3).trim();
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            return userData.login; // מחזיר את שם המשתמש האמיתי
        } else {
            const errorData = await response.json();
            // ✅ Fix: הסר debug logs חשופים של שגיאות
            return null;
        }
    } catch (error) {
        // ✅ Fix: הסר console.error של שגיאות
        return null;
    }
}

// רינדור רשימת הידיעות
function renderNewsList(newsArray) {
    const container = document.getElementById('news-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (newsArray.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <p>אין ידיעות להצגה. התחל בפרסום הידיעה הראשונה!</p>
            </div>
        `;
        return;
    }

    newsArray.forEach(item => {
        const slug = generateSlug(item.data.title, item.data.date);
        const newsDiv = document.createElement('div');
        newsDiv.className = 'news-item-admin';
        newsDiv.dataset.slug = slug;

        // ✅ Fix XSS: תוכן דינמי מנוקה דרך textContent
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'item-details';

        const titleH3 = document.createElement('h3');
        titleH3.textContent = item.data.title;  // Safe!

        const dateP = document.createElement('p');
        dateP.textContent = 'פורסם ב: ' + item.data.date;  // Safe!

        const iconI = document.createElement('i');
        iconI.className = 'fas fa-file-alt item-icon';

        detailsDiv.appendChild(iconI);
        const contentDiv = document.createElement('div');
        contentDiv.appendChild(titleH3);
        contentDiv.appendChild(dateP);
        detailsDiv.appendChild(contentDiv);
        newsDiv.appendChild(detailsDiv);

        // ✅ Fix XSS: בנה את כפתורים בעדכות בטוח
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-news-btn premium-btn small';
        editBtn.dataset.slug = slug;
        editBtn.innerHTML = '<i class="fas fa-edit"></i> ערוך';
        editBtn.addEventListener('click', () => handleEditNews(slug));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-news-btn premium-btn small danger';
        deleteBtn.dataset.slug = slug;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> מחק';
        deleteBtn.addEventListener('click', () => handleDeleteNews(slug));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        newsDiv.appendChild(actionsDiv);

        container.appendChild(newsDiv);
    });
}

// מחיקת ידיעה
async function handleDeleteNews(slug) {
    if (!confirm('האם אתה בטוח שברצונך למחוק ידיעה זו? הפעולה אינה ניתנת לביטול.')) return;

    showStatus('מוחק ידיעה...', 50);
    const p1 = "https://";
    const p2 = "api.github.com";
    const p3 = "/repos/";
    const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch JSON');

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        const updatedContent = existingContent.filter(item =>
            generateSlug(item.data.title, item.data.date) !== slug
        );

        const updatedContentBase64 = encodeToBase64(JSON.stringify(updatedContent, null, 2));

        const payload = {
            message: `Delete news item: ${slug}`,
            content: updatedContentBase64,
            branch: 'main'
        };
        const updateResponse = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, fileData.sha, 2);

        if (updateResponse && updateResponse.ok) {
            showStatus('הידיעה נמחקה בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`מחק ידיעה: ${slug}`, 'news');
            await loadAndRenderNewsList();
        } else {
            throw new Error('Delete failed on GitHub');
        }
    } catch (error) {
        handleApiError(error);
    }
}

async function loadAndRenderNewsList() {
    if (!GITHUB_TOKEN) return;

    const p1 = "https://";
    const p2 = "api.github.com";
    const p3 = "/repos/";
    const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) return;

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // Populate cache for editing
        allLoadedNews = existingContent.map(item => ({
            slug: generateSlug(item.data.title, item.data.date),
            title: item.data.title,
            date: item.data.date,
            body: item.data.body
        }));

        renderNewsList(existingContent);
    } catch (error) {
        // ✅ Fix: הסר debug error logging
        showStatus('שגיאה בטעינת רשימת הידיעות', null, true);
    }
}

// [חדש] טעינה ורינדור של ההיסטוריה
async function loadAndRenderHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    try {
        const p1 = "https://";
        const p2 = "api.github.com";
        const p3 = "/repos/";
        const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + HISTORY_JSON_PATH;
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!response.ok) throw new Error('Failed to load history');

        const fileData = await response.json();
        const history = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        container.innerHTML = '';
        if (history.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>אין פעולות מתועדות</p></div>';
            return;
        }

        history.forEach(log => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-icon ${log.type || 'general'}">
                    <i class="fas ${getIconForType(log.type)}"></i>
                </div>
                <div class="history-time">${log.timestamp}</div>
                <div class="history-user">${log.user}</div>
                <div class="history-action">${log.action}</div>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = `<p style="color:red; text-align:center;">שגיאה בטעינת היסטוריה: ${err.message}</p>`;
    }
}

function getIconForType(type) {
    switch (type) {
        case 'login': return 'fa-sign-in-alt';
        case 'news': return 'fa-newspaper';
        case 'gallery': return 'fa-images';
        default: return 'fa-info-circle';
    }
}

// [חדש] טעינה ורינדור של הודעות (מתוך Google Sheets) - תומך במחיקה מקומית
async function loadAndRenderMessages() {
    const container = document.getElementById('messages-list-container');
    if (!container) return;

    if (!MESSAGES_SHEET_URL || MESSAGES_SHEET_URL.includes("נא_להזין")) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>טרם הוגדר קישור לגיליון ההודעות ב-admin.js</p></div>';
        return;
    }

    try {
        // [שינוי] טעינת רשימת הודעות שנמחקו מ-GitHub
        let deletedMessages = [];
        try {
            const p1 = "https://";
            const p2 = "api.github.com";
            const p3 = "/repos/";
            const delUrl = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/data/deleted_messages.json";
            const delRes = await fetch(delUrl, {
                headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
            });
            if (delRes.ok) {
                const delData = await delRes.json();
                deletedMessages = JSON.parse(decodeBase64ToUtf8(delData.content.replace(/\n/g, '')));
            }
        } catch (e) { /* ✅ Fix: הסר debug log אם אין deleted_messages */ }

        const response = await fetch(MESSAGES_SHEET_URL);
        if (!response.ok) throw new Error('Failed to load messages sheet');

        const csvData = await response.text();
        const rows = parseCSV(csvData);

        container.innerHTML = '';
        if (rows.length <= 1) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-envelope-open"></i><p>אין הודעות להצגה</p></div>';
            return;
        }

        const messages = rows.slice(1).reverse();
        let visibleCount = 0;

        messages.forEach((row, index) => {
            if (row.length < 4) return;
            const [timestamp, name, email, body] = row;
            const messageId = `${timestamp}-${email}`;

            // סינון הודעות שנמחקו
            if (deletedMessages.includes(messageId)) return;
            visibleCount++;

            const div = document.createElement('div');
            div.className = 'message-card';

            // ✅ Fix XSS: בנה DOM elements בטוח במקום innerHTML
            const headerDiv = document.createElement('div');
            headerDiv.className = 'message-header';

            const infoDiv = document.createElement('div');
            infoDiv.className = 'message-info';
            const nameH4 = document.createElement('h4');
            nameH4.textContent = name;
            const emailP = document.createElement('p');
            emailP.textContent = email;
            infoDiv.appendChild(nameH4);
            infoDiv.appendChild(emailP);

            const dateDiv = document.createElement('div');
            dateDiv.className = 'message-date';
            dateDiv.textContent = timestamp;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-msg-btn premium-btn small danger';
            deleteBtn.dataset.id = messageId;
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> מחק';
            deleteBtn.addEventListener('click', () => handleDeleteMessage(messageId));

            headerDiv.appendChild(infoDiv);
            headerDiv.appendChild(dateDiv);
            headerDiv.appendChild(deleteBtn);

            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'message-body';
            bodyDiv.textContent = body;

            div.appendChild(headerDiv);
            div.appendChild(bodyDiv);
            container.appendChild(div);
        });

        if (visibleCount === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-envelope-open"></i><p>אין הודעות להצגה</p></div>';
        }
    } catch (err) {
        container.innerHTML = `<p style="color:red; text-align:center;">שגיאה בטעינת הודעות: ${err.message}</p>`;
    }
}

async function handleDeleteMessage(messageId) {
    if (!confirm('האם אתה בטוח שברצונך למחוק הודעה זו מהתצוגה?')) return;

    showStatus('מוחק הודעה...', 50);
    const FILE_PATH = 'data/deleted_messages.json';
    const p1 = "https://";
    const p2 = "api.github.com";
    const p3 = "/repos/";
    const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE_PATH;

    try {
        let deletedMessages = [];
        let sha = null;

        const res = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (res.ok) {
            const data = await res.json();
            sha = data.sha;
            deletedMessages = JSON.parse(decodeBase64ToUtf8(data.content.replace(/\n/g, '')));
        }

        if (!deletedMessages.includes(messageId)) {
            deletedMessages.push(messageId);
        }

        const payload = {
            message: `Delete message: ${messageId}`,
            content: encodeToBase64(JSON.stringify(deletedMessages, null, 2)),
            branch: 'main'
        };
        const putRes = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, sha, 2);

        if (putRes && putRes.ok) {
            showStatus('ההודעה נמחקה מהתצוגה', 100);
            setTimeout(hideStatus, 1000);
            loadAndRenderMessages();
        } else {
            throw new Error('Failed to update deleted_messages.json');
        }
    } catch (err) {
        handleApiError(err);
    }
}

// פונקציית עזר פשוטה לפיענוח CSV (מתחשבת במירכאות)
function parseCSV(text) {
    const lines = text.split('\n');
    return lines.map(line => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else cur += char;
        }
        result.push(cur.trim());
        return result;
    });
}


// עריכת ידיעה קיימת
async function handleEditNews(slug) {
    showStatus('טוען ידיעה לעריכה...', 30);
    try {
        const item = allLoadedNews.find(n => n.slug === slug);
        if (!item) throw new Error('News item not found');

        // השהייה קלה לחווית משתמש טובה יותר כפי שביקש המשתמש
        await new Promise(r => setTimeout(r, 600));

        editingNewsSlug = slug;
        document.getElementById('news-title').value = item.title;
        document.getElementById('news-date').value = item.date;
        easyMDE.value(item.body);

        cancelNewsBtn.style.display = 'inline-block';
        addNewsForm.querySelector('button[type="submit"]').textContent = 'שמור שינויים';

        navigateTo('news-section');
        hideStatus();
    } catch (err) {
        handleApiError(err);
    }
}

export function resetNewsForm() {
    addNewsForm.reset();
    easyMDE.value('');
    editingNewsSlug = null;
    editingNewsSHA = null;
    addNewsForm.querySelector('button[type="submit"]').textContent = 'פרסם ידיעה';
    if (cancelNewsBtn) cancelNewsBtn.style.display = 'none';
}

// שמירת ידיעה (חדשה או עריכה)
async function handleSaveNews(e) {
    e.preventDefault();
    const isUpdate = !!editingNewsSlug;
    showStatus('מבצע גישה ל-GitHub... נא להמתין', 20);

    const title = document.getElementById('news-title').value.trim();
    const date = document.getElementById('news-date').value.trim();
    const body = easyMDE.value().trim();

    // ✅ Fix: הוסף validation לתאריך
    if (!title || !date || !body) {
        showStatus('נא למלא את כל השדות', null, true);
        return;
    }

    // בדוק שהתאריך בפורמט תקין (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
        showStatus('תאריך לא תקין. השתמש בפורמט: YYYY-MM-DD', null, true);
        return;
    }

    const newItem = {
        data: { title, date, body },
    };

    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch JSON: ' + fileResponse.status);
        showStatus('מעבד נתונים ושומר שינויים...', 60);

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        const sha = fileData.sha;

        if (editingNewsSlug) {
            const index = existingContent.findIndex(item =>
                generateSlug(item.data.title, item.data.date) === editingNewsSlug
            );
            if (index !== -1) existingContent[index] = newItem;
            editingNewsSlug = null;
            editingNewsSHA = null;
            addNewsForm.querySelector('button[type="submit"]').textContent = 'פרסם ידיעה';
            if (cancelNewsBtn) cancelNewsBtn.style.display = 'none';
        } else {
            existingContent.unshift(newItem);
        }

        const updatedContentBase64 = encodeToBase64(JSON.stringify(existingContent, null, 2));

        const payload = {
            message: `${editingNewsSlug ? 'Update' : 'Add'} news: ${title}`,
            content: updatedContentBase64,
            branch: 'main'
        };
        const updateResponse = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, sha, 2);

        if (updateResponse && updateResponse.ok) {
            clearNewsDraft();
            showStatus('הידיעה פורסמה בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${editingNewsSlug ? 'עדכן' : 'הוסיף'} ידיעה: ${title}`, 'news');
            resetNewsForm();
            await loadAndRenderNewsList();

            logEvent(`${isUpdate ? 'עדכן' : 'הוסיף'} ידיעה: ${title}`, 'news');
            resetNewsForm();
            await loadAndRenderNewsList();
        } else {
            const errorData = updateResponse ? await updateResponse.json().catch(() => ({})) : {};
            throw new Error(errorData.message || 'Unknown error saving news');
        }
    } catch (err) {
        handleApiError(err);
    }
}

// ============================================================
// 5. Event Listeners
// ============================================================

// אתחול הדף
document.addEventListener('DOMContentLoaded', async () => {
    // אתחול עורך Markdown
    try {
        easyMDE = new EasyMDE({
            element: document.getElementById("news-body"),
            status: false,
            spellChecker: false,
            autoDownloadFontAwesome: false, // [חדש] מניעת הורדה חיצונית שעוברת על ה-CSP
            direction: 'rtl', // [חדש] תמיכה ב-RTL
            autosave: {
                enabled: true,
                uniqueId: "news-editor",
                delay: 1000,
            },
        });
    } catch (e) {
        // ✅ Fix: הסר EasyMDE עירעור צעדי
        showStatus('שגיאה בטעינת עורך הטקסט', null, true);
    }

    // מחכים שהספריות של גוגל יטענו (אם הן async)
    if (typeof google !== 'undefined') {
        initGoogleLogin();
    }

    showAdminPanel();

    // ניווט
    document.getElementById('nav-news-btn').addEventListener('click', () => navigateTo('news-section'));
    document.getElementById('nav-gallery-btn').addEventListener('click', () => navigateTo('gallery-section'));
    document.getElementById('nav-history-btn').addEventListener('click', () => navigateTo('history-section'));
    document.getElementById('nav-messages-btn').addEventListener('click', () => navigateTo('messages-section'));
    document.getElementById('nav-site-btn').addEventListener('click', async () => {
        navigateTo('site-section');
        await loadSiteConfig();
    });
    document.getElementById('save-all-site-settings').addEventListener('click', saveAllSiteSettings);

    document.querySelectorAll('.back-to-dashboard-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo('dashboard-section'));
    });
    closeStatusBtn.addEventListener('click', hideStatus);

    // [חדש] מודאל תצוגה מקדימה לתמונות
    const imgModal = document.getElementById('image-preview-modal');
    const closeImgModal = document.getElementById('close-preview-modal');
    if (closeImgModal) {
        closeImgModal.onclick = () => imgModal.style.display = 'none';
    }
    window.onclick = (e) => { if (e.target === imgModal) imgModal.style.display = 'none'; };

    initGalleryAdminEvents();

    // Theme initialization
    try {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        applyTheme(savedTheme);
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    } catch (e) { /* ignore */ }

    // Draft & editor controls
    const undoBtn = document.getElementById('undo-news-btn');
    const redoBtn = document.getElementById('redo-news-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const loadDraftBtn = document.getElementById('load-draft-btn');
    const clearDraftBtn = document.getElementById('clear-draft-btn');

    if (undoBtn) undoBtn.addEventListener('click', undoEditor);
    if (redoBtn) redoBtn.addEventListener('click', redoEditor);
    if (saveDraftBtn) saveDraftBtn.addEventListener('click', () => saveNewsDraft(true));
    if (loadDraftBtn) loadDraftBtn.addEventListener('click', () => loadNewsDraft(true));
    if (clearDraftBtn) clearDraftBtn.addEventListener('click', clearNewsDraft);

    // Start autosave for drafts (only after navigating to news section)
    // initDraftAutosave() will be called when user navigates to news-section
    // to avoid loading stale drafts on page load

    // [חדש] מאזין לכפתורי "עין" להצגת/הסתרת סיסמה
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const targetId = icon.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    if (cancelNewsBtn) {
        cancelNewsBtn.addEventListener('click', resetNewsForm);
    }
});

// כפתור עריכה ומחיקה - delegated event
document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-news-btn');
    const deleteBtn = e.target.closest('.delete-news-btn');

    if (editBtn) {
        handleEditNews(editBtn.dataset.slug);
    } else if (deleteBtn) {
        handleDeleteNews(deleteBtn.dataset.slug);
    }

    const deleteMsgBtn = e.target.closest('.delete-msg-btn');
    if (deleteMsgBtn) {
        handleDeleteMessage(deleteMsgBtn.dataset.id);
    }
});

// טופס התחברות
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userCodeInput = document.getElementById('admin-usercode').value.trim();
    const tokenInput = document.getElementById('github-token').value.trim();

    if (ADMIN_USER_CODES.hasOwnProperty(userCodeInput)) {
        showStatus('מאמת טוקן GitHub...', 30);
        const username = await verifyGitHubToken(tokenInput);

        if (username) {
            localStorage.setItem(GITHUB_TOKEN_KEY, tokenInput);
            localStorage.setItem(GITHUB_USERNAME_KEY, username);
            localStorage.setItem(USER_CODE_KEY, userCodeInput);
            updateGithubAuth(tokenInput, username);

            showStatus('התחברות הצליחה! ברוך הבא.', 100);
            logEvent('התחבר למערכת', 'login');
            setTimeout(() => {
                hideStatus();
                showAdminPanel();
            }, 1000);
        } else {
            showStatus('טוקן GitHub לא תקין', null, true);
        }
    } else {
        showStatus('קוד משתמש לא תקין', null, true);
    }
});

// טופס הוספת/עריכת חדשות
addNewsForm.addEventListener('submit', handleSaveNews);

// כפתור יציאה
document.getElementById('logout-btn').addEventListener('click', logout);