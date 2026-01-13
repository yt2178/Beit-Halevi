
const GALLERY_JSON_PATH = 'data/gallery.json';
let editingAlbumIndex = null; // לאחסן אם עורכים אלבום קיים
let selectedFiles = [];       // התמונות שנבחרו להעלאה


import {
    GITHUB_TOKEN, GITHUB_USERNAME, REPO_OWNER, REPO_NAME,
    decodeBase64ToUtf8, encodeToBase64, // פונקציות עזר
    uploadFileToDrive, makeFilePublic, // פונקציות Google Drive 
    googleLogin,
    showStatus, hideStatus, // [חדש] פונקציות סטטוס
    logEvent // [חדש]
} from './admin.js';

/* ----------------- אלמנטים ----------------- */
let galleryForm, albumTitleInput, albumThumbnailInput, albumImagesInput, galleryStatusMessage, galleryListContainer, albumPreview;

document.addEventListener('DOMContentLoaded', () => {
    galleryForm = document.getElementById('add-album-form');
    albumTitleInput = document.getElementById('albumTitleInput');
    albumThumbnailInput = document.getElementById('albumThumbnailInput');
    albumImagesInput = document.getElementById('albumImagesInput');
    galleryStatusMessage = document.getElementById('gallery-status-message');
    galleryListContainer = document.getElementById('gallery-list-container');
    albumPreview = document.getElementById('albumPreview');
    if (albumImagesInput) albumImagesInput.addEventListener('change', handleFileSelect); // <--- הקוד הזה נכון!


    /* ----------------- יצירת אזור תצוגה מקדימה אם לא קיים ----------------- */
    if (!albumPreview && albumImagesInput) {
        albumPreview = document.createElement('div');
        albumPreview.id = 'albumPreview';
        albumPreview.className = 'album-preview-grid';
        albumImagesInput.insertAdjacentElement('afterend', albumPreview);
    }

    /* ----------------- מאזינים לאירועים ----------------- */
    if (albumImagesInput) albumImagesInput.addEventListener('change', handleFileSelect);

    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', resetGalleryForm);

    if (galleryForm) galleryForm.addEventListener('submit', handleGallerySubmit);
});

/* ----------------- לוגיקה ראשית ----------------- */
export async function loadAndRenderGallery() {
    // שימוש במשתנים הגלובליים מ-admin.js
    if (typeof GITHUB_TOKEN === 'undefined' || !GITHUB_TOKEN) return;

    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${GALLERY_JSON_PATH}`;

    try {
        const response = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!response.ok) throw new Error('Failed to fetch gallery JSON');

        const fileData = await response.json();
        // שימוש בפונקציית העזר מ-admin.js או הגדרה מקומית אם צריך
        const content = decodeBase64ToUtf8(fileData.content.replace(/\n/g, ''));
        const galleryArray = JSON.parse(content);

        renderGalleryList(galleryArray, fileData.sha);
    } catch (err) {
        console.error('Error loading gallery:', err);
        if (galleryStatusMessage) galleryStatusMessage.textContent = 'שגיאה בטעינת הגלריה';
    }
}
// חשיפת הפונקציה לחלון כדי ש-admin.js יוכל לקרוא לה
window.loadAndRenderGallery = loadAndRenderGallery;

function renderGalleryList(galleryArray, sha) {
    if (!galleryListContainer) return;
    galleryListContainer.innerHTML = '';

    if (galleryArray.length === 0) {
        galleryListContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <p>אין אלבומים להצגה. התחל ביצירת האלבום הראשון!</p>
            </div>
        `;
        return;
    }

    galleryArray.forEach((album, index) => {
        const div = document.createElement('div');
        div.className = 'album-item-admin';
        div.innerHTML = `
            <div class="item-details">
                <img src="${album.data.thumbnail}" alt="${album.data.title}" class="item-thumb-admin">
                <div>
                    <h3>${album.data.title}</h3>
                    <p>${album.data.images ? album.data.images.length : 0} תמונות</p>
                </div>
            </div>
            <div class="item-actions">
                <button class="edit-album-btn premium-btn small" data-index="${index}">
                    <i class="fas fa-edit"></i> ערוך
                </button>
                <button class="delete-album-btn premium-btn small danger" data-index="${index}">
                    <i class="fas fa-trash-alt"></i> מחק
                </button>
            </div>
        `;
        galleryListContainer.appendChild(div);

        div.querySelector('.edit-album-btn').addEventListener('click', () => editAlbum(album, index));
        div.querySelector('.delete-album-btn').addEventListener('click', () => deleteAlbum(index));
    });

    galleryListContainer.dataset.sha = sha;
}
function editAlbum(album, index) {
    albumTitleInput.value = album.data.title || '';
    albumThumbnailInput.value = album.data.thumbnail || '';

    albumPreview.innerHTML = '';
    selectedFiles = []; // איפוס בחירות חדשות

    // הצגת תמונות קיימות
    (album.data.images || []).forEach((imgPath, idx) => {
        const item = createPreviewItem(imgPath, true, idx);
        if (album.data.thumbnail === imgPath) {
            item.classList.add('is-thumbnail');
            const badge = document.createElement('div');
            badge.className = 'preview-thumb-badge';
            badge.textContent = 'שער';
            item.appendChild(badge);
        }
        albumPreview.appendChild(item);
    });

    editingAlbumIndex = index;
    albumTitleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // שינוי כפתור השמירה
    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'עדכן אלבום';
    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

export function resetGalleryForm() {
    if (galleryForm) galleryForm.reset();

    // ניקוי URL-ים מהזיכרון
    selectedFiles.forEach(f => {
        if (f.localUrl) URL.revokeObjectURL(f.localUrl);
    });

    // ניקוי תצוגה מקדימה
    if (albumPreview) albumPreview.innerHTML = '';
    selectedFiles = [];
    editingAlbumIndex = null;

    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'שמור אלבום';

    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
}
async function deleteAlbum(indexToDelete) {
    if (!confirm('האם אתה בטוח שברצונך למחוק את האלבום?')) return;

    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${GALLERY_JSON_PATH}`;
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch gallery JSON');

        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // מחיקה
        galleryArray.splice(indexToDelete, 1);

        const updatedContentBase64 = encodeToBase64(JSON.stringify(galleryArray, null, 2));

        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Delete album index ${indexToDelete} (by ${GITHUB_USERNAME})`,
                content: updatedContentBase64,
                sha: fileData.sha,
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
            galleryStatusMessage.textContent = 'האלבום נמחק בהצלחה';
            galleryStatusMessage.style.color = 'green';
            logEvent(`מחק אלבום תמונות אינדקס ${indexToDelete}`, 'gallery');
            loadAndRenderGallery();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        console.error('Error deleting album:', err);
        showStatus('שגיאה במחיקת האלבום: ' + err.message, null, true);
    }
}

/* ----------------- פונקציה לוגיקה ראשית ----------------- */
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
        // [תיקון קריטי ל-404]: יצירת URL זמני לתצוגה מקדימה
        const localUrl = URL.createObjectURL(file);

        selectedFiles.push({
            file: file,
            localUrl: localUrl
        });

        // הצגת תצוגה מקדימה
        const item = createPreviewItem(localUrl, false);
        albumPreview.appendChild(item);
    }
    e.target.value = '';
}

function createPreviewItem(src, isExisting = false, existingIndex = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'album-preview-item';
    wrapper.dataset.existing = isExisting ? '1' : '0';
    if (isExisting && existingIndex !== null) wrapper.dataset.index = existingIndex;

    const img = document.createElement('img');
    img.src = src;
    img.style.cursor = 'pointer';
    wrapper.appendChild(img);

    // כפתורים: הגדר כתמונת שער + מחק
    const controls = document.createElement('div');
    controls.className = 'preview-controls';

    // כפתור תמונת שער (סטאר)
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'preview-btn';
    thumbBtn.title = 'הגדר כתמונת שער';
    thumbBtn.innerHTML = '⭐';

    const setAsThumbnail = () => {
        albumThumbnailInput.value = src;

        // עדכון ויזואלי של כל הפריטים
        Array.from(albumPreview.querySelectorAll('.album-preview-item')).forEach(el => {
            el.classList.remove('is-thumbnail');
            const b = el.querySelector('.preview-thumb-badge');
            if (b) b.remove();
        });

        // עדכון הפריט הנוכחי
        wrapper.classList.add('is-thumbnail');
        const badge = document.createElement('div');
        badge.className = 'preview-thumb-badge';
        badge.textContent = 'שער';
        wrapper.appendChild(badge);
    };

    thumbBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setAsThumbnail();
    });

    // לחיצה על התמונה עצמה גם מגדירה כעיקרית
    img.addEventListener('click', setAsThumbnail);

    // כפתור מחיקה
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'preview-btn remove';
    removeBtn.title = 'הסר תמונה';
    removeBtn.innerHTML = '🗑';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = img.src;

        if (wrapper.dataset.existing === '0') {
            const fileObj = selectedFiles.find(f => f.localUrl === url);
            if (fileObj) {
                URL.revokeObjectURL(fileObj.localUrl);
                selectedFiles = selectedFiles.filter(f => f.localUrl !== url);
            }
        }

        if (albumThumbnailInput.value === url) {
            albumThumbnailInput.value = '';
        }

        wrapper.remove();
    });

    controls.appendChild(thumbBtn);
    controls.appendChild(removeBtn);
    wrapper.appendChild(controls);

    return wrapper;
}
// admin-gallery.js (פונקציית handleGallerySubmit - מתוקנת)
async function handleGallerySubmit(e) {
    e.preventDefault();
    showStatus('מכין העלאה לדרייב... נא להמתין', 10);

    try {
        // [תיקון קריטי 1]: ביצוע Login וקבלת ה-Token
        showStatus('מתחבר לחשבון גוגל...', 20);
        const googleAccessToken = await googleLogin();

        // 1. השגת הקובץ הנוכחי
        showStatus('ניגש למאגר הנתונים ב-GitHub...', 35);
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${GALLERY_JSON_PATH}`;
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch gallery JSON');
        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // 2. איסוף רשימת התמונות הסופית מה-DOM
        const finalImages = [];
        const previewItems = albumPreview.querySelectorAll('.album-preview-item');
        const totalItems = previewItems.length;
        let processedCount = 0;

        for (const item of previewItems) {
            const img = item.querySelector('img');

            if (item.dataset.existing === '1') {
                finalImages.push(img.getAttribute('src'));
                processedCount++;
            } else {
                const fileObj = selectedFiles.find(f => f.localUrl === img.src);
                if (fileObj) {
                    showStatus(`מעלה תמונה ${processedCount + 1} מתוך ${totalItems} לדרייב...`, 40 + (processedCount / totalItems * 40));
                    const fileId = await uploadFileToDrive(fileObj.file, googleAccessToken);
                    const publicUrl = await makeFilePublic(fileId, googleAccessToken);
                    finalImages.push(publicUrl);
                    processedCount++;
                }
            }
        }

        // 3. בניית האובייקט החדש
        const newAlbum = {
            data: {
                title: albumTitleInput.value,
                thumbnail: albumThumbnailInput.value || finalImages[0] || "",
                images: finalImages
            },
            content: ""
        };

        // 4. עדכון המערך
        const isUpdate = editingAlbumIndex !== null;
        if (isUpdate) {
            galleryArray[editingAlbumIndex] = newAlbum;
            editingAlbumIndex = null;
        } else {
            galleryArray.push(newAlbum);
        }

        showStatus('מעדכן את האתר... כמעט סיימנו', 90);

        // 5. שמירה ב-GitHub
        const updatedContentBase64 = encodeToBase64(JSON.stringify(galleryArray, null, 2));
        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update gallery: ${albumTitleInput.value}`,
                content: updatedContentBase64,
                sha: fileData.sha,
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
            showStatus('האלבום נשמר בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${isUpdate ? 'עדכן' : 'הוסיף'} אלבום: ${albumTitleInput.value}`, 'gallery');
            resetGalleryForm();
            loadAndRenderGallery();
        } else {
            throw new Error('Save to GitHub failed');
        }

    } catch (err) {
        console.error(err);
        showStatus('שגיאה בתהליך השמירה: ' + err.message, null, true);
    }
}
