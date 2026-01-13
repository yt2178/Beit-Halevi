// ============================================================
// admin.js - ניהול חדשות דרך GitHub API
// ============================================================

// ============================================================
// 1. הגדרות קבועות (Constants)
// ============================================================
export const REPO_OWNER = 'yt2178';
export const REPO_NAME = 'Beit-Halevi';
export const NEWS_PATH = '_posts/news/'; // Not used in this version, but kept for context
export const JSON_FILE_PATH = 'data/news.json';
export const HISTORY_JSON_PATH = 'data/history.json';
export const MESSAGES_SHEET_URL = "נא_להזין_כאן_את_קישור_הפרסום_של_האקסל_בתצורת_CSV";

import { loadAndRenderGallery } from './admin-gallery.js';

const ADMIN_USER_CODES = {
    "12589": "YT",      // שם משתמש GitHub: Avner-Halevi
    "112233": "Admin-Test",    // שם משתמש GitHub: Admin-Test
    // ניתן להוסיף קודים נוספים...
};

// ============================================================
// 2. הגדרות קבועות (Constants)
// ============================================================
const GOOGLE_CLIENT_ID = "1038052523883-b3r3k21kc6pvu3t3vken0f963q6cl0q1.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_FOLDER_ID = "1viRoR0PVmGrYNtuTSxRBTn5v4lSPvxow"; // [חדש]

// ============================================================
// 3. הגדרות קבועות (Constants)
// ============================================================
const GITHUB_TOKEN_KEY = 'admin_github_token';
const USER_CODE_KEY = 'admin_user_code';
const GITHUB_USERNAME_KEY = 'admin_github_username';

// ============================================================
// 3. משתנים גלובליים (Global Variables)
// ============================================================
export let GITHUB_TOKEN = localStorage.getItem(GITHUB_TOKEN_KEY);
export let GITHUB_USERNAME = localStorage.getItem(GITHUB_USERNAME_KEY);
export let simplemde;
export let editingNewsSlug = null;
export let editingNewsSHA = null;
const cancelNewsBtn = document.getElementById('cancel-news-edit');

// משתנים גלובליים
let tokenClient;

// אלמנטי DOM
const loginSection = document.getElementById('login-section');
const newsSection = document.getElementById('news-section');
const dashboardSection = document.getElementById('dashboard-section');
const gallerySection = document.getElementById('gallery-section');
const historySection = document.getElementById('history-section');
const messagesSection = document.getElementById('messages-section');
const loginForm = document.getElementById('login-form');
const addNewsForm = document.getElementById('add-news-form');
const loginMessage = document.getElementById('login-message');
const logoutBtn = document.getElementById('logout-btn');

// אלמנטי סטטוס
const statusOverlay = document.getElementById('status-overlay');
const statusText = document.getElementById('status-text');
const statusProgress = document.getElementById('status-progress');
const closeStatusBtn = document.getElementById('close-status-btn');

// ============================================================
// 4. פונקציות סטטוס (Status Functions)
// ============================================================
export function showStatus(text, progress = null, isError = false) {
    statusOverlay.style.display = 'flex';
    statusText.textContent = text;
    statusText.style.color = isError ? '#e74c3c' : '#2c3e50';
    closeStatusBtn.style.display = isError ? 'inline-block' : 'none';

    if (progress !== null) {
        statusProgress.parentElement.style.display = 'block';
        statusProgress.style.width = progress + '%';
    } else {
        statusProgress.parentElement.style.display = 'none';
    }
}

export function hideStatus() {
    statusOverlay.style.display = 'none';
}

function handleApiError(err) {
    console.error(err);
    let msg = "שגיאה לא צפויה";
    if (err.message.includes("404")) msg = "הקובץ לא נמצא ב-GitHub";
    if (err.message.includes("401")) msg = "טוקן לא בתוקף או חסר הרשאות";
    if (err.message.includes("403")) msg = "אין הרשאה לביצוע הפעולה (ייתכן שהטוקן מוגבל)";
    if (err.message.includes("sha")) msg = "שגיאת סנכרון: הקובץ עודכן על ידי מישהו אחר. נא לרענן.";
    if (err.message.includes("Token client")) msg = "שגיאה בחיבור לגוגל. נא לרענן ולנסות שוב.";

    showStatus(`שגיאה: ${msg} (${err.message})`, null, true);
}

// ============================================================
// 4. פונקציות Google API (Google API Functions)
// ============================================================
export function initGoogleLogin() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error("Google Identity Services not loaded");
        return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (tokenResponse) => {
            console.log("Access Token Received:", tokenResponse.access_token);
        },
    });
}
// admin.js (חלק 4: פונקציות Google API - החלף את הפונקציות הקיימות)
export async function googleLogin() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            return reject(new Error("Token client not initialized"));
        }

        tokenClient.callback = (tokenResponse) => {
            if (tokenResponse.error) {
                reject(tokenResponse.error);
            } else {
                resolve(tokenResponse.access_token);
            }
        };

        // בקשה ל-Token - יופיע popup אם צריך
        tokenClient.requestAccessToken();
    });
}
// ============================================================
// 5. פונקציות עזר (Utility Functions)
// ============================================================
export function encodeToBase64(str) {
    const encoder = new TextEncoder();           // UTF-8
    const bytes = encoder.encode(str);          // מחרוזת לבייטים
    let binary = '';
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return btoa(binary);
}

export function decodeBase64ToUtf8(base64Str) {
    const binary = atob(base64Str);
    const bytes = Uint8Array.from(binary.split('').map(char => char.charCodeAt(0)));
    const decoder = new TextDecoder(); // UTF-8
    return decoder.decode(bytes);
}

// [חדש] פונקציה לתיעוד פעולות
export async function logEvent(action, type = 'general') {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) return;

    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${HISTORY_JSON_PATH}`;
        let historyArray = [];
        let sha = null;

        // 1. ניסיון לקרוא את הקובץ הקיים
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (response.ok) {
            const fileData = await response.json();
            sha = fileData.sha;
            historyArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        }

        // 2. הוספת האירוע החדש לראש הרשימה
        const newLog = {
            timestamp: new Date().toLocaleString('he-IL'),
            user: GITHUB_USERNAME,
            action: action,
            type: type // 'login', 'news', 'gallery'
        };

        historyArray.unshift(newLog);

        // שמירה על הגודל (למשל 100 לוגים אחרונים)
        if (historyArray.length > 100) historyArray = historyArray.slice(0, 100);

        // 3. שמירה בחזרה ל-GitHub
        await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Log action: ${action}`,
                content: encodeToBase64(JSON.stringify(historyArray, null, 2)),
                sha: sha,
                branch: 'main'
            })
        });
    } catch (err) {
        console.error('Failed to log event:', err);
    }
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

// [חדש] פונקציה משופרת לבניית Slug סופי
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
        newsSection.style.display = 'none';
        gallerySection.style.display = 'none';

        logoutBtn.style.display = 'inline-block';

        loadAndRenderNewsList();
        loadAndRenderGallery();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        newsSection.style.display = 'none';
        gallerySection.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

function navigateTo(sectionId) {
    const sections = [dashboardSection, newsSection, gallerySection, historySection, messagesSection];
    sections.forEach(s => { if (s) s.style.display = 'none'; });
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    if (sectionId === 'history-section') loadAndRenderHistory();
    if (sectionId === 'messages-section') loadAndRenderMessages();
}
// [חדש] פונקציה למציאת או יצירת תיקיית הגלריה בדרייב
async function getFolderId(token) {
    const FOLDER_NAME = "ישיבת בית הלוי - גלריה";

    try {
        // 1. חיפוש תיקייה קיימת עם השם הזה
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            { headers: { "Authorization": "Bearer " + token } }
        );
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        // 2. אם לא נמצאה - יצירת תיקייה חדשה
        const createRes = await fetch(
            "https://www.googleapis.com/drive/v3/files",
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: FOLDER_NAME,
                    mimeType: "application/vnd.google-apps.folder"
                })
            }
        );
        const createData = await createRes.json();

        // הפיכת התיקייה לציבורית (כדי שהתמונות בתוכה יוכלו להיות ציבוריות בקלות)
        await makeFilePublic(createData.id, token);

        return createData.id;
    } catch (err) {
        console.error("Error in getFolderId:", err);
        return "root"; // fallback לתיקיית השורש
    }
}

export async function uploadFileToDrive(file, Token) {
    const token = Token;
    const folderId = await getFolderId(token); // [שינוי] מציאת/יצירת התיקייה הייעודית

    const metadata = {
        name: file.name,
        parents: [folderId] // [שינוי] העלאה לתוך התיקייה שנמצאה
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { "Authorization": "Bearer " + token },
            body: form
        }
    );

    const data = await res.json();
    return data.id;
}
export async function makeFilePublic(fileId, Token) {
    const token = Token;

    await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`, // [שינוי] שימוש ב-Token
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                role: "reader",
                type: "anyone"
            })
        }
    );

    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}
// ============================================================
// 7. פונקציות GitHub (GitHub Functions)
// ============================================================
// יציאה מהמערכת
function logout() {
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
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`
            }
        });
        if (response.ok) {
            const userData = await response.json();
            return userData.login; // מחזיר את שם המשתמש האמיתי
        }
    } catch (error) {
        console.error("Token verification failed:", error);
    }
    return null;
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

        newsDiv.innerHTML = `
            <div class="item-details">
                <i class="fas fa-file-alt item-icon"></i>
                <div>
                    <h3>${item.data.title}</h3>
                    <p>פורסם ב: ${item.data.date}</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="edit-news-btn premium-btn small" data-slug="${slug}">
                    <i class="fas fa-edit"></i> ערוך
                </button>
                <button class="delete-news-btn premium-btn small danger" data-slug="${slug}">
                    <i class="fas fa-trash-alt"></i> מחק
                </button>
            </div>
        `;
        container.appendChild(newsDiv);
    });
}

// מחיקת ידיעה
async function handleDeleteNews(slug) {
    if (!confirm('האם אתה בטוח שברצונך למחוק ידיעה זו? הפעולה אינה ניתנת לביטול.')) return;

    showStatus('מוחק ידיעה...', 50);
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

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

        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Delete news item: ${slug}`,
                content: updatedContentBase64,
                sha: fileData.sha,
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
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

    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) return;

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        renderNewsList(existingContent);
    } catch (error) {
        console.error('Error loading news list:', error);
    }
}

// [חדש] טעינה ורינדור של ההיסטוריה
async function loadAndRenderHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${HISTORY_JSON_PATH}`;
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

// [חדש] טעינה ורינדור של הודעות (מתוך Google Sheets)
async function loadAndRenderMessages() {
    const container = document.getElementById('messages-list-container');
    if (!container) return;

    if (!MESSAGES_SHEET_URL || MESSAGES_SHEET_URL.includes("נא_להזין")) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>טרם הוגדר קישור לגיליון ההודעות ב-admin.js</p></div>';
        return;
    }

    try {
        const response = await fetch(MESSAGES_SHEET_URL);
        if (!response.ok) throw new Error('Failed to load messages sheet');

        const csvData = await response.text();
        const rows = parseCSV(csvData); // פונקציית עזר לפענוח CSV

        container.innerHTML = '';
        if (rows.length <= 1) { // רק כותרות או ריק
            container.innerHTML = '<div class="empty-state"><i class="fas fa-envelope-open"></i><p>אין הודעות להצגה</p></div>';
            return;
        }

        // דלוג על שורת הכותרת והצגת ההודעות (מהחדשה לישנה - אם האקסל מסודר כך)
        // בדרך כלל גוגל מוסיף שורות למטה, אז נהפוך את הסדר
        const messages = rows.slice(1).reverse();

        messages.forEach(row => {
            if (row.length < 4) return; // וודאות שיש מספיק עמודות
            const [timestamp, name, email, body] = row;

            const div = document.createElement('div');
            div.className = 'message-card';
            div.innerHTML = `
                <div class="message-header">
                    <div class="message-info">
                        <h4>${name}</h4>
                        <p>${email}</p>
                    </div>
                    <div class="message-date">${timestamp}</div>
                </div>
                <div class="message-body">${body}</div>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        container.innerHTML = `<p style="color:red; text-align:center;">שגיאה בטעינת הודעות: ${err.message}</p>`;
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
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            }
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
        simplemde.value(newsItem.data.body);

        editingNewsSlug = slug;
        editingNewsSHA = fileData.sha;

        cancelNewsBtn.style.display = 'inline-block';
        addNewsForm.querySelector('button[type="submit"]').textContent = 'שמור שינויים';
        hideStatus();
    } catch (error) {
        handleApiError(error);
    }
}

export function resetNewsForm() {
    addNewsForm.reset();
    simplemde.value('');
    editingNewsSlug = null;
    editingNewsSHA = null;
    addNewsForm.querySelector('button[type="submit"]').textContent = 'פרסם ידיעה';
    if (cancelNewsBtn) cancelNewsBtn.style.display = 'none';
}

// שמירת ידיעה (חדשה או עריכה)
async function handleSaveNews(e) {
    e.preventDefault();
    showStatus('מבצע גישה ל-GitHub... נא להמתין', 20);

    const title = document.getElementById('news-title').value;
    const date = document.getElementById('news-date').value;
    const body = simplemde.value();

    if (!title || !date || !body) {
        showStatus('נא למלא את כל השדות', null, true);
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
            addNewsForm.querySelector('button').textContent = 'פרסם ידיעה';
        } else {
            existingContent.unshift(newItem);
        }

        const updatedContentBase64 = encodeToBase64(JSON.stringify(existingContent, null, 2));

        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `${editingNewsSlug ? 'Update' : 'Add'} news: ${title}`,
                content: updatedContentBase64,
                sha: sha,
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
            showStatus('הידיעה פורסמה בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${editingNewsSlug ? 'עדכן' : 'הוסיף'} ידיעה: ${title}`, 'news');
            resetNewsForm();
            await loadAndRenderNewsList();
        } else {
            const errorData = await updateResponse.json();
            throw new Error(errorData.message);
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
    simplemde = new SimpleMDE({
        element: document.getElementById("news-body"),
        status: false,
        spellChecker: false
    });

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
    document.querySelectorAll('.back-to-dashboard-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo('dashboard-section'));
    });
    closeStatusBtn.addEventListener('click', hideStatus);

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
});

// טופס התחברות
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userCodeInput = document.getElementById('admin-usercode').value;
    const tokenInput = document.getElementById('github-token').value.trim();

    showStatus('מבצע אימות מול GitHub...', 40);

    if (ADMIN_USER_CODES.hasOwnProperty(userCodeInput)) {
        if (tokenInput) {
            const verifiedLogin = await verifyGitHubToken(tokenInput);

            if (verifiedLogin) {
                GITHUB_USERNAME = verifiedLogin;
                GITHUB_TOKEN = tokenInput;

                localStorage.setItem(GITHUB_USERNAME_KEY, GITHUB_USERNAME);
                localStorage.setItem(GITHUB_TOKEN_KEY, GITHUB_TOKEN);
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

// טופס הוספת/עריכת חדשות
addNewsForm.addEventListener('submit', handleSaveNews);

// כפתור יציאה
document.getElementById('logout-btn').addEventListener('click', logout);