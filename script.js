document.addEventListener('DOMContentLoaded', () => {
    // ---- הגדרות כלליות ----
    const repoOwner = 'yt2178';
    const repoName = 'Beit-Halevi';

    // ---- משתנים גלובליים ----
    const gridOverlay = document.getElementById('grid-overlay');
    const gridCloseBtn = document.querySelector('.grid-close');
    const thumbnailGrid = document.getElementById('thumbnail-grid');
    const gridAlbumTitle = document.getElementById('grid-album-title');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCloseBtn = lightbox.querySelector('.lightbox-close');
    const nextBtn = lightbox.querySelector('.lightbox-next');
    const prevBtn = lightbox.querySelector('.lightbox-prev');
    let currentAlbumImages = [];
    let currentIndex = 0;

    // ---- קוד כפתור "חזרה למעלה" ----
    let backToTopButton = document.getElementById("back-to-top-btn");
    if (backToTopButton) {
        window.onscroll = () => {
            if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) { backToTopButton.style.display = "flex"; } else { backToTopButton.style.display = "none"; }
        };
        backToTopButton.addEventListener("click", () => window.scrollTo({top: 0, behavior: 'smooth'}) );
    }

    // ---- [חדש] פונקציה פשוטה לפירוק Front Matter ----
    function parseFrontMatter(content) {
        const match = /^---\s*([\s\S]+?)\s*---/.exec(content);
        if (!match) return { data: {}, content };

        const yamlText = match[1];
        const body = content.slice(match[0].length).trim();

        const data = {};
        let currentList = null;
        yamlText.trim().split('\n').forEach(line => {
            const keyValueMatch = line.match(/^([^:]+):(.*)/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim().replace(/^['"]|['"]$/g, '');
                if (value) {
                    data[key] = value;
                    currentList = null;
                } else {
                    data[key] = [];
                    currentList = key;
                }
            } else if (currentList && line.trim().startsWith('- ')) {
                const value = line.replace(/^- /, '').trim().replace(/^['"]|['"]$/g, '');
                if (value) data[currentList].push(value);
            }
        });
        return { data, content: body };
    }

    // ---- פונקציות טעינה ועיבוד ----
    async function fetchAndParse(path) {
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (!response.ok) throw new Error(`Network response error for ${path}`);
            const data = await response.json();
            if (!Array.isArray(data)) return [];

            const parsedItems = await Promise.all(data
                .filter(file => file.type === 'file' && file.name.endsWith('.md'))
                .map(async file => {
                    try {
                        const fileResponse = await fetch(file.download_url);
                        if (!fileResponse.ok) return null;
                        const content = await fileResponse.text();
                        return parseFrontMatter(content);
                    } catch { return null; }
                })
            );
            return parsedItems.filter(item => item !== null);
        } catch (error) {
            console.error(`Error processing ${path}:`, error);
            return null;
        }
    }

    async function loadNews() {
        const newsContainer = document.getElementById('news-container');
        if (!newsContainer) return;

        const items = await fetchAndParse('_posts/news');
        if (items === null) {
            newsContainer.innerHTML = '<p style="text-align:center; color: red;">שגיאה בטעינת העדכונים.</p>';
            return;
        }

        const sortedItems = items
            .map(item => ({ ...item.data, body: item.content }))
            .filter(item => item.title && item.date)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        newsContainer.innerHTML = '';
        if (sortedItems.length === 0) {
            newsContainer.innerHTML = '<p style="text-align:center;">אין עדכונים חדשים כרגע.</p>';
            return;
        }

        sortedItems.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
           newsElement.innerHTML = `<h3>${item.title}</h3><p><strong>פורסם בתאריך: ${formattedDate}</strong></p><div>${marked.parse(item.body)}</div>`;
            newsContainer.appendChild(newsElement);
        });
    }

    async function loadGallery() {
        const albumContainer = document.getElementById('album-grid-container');
        if (!albumContainer) return;

        const items = await fetchAndParse('_posts/gallery');
        if (items === null) {
            albumContainer.innerHTML = '<p style="text-align:center; color: red;">שגיאה בטעינת האלבומים.</p>';
            return;
        }

        const albums = items
            .map(item => item.data)
            .filter(item => item.title && item.thumbnail);
        
        albumContainer.innerHTML = '';
        if (albums.length === 0) {
            albumContainer.innerHTML = '<p style="text-align:center;">לא נמצאו אלבומים.</p>';
            return;
        }

        albums.forEach(albumData => {
             const albumElement = document.createElement('a');
             albumElement.className = 'album-cover';
             albumElement.innerHTML = `<img src="${albumData.thumbnail}" alt="${albumData.title}"><div class="album-title">${albumData.title}</div>`;
             albumElement.addEventListener('click', () => {
                 openGridOverlay(albumData);
             });
             albumContainer.appendChild(albumElement);
        });
    }

    // --- שאר הפונקציות ---
    function openGridOverlay(albumData) {
        thumbnailGrid.innerHTML = '';
        gridAlbumTitle.textContent = albumData.title;
        currentAlbumImages = (albumData.images || []).map(imgSrc => ({ src: imgSrc, alt: albumData.title }));

        if (currentAlbumImages.length === 0) {
             thumbnailGrid.innerHTML = '<p style="color:white; text-align:center;">לא נמצאו תמונות באלבום זה.</p>';
        } else {
            currentAlbumImages.forEach((imgData, index) => {
                const thumb = document.createElement('img');
                thumb.src = imgData.src; thumb.alt = imgData.alt; thumb.dataset.index = index;
                thumb.addEventListener('click', () => {
                    currentIndex = parseInt(thumb.dataset.index); showLightboxImage();
                    gridOverlay.classList.remove('active'); lightbox.classList.add('active');
                });
                thumbnailGrid.appendChild(thumb);
            });
        }
        gridOverlay.classList.add('active');
    }
    
    function showLightboxImage() { if (!currentAlbumImages[currentIndex]) return; lightboxImg.src = currentAlbumImages[currentIndex].src; lightboxImg.alt = currentAlbumImages[currentIndex].alt; prevBtn.style.display = (currentIndex > 0) ? 'block' : 'none'; nextBtn.style.display = (currentIndex < currentAlbumImages.length - 1) ? 'block' : 'none'; }
    function closeLightbox() { lightbox.classList.remove('active'); }
    function showNextImage() { if (currentIndex < currentAlbumImages.length - 1) { currentIndex++; showLightboxImage(); } }
    function showPrevImage() { if (currentIndex > 0) { currentIndex--; showLightboxImage(); } }
    
    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (nextBtn) nextBtn.addEventListener('click', showNextImage);
    if (prevBtn) prevBtn.addEventListener('click', showPrevImage);
    if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    if (gridCloseBtn) gridCloseBtn.addEventListener('click', () => { gridOverlay.classList.remove('active'); currentAlbumImages = []; });

    document.addEventListener('keydown', (e) => {
        if (lightbox && lightbox.classList.contains('active')) {
            if (e.key === 'ArrowRight') showNextImage();
            else if (e.key === 'ArrowLeft') showPrevImage();
            else if (e.key === 'Escape') closeLightbox();
        }
    });

    const dateTimeDisplay = document.getElementById('date-time-display');
    function updateDateTime() {
        const now = new Date();
        const gregorianDate = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateTimeDisplay.textContent = `${gregorianDate} | ${time}`;
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);
    loadNews();
    loadGallery();
});
