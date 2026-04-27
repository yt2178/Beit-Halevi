import {
    GITHUB_TOKEN, GITHUB_USERNAME, REPO_OWNER, REPO_NAME, GALLERY_JSON_PATH,
    decodeBase64ToUtf8, encodeToBase64,
    uploadFileToDrive, makeFilePublic,
    googleLogin,
    showStatus, hideStatus,
    logEvent, putWithShaRetry, sendPushNotification
} from './admin-core.js';

let editingAlbumIndex = null; // לאחסן אם עורכים אלבום קיים
let selectedFiles = [];       // התמונות שנבחרו להעלאה

/**
 * [חדש] פונקציה לדחיסת תמונה לפני העלאה לחיסכון במקום בדרייב
 * מורידה איכות ל-0.8 ומגבילה רוחב למקסימום 1600px
 */
async function compressImage(file, maxWidth = 1600, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = err => reject(err);
        };
        reader.onerror = err => reject(err);
    });
}

// [חדש] פונקציה להצגת תמונה בתצוגה מקדימה גדולה במודאל הניהול
function showLargePreview(src) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-large-img');
    if (modal && img) {
        img.src = src;
        modal.style.display = 'flex';
    }
}

export function initGalleryAdminEvents() {
    // מאזין לסגירת מודאל תצוגה מקדימה לתמונות (אם קיים בדף הניהול)
    const closeBtn = document.getElementById('close-preview-modal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('image-preview-modal');
            if (modal) modal.style.display = 'none';
        };
    }
}

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
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
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
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
            cache: 'no-store'
        });

        if (!response.ok) throw new Error('Failed to fetch gallery JSON');

        const fileData = await response.json();
        // שימוש בפונקציית העזר מ-admin.js או הגדרה מקומית אם צריך
        const content = decodeBase64ToUtf8(fileData.content.replace(/\n/g, ''));
        const galleryArray = JSON.parse(content);

        renderGalleryList(galleryArray, fileData.sha);
    } catch (err) {
        showStatus('שגיאה בטעינת הגלריה', null, true);
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

        // Item Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'item-details';

        const img = document.createElement('img');
        img.src = album.data.thumbnail;
        img.alt = album.data.title;
        img.className = 'item-thumb-admin';

        const infoDiv = document.createElement('div');
        const h3 = document.createElement('h3');
        h3.textContent = album.data.title; // Safe XSS
        const p = document.createElement('p');
        p.textContent = (album.data.images ? album.data.images.length : 0) + ' תמונות';

        infoDiv.appendChild(h3);
        infoDiv.appendChild(p);
        detailsDiv.appendChild(img);
        detailsDiv.appendChild(infoDiv);

        // Item Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'item-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-album-btn premium-btn small';
        editBtn.dataset.index = index;
        editBtn.innerHTML = '<i class="fas fa-edit"></i> ערוך';
        editBtn.addEventListener('click', () => editAlbum(album, index));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-album-btn premium-btn small danger';
        deleteBtn.dataset.index = index;
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> מחק';
        deleteBtn.addEventListener('click', () => deleteAlbum(index));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        div.appendChild(detailsDiv);
        div.appendChild(actionsDiv);

        galleryListContainer.appendChild(div);
    });

    galleryListContainer.dataset.sha = sha;
}
function editAlbum(album, index) {
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    albumTitleInput.value = album.data.title || '';
    if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = album.data.thumbnail || '';

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
    selectedFiles = [];
    editingAlbumIndex = null;
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = '';

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
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
            cache: 'no-store'
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch gallery JSON');

        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // מחיקה
        galleryArray.splice(indexToDelete, 1);

        const updatedContentBase64 = encodeToBase64(JSON.stringify(galleryArray, null, 2));

        const payload = {
            message: `Delete album index ${indexToDelete} (by ${GITHUB_USERNAME})`,
            content: updatedContentBase64,
            branch: 'main'
        };
        const updateResponse = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, fileData.sha, 2);

        if (updateResponse && updateResponse.ok) {
            galleryStatusMessage.textContent = 'האלבום נמחק בהצלחה';
            galleryStatusMessage.style.color = 'green';
            logEvent(`מחק אלבום תמונות אינדקס ${indexToDelete}`, 'gallery');
            loadAndRenderGallery();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        // ✅ Fix: הסר console.error
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
        const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
        if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = src;

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

        const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
        if (albumThumbnailUrlInput && albumThumbnailUrlInput.value === url) {
            albumThumbnailUrlInput.value = '';
        }

        wrapper.remove();
    });

    controls.appendChild(thumbBtn);
    controls.appendChild(removeBtn);

    // [חדש] כפתור תצוגה מקדימה גדולה
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'preview-btn view';
    viewBtn.title = 'הצג תמונה גדולה';
    viewBtn.innerHTML = '👁';
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showLargePreview(img.src);
    });
    controls.appendChild(viewBtn);

    wrapper.appendChild(controls);

    return wrapper;
}
// admin-gallery.js (פונקציית handleGallerySubmit - מתוקנת)
async function handleGallerySubmit(e) {
    e.preventDefault();

    // ✅ Fix: הוסף validation של inputs
    const albumTitle = albumTitleInput.value.trim();
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    // בדיקה בטוחה של קבצים כדי למנוע קריסה
    const albumThumbnailFile = (albumThumbnailInput.files && albumThumbnailInput.files.length > 0) ? albumThumbnailInput.files[0] : null;
    const albumImages = albumImagesInput.files;
    
    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    if (!albumTitle) {
        showStatus('נא להזין שם לאלבום', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    if (!albumThumbnailFile && !albumThumbnailUrlInput?.value) {
        showStatus('נא לבחור תמונת כיסוי לאלבום', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const existingImagesCount = document.getElementById('albumPreview')?.children.length || 0;
    if (albumImages.length === 0 && existingImagesCount === 0) {
        showStatus('נא לבחור לפחות תמונה אחת לאלבום', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    showStatus('מכין העלאה לדרייב... נא להמתין', 10);

    try {
        // [תיקון קריטי 1]: ביצוע Login וקבלת ה-Token
        showStatus('מתחבר לחשבון גוגל...', 20);
        const googleAccessToken = await googleLogin();

        // 1. השגת הקובץ הנוכחי
        showStatus('ניגש למאגר הנתונים ב-GitHub...', 35);
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${GALLERY_JSON_PATH}`;
        const fileResponse = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
            cache: 'no-store'
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
                    showStatus(`מעבד ודוחס תמונה ${processedCount + 1} מתוך ${totalItems}...`, 40 + (processedCount / totalItems * 40));
                    
                    let fileToUpload = fileObj.file;
                    try {
                        // דחיסת תמונה לחיסכון בנפח (רק אם זו תמונה)
                        if (fileToUpload.type.startsWith('image/')) {
                            fileToUpload = await compressImage(fileToUpload);
                        }
                    } catch (compressErr) {
                        console.warn("Compression failed, uploading original:", compressErr);
                    }

                    showStatus(`מעלה תמונה ${processedCount + 1} מתוך ${totalItems} לדרייב...`, 40 + (processedCount / totalItems * 40));
                    const fileId = await uploadFileToDrive(fileToUpload, googleAccessToken);
                    const publicUrl = await makeFilePublic(fileId, googleAccessToken);
                    finalImages.push(publicUrl);
                    processedCount++;
                }
            }
        }

        // 3. בניית האובייקט החדש
        // [תיקון] ודא שה-thumbnail תמיד מוגדר - אם לא נבחר, השתמש ב-finalImages[0]
        let thumbnailUrl = albumThumbnailUrlInput?.value || finalImages[0] || "";

        if (!thumbnailUrl && finalImages.length > 0) {
            thumbnailUrl = finalImages[0];
        }

        if (!thumbnailUrl && finalImages.length === 0) {
            showStatus('שגיאה: אין תמונות באלבום. אנא הוסף לפחות תמונה אחת.', null, true);
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        const newAlbum = {
            data: {
                title: albumTitleInput.value,
                thumbnail: thumbnailUrl,
                images: finalImages
            },
            content: ""
        };

        // 4. עדכון המערך
        const isUpdate = editingAlbumIndex !== null;
        const savedEditingAlbumIndex = editingAlbumIndex;
        if (isUpdate) {
            galleryArray[editingAlbumIndex] = newAlbum;
            editingAlbumIndex = null;
        } else {
            galleryArray.push(newAlbum);
        }

        showStatus('מעדכן את האתר... כמעט סיימנו', 90);

        // 5. שמירה ב-GitHub
        const transformFn = (latestContent) => {
            if (savedEditingAlbumIndex !== null) {
                latestContent[savedEditingAlbumIndex] = newAlbum;
            } else {
                latestContent.push(newAlbum);
            }
            return encodeToBase64(JSON.stringify(latestContent, null, 2));
        };

        const initialContent = encodeToBase64(JSON.stringify(galleryArray, null, 2));

        const updateResponse = await putWithShaRetry(API_URL, {
            message: `Update gallery: ${albumTitleInput.value}`,
            content: initialContent,
            branch: 'main'
        }, GITHUB_TOKEN, fileData.sha, 3, transformFn);

        if (updateResponse && updateResponse.ok) {
            showStatus('האלבום נשמר בהצלחה!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${isUpdate ? 'עדכן' : 'הוסיף'} אלבום: ${albumTitleInput.value}`, 'gallery');
            
            // [חדש] התראה על הוספת אלבום חדש לגמרי
            if (!isUpdate) {
                sendPushNotification(albumTitleInput.value, "אלבום תמונות חדש הועלה לגלריית הישיבה. מוזמנים לצפות!");
            }
            
            resetGalleryForm();
            loadAndRenderGallery();
        } else {
            throw new Error('Save to GitHub failed');
        }

    } catch (err) {
        // ✅ Fix: הסר console.error
        showStatus('שגיאה בתהליך השמירה: ' + err.message, null, true);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}
