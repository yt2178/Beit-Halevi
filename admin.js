// ============================================================
// admin.js - ניהול חדשות דרך GitHub API
// ============================================================

import {
    REPO_OWNER, REPO_NAME, JSON_FILE_PATH, HISTORY_JSON_PATH, SITE_CONFIG_PATH,
    MESSAGES_SHEET_URL,
    GITHUB_TOKEN, GITHUB_USERNAME, updateGithubAuth,
    showStatus, hideStatus, encodeToBase64, decodeBase64ToUtf8,
    initGoogleLogin, googleLogin, logEvent,
    GOOGLE_CLIENT_ID, GOOGLE_SCOPES, sendPushNotification,
    uploadFileToDrive, makeFilePublic, verifyGitHubToken
} from './admin-core.js';
import { putWithShaRetry } from './admin-core.js';

import { loadAndRenderGallery, initGalleryAdminEvents } from './admin-gallery.js';
import { loadAndRenderTasks } from './admin-tasks.js';
import { loadSiteConfig, saveAllSiteSettings } from './admin-site-editor.js';

const ADMIN_USER_CODES = {
    "12589": "ידידיה תפילין",
    "112233": "הרב יאיר חלבי",
    "11223344": "הרב יוסף חיים סנו"
};

const GITHUB_TOKEN_KEY = 'admin_github_token';
const USER_CODE_KEY = 'admin_user_code';
const GITHUB_USERNAME_KEY = 'admin_github_username';

// Theme & Drafts keys
const DRAFT_KEY = 'news_draft_v1';
const THEME_KEY = 'admin_theme';

export let easyMDE;

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
        checkDraftStatus();
    } catch (e) {
        if (showFeedback) showToast('❌ שגיאה בשמירה', 1500, 'error');
    }
}

function checkDraftStatus() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        const banner = document.getElementById('draft-banner');
        if (banner) {
            banner.style.display = raw ? 'flex' : 'none';
        }
    } catch (e) { }
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
        checkDraftStatus();
    } catch (e) {
        if (showFeedback) showToast('❌ שגיאה בטעינה', 1500, 'error');
    }
}

function clearNewsDraft() {
    try {
        localStorage.removeItem(DRAFT_KEY);
        showToast('✅ טיוטה נמחקה', 1500, 'success');
        checkDraftStatus();

        // Reset form completely if clearing draft
        document.getElementById('news-title').value = '';
        document.getElementById('news-date').value = new Date().toISOString().split('T')[0];
        if (easyMDE && typeof easyMDE.value === 'function') easyMDE.value('');
        else document.getElementById('news-body').value = '';

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
function showToast(message, duration = 1500, type = 'success') {
    try {
        let container = document.getElementById('toast-container');
        if (!container) {
            // Create container if it doesn't exist
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                try { toast.remove(); } catch (e) { }
            }, 300);
        }, duration);
    } catch (e) {
        // silent fail
    }
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

// [חדש] ניהול בחירה מרובה
let selectedNewsSlugs = [];

// אלמנטים DOM
const loginSection = document.getElementById('login-section');
const newsSection = document.getElementById('news-section');
const dashboardSection = document.getElementById('dashboard-section');
const gallerySection = document.getElementById('gallery-section');
const historySection = document.getElementById('history-section');
const messagesSection = document.getElementById('messages-section');
const tasksSection = document.getElementById('tasks-section');
const siteSection = document.getElementById('site-section');
const loginForm = document.getElementById('login-form');
const addNewsForm = document.getElementById('add-news-form');
const loginMessage = document.getElementById('login-message');
const logoutBtn = document.getElementById('logout-btn');

// אלמנטים סטטוס
const closeStatusBtn = document.getElementById('close-status-btn');

function handleApiError(err) {
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

// הצגת/הסתרת פאנל הניהול
function showAdminPanel() {
    if (GITHUB_TOKEN && GITHUB_USERNAME) {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

        // הסתרת כל השאר
        [newsSection, gallerySection, historySection, messagesSection, siteSection, tasksSection].forEach(s => {
            if (s) s.style.display = 'none';
        });

        const lBtn = document.getElementById('logout-btn');
        if (lBtn) lBtn.style.display = 'inline-block';

        loadAndRenderNewsList();
        loadAndRenderGallery();

        // [חדש] עדכון תצוגת תפריט תחתון
        window.dispatchEvent(new Event('admin-login-success'));
    } else {
        [dashboardSection, newsSection, gallerySection, historySection, messagesSection, siteSection, tasksSection].forEach(s => {
            if (s) s.style.display = 'none';
        });
        loginSection.style.display = 'block';
        const lBtn = document.getElementById('logout-btn');
        if (lBtn) lBtn.style.display = 'none';

        // [חדש] עדכון תצוגת תפריט תחתון
    }
}

function logout() {
    updateGithubAuth('');
    localStorage.removeItem('admin_user_code');
    localStorage.removeItem('admin_github_username');
    location.reload();
}

function navigateTo(sectionId) {
    const sections = [dashboardSection, newsSection, gallerySection, historySection, messagesSection, siteSection, tasksSection];
    sections.forEach(s => { if (s) s.style.display = 'none'; });
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    if (sectionId === 'history-section') loadAndRenderHistory();
    if (sectionId === 'messages-section') loadAndRenderMessages();
    if (sectionId === 'tasks-section') loadAndRenderTasks();
    if (sectionId === 'news-section') {
        setDefaultNewsDate();
        initDraftAutosave();
        typeof checkDraftStatus === 'function' && checkDraftStatus();
    }
}

// יצירת פריט ידיעה בודד
function createNewsItemElement(item) {
    const slug = generateSlug(item.data.title, item.data.date);
    const newsDiv = document.createElement('div');
    newsDiv.className = 'news-item-admin';
    newsDiv.dataset.slug = slug;

    // [חדש] תיבת בחירה (Checkbox) למחיקה מרובה
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'news-item-checkbox';
    checkbox.dataset.slug = slug;
    checkbox.addEventListener('change', (e) => {
        if (e.target.checked) selectedNewsSlugs.push(slug);
        else selectedNewsSlugs = selectedNewsSlugs.filter(s => s !== slug);
        updateBulkActionsUI();
    });
    newsDiv.appendChild(checkbox);

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

    // ✅ Fix XSS: בנה את כפתורי בעדכונים בטוח
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

    return newsDiv;
}

// רינדור רשימת הידיעות
function renderNewsList(newsArray) {
    const container = document.getElementById('news-list-container');
    if (!container) return;

    container.innerHTML = '';

    // [חדש] איפוס בחירה כשמרנדרים מחדש
    selectedNewsSlugs = [];
    updateBulkActionsUI();

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
        container.appendChild(createNewsItemElement(item));
    });
}

function updateBulkActionsUI() {
    const bar = document.getElementById('bulk-actions');
    const countSpan = document.getElementById('selected-count');
    if (!bar || !countSpan) return;

    if (selectedNewsSlugs.length > 0) {
        bar.style.display = 'flex';
        countSpan.textContent = `נבחרו ${selectedNewsSlugs.length} פריטים`;
    } else {
        bar.style.display = 'none';
    }
}

// מחיקת ידיעה
async function handleDeleteNews(slug) {
    if (!confirm('האם אתה בטוח שברצונך למחוק ידיעה זו? הפעולה אינה ניתנת לביטול.')) return;
    performDelete([slug]);
}

async function handleBulkDelete() {
    if (selectedNewsSlugs.length === 0) return;
    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedNewsSlugs.length} ידיעות? הפעולה אינה ניתנת לביטול.`)) return;
    performDelete([...selectedNewsSlugs]);
}

async function performDelete(slugs) {
    showStatus(`מוחק ${slugs.length} פריטים...`, 50);
    const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch JSON');

        const fileData = await fileResponse.json();

        const transformFn = (latestContent) => {
            const updated = latestContent.filter(item => {
                const itemSlug = generateSlug(item.data.title, item.data.date);
                return !slugs.includes(itemSlug);
            });
            return encodeToBase64(JSON.stringify(updated, null, 2));
        };

        const updateResponse = await putWithShaRetry(API_URL, {
            message: `Delete ${slugs.length} news items`,
            branch: 'main'
        }, GITHUB_TOKEN, fileData.sha, 3, transformFn);

        if (updateResponse && updateResponse.ok) {
            showStatus('הפעולה הושלמה בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`מחק ${slugs.length} ידיעות`, 'news');
            selectedNewsSlugs = [];
            updateBulkActionsUI();
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

    const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
        });

        if (!fileResponse.ok) return;

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        renderNewsList(existingContent);
    } catch (error) {
        showStatus('שגיאה בטעינת רשימת הידיעות', null, true);
    }
}

// [חדש] טעינה ורינדור של ההיסטוריה
async function loadAndRenderHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    try {
        const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + HISTORY_JSON_PATH;
        const response = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
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

            // [אבטחה] ניקוי תוכן הפעולה למקרה שמכיל תגים
            const safeAction = DOMPurify.sanitize(log.action);

            div.innerHTML = `
                <div class="history-icon ${log.type || 'general'}">
                    <i class="fas ${getIconForType(log.type)}"></i>
                </div>
                <div class="history-time">${log.timestamp}</div>
                <div class="history-user">${DOMPurify.sanitize(log.user)}</div>
                <div class="history-action">${safeAction}</div>
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

async function fetchDeletedMessages() {
    try {
        const delUrl = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/data/deleted_messages.json";
        const delRes = await window.fetch(delUrl, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN }
        });
        if (delRes.ok) {
            const delData = await delRes.json();
            return JSON.parse(decodeBase64ToUtf8(delData.content.replace(/\n/g, '')));
        }
    } catch (e) { /* ✅ Fix: הסר debug log אם אין deleted_messages */ }
    return [];
}

async function fetchMessagesFromSheet() {
    const response = await window.fetch(MESSAGES_SHEET_URL);
    if (!response.ok) throw new Error('Failed to load messages sheet');
    const csvData = await response.text();
    return parseCSV(csvData);
}

function createMessageCardElement(timestamp, name, email, body, messageId) {
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
    // Listener removed - handled by delegated listener

    const replyBtn = document.createElement('a');
    replyBtn.className = 'premium-btn small secondary reply-btn';
    replyBtn.target = "_blank";
    const subject = encodeURIComponent("תגובה לפנייתך באתר ישיבת בית הלוי");
    const mailBody = encodeURIComponent(`שלום ${name},\n\nבהמשך להודעתך באתר:\n"${body}"\n\n---`);
    replyBtn.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${mailBody}`;
    replyBtn.title = "לחץ כאן כדי להשיב באמצעות Gmail בדפדפן";
    replyBtn.style.textDecoration = 'none';
    replyBtn.innerHTML = '<i class="fas fa-reply"></i> השב';
    replyBtn.style.marginLeft = '8px';

    headerDiv.appendChild(infoDiv);
    headerDiv.appendChild(dateDiv);
    headerDiv.appendChild(replyBtn);
    headerDiv.appendChild(deleteBtn);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';
    bodyDiv.textContent = body;

    div.appendChild(headerDiv);
    div.appendChild(bodyDiv);

    return div;
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
        const deletedMessages = await fetchDeletedMessages();
        const rows = await fetchMessagesFromSheet();

        container.innerHTML = '';
        if (rows.length <= 1) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-envelope-open"></i><p>אין הודעות להצגה</p></div>';
            return;
        }

        const messages = rows.slice(1).reverse();
        let visibleCount = 0;

        messages.forEach((row) => {
            if (row.length < 4) return;
            const [timestamp, name, email, body] = row;
            const messageId = `${timestamp}-${email}`;

            // סינון הודעות שנמחקו
            if (deletedMessages.includes(messageId)) return;
            visibleCount++;

            const messageCard = createMessageCardElement(timestamp, name, email, body, messageId);
            container.appendChild(messageCard);
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
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

    try {
        let deletedMessages = [];
        let sha = null;

        const res = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
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
    const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await window.fetch(API_URL, {
            headers: {
                'Authorization': "token " + GITHUB_TOKEN,
                'Content-Type': 'application/json'
            },
            cache: 'no-store'
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch news item');

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        const newsItem = existingContent.find(item =>
            generateSlug(item.data.title, item.data.date) === slug
        );

        if (!newsItem) throw new Error('News item not found');

        document.getElementById('news-title').value = newsItem.data.title;
        document.getElementById('news-date').value = newsItem.data.date;
        easyMDE.value(newsItem.data.body);

        editingNewsSlug = slug;
        editingNewsSHA = fileData.sha;

        const cBtn = document.getElementById('cancel-news-edit');
        if (cBtn) cBtn.style.display = 'inline-block';
        addNewsForm.querySelector('button[type="submit"]').textContent = 'שמור שינויים';
        hideStatus();
    } catch (error) {
        handleApiError(error);
    }
}

export function resetNewsForm() {
    addNewsForm.reset();
    easyMDE.value('');
    editingNewsSlug = null;
    editingNewsSHA = null;
    addNewsForm.querySelector('button[type="submit"]').textContent = 'פרסם ידיעה';
    const cBtn = document.getElementById('cancel-news-edit');
    if (cBtn) cBtn.style.display = 'none';
}

// שמירת ידיעה (חדשה או עריכה)
async function handleSaveNews(e) {
    e.preventDefault();
    showStatus('מבצע גישה ל-GitHub... נא להמתין', 20);

    const title = document.getElementById('news-title').value.trim();
    const date = document.getElementById('news-date').value.trim();
    const body = easyMDE.value().trim();

    if (!title || !date || !body) {
        showStatus('נא למלא את כל השדות', null, true);
        return;
    }

    const newItem = {
        data: { title, date, body },
    };

    const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + JSON_FILE_PATH;

    try {
        const fileResponse = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
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
            addNewsForm.querySelector('button').textContent = 'פרסם ידיעה';
        } else {
            existingContent.unshift(newItem);
        }

        const transformFn = (latestContent) => {
            // Need to capture editingNewsSlug locally because it's reset in the outer scope
            // actually it's reset AFTER the call, but let's be safe and use parameters or closure
            if (editingNewsSlug) {
                const index = latestContent.findIndex(item =>
                    generateSlug(item.data.title, item.data.date) === editingNewsSlug
                );
                if (index !== -1) latestContent[index] = newItem;
            } else {
                latestContent.unshift(newItem);
            }
            return encodeToBase64(JSON.stringify(latestContent, null, 2));
        };

        const updateResponse = await putWithShaRetry(API_URL, {
            message: `${editingNewsSlug ? 'Update' : 'Add'} news: ${title}`,
            branch: 'main'
        }, GITHUB_TOKEN, sha, 3, transformFn);

        if (updateResponse && updateResponse.ok) {
            clearNewsDraft();
            showStatus('הידיעה פורסמה בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${editingNewsSlug ? 'עדכן' : 'הוסיף'} ידיעה: ${title}`, 'news');

            if (!editingNewsSlug) {
                sendPushNotification(title, "ידיעה חדשה התפרסמה באתר ישיבת בית הלוי! ככנסו לקרוא.");
            }

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
async function initAdmin() {
    // אתחול עורך Markdown
    try {
        easyMDE = new EasyMDE({
            element: document.getElementById("news-body"),
            status: false,
            spellChecker: false,
            direction: 'rtl',
            autosave: {
                enabled: true,
                uniqueId: "news-editor",
                delay: 1000,
            },
        });
    } catch (e) {
        showStatus('שגיאה בטעינת עורך הטקסט', null, true);
    }

    if (typeof google !== 'undefined') {
        initGoogleLogin();
    }

    showAdminPanel();

    // ניווט
    document.getElementById('nav-news-btn')?.addEventListener('click', () => navigateTo('news-section'));
    document.getElementById('nav-gallery-btn')?.addEventListener('click', () => navigateTo('gallery-section'));
    document.getElementById('nav-history-btn')?.addEventListener('click', () => navigateTo('history-section'));
    document.getElementById('nav-messages-btn')?.addEventListener('click', () => navigateTo('messages-section'));
    document.getElementById('nav-tasks-btn')?.addEventListener('click', () => navigateTo('tasks-section'));
    document.getElementById('nav-site-btn')?.addEventListener('click', async () => {
        navigateTo('site-section');
        await loadSiteConfig();
    });
    document.getElementById('save-all-site-settings')?.addEventListener('click', saveAllSiteSettings);

    document.querySelectorAll('.back-to-dashboard-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo('dashboard-section'));
    });
    document.getElementById('close-status-btn')?.addEventListener('click', hideStatus);

    // Logout and Theme listeners
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('logout-btn-mobile')?.addEventListener('click', logout);
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-btn-mobile')?.addEventListener('click', toggleTheme);

    initGalleryAdminEvents();

    try {
        const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
        applyTheme(savedTheme);
    } catch (e) { }

    // Draft & editor controls
    document.getElementById('undo-news-btn')?.addEventListener('click', undoEditor);
    document.getElementById('redo-news-btn')?.addEventListener('click', redoEditor);
    document.getElementById('save-draft-btn')?.addEventListener('click', () => saveNewsDraft(true));
    document.getElementById('load-draft-btn')?.addEventListener('click', () => loadNewsDraft(true));
    document.getElementById('clear-draft-btn')?.addEventListener('click', clearNewsDraft);

    document.getElementById('banner-load-draft')?.addEventListener('click', (e) => {
        e.preventDefault();
        loadNewsDraft(true);
    });
    document.getElementById('banner-clear-draft')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('האם אתה בטוח שברצונך למחוק את הטיוטה?')) clearNewsDraft();
    });

    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', () => {
            const targetId = icon.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input && input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else if (input) {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    document.getElementById('cancel-news-edit')?.addEventListener('click', resetNewsForm);

    // Bottom nav
    document.getElementById('bnav-dashboard')?.addEventListener('click', () => navigateTo('dashboard-section'));
    document.getElementById('bnav-news')?.addEventListener('click', () => navigateTo('news-section'));
    document.getElementById('bnav-tasks')?.addEventListener('click', () => navigateTo('tasks-section'));
    document.getElementById('bnav-gallery')?.addEventListener('click', () => navigateTo('gallery-section'));
    document.getElementById('bnav-messages')?.addEventListener('click', () => navigateTo('messages-section'));
    document.getElementById('bnav-site')?.addEventListener('click', () => navigateTo('site-section'));

    // [חדש] כפתור מחיקה מרובה
    document.getElementById('bulk-delete-btn')?.addEventListener('click', handleBulkDelete);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}

// Delegated events
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

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userCodeInput = document.getElementById('admin-usercode').value;
        const tokenInput = document.getElementById('github-token').value.trim();

        showStatus('מבצע אימות מול GitHub...', 40);

        if (ADMIN_USER_CODES.hasOwnProperty(userCodeInput)) {
            if (tokenInput) {
                const verifiedLogin = await verifyGitHubToken(tokenInput);

                if (verifiedLogin) {
                    const adminDisplayName = ADMIN_USER_CODES[userCodeInput];
                    localStorage.setItem(GITHUB_USERNAME_KEY, adminDisplayName);
                    updateGithubAuth(tokenInput, adminDisplayName);

                    localStorage.setItem(GITHUB_TOKEN_KEY, tokenInput);
                    localStorage.setItem(USER_CODE_KEY, userCodeInput);

                    showStatus('התחברות הצליחה! ברוך הבא.', 100);
                    logEvent('התחבר למערכת', 'login');
                    setTimeout(() => {
                        hideStatus();
                        showAdminPanel();
                    }, 1000);
                } else {
                    showStatus('טוקן GitHub אינו תקין או שפג תוקפו.', null, true);
                }
            } else {
                showStatus('נדרש Token כדי להמשיך.', null, true);
            }
        } else {
            showStatus('קוד משתמש שגוי. נא לנסות שנית.', null, true);
        }
    });
}

if (addNewsForm) {
    addNewsForm.addEventListener('submit', handleSaveNews);
}
