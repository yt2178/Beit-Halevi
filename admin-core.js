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
export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.file";
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

    const scopeStr = "https://www.googleapis.com/auth/drive.file";
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

        console.log("Setting up token callback...");
        window.tokenClient.callback = (tokenResponse) => {
            console.log("Received Token Response in googleLogin:", tokenResponse);
            if (tokenResponse.error) {
                console.error("Google Auth Error:", tokenResponse);
                const errorMsg = tokenResponse.error_description || tokenResponse.error;
                reject(new Error(`שגיאת אימות גוגל: ${errorMsg}`));
            } else if (tokenResponse.access_token) {
                console.log("Success! Access token obtained.");
                resolve(tokenResponse.access_token);
            } else {
                reject(new Error("לא התקבל Access Token מגוגל."));
            }
        };

        const scopeStr = "https://www.googleapis.com/auth/drive.file";
        console.log("Requesting access token with explicit scope:", scopeStr);

        // REQUEST TOKEN
        // Explicitly passing the scope here is the RECOMMENDED fix for "Missing required parameter: scope"
        try {
            window.tokenClient.requestAccessToken({
                prompt: 'select_account',
                scope: scopeStr
            });
            console.log("requestAccessToken called.");
        } catch (requestErr) {
            console.error("Error calling requestAccessToken:", requestErr);
            reject(requestErr);
        }
    });
}

export async function getFolderId(token) {
    const FOLDER_NAME = "ישיבת בית הלוי - גלריה";
    try {
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            { headers: { "Authorization": "Bearer " + token } }
        );
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" })
        });
        const createData = await createRes.json();
        await makeFilePublic(createData.id, token);
        return createData.id;
    } catch (err) {
        console.error("Error in getFolderId:", err);
        return "root";
    }
}

export async function uploadFileToDrive(file, token) {
    const folderId = await getFolderId(token);
    const metadata = { name: file.name, parents: [folderId] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token },
        body: form
    });
    const data = await res.json();
    return data.id;
}

export async function makeFilePublic(fileId, token) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" })
    });
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// Logging helper
export async function logEvent(action, type = 'general') {
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) return;
    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${HISTORY_JSON_PATH}`;
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
    } catch (err) { console.error('Failed to log event:', err); }
}
