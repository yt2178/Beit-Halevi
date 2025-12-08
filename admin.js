// ============================================================
// admin.js - ניהול חדשות דרך GitHub API
// ============================================================

// ============================================================
// 1. הגדרות קבועות (Constants)
// ============================================================
const REPO_OWNER = 'yt2178';
const REPO_NAME = 'Beit-Halevi';
const NEWS_PATH = '_posts/news/'; // Not used in this version, but kept for context
const JSON_FILE_PATH = 'data/news.json';

// הגדרות Google Drive
const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const GOOGLE_API_KEY = "YOUR_API_KEY";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file";

const ADMIN_USER_CODES = {
    "12589": "YT",      // שם משתמש GitHub: Avner-Halevi
    "9999": "Admin-Test",    // שם משתמש GitHub: Admin-Test
    // ניתן להוסיף קודים נוספים...
};

const GITHUB_TOKEN_KEY = 'admin_github_token';
const USER_CODE_KEY = 'admin_user_code';
const GITHUB_USERNAME_KEY = 'admin_github_username';

// ============================================================
// 2. משתנים גלובליים (Global Variables)
// ============================================================
let GITHUB_TOKEN = localStorage.getItem(GITHUB_TOKEN_KEY);
let GITHUB_USERNAME = localStorage.getItem(GITHUB_USERNAME_KEY);
let simplemde;
let editingNewsSlug = null;
let editingNewsSHA = null;

// אלמנטי DOM
const loginSection = document.getElementById('login-section');
const newsSection = document.getElementById('news-section');
const loginForm = document.getElementById('login-form');
const addNewsForm = document.getElementById('add-news-form');
const loginMessage = document.getElementById('login-message');
const newsStatusMessage = document.getElementById('news-status-message');



// ============================================================
// 4. פונקציות Google API (Google API Functions)
// ============================================================
function initGoogleAPI() {
    return new Promise(resolve => {
        gapi.load("client:auth2", async () => {
            await gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                clientId: GOOGLE_CLIENT_ID,
                scope: GOOGLE_SCOPES
            });
            resolve();
        });
    });
}
//
async function googleLogin() {
    await initGoogleAPI();
    const auth = gapi.auth2.getAuthInstance();
    if (!auth.isSignedIn.get()) {
        await auth.signIn();
    }
}

// ============================================================
// 5. פונקציות עזר (Utility Functions)
// ============================================================
function encodeToBase64(str) {
    const encoder = new TextEncoder();           // UTF-8
    const bytes = encoder.encode(str);          // מחרוזת לבייטים
    let binary = '';
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return btoa(binary);
}

function decodeBase64ToUtf8(base64Str) {
    const binary = atob(base64Str);
    const bytes = Uint8Array.from(binary.split('').map(char => char.charCodeAt(0)));
    const decoder = new TextDecoder(); // UTF-8
    return decoder.decode(bytes);
}

function generateSlug(title, date) {
    // מחליף רווחים במקפים ומסיר תווים שאינם אותיות, מספרים או מקפים
    return `${date}-${title.replace(/\s/g, '-').replace(/[^א-תa-zA-Z0-9-]/g, '')}`;
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
        loadAndRenderNewsList();// טוען את רשימת החדשות כאשר הפאנל מוצג
        loadAndRenderGallery(); // טוען את רשימת האלבומים כאשר הפאנל מוצג
    } else {
        loginSection.style.display = 'block';
        newsSection.style.display = 'none';
        document.getElementById('gallery-section').style.display = 'none'; // <<<<<<<< חדש!
        logoutBtn.style.display = 'none';
    }
}
async function uploadFileToDrive(file) {
    const metadata = {
        name: file.name,
        parents: ["root"]
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const token = gapi.auth.getToken().access_token;

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
async function makeFilePublic(fileId) {
    const token = gapi.auth.getToken().access_token;

    await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
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
            <button class="edit-news-btn">ערוך</button>
        `;
        container.appendChild(newsDiv);
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
                generateSlug(item.data.title, item.data.date) === editingNewsSlug
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
