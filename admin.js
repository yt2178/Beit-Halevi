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

// אלמנטי DOM
const loginSection = document.getElementById('login-section');
const newsSection = document.getElementById('news-section');
const loginForm = document.getElementById('login-form');
const addNewsForm = document.getElementById('add-news-form');
const loginMessage = document.getElementById('login-message');
const newsStatusMessage = document.getElementById('news-status-message');
const logoutBtn = document.getElementById('logout-btn');

// משתנים גלובליים
let googleApiInitialized = false;
export let googleApiInitPromise = initGoogleApiGlobals();
let tokenClient;
// ============================================================
// 4. פונקציות Google API (Google API Functions)
// ============================================================
// admin.js (initGoogleApiGlobals - תיקון חזק לכשל)
function initGoogleApiGlobals() {
    return new Promise(resolve => {
        gapi.load('client:auth2', async () => {
            try {
                // [תיקון קריטי] השתמש ב-await ישירות על ה-Promise של init
                await gapi.client.init({
                    clientId: GOOGLE_CLIENT_ID,
                    scope: GOOGLE_SCOPES,
                });
                googleApiInitialized = true;
                console.log("Google API Client Initialized successfully.");
                resolve(true);

            } catch (error) {
                console.error("Google API Initialization Failed:", error);

                // [חדש] מנגנון ניקוי localStorage במקרה של כשל ידוע
                if (error.error === 'idpiframe_initialization_failed') {
                    // אם נכשל, נסה לנקות את ה-Token ולבקש מהמשתמש לרענן
                    alert('שגיאת אימות גוגל: נא לרענן את הדף ולהתחבר מחדש.');
                    localStorage.removeItem(GITHUB_TOKEN_KEY);
                    localStorage.removeItem(GITHUB_USERNAME_KEY);
                }

                resolve(false); // סיום ה-Promise עם כישלון
            }
        });
    });
}
export function initGoogleLogin() {
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
    const logoutBtn = document.getElementById('logout-btn');

    if (GITHUB_TOKEN && GITHUB_USERNAME) {
        loginSection.style.display = 'none';
        newsSection.style.display = 'block';
        document.getElementById('gallery-section').style.display = 'block'; // <<<<<<<< חדש!

        logoutBtn.style.display = 'inline-block';
        if (typeof initGoogleDrive === 'function') {
            initGoogleDrive(); // ודא ש-admin-gallery.js נטען לפני admin.js
        }
        loadAndRenderNewsList();// טוען את רשימת החדשות כאשר הפאנל מוצג
        loadAndRenderGallery(); // טוען את רשימת האלבומים כאשר הפאנל מוצג

    } else {
        loginSection.style.display = 'block';
        newsSection.style.display = 'none';
        document.getElementById('gallery-section').style.display = 'none'; // <<<<<<<< חדש!
        logoutBtn.style.display = 'none';
    }
}
export async function uploadFileToDrive(file, Token) {
    const metadata = {
        name: file.name,
        parents: ["root"]
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const token = Token;

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { "Authorization": "Bearer " + token }, // [שינוי] שימוש ב-Token שהתקבל
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

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
// ============================================================
// 7. פונקציות GitHub (GitHub Functions)
// ============================================================
// יציאה מהמערכת
function logout() {
    localStorage.removeItem(GITHUB_TOKEN_KEY);
    localStorage.removeItem(GITHUB_USERNAME_KEY);
    localStorage.removeItem(USER_CODE_KEY); // הסרת קוד המשתמש גם
    GITHUB_TOKEN = null;
    GITHUB_USERNAME = null;
    showAdminPanel();
}

// רינדור רשימת הידיעות
function renderNewsList(newsArray) {
    const container = document.getElementById('news-list-container');
    if (!container) return; // ודא שהאלמנט קיים

    container.innerHTML = '';

    newsArray.forEach(item => {
        const slug = generateSlug(item.data.title, item.data.date);
        const newsDiv = document.createElement('div');
        newsDiv.className = 'news-item-admin';
        newsDiv.dataset.slug = slug;

        newsDiv.innerHTML = `
            <h3>${item.data.title}</h3>
            <p>תאריך: ${item.data.date}</p>
            <button class="edit-news-btn" data-slug="${slug}">ערוך</button>
        `;
        container.appendChild(newsDiv);
    });

    // [חדש] חיבור האירוע לכל כפתורי העריכה
    document.querySelectorAll('.edit-news-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const slug = e.target.dataset.slug;
            handleEditNews(slug);
        });
    });
}
function showSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'block';
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.style.display = 'none';
}

async function loadAndRenderNewsList() {
    if (!GITHUB_TOKEN) return;
    showSpinner(); // הצגת הספינר

    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) {
            console.error('Failed to fetch news list:', fileResponse.status, fileResponse.statusText);
            hideSpinner();
            return;
        }

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        renderNewsList(existingContent);
    } catch (error) {
        console.error('Error loading news list:', error);
    } finally {
        hideSpinner(); // הסתרת הספינר אחרי סיום
    }
}


// עריכת ידיעה קיימת
async function handleEditNews(slug) {
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${JSON_FILE_PATH}`;

    try {
        const fileResponse = await fetch(API_URL, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!fileResponse.ok) {
            alert('שגיאה בגישה לקובץ.');
            return;
        }

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // מציאת הידיעה לפי slug
        const newsItem = existingContent.find(item =>
            generateSlug(item.data.title, item.data.date) === slug
        );

        if (!newsItem) {
            alert('לא נמצאה הידיעה.');
            return;
        }

        // מילוי הטופס
        document.getElementById('news-title').value = newsItem.data.title;
        document.getElementById('news-date').value = newsItem.data.date;
        simplemde.value(newsItem.data.body);

        // שמירת מזהים גלובליים
        editingNewsSlug = slug;
        editingNewsSHA = fileData.sha;

        // עדכון כפתור
        addNewsForm.querySelector('button').textContent = 'שמור שינויים';
    } catch (error) {
        console.error('Error editing news:', error);
        alert('שגיאה בטעינת הידיעה.');
    }
}

// שמירת ידיעה (חדשה או עריכה)
async function handleSaveNews(e) {
    e.preventDefault();
    newsStatusMessage.textContent = 'מבצע גישה לקובץ קיים... אנא המתן.';
    showSpinner(); // הצגת הספינר

    const title = document.getElementById('news-title').value;
    const date = document.getElementById('news-date').value;
    const body = simplemde.value();

    if (!title || !date || !body) {
        newsStatusMessage.style.color = 'red';
        newsStatusMessage.textContent = 'נא למלא את כל השדות.';
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

        if (!fileResponse.ok) {
            throw new Error('Failed to fetch JSON.');
        }

        const fileData = await fileResponse.json();
        const existingContent = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        const sha = fileData.sha;

        // עריכה או הוספה חדשה
        if (editingNewsSlug) {
            const index = existingContent.findIndex(item =>
                generateSlug(item.data.title, item.data.date) === editingNewsSlug // [תיקון] היה צריך להיות generateSlug
            );
            if (index !== -1) {
                existingContent[index] = newItem;
            }
            editingNewsSlug = null;
            editingNewsSHA = null;
            addNewsForm.querySelector('button').textContent = 'פרסם'; // שחזור כפתור
        } else {
            existingContent.unshift(newItem); // הוספה לראש הרשימה
        }

        // קידוד ושליחה
        const updatedContentBase64 = encodeToBase64(JSON.stringify(existingContent, null, 2));

        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `${editingNewsSlug ? 'Update' : 'Add'} news: ${title} (by ${GITHUB_USERNAME})`,
                content: updatedContentBase64,
                sha: sha, // השתמש ב-SHA הנוכחי של הקובץ
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
            newsStatusMessage.style.color = 'green';
            newsStatusMessage.textContent = 'הידיעה פורסמה בהצלחה!';
            addNewsForm.reset();
            simplemde.value(''); // ניקוי העורך
            await loadAndRenderNewsList(); // רענון רשימת הידיעות
        } else {
            const errorData = await updateResponse.json();
            throw new Error(errorData.message || 'API error');
        }
    } catch (err) {
        hideSpinner(); // הסתרת הספינר
        console.error('Error saving news:', err);
        newsStatusMessage.style.color = 'red';
        newsStatusMessage.textContent = `שגיאה: ${err.message}. ודא של-Token יש הרשאת 'repo' ושהקובץ קיים.`;
    } finally {
        hideSpinner(); // הסתרת הספינר תמיד, גם אם הצליח וגם אם נכשל
    }
}

// ============================================================
// 5. Event Listeners
// ============================================================

// אתחול הדף
document.addEventListener('DOMContentLoaded', () => {
    // אתחול עורך Markdown
    simplemde = new SimpleMDE({
        element: document.getElementById("news-body"),
        status: false,
        spellChecker: false
    });
    initGoogleLogin();
    showAdminPanel();
});

// כפתור עריכה - delegated event
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-news-btn')) {
        const slug = e.target.closest('.news-item-admin').dataset.slug;
        handleEditNews(slug);
    }
});

// טופס התחברות
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userCodeInput = document.getElementById('admin-usercode').value;
    const tokenInput = document.getElementById('github-token').value;

    loginMessage.textContent = '';

    if (ADMIN_USER_CODES.hasOwnProperty(userCodeInput)) {
        if (tokenInput) {
            GITHUB_USERNAME = ADMIN_USER_CODES[userCodeInput];
            GITHUB_TOKEN = tokenInput.trim();

            localStorage.setItem(GITHUB_USERNAME_KEY, GITHUB_USERNAME);
            localStorage.setItem(GITHUB_TOKEN_KEY, GITHUB_TOKEN);
            localStorage.setItem(USER_CODE_KEY, userCodeInput);

            showAdminPanel();
        } else {
            loginMessage.textContent = "נדרש Token כדי להמשיך.";
        }
    } else {
        loginMessage.textContent = "קוד משתמש שגוי.";
    }
});

// טופס הוספת/עריכת חדשות
addNewsForm.addEventListener('submit', handleSaveNews);

// כפתור יציאה
document.getElementById('logout-btn').addEventListener('click', logout);