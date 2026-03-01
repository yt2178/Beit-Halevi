/**
 * admin-core.js - Shared constants, state, and Google API logic
 * Centralizes core functionality to avoid circular dependencies.
 */

// ============================================================
// 1. Constants
// ============================================================
export const REPO_OWNER = 'yt2178';
export const REPO_NAME = 'Beit-Halevi';
export const JSON_FILE_PATH = 'data/news.json';
export const HISTORY_JSON_PATH = 'data/history.json';
export const SITE_CONFIG_PATH = 'data/site-config.json';
export const GALLERY_JSON_PATH = 'data/gallery.json';
export const MESSAGES_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpxzvw-KY5zHaayaA6eaDMJ4OG8DxvrPHfBpC7_yI0TBlnMyGZm378VJiv3vJOmdSqtjon7SaPWVno/pub?output=csv";

// Google API Config
export const GOOGLE_CLIENT_ID = "1038052523883-b3r3k21kc6pvu3t3vken0f963q6cl0q1.apps.googleusercontent.com";
export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file email profile openid";
export const GOOGLE_FOLDER_ID = "1viRoR0PVmGrYNtuTSxRBTn5v4lSPvxow";

// Storage Keys
export const GITHUB_TOKEN_KEY = 'admin_github_token';
export const USER_CODE_KEY = 'admin_user_code';
export const GITHUB_USERNAME_KEY = 'admin_github_username';

// ============================================================
// 2. Global State
// ============================================================
export let GITHUB_TOKEN = localStorage.getItem(GITHUB_TOKEN_KEY);
export let GITHUB_USERNAME = localStorage.getItem(GITHUB_USERNAME_KEY);
window.tokenClient = null;

export function updateGithubAuth(token, username) {
    GITHUB_TOKEN = token;
    GITHUB_USERNAME = username;
}

// ============================================================
// 3. Status & UI Helpers
// ============================================================
export function showStatus(text, progress = null, isError = false) {
    const overlay = document.getElementById('status-overlay');
    const statusText = document.getElementById('status-text');
    const statusProgress = document.getElementById('status-progress');
    const closeBtn = document.getElementById('close-status-btn');

    if (!overlay || !statusText) return;

    overlay.style.display = 'flex';
    statusText.textContent = text;
    statusText.style.color = isError ? '#e74c3c' : '#2c3e50';
    if (closeBtn) closeBtn.style.display = isError ? 'inline-block' : 'none';

    if (progress !== null && statusProgress) {
        statusProgress.parentElement.style.display = 'block';
        statusProgress.style.width = progress + '%';
    } else if (statusProgress) {
        statusProgress.parentElement.style.display = 'none';
    }
}

export function hideStatus() {
    const overlay = document.getElementById('status-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ============================================================
// 4. Utility Functions
// ============================================================
export function encodeToBase64(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return btoa(binary);
}

export function decodeBase64ToUtf8(base64Str) {
    try {
        const binary = atob(base64Str);
        const bytes = Uint8Array.from(binary.split('').map(char => char.charCodeAt(0)));
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    } catch (e) {
        console.error("Base64 decode error:", e);
        return "";
    }
}

// ============================================================
// 5. Google API Logic
// ============================================================
export function initGoogleLogin() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.warn("Google Identity Services not loaded yet.");
        return;
    }

    if (window.tokenClient) {
        console.log("Google Token Client already exists.");
        return;
    }

    const scopeStr = "https://www.googleapis.com/auth/drive.file email profile openid";
    console.log("Initializing GIS with Client ID:", GOOGLE_CLIENT_ID);
    console.log("Scope string being used for init:", scopeStr);

    try {
        window.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: scopeStr,
            callback: (tokenResponse) => {
                // This will be overridden in googleLogin
                console.log("GIS Global Callback Response:", tokenResponse);
            },
        });
        console.log("Google Token Client initialized successfully.");
    } catch (err) {
        console.error("GIS Init Failed:", err);
    }
}
window.initGoogleLogin = initGoogleLogin; // Export to window for global access

export async function googleLogin() {
    return new Promise((resolve, reject) => {
        if (!window.tokenClient) {
            console.log("tokenClient not found, attempting to initialize...");
            initGoogleLogin();
        }

        if (!window.tokenClient) {
            return reject(new Error("גוגל לא נטען כראוי, נא לרענן או לבדוק חיבור אינטרנט."));
        }

        let timeoutId;

        console.log("Setting up token callback...");
        window.tokenClient.callback = (tokenResponse) => {
            clearTimeout(timeoutId);
            console.log("Received Token Response in googleLogin:", tokenResponse);

            if (tokenResponse.error) {
                console.error("Google Auth Error:", tokenResponse);

                // [חדש] טיפול בשגיאות ספציפיות
                if (tokenResponse.error === 'popup_closed_by_user') {
                    reject(new Error("סגרת את חלון ההתחברות. נסה שוב."));
                } else if (tokenResponse.error === 'access_denied') {
                    reject(new Error("הגבלת תגישות לאתר. בדוק את הגדרות חשבון גוגל שלך."));
                } else {
                    const errorMsg = tokenResponse.error_description || tokenResponse.error;
                    reject(new Error(`שגיאת אימות גוגל: ${errorMsg}`));
                }
            } else if (tokenResponse.access_token) {
                console.log("Success! Access token obtained.");
                resolve(tokenResponse.access_token);
            } else {
                reject(new Error("לא התקבל Access Token מגוגל."));
            }
        };

        const scopeStr = "https://www.googleapis.com/auth/drive.file email profile openid";
        console.log("Requesting access token with explicit scope:", scopeStr);

        // [חדש] טיפול בחלוןutorialשנסגר בלי סיום הכרת
        timeoutId = setTimeout(() => {
            reject(new Error("חלון התחברות לא נפתח. בדוק אם דפדפנך מחסום חלונות קופצים."));
        }, 10000);

        // REQUEST TOKEN
        // Explicitly passing the scope here is the RECOMMENDED fix for "Missing required parameter: scope"
        try {
            window.tokenClient.requestAccessToken({
                prompt: 'select_account',
                scope: scopeStr
            });
            console.log("requestAccessToken called.");
        } catch (requestErr) {
            clearTimeout(timeoutId);
            console.error("Error calling requestAccessToken:", requestErr);
            reject(requestErr);
        }
    });
}

export async function getFolderId(token) {
    const FOLDER_NAME = "ישיבת בית הלוי - גלריה";

    // Using split strings and trim to bulletproof against hidden characters
    const p1 = "https://";
    const p2 = "www.googleapis.com";
    const p3 = "/drive/v3/files";
    const baseUrl = (p1 + p2 + p3).trim();

    const query = "name='" + encodeURIComponent(FOLDER_NAME) + "' and mimeType='application/vnd.google-apps.folder' and trashed=false";
    const searchUrl = baseUrl + "?q=" + query;

    try {
        console.log("Drive Search URL:", searchUrl);
        const searchRes = await fetch(searchUrl, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!searchRes.ok) {
            const errText = await searchRes.text().catch(() => '');
            console.error("Drive Search failed: " + searchRes.status, errText);
            return "root";
        }

        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

        console.log("Folder not found, creating new folder...");
        const createRes = await fetch(baseUrl, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: FOLDER_NAME,
                mimeType: "application/vnd.google-apps.folder"
            })
        });

        if (!createRes.ok) {
            const errText = await createRes.text().catch(() => '');
            throw new Error("Folder creation failed: " + createRes.status + " " + errText);
        }

        const createData = await createRes.json();
        await makeFilePublic(createData.id, token);
        return createData.id;
    } catch (err) {
        console.error("getFolderId error:", err);
        return "root";
    }
}

export async function uploadFileToDrive(file, token) {
    const folderId = await getFolderId(token);
    const metadata = { name: file.name, parents: [folderId] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const uploadUrl = "https://" + "www.googleapis.com" + "/upload/drive/v3/files?uploadType=multipart";
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            console.log("Attempt " + attempt + ": Uploading " + file.name + " to Drive...");
            const res = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Authorization": "Bearer " + token },
                body: form,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                console.error("Drive upload attempt " + attempt + " failed: " + res.status, text);
                if (attempt === maxAttempts) throw new Error("Drive upload failed: " + res.status + " " + text);
                continue;
            }

            const data = await res.json();
            console.log("Upload successful, File ID: " + data.id);
            return data.id;
        } catch (err) {
            clearTimeout(timeoutId);
            console.error("Attempt " + attempt + " error:", err);
            if (attempt === maxAttempts) throw err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// Helper: perform a GitHub PUT with SHA retry on conflict (409/422)
export async function putWithShaRetry(API_URL, payloadObj, token, initialSha = null, maxRetries = 2) {
    let sha = initialSha;
    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const bodyObj = Object.assign({}, payloadObj);
        if (sha) bodyObj.sha = sha;
        try {
            const res = await fetch(API_URL, {
                method: 'PUT',
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            });
            if (res.ok) return res;
            // If conflict or validation error, refetch latest sha and retry
            if (res.status === 409 || res.status === 422 || res.status === 500) {
                try {
                    const latest = await fetch(API_URL, { headers: { 'Authorization': `token ${token}` } });
                    if (latest.ok) {
                        const fileData = await latest.json();
                        sha = fileData.sha;
                        // small backoff before retrying
                        await new Promise(r => setTimeout(r, 500));
                        continue;
                    }
                } catch (e) { lastErr = e; }
            }
            // other errors: attach message and throw
            const txt = await res.text().catch(() => '');
            throw new Error(`GitHub PUT failed: ${res.status} ${txt}`);
        } catch (err) {
            lastErr = err;
            if (attempt === maxRetries) throw lastErr;
            await new Promise(r => setTimeout(r, 600));
        }
    }
    throw lastErr;
}

export async function makeFilePublic(fileId, token) {
    const p1 = "https://";
    const p2 = "www.googleapis.com";
    const p3 = "/drive/v3/files/";
    const url = (p1 + p2 + p3).trim() + fileId + "/permissions";

    await fetch(url, {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" })
    });
    return "https://" + "drive.google.com" + "/thumbnail?id=" + fileId + "&sz=w1000";
}

// Logging helper
export async function logEvent(action, type = 'general') {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) return;
    try {
        const p1 = "https://";
        const p2 = "api.github.com";
        const p3 = "/repos/";
        const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + HISTORY_JSON_PATH;
        let historyArray = [];
        let sha = null;

        const response = await fetch(API_URL, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
        if (response.ok) {
            const fileData = await response.json();
            sha = fileData.sha;
            historyArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));
        }

        historyArray.unshift({
            timestamp: new Date().toLocaleString('he-IL'),
            user: GITHUB_USERNAME,
            action: action,
            type: type
        });
        if (historyArray.length > 100) historyArray = historyArray.slice(0, 100);

        await fetch(API_URL, {
            method: 'PUT',
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Log action: ${action}`,
                content: encodeToBase64(JSON.stringify(historyArray, null, 2)),
                sha: sha,
                branch: 'main'
            })
        });
    } catch (err) { }
}

