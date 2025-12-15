
const GALLERY_JSON_PATH = 'data/gallery.json';
let editingAlbumIndex = null; // לאחסן אם עורכים אלבום קיים
let selectedFiles = [];       // התמונות שנבחרו להעלאה


import {
    GITHUB_TOKEN, GITHUB_USERNAME, REPO_OWNER, REPO_NAME,
    decodeBase64ToUtf8, encodeToBase64, // פונקציות עזר
    uploadFileToDrive, makeFilePublic, // פונקציות Google Drive 
    googleLogin
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
    if (galleryForm) galleryForm.addEventListener('submit', handleGallerySubmit);
    if (albumImagesInput) albumImagesInput.addEventListener('change', handleFileSelect);
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

    galleryArray.forEach((album, index) => {
        const div = document.createElement('div');
        div.className = 'album-item-admin';
        div.innerHTML = `
            <h3>${album.data.title}</h3>
            <img src="${album.data.thumbnail}" alt="${album.data.title}" style="max-width:120px; max-height:80px; object-fit:cover;">
            <div style="margin-top:10px;">
                <button class="edit-album-btn" data-index="${index}">ערוך</button>
                <button class="delete-album-btn" data-index="${index}" style="background:#e74c3c; margin-right:5px;">מחק</button>
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
            item.querySelector('img').style.border = '2px solid gold';
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
            loadAndRenderGallery();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        console.error('Error deleting album:', err);
        galleryStatusMessage.textContent = 'שגיאה במחיקת האלבום';
        galleryStatusMessage.style.color = 'red';
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
    wrapper.appendChild(img);

    // כפתורים: הגדר כתמונת שער + מחק
    const controls = document.createElement('div');
    controls.className = 'preview-controls';

    // כפתור תמונת שער
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'preview-btn';
    thumbBtn.title = 'הגדר כתמונת שער';
    thumbBtn.innerHTML = '⭐';
    thumbBtn.addEventListener('click', () => {
        albumThumbnailInput.value = src;
        // עדכון ויזואלי
        Array.from(albumPreview.querySelectorAll('img')).forEach(i => i.style.border = 'none');
        img.style.border = '2px solid gold';

        // עדכון תג
        Array.from(albumPreview.querySelectorAll('.preview-thumb-badge')).forEach(b => b.remove());
        const badge = document.createElement('div');
        badge.className = 'preview-thumb-badge';
        badge.textContent = 'שער';
        wrapper.appendChild(badge);
    });

    // כפתור מחיקה
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'preview-btn';
    removeBtn.title = 'הסר תמונה';
    removeBtn.innerHTML = '🗑';
    removeBtn.addEventListener('click', () => {
        const url = img.src;

        if (wrapper.dataset.existing === '0') {
            // תמונה חדשה - הסרה מהמערך
            selectedFiles = selectedFiles.filter(f => !(url.endsWith(f.file.name) || url === f.objectURL));
        } else {
            // תמונה קיימת - סימון למחיקה (אופציונלי, כרגע רק מסתירים)
            // במימוש פשוט, אנחנו פשוט נבנה את רשימת התמונות מחדש לפי מה שנשאר ב-DOM
        }

        // אם זו תמונת השער, נקה את השדה
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
    // [שינוי קל] העבר את הצגת ההודעה לכאן (לפני ה-try)
    galleryStatusMessage.textContent = 'מבצע אימות...';
    galleryStatusMessage.style.color = 'blue';

    try {
        // [תיקון קריטי 1]: ביצוע Login וקבלת ה-Token
        const googleAccessToken = await googleLogin(); // משמש רק להעלאה לדרייב

        // 1. השגת הקובץ הנוכחי
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${GALLERY_JSON_PATH}`;
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch gallery JSON');
        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // 2. איסוף רשימת התמונות הסופית מה-DOM (כדי לתמוך במחיקות וסדר)
        const finalImages = [];
        const previewItems = albumPreview.querySelectorAll('.album-preview-item');

        for (const item of previewItems) {
            const img = item.querySelector('img');

            if (item.dataset.existing === '1') {
                // תמונה קיימת - לא נוגעים
                let path = img.getAttribute('src');
                finalImages.push(path);
            } else {
                // [תיקון קריטי 2]: תמונה חדשה - עכשיו מעלים!
                const fileObj = selectedFiles.find(f => f.localUrl === img.src); // חפש לפי URL מקומי
                if (fileObj) {
                    // [תיקון קריטי 2]: העבר את ה-Token לתוך הפונקציות
                    const fileId = await uploadFileToDrive(fileObj.file, googleAccessToken);
                    const publicUrl = await makeFilePublic(fileId, googleAccessToken); // וגם לכאן

                    finalImages.push(publicUrl);
                }
            }
        }

        // 3. בניית האובייקט החדש
        const newAlbum = {
            data: {
                title: albumTitleInput.value,
                thumbnail: albumThumbnailInput.value,
                images: finalImages
            },
            content: ""
        };
        // 4. עדכון המערך (קוד קיים)
        if (editingAlbumIndex !== null) {
            galleryArray[editingAlbumIndex] = newAlbum;
            editingAlbumIndex = null;
            galleryForm.querySelector('button[type="submit"]').textContent = 'שמור אלבום';
        } else {
            galleryArray.push(newAlbum);
        }

        // 5. שמירה (קוד קיים)
        const updatedContentBase64 = encodeToBase64(JSON.stringify(galleryArray, null, 2));
        const updateResponse = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update gallery (by ${GITHUB_USERNAME})`,
                content: updatedContentBase64,
                sha: fileData.sha,
                branch: 'main'
            })
        });

        if (updateResponse.ok) {
            galleryStatusMessage.textContent = 'נשמר בהצלחה!';
            galleryStatusMessage.style.color = 'green';
            galleryForm.reset();
            albumPreview.innerHTML = '';
            selectedFiles = [];
            loadAndRenderGallery();
        } else {
            throw new Error('Save failed');
        }

    } catch (err) {
        console.error(err);
        galleryStatusMessage.textContent = 'שגיאה בשמירה: ' + err.message;
        galleryStatusMessage.style.color = 'red';
    }
}
