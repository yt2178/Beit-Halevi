import {
    GITHUB_TOKEN, GITHUB_USERNAME, REPO_OWNER, REPO_NAME, GALLERY_JSON_PATH,
    decodeBase64ToUtf8, encodeToBase64,
    uploadFileToDrive, makeFilePublic,
    googleLogin, APPS_SCRIPT_URL,
    showStatus, hideStatus,
    logEvent, putWithShaRetry, sendPushNotification
} from './admin-core.js';

let editingAlbumIndex = null; // ׳׳׳—׳¡׳ ׳׳ ׳¢׳•׳¨׳›׳™׳ ׳׳׳‘׳•׳ ׳§׳™׳™׳
let selectedFiles = [];       // ׳”׳×׳׳•׳ ׳•׳× ׳©׳ ׳‘׳—׳¨׳• ׳׳”׳¢׳׳׳”

/**
 * [׳—׳“׳©] ׳₪׳•׳ ׳§׳¦׳™׳” ׳׳“׳—׳™׳¡׳× ׳×׳׳•׳ ׳” ׳׳₪׳ ׳™ ׳”׳¢׳׳׳” ׳׳—׳™׳¡׳›׳•׳ ׳‘׳׳§׳•׳ ׳‘׳“׳¨׳™׳™׳‘
 * ׳׳•׳¨׳™׳“׳” ׳׳™׳›׳•׳× ׳-0.8 ׳•׳׳’׳‘׳™׳׳” ׳¨׳•׳—׳‘ ׳׳׳§׳¡׳™׳׳•׳ 1600px
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
                        // ׳”׳׳¨׳× ׳”׳¡׳™׳•׳׳× ׳-webp
                        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const newName = `${baseName}.webp`;
                        const compressedFile = new File([blob], newName, {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, 'image/webp', quality);
            };
            img.onerror = err => reject(err);
        };
        reader.onerror = err => reject(err);
    });
}

// [׳—׳“׳©] ׳׳•׳’׳™׳§׳” ׳׳ ׳™׳•׳•׳˜ ׳‘׳×׳¦׳•׳’׳” ׳”׳׳§׳“׳™׳׳”
let currentPreviewIndex = 0;
let previewImagesList = [];

function updatePreviewArrows() {
    const prevBtn = document.getElementById('modal-prev-btn'); // ׳©׳׳׳ - ׳—׳¥ ׳׳׳¢׳‘׳¨ ׳׳‘׳
    const nextBtn = document.getElementById('modal-next-btn'); // ׳™׳׳™׳ - ׳—׳¥ ׳׳׳¢׳‘׳¨ ׳׳§׳•׳“׳
    
    if (prevBtn) prevBtn.style.display = (currentPreviewIndex < previewImagesList.length - 1) ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = (currentPreviewIndex > 0) ? 'block' : 'none';
}

function showLargePreview(index) {
    previewImagesList = Array.from(document.querySelectorAll('#albumPreview .album-preview-item img')).map(img => img.src);
    if (previewImagesList.length === 0) return;
    
    currentPreviewIndex = index;
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-large-img');
    if (modal && img) {
        img.src = previewImagesList[currentPreviewIndex];
        updatePreviewArrows();
        modal.style.display = 'flex';
    }
}

function navigatePreview(direction) {
    if (previewImagesList.length === 0) return;
    const newIndex = currentPreviewIndex + direction;
    if (newIndex < 0 || newIndex >= previewImagesList.length) return; // ׳׳׳ ׳׳•׳₪ ׳‘׳—׳¦׳™׳
    
    currentPreviewIndex = newIndex;
    const img = document.getElementById('preview-large-img');
    if (img) img.src = previewImagesList[currentPreviewIndex];
    updatePreviewArrows();
}

export function initGalleryAdminEvents() {
    const dateInput = document.getElementById('albumDateInput');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    // ׳׳׳–׳™׳ ׳׳¡׳’׳™׳¨׳× ׳׳•׳“׳׳ ׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳” ׳׳×׳׳•׳ ׳•׳×
    const closeBtn = document.getElementById('close-preview-modal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('image-preview-modal');
            if (modal) modal.style.display = 'none';
        };
    }
    
    const modal = document.getElementById('image-preview-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            // ׳™׳¦׳™׳׳” ׳‘׳׳™׳“׳” ׳•׳׳—׳¦׳• ׳¢׳ ׳”׳¨׳§׳¢ ׳׳—׳•׳¥ ׳׳×׳׳•׳ ׳”
            if (e.target === modal || e.target.classList.contains('modal-content')) {
                modal.style.display = 'none';
            }
        });
    }

    // ׳׳׳–׳™׳ ׳™ ׳—׳™׳¦׳™׳ ׳׳×׳¦׳•׳’׳” ׳”׳׳§׳“׳™׳׳”
    const prevBtn = document.getElementById('modal-prev-btn');
    const nextBtn = document.getElementById('modal-next-btn');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePreview(1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); navigatePreview(-1); });

    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('image-preview-modal');
        if (modal && modal.style.display === 'flex') {
            if (e.key === 'ArrowRight') navigatePreview(-1);
            if (e.key === 'ArrowLeft') navigatePreview(1);
            if (e.key === 'Escape') modal.style.display = 'none';
        }
    });
}

/* ----------------- ׳׳׳׳ ׳˜׳™׳ ----------------- */
let galleryForm, albumTitleInput, albumImagesInput, galleryStatusMessage, galleryListContainer, albumPreview;

document.addEventListener('DOMContentLoaded', () => {
    galleryForm = document.getElementById('add-album-form');
    albumTitleInput = document.getElementById('albumTitleInput');
    albumImagesInput = document.getElementById('albumImagesInput');
    galleryStatusMessage = document.getElementById('gallery-status-message');
    galleryListContainer = document.getElementById('gallery-list-container');
    albumPreview = document.getElementById('albumPreview');
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    if (albumImagesInput) albumImagesInput.addEventListener('change', handleFileSelect); // <--- ׳”׳§׳•׳“ ׳”׳–׳” ׳ ׳›׳•׳!


    /* ----------------- ׳™׳¦׳™׳¨׳× ׳׳–׳•׳¨ ׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳” ׳׳ ׳׳ ׳§׳™׳™׳ ----------------- */
    if (!albumPreview && albumImagesInput) {
        albumPreview = document.createElement('div');
        albumPreview.id = 'albumPreview';
        albumPreview.className = 'album-preview-grid';
        albumImagesInput.insertAdjacentElement('afterend', albumPreview);
    }

    /* ----------------- ׳׳׳–׳™׳ ׳™׳ ׳׳׳™׳¨׳•׳¢׳™׳ ----------------- */
    if (albumImagesInput) albumImagesInput.addEventListener('change', handleFileSelect);

    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.addEventListener('click', resetGalleryForm);

    if (galleryForm) galleryForm.addEventListener('submit', handleGallerySubmit);
});

/* ----------------- ׳׳•׳’׳™׳§׳” ׳¨׳׳©׳™׳× ----------------- */
export async function loadAndRenderGallery() {
    // ׳©׳™׳׳•׳© ׳‘׳׳©׳×׳ ׳™׳ ׳”׳’׳׳•׳‘׳׳™׳™׳ ׳-admin.js
    if (typeof GITHUB_TOKEN === 'undefined' || !GITHUB_TOKEN) return;

    const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + GALLERY_JSON_PATH;

    try {
        const response = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
        });

        if (!response.ok) throw new Error('Failed to fetch gallery JSON');

        const fileData = await response.json();
        // ׳©׳™׳׳•׳© ׳‘׳₪׳•׳ ׳§׳¦׳™׳™׳× ׳”׳¢׳–׳¨ ׳-admin.js ׳׳• ׳”׳’׳“׳¨׳” ׳׳§׳•׳׳™׳× ׳׳ ׳¦׳¨׳™׳
        const content = decodeBase64ToUtf8(fileData.content.replace(/\n/g, ''));
        const galleryArray = JSON.parse(content);

        renderGalleryList(galleryArray, fileData.sha);
    } catch (err) {
        showStatus('׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳× ׳”׳’׳׳¨׳™׳”', null, true);
    }
}
// ׳—׳©׳™׳₪׳× ׳”׳₪׳•׳ ׳§׳¦׳™׳” ׳׳—׳׳•׳ ׳›׳“׳™ ׳©-admin.js ׳™׳•׳›׳ ׳׳§׳¨׳•׳ ׳׳”
window.loadAndRenderGallery = loadAndRenderGallery;

function renderGalleryList(galleryArray, sha) {
    if (!galleryListContainer) return;
    galleryListContainer.replaceChildren();

    if (galleryArray.length === 0) {
        const emptyStateDiv = document.createElement('div');
        emptyStateDiv.className = 'empty-state';

        const icon = document.createElement('i');
        icon.className = 'fas fa-images';

        const text = document.createElement('p');
        text.textContent = '׳׳™׳ ׳׳׳‘׳•׳׳™׳ ׳׳”׳¦׳’׳”. ׳”׳×׳—׳ ׳‘׳™׳¦׳™׳¨׳× ׳”׳׳׳‘׳•׳ ׳”׳¨׳׳©׳•׳!';

        emptyStateDiv.appendChild(icon);
        emptyStateDiv.appendChild(text);

        galleryListContainer.appendChild(emptyStateDiv);
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
        const dateText = album.data.date ? ' | ׳×׳׳¨׳™׳: ' + album.data.date : '';
        p.textContent = (album.data.images ? album.data.images.length : 0) + ' ׳×׳׳•׳ ׳•׳×' + dateText;

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

        const editIcon = document.createElement('i');
        editIcon.className = 'fas fa-edit';
        editBtn.appendChild(editIcon);
        editBtn.appendChild(document.createTextNode(' ׳¢׳¨׳•׳'));

        editBtn.addEventListener('click', () => editAlbum(album, index));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-album-btn premium-btn small danger';
        deleteBtn.dataset.index = index;

        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash-alt';
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.appendChild(document.createTextNode(' ׳׳—׳§'));

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
    const albumDateInput = document.getElementById('albumDateInput');
    albumTitleInput.value = album.data.title || '';
    if (albumDateInput) albumDateInput.value = album.data.date || new Date().toISOString().split('T')[0];
    if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = album.data.thumbnail || '';

    albumPreview.replaceChildren();
    selectedFiles = []; // ׳׳™׳₪׳•׳¡ ׳‘׳—׳™׳¨׳•׳× ׳—׳“׳©׳•׳×

    // ׳”׳¦׳’׳× ׳×׳׳•׳ ׳•׳× ׳§׳™׳™׳׳•׳×
    (album.data.images || []).forEach((imgPath, idx) => {
        const item = createPreviewItem(imgPath, true, idx);
        if (album.data.thumbnail === imgPath) {
            item.classList.add('is-thumbnail');
            const badge = document.createElement('div');
            badge.className = 'preview-thumb-badge';
            badge.textContent = '׳©׳¢׳¨';
            item.appendChild(badge);
        }
        albumPreview.appendChild(item);
    });

    editingAlbumIndex = index;
    albumTitleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // ׳©׳™׳ ׳•׳™ ׳›׳₪׳×׳•׳¨ ׳”׳©׳׳™׳¨׳”
    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    submitBtn.textContent = '׳¢׳“׳›׳ ׳׳׳‘׳•׳';
    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

export function resetGalleryForm() {
    if (galleryForm) galleryForm.reset();
    const albumDateInput = document.getElementById('albumDateInput');
    if (albumDateInput) albumDateInput.value = new Date().toISOString().split('T')[0];

    // ׳ ׳™׳§׳•׳™ URL-׳™׳ ׳׳”׳–׳™׳›׳¨׳•׳
    selectedFiles.forEach(f => {
        if (f.localUrl) URL.revokeObjectURL(f.localUrl);
    });

    // ׳ ׳™׳§׳•׳™ ׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳”
    if (albumPreview) albumPreview.replaceChildren();
    selectedFiles = [];
    selectedFiles = [];
    editingAlbumIndex = null;
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = '';

    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = '׳©׳׳•׳¨ ׳׳׳‘׳•׳';

    const cancelBtn = document.getElementById('cancel-album-edit');
    if (cancelBtn) cancelBtn.style.display = 'none';
}
async function deleteAlbum(indexToDelete) {
    if (!confirm('׳”׳׳ ׳׳×׳” ׳‘׳˜׳•׳— ׳©׳‘׳¨׳¦׳•׳ ׳ ׳׳׳—׳•׳§ ׳׳× ׳”׳׳׳‘׳•׳?')) return;

    try {
        const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + GALLERY_JSON_PATH;
        const fileResponse = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
        });

        if (!fileResponse.ok) throw new Error("Failed to fetch gallery JSON");

        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // ׳׳—׳™׳§׳”
        galleryArray.splice(indexToDelete, 1);

        const updatedContentBase64 = encodeToBase64(JSON.stringify(galleryArray, null, 2));

        const payload = {
            message: `Delete album index ${indexToDelete} (by ${GITHUB_USERNAME})`,
            content: updatedContentBase64,
            branch: 'main'
        };
        const updateResponse = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, fileData.sha, 2);

        if (updateResponse && updateResponse.ok) {
            galleryStatusMessage.textContent = '׳”׳׳׳‘׳•׳ ׳ ׳׳—׳§ ׳‘׳”׳¦׳׳—׳”';
            galleryStatusMessage.style.color = 'green';
            logEvent(`׳׳—׳§ ׳׳׳‘׳•׳ ׳×׳׳•׳ ׳•׳× ׳׳™׳ ׳“׳§׳¡ ${indexToDelete}`, 'gallery');
            loadAndRenderGallery();
        } else {
            throw new Error('Update failed');
        }
    } catch (err) {
        showStatus('׳©׳’׳™׳׳” ׳‘׳׳—׳™׳§׳× ׳”׳׳׳‘׳•׳: ' + err.message, null, true);
    }
}

/* ----------------- ׳₪׳•׳ ׳§׳¦׳™׳” ׳׳•׳’׳™׳§׳” ׳¨׳׳©׳™׳× ----------------- */
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
        // [׳×׳™׳§׳•׳ ׳§׳¨׳™׳˜׳™ ׳-404]: ׳™׳¦׳™׳¨׳× URL ׳–׳׳ ׳™ ׳׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳”
        const localUrl = URL.createObjectURL(file);

        selectedFiles.push({
            file: file,
            localUrl: localUrl
        });

        // ׳”׳¦׳’׳× ׳×׳¦׳•׳’׳” ׳׳§׳“׳™׳׳”
        const item = createPreviewItem(localUrl, false);
        albumPreview.appendChild(item);
    }

    if (!albumPreview.querySelector('.is-thumbnail')) {
        const firstItem = albumPreview.querySelector('.album-preview-item');
        if (firstItem) {
            const starBtn = firstItem.querySelector('.preview-btn:not(.remove)');
            if (starBtn) starBtn.click();
        }
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

    // ׳›׳₪׳×׳•׳¨׳™׳: ׳”׳’׳“׳¨ ׳›׳×׳׳•׳ ׳× ׳©׳¢׳¨ + ׳׳—׳§
    const controls = document.createElement('div');
    controls.className = 'preview-controls';

    // ׳›׳₪׳×׳•׳¨ ׳×׳׳•׳ ׳× ׳©׳¢׳¨ (׳¡׳˜׳׳¨)
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'preview-btn';
    thumbBtn.title = '׳‘׳—׳™׳¨׳× ׳×׳׳•׳ ׳× ׳©׳¢׳¨ ׳׳׳׳‘׳•׳';
    thumbBtn.textContent = 'ג­';

    const setAsThumbnail = () => {
        const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
        if (albumThumbnailUrlInput) albumThumbnailUrlInput.value = src;

        // ׳¢׳“׳›׳•׳ ׳•׳™׳–׳•׳׳׳™ ׳©׳ ׳›׳ ׳”׳₪׳¨׳™׳˜׳™׳
        Array.from(albumPreview.querySelectorAll('.album-preview-item')).forEach(el => {
            el.classList.remove('is-thumbnail');
            const b = el.querySelector('.preview-thumb-badge');
            if (b) b.remove();
        });

        // ׳¢׳“׳›׳•׳ ׳”׳₪׳¨׳™׳˜ ׳”׳ ׳•׳›׳—׳™
        wrapper.classList.add('is-thumbnail');
        const badge = document.createElement('div');
        badge.className = 'preview-thumb-badge';
        badge.textContent = '׳©׳¢׳¨';
        wrapper.appendChild(badge);
    };

    thumbBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setAsThumbnail();
    });

    // ׳׳—׳™׳¦׳” ׳¢׳ ׳”׳×׳׳•׳ ׳” ׳₪׳•׳×׳—׳× ׳׳× ׳”׳׳¡׳ ׳”׳׳׳
    img.addEventListener('click', (e) => {
        e.stopPropagation();
        const allItems = Array.from(albumPreview.querySelectorAll('.album-preview-item'));
        const index = allItems.indexOf(wrapper);
        showLargePreview(index !== -1 ? index : 0);
    });

    // ׳›׳₪׳×׳•׳¨ ׳׳—׳™׳§׳”
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'preview-btn remove';
    removeBtn.title = '׳”׳¡׳¨ ׳×׳׳•׳ ׳”';
    removeBtn.textContent = 'נ—‘';
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

    wrapper.appendChild(controls);

    return wrapper;
}
// admin-gallery.js (׳₪׳•׳ ׳§׳¦׳™׳™׳× handleGallerySubmit - ׳׳×׳•׳§׳ ׳×)
let _gallerySubmitting = false;

async function handleGallerySubmit(e) {
    e.preventDefault();

    // Guard: prevent double-submission
    if (_gallerySubmitting) return;
    _gallerySubmitting = true;

    const albumTitle = albumTitleInput.value.trim();
    const albumThumbnailUrlInput = document.getElementById('albumThumbnailUrl');
    const albumImages = albumImagesInput.files;
    
    const submitBtn = galleryForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    if (!albumTitle) {
        showStatus('׳ ׳ ׳׳”׳–׳™׳ ׳©׳ ׳׳׳׳‘׳•׳', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    // ׳‘׳“׳™׳§׳× ׳׳•׳¨׳ ׳›׳•׳×׳¨׳×
    if (albumTitle.length < 2 || albumTitle.length > 100) {
        showStatus('׳©׳ ׳”׳׳׳‘׳•׳ ׳—׳™׳™׳‘ ׳׳”׳™׳•׳× ׳‘׳™׳ 2 ׳-100 ׳×׳•׳•׳™׳.', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    // ׳‘׳“׳™׳§׳× URL ׳׳×׳׳•׳ ׳× ׳”׳©׳¢׳¨ ׳׳ ׳”׳•׳–׳ ׳™׳“׳ ׳™׳×
    if (albumThumbnailUrlInput && albumThumbnailUrlInput.value) {
        try {
            new URL(albumThumbnailUrlInput.value);
        } catch (e) {
            // ׳׳ ׳–׳” ׳׳ URL ׳×׳§׳™׳ ׳•׳–׳” ׳׳ ׳׳§׳•׳׳™ (blob)
            if (!albumThumbnailUrlInput.value.startsWith('blob:')) {
                showStatus('׳›׳×׳•׳‘׳× ׳×׳׳•׳ ׳× ׳”׳©׳¢׳¨ ׳׳™׳ ׳” ׳×׳§׳™׳ ׳”.', null, true);
                if (submitBtn) submitBtn.disabled = false;
                return;
            }
        }
    }

    // ׳‘׳“׳™׳§׳× ׳§׳‘׳¦׳™׳ ׳ ׳‘׳—׳¨׳™׳ - ׳¡׳•׳’ ׳•׳’׳•׳“׳
    for (const file of albumImages) {

        // ׳‘׳“׳™׳§׳× ׳¡׳•׳’ ׳§׳•׳‘׳¥ (׳¨׳§ ׳×׳׳•׳ ׳•׳×)
        if (!file.type.startsWith('image/')) {
            showStatus(`׳”׳§׳•׳‘׳¥ "${file.name}" ׳׳™׳ ׳• ׳×׳׳•׳ ׳”. ׳׳ ׳ ׳”׳¢׳׳” ׳¨׳§ ׳§׳‘׳¦׳™ ׳×׳׳•׳ ׳•׳×.`, null, true);
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        // ׳‘׳“׳™׳§׳× ׳’׳•׳“׳ ׳§׳•׳‘׳¥ (׳׳§׳¡׳™׳׳•׳ 10MB)
        const maxSizeInBytes = 10 * 1024 * 1024;
        if (file.size > maxSizeInBytes) {
            showStatus(`׳”׳§׳•׳‘׳¥ "${file.name}" ׳’׳“׳•׳ ׳׳“׳™. ׳”׳’׳•׳“׳ ׳”׳׳§׳¡׳™׳׳׳™ ׳”׳׳•׳×׳¨ ׳”׳•׳ 10MB.`, null, true);
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
    }

    const existingImagesCount = document.getElementById('albumPreview')?.children.length || 0;
    if (albumImages.length === 0 && existingImagesCount === 0) {
        showStatus('׳ ׳ ׳׳‘׳—׳•׳¨ ׳׳₪׳—׳•׳× ׳×׳׳•׳ ׳” ׳׳—׳× ׳׳׳׳‘׳•׳.', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    if (!albumThumbnailUrlInput?.value) {
        showStatus('׳™׳© ׳׳‘׳—׳•׳¨ ׳×׳׳•׳ ׳× ׳©׳¢׳¨ ׳׳×׳•׳ ׳”׳×׳׳•׳ ׳•׳× ׳©׳”׳¢׳׳™׳×, ׳׳• ׳׳”׳¢׳׳•׳× ׳—׳“׳©׳”, ׳¢׳ ׳™׳“׳™ ׳׳—׳™׳¦׳” ׳¢׳ ׳”׳›׳•׳›׳‘׳™׳×.', null, true);
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    showStatus('׳׳›׳™׳ ׳”׳¢׳׳׳” ׳׳“׳¨׳™׳™׳‘... ׳ ׳ ׳׳”׳׳×׳™׳', 10);

    try {
        // [׳×׳™׳§׳•׳ ׳§׳¨׳™׳˜׳™ 1]: ׳‘׳™׳¦׳•׳¢ Login ׳•׳§׳‘׳׳× ׳”-Token
        showStatus('׳׳×׳—׳‘׳¨ ׳׳—׳©׳‘׳•׳ ׳’׳•׳’׳...', 20);
        const googleAccessToken = APPS_SCRIPT_URL ? null : await googleLogin();

        // 1. ׳”׳©׳’׳× ׳”׳§׳•׳‘׳¥ ׳”׳ ׳•׳›׳—׳™
        showStatus('׳ ׳™׳’׳© ׳׳׳׳’׳¨ ׳”׳ ׳×׳•׳ ׳™׳ ׳‘-GitHub...', 35);
        const API_URL = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + GALLERY_JSON_PATH;
        const fileResponse = await window.fetch(API_URL, {
            headers: { 'Authorization': "token " + GITHUB_TOKEN },
            cache: 'no-store'
        });

        if (!fileResponse.ok) throw new Error('Failed to fetch gallery JSON');
        const fileData = await fileResponse.json();
        const galleryArray = JSON.parse(decodeBase64ToUtf8(fileData.content.replace(/\n/g, '')));

        // 2. ׳׳™׳¡׳•׳£ ׳¨׳©׳™׳׳× ׳”׳×׳׳•׳ ׳•׳× ׳”׳¡׳•׳₪׳™׳× ׳׳”-DOM
        const previewItems = albumPreview.querySelectorAll('.album-preview-item');
        const totalItems = previewItems.length;
        let processedCount = 0;

        showStatus(`׳׳×׳—׳™׳ ׳¢׳™׳‘׳•׳“ ׳•׳”׳¢׳׳׳” ׳©׳ ${totalItems} ׳×׳׳•׳ ׳•׳×...`, 40);

        const selectedFilesMap = new Map(selectedFiles.map(f => [f.localUrl, f]));
        const previewItemsArray = Array.from(previewItems);
        const results = new Array(previewItemsArray.length);
        const uploadTasks = [];

        for (let i = 0; i < previewItemsArray.length; i++) {
            const item = previewItemsArray[i];
            const img = item.querySelector('img');

            if (item.dataset.existing === '1') {
                processedCount++;
                results[i] = img.getAttribute('src');
            } else {
                const fileObj = selectedFilesMap.get(img.src);
                if (fileObj) {
                    uploadTasks.push(async () => {
                        let fileToUpload = fileObj.file;
                        const originalSize = (fileToUpload.size / 1024 / 1024).toFixed(2);
                        console.log(`DEBUG: Original file size: ${originalSize}MB`);

                        try {
                            // ׳“׳—׳™׳¡׳× ׳×׳׳•׳ ׳” ׳׳—׳™׳¡׳›׳•׳ ׳‘׳ ׳₪׳— (׳¨׳§ ׳׳ ׳–׳• ׳×׳׳•׳ ׳”)
                            if (fileToUpload.type.startsWith('image/')) {
                                fileToUpload = await compressImage(fileToUpload);
                                const compressedSize = (fileToUpload.size / 1024 / 1024).toFixed(2);
                                console.log(`DEBUG: Compressed file size: ${compressedSize}MB`);
                            }
                        } catch (compressErr) {
                            console.warn("Compression failed, uploading original:", compressErr);
                        }

                        const fileId = await uploadFileToDrive(fileToUpload, googleAccessToken);
                        const publicUrl = await makeFilePublic(fileId, googleAccessToken);

                        processedCount++;
                        showStatus(`׳׳¢׳׳” ׳×׳׳•׳ ׳•׳× ׳׳“׳¨׳™׳™׳‘ (${processedCount}/${totalItems})...`, 40 + (processedCount / totalItems * 40));

                        results[i] = publicUrl;
                    });
                } else {
                    results[i] = null;
                }
            }
        }

        const BATCH_SIZE = 3;
        for (let i = 0; i < uploadTasks.length; i += BATCH_SIZE) {
            const batch = uploadTasks.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(task => task()));
        }
        const finalImages = results.filter(url => url !== null);

        // 3. ׳‘׳ ׳™׳™׳× ׳”׳׳•׳‘׳™׳™׳§׳˜ ׳”׳—׳“׳©
        let thumbnailUrl = "";
        // const previewItemsArray = Array.from(previewItems); // already defined above
        const thumbnailIndex = previewItemsArray.findIndex(item => item.classList.contains('is-thumbnail'));
        
        if (thumbnailIndex !== -1 && results[thumbnailIndex]) {
            thumbnailUrl = results[thumbnailIndex];
        } else {
            thumbnailUrl = finalImages[0] || "";
        }

        if (!thumbnailUrl && finalImages.length === 0) {
            showStatus('׳©׳’׳™׳׳”: ׳׳™׳ ׳×׳׳•׳ ׳•׳× ׳‘׳׳׳‘׳•׳. ׳׳ ׳ ׳”׳•׳¡׳£ ׳׳₪׳—׳•׳× ׳×׳׳•׳ ׳” ׳׳—׳×.', null, true);
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        const albumDateInput = document.getElementById('albumDateInput');
        const albumDate = (albumDateInput && albumDateInput.value) ? albumDateInput.value : new Date().toISOString().split('T')[0];

        const newAlbum = {
            data: {
                title: albumTitleInput.value,
                date: albumDate,
                thumbnail: thumbnailUrl,
                images: finalImages
            },
            content: ""
        };

        // 4. ׳¢׳“׳›׳•׳ ׳”׳׳¢׳¨׳
        const isUpdate = editingAlbumIndex !== null;
        const savedEditingAlbumIndex = editingAlbumIndex;
        if (isUpdate) {
            galleryArray[editingAlbumIndex] = newAlbum;
            editingAlbumIndex = null;
        } else {
            galleryArray.push(newAlbum);
        }

        showStatus('׳׳¢׳“׳›׳ ׳׳× ׳”׳׳×׳¨... ׳›׳׳¢׳˜ ׳¡׳™׳™׳׳ ׳•', 90);

        // 5. ׳©׳׳™׳¨׳” ׳‘-GitHub
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
            showStatus('׳”׳׳׳‘׳•׳ ׳ ׳©׳׳¨ ׳‘׳”׳¦׳׳—׳”!', 100);
            setTimeout(hideStatus, 1500);
            logEvent(`${isUpdate ? '׳¢׳“׳›׳' : '׳”׳•׳¡׳™׳£'} ׳׳׳‘׳•׳: ${albumTitleInput.value}`, 'gallery');
            
            // [׳—׳“׳©] ׳”׳×׳¨׳׳” ׳¢׳ ׳”׳•׳¡׳₪׳×/׳¢׳“׳›׳•׳ ׳׳׳‘׳•׳
            if (!isUpdate) {
                sendPushNotification(albumTitleInput.value, "׳’׳׳¨׳™׳™׳× ׳×׳׳•׳ ׳•׳× ׳—׳“׳©׳” ׳₪׳•׳¨׳¡׳׳” ׳‘׳׳×׳¨ ׳”׳™׳©׳™׳‘׳”: ׳”׳™׳›׳ ׳¡׳• ׳׳¦׳₪׳™׳™׳”.", false);
            } else {
                sendPushNotification(albumTitleInput.value, "׳¢׳“׳›׳•׳ ׳‘׳’׳׳¨׳™׳™׳× ׳”׳×׳׳•׳ ׳•׳× ׳‘׳׳×׳¨ ׳”׳™׳©׳™׳‘׳”: ׳”׳™׳›׳ ׳¡׳• ׳׳¦׳₪׳™׳™׳” ׳‘׳×׳׳•׳ ׳•׳× ׳”׳—׳“׳©׳•׳×.", true);
            }
            
            resetGalleryForm();
            loadAndRenderGallery();
        } else {
            throw new Error('Save to GitHub failed');
        }

    } catch (err) {
        showStatus('׳©׳’׳™׳׳” ׳‘׳×׳”׳׳™׳ ׳”׳©׳׳™׳¨׳”: ' + err.message, null, true);
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        _gallerySubmitting = false;
    }
}

