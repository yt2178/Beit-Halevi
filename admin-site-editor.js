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
    primaryColor: '#1a4b84' 
};
let siteConfigSHA = null;

// רשימת הטקסטים שניתן לערוך
const EDITABLE_TEXTS = [
    { key: 'about_title', label: '📄 כותרת אודות' },
    { key: 'about_body', label: '📝 תוכן אודות' },
    { key: 'donation_title', label: '💝 כותרת תרומות' },
    { key: 'donation_body', label: '💰 תוכן תרומות' },
    { key: 'contact_title', label: '📞 כותרת צור קשר' },
    { key: 'contact_intro', label: '💬 טקסט הקדמה צור קשר' },
];

export async function loadSiteConfig() {
    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SITE_CONFIG_PATH}`;
        const res = await fetch(API_URL, { 
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` } 
        });
        
        if (res.ok) {
            const data = await res.json();
            const config = JSON.parse(decodeBase64ToUtf8(data.content.replace(/\n/g, '')));
            currentSiteConfig = {
                texts: config.texts || {},
                theme: config.theme || 'light',
                primaryColor: config.primaryColor || '#1a4b84'
            };
            siteConfigSHA = data.sha;
            
            // עדכון ה-UI
            document.getElementById('site-theme-select').value = currentSiteConfig.theme;
            document.getElementById('site-primary-color').value = currentSiteConfig.primaryColor;
            
            renderEditableTextsList(currentSiteConfig.texts);
            renderSitePreview(currentSiteConfig);
            return config;
        }
    } catch (e) {
        // ✅ Fix: הסר console.error
    }
    
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
    
    previewContainer.innerHTML = `
        <div style="font-family: 'Assistant', sans-serif; direction: rtl; color: ${textColor}; background: ${bgColor}; padding: 15px; border-radius: 5px;">
            
            <section style="margin-bottom: 25px;">
                <h3 style="color: ${config.primaryColor}; border-bottom: 2px solid ${config.primaryColor}; padding-bottom: 8px;">ℹ️ אודות</h3>
                <h4 id="preview-about-title" style="margin-top: 10px; margin-bottom: 5px; font-size: 1.1rem;">
                    ${config.texts?.about_title || "אודות הישיבה"}
                </h4>
                <p id="preview-about-body" style="line-height: 1.6; margin: 0;">
                    ${config.texts?.about_body || "ישיבת בית הלוי בראש העין עומדת בראשותו של האדמו\"ר הגאון הרב אבנר עפג'ין שליט\"א."}
                </p>
            </section>
            
            <section style="margin-bottom: 25px;">
                <h3 style="color: ${config.primaryColor}; border-bottom: 2px solid ${config.primaryColor}; padding-bottom: 8px;">💝 תרומות</h3>
                <h4 id="preview-donation-title" style="margin-top: 10px; margin-bottom: 5px; font-size: 1.1rem;">
                    ${config.texts?.donation_title || "היו שותפים בהחזקת התורה"}
                </h4>
                <p id="preview-donation-body" style="line-height: 1.6; margin: 0;">
                    ${config.texts?.donation_body || "כל תרומה מסייעת לנו להמשיך להגדיל תורה ולהאדירה."}
                </p>
            </section>
            
            <section style="margin-bottom: 25px;">
                <h3 style="color: ${config.primaryColor}; border-bottom: 2px solid ${config.primaryColor}; padding-bottom: 8px;">📞 צור קשר</h3>
                <h4 id="preview-contact-title" style="margin-top: 10px; margin-bottom: 5px; font-size: 1.1rem;">
                    ${config.texts?.contact_title || "צור קשר"}
                </h4>
                <p id="preview-contact-intro" style="line-height: 1.6; margin: 0;">
                    ${config.texts?.contact_intro || "ניתן ליצור קשר עם משרדי הישיבה באמצעות הטופס או המרכז."}
                </p>
            </section>
        </div>
    `;
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

window.updateThemePreview = function() {
    currentSiteConfig.theme = document.getElementById('site-theme-select').value;
    currentSiteConfig.primaryColor = document.getElementById('site-primary-color').value;
    renderSitePreview(currentSiteConfig);
}

export async function saveAllSiteSettings() {
    showStatus('💾 שומר הגדרות אתר ב-GitHub...', 50);
    
    currentSiteConfig.theme = document.getElementById('site-theme-select').value;
    currentSiteConfig.primaryColor = document.getElementById('site-primary-color').value;
    
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${SITE_CONFIG_PATH}`;
    
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
