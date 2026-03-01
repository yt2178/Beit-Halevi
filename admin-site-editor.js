// admin-site-editor.js - עורך אתר עם תצוגה מקדימה חישנית

import {
    REPO_OWNER, REPO_NAME, SITE_CONFIG_PATH,
    GITHUB_TOKEN, GITHUB_USERNAME,
    showStatus, hideStatus, encodeToBase64, decodeBase64ToUtf8,
    logEvent
} from './admin-core.js';
import { putWithShaRetry } from './admin-core.js';

let currentSiteConfig = {
    texts: {},
    theme: 'light',
    primaryColor: '#1a4b84',
    oneSignalAppId: ''
};
let siteConfigSHA = null;

// רשימת הטקסטים שניתן לערוך
const EDITABLE_TEXTS = [
    { key: 'about_title', label: '📄 כותרת אודות' },
    { key: 'about_body', label: '📝 תוכן אודות' },
    { key: 'donation_title', label: '💝 כותרת תרומות' },
    { key: 'donation_body', label: '💰 תוכן תרומות' },
    { key: 'contact_title', label: '📞 כותרת צור קשר' },
    { key: 'contact_intro', label: '💬 תוכן צור קשר' },
];

export async function loadSiteConfig() {
    try {
        const p1 = "https://";
        const p2 = "api.github.com";
        const p3 = "/repos/";
        const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + SITE_CONFIG_PATH;
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (res.ok) {
            const data = await res.json();
            const config = JSON.parse(decodeBase64ToUtf8(data.content.replace(/\n/g, '')));
            currentSiteConfig = {
                texts: config.texts || {},
                theme: config.theme || 'light',
                primaryColor: config.primaryColor || '#1a4b84',
                oneSignalAppId: config.oneSignalAppId || ''
            };
            siteConfigSHA = data.sha;

            // עדכון ה-UI
            document.getElementById('site-theme-select').value = currentSiteConfig.theme;
            document.getElementById('site-primary-color').value = currentSiteConfig.primaryColor;
            if (document.getElementById('site-onesignal-id')) {
                document.getElementById('site-onesignal-id').value = currentSiteConfig.oneSignalAppId || '';
            }

            renderEditableTextsList(currentSiteConfig.texts);
            renderSitePreview(currentSiteConfig);
            return config;
        }
    } catch (e) { }

    // ערכי ברירת מחדל
    currentSiteConfig = {
        texts: {},
        theme: 'light',
        primaryColor: '#1a4b84'
    };
    renderEditableTextsList({});
    renderSitePreview(currentSiteConfig);
    return currentSiteConfig;
}

function renderEditableTextsList(texts) {
    const container = document.getElementById('editable-texts-list');
    if (!container) return;

    container.innerHTML = '';

    EDITABLE_TEXTS.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'premium-btn small secondary';
        btn.textContent = item.label;
        btn.dataset.key = item.key;
        btn.onclick = (e) => {
            e.preventDefault();
            openTextEditor(item.key, item.label, texts[item.key] || '');
        };
        container.appendChild(btn);
    });
}

function openTextEditor(key, label, currentValue) {
    const editArea = document.getElementById('text-edit-area');
    if (!editArea) return;

    editArea.style.display = 'block';
    document.getElementById('editing-label').textContent = `עורך: ${label}`;

    const editor = document.getElementById('site-text-editor');
    editor.value = currentValue;
    editor.focus();

    const saveBtn = document.getElementById('save-site-text');
    saveBtn.onclick = () => {
        const newValue = editor.value;
        currentSiteConfig.texts[key] = newValue;
        updateSitePreview(key, newValue);
        showStatus(`😊 הטקסט עודכן בתצוגה המקדימה`, 100);
        setTimeout(hideStatus, 2000);
    };
}

function renderSitePreview(config) {
    const previewContainer = document.getElementById('site-preview-container');
    if (!previewContainer) return;

    const isDark = config.theme === 'dark';
    const bgColor = isDark ? '#1a1a1a' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#2c3e50';

    previewContainer.innerHTML = ''; // Clear container

    const containerDiv = document.createElement('div');
    containerDiv.style.cssText = `font-family: 'Assistant', sans-serif; direction: rtl; color: ${textColor}; background: ${bgColor}; padding: 15px; border-radius: 5px;`;

    // Helper to create sections
    const createSection = (title, keyTitle, defaultTitle, keyBody, defaultBody, bodyId, titleId) => {
        const section = document.createElement('section');
        section.style.marginBottom = '25px';

        const h3 = document.createElement('h3');
        h3.style.cssText = `color: ${config.primaryColor}; border-bottom: 2px solid ${config.primaryColor}; padding-bottom: 8px;`;
        h3.textContent = title;

        const h4 = document.createElement('h4');
        h4.id = titleId;
        h4.style.cssText = 'margin-top: 10px; margin-bottom: 5px; font-size: 1.1rem;';
        h4.textContent = config.texts?.[keyTitle] || defaultTitle;

        const p = document.createElement('p');
        p.id = bodyId;
        p.style.cssText = 'line-height: 1.6; margin: 0;';
        p.textContent = config.texts?.[keyBody] || defaultBody;

        section.appendChild(h3);
        section.appendChild(h4);
        section.appendChild(p);
        return section;
    };

    containerDiv.appendChild(createSection('ℹ️ אודות', 'about_title', "אודות הישיבה", 'about_body', "ישיבת בית הלוי בראש העין עומדת בראשותו של האדמו\"ר הגאון הרב אבנר עפג'ין שליט\"א.", 'preview-about-body', 'preview-about-title'));
    containerDiv.appendChild(createSection('💝 תרומות', 'donation_title', "היו שותפים בהחזקת התורה", 'donation_body', "כל תרומה מסייעת לנו להמשיך להגדיל תורה ולהאדירה.", 'preview-donation-body', 'preview-donation-title'));
    containerDiv.appendChild(createSection('📞 צור קשר', 'contact_title', "צור קשר", 'contact_intro', "ניתן ליצור קשר עם משרדי הישיבה באמצעות הטופס או המרכז.", 'preview-contact-intro', 'preview-contact-title'));

    previewContainer.appendChild(containerDiv);
}

function updateSitePreview(key, value) {
    const previewMap = {
        'about_title': '#preview-about-title',
        'about_body': '#preview-about-body',
        'donation_title': '#preview-donation-title',
        'donation_body': '#preview-donation-body',
        'contact_title': '#preview-contact-title',
        'contact_intro': '#preview-contact-intro'
    };

    const selector = previewMap[key];
    if (selector) {
        const element = document.querySelector(selector);
        if (element) element.textContent = value || '...';
    }
}

window.updateThemePreview = function () {
    currentSiteConfig.theme = document.getElementById('site-theme-select').value;
    currentSiteConfig.primaryColor = document.getElementById('site-primary-color').value;
    renderSitePreview(currentSiteConfig);
}

export async function saveAllSiteSettings() {
    showStatus('💾 שומר הגדרות אתר ב-GitHub...', 50);

    currentSiteConfig.theme = document.getElementById('site-theme-select').value;
    currentSiteConfig.primaryColor = document.getElementById('site-primary-color').value;
    currentSiteConfig.oneSignalAppId = document.getElementById('site-onesignal-id').value.trim();

    const p1 = "https://";
    const p2 = "api.github.com";
    const p3 = "/repos/";
    const API_URL = (p1 + p2 + p3).trim() + REPO_OWNER + "/" + REPO_NAME + "/contents/" + SITE_CONFIG_PATH;

    try {
        const payload = {
            message: `Update site configuration and text`,
            content: encodeToBase64(JSON.stringify(currentSiteConfig, null, 2)),
            branch: 'main'
        };
        const updateResponse = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, siteConfigSHA, 2);

        if (updateResponse && updateResponse.ok) {
            showStatus('✅ הגדרות האתר נשמרו בהצלחה! 🎉', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`עדכן הגדרות אתר וטקסטים`, 'general');
            const data = await updateResponse.json();
            siteConfigSHA = data.content.sha;
        } else {
            throw new Error('Save failed on GitHub');
        }
    } catch (err) {
        showStatus(`❌ שגיאה: ${err.message}`, null, true);
    }
}
