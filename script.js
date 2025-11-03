document.addEventListener('DOMContentLoaded', () => {
    // ---- הגדרות כלליות ----
    const repoOwner = 'yt2178'; // שם המשתמש שלך
    const repoName = 'Beit-Halevi'; // שם המאגר הנכון

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

    // ---- פונקציות טעינה ועיבוד ----
    async function fetchContent(path) {
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        try {
            const response = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json' } });
            if (!response.ok) throw new Error(`Network response was not ok for ${path}`);
            const data = await response.json();
            if (!Array.isArray(data)) return []; // Handle case where path is not a directory
            const files = await Promise.all(data.filter(file => file.type === 'file' && file.name !== '.gitkeep').map(async file => {
                const fileResponse = await fetch(file.download_url);
                return await fileResponse.text();
            }));
            return files;
        } catch (error) { console.error(`Error fetching from ${path}:`, error); return []; }
    }
    
    function parseYaml(yamlStr) {
        const metadata = {};
        let currentList = null;
        if (!yamlStr) return metadata;
        yamlStr.trim().split('\n').forEach(line => {
            const keyValueMatch = line.match(/^([^:]+):(.*)/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim();
                if (value) {
                    metadata[key] = value;
                    currentList = null;
                } else {
                    metadata[key] = [];
                    currentList = key;
                }
            } else if (currentList && line.trim().startsWith('- ')) {
                const value = line.replace(/^- /, '').trim();
                if (value) metadata[currentList].push(value);
            }
        });
        return metadata;
    }

    function parseMarkdown(content) {
        const match = content.match(/---([\s\S]*?)---([\s\S]*)/);
        if (!match) return { body: content };
        const metadata = parseYaml(match[1]);
        metadata.body = match[2].trim();
        return metadata;
    }

    // ---- טעינת חדשות ועדכונים ----
    async function loadNews() {
        const newsContainer = document.getElementById('news-container');
        if (!newsContainer) return;
        
        const newsFiles = await fetchContent('_posts/news');
        const newsItems = newsFiles.map(parseMarkdown).filter(item => item.title).sort((a, b) => new Date(b.date) - new Date(a.date));

        newsContainer.innerHTML = '';
        if (newsItems.length === 0) {
            newsContainer.innerHTML = '<p style="text-align:center;">אין עדכונים חדשים כרגע.</p>';
            return;
        }

        newsItems.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
            
            // [חדש] יצירת תאריך עברי
            const hDate = new Hebcal.HDate(date);
            const hebrewDate = hDate.toString('h');

            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
            
            // [חדש] שימוש ב-marked.parse להמרת Markdown ל-HTML והוספת תאריך עברי
            newsElement.innerHTML = `<h3>${item.title}</h3><p><strong>פורסם בתאריך: ${formattedDate} (${hebrewDate})</strong></p><div>${marked.parse(item.body)}</div>`;
            newsContainer.appendChild(newsElement);
        });
    }

    // ---- טעינת גלריית תמונות ----
    async function loadGallery() {
        const albumContainer = document.getElementById('album-grid-container');
        if (!albumContainer) return;

        const galleryFiles = await fetchContent('_posts/gallery');
        const albums = galleryFiles.map(parseMarkdown).filter(item => item.title);

        albumContainer.inn
