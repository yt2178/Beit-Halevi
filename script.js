document.addEventListener('DOMContentLoaded', () => {
    // ---- הגדרות כלליות ----
    const repoOwner = 'beit-halevi-rosh-ayin'; // <--- החלף בשם המשתמש שלך ב-GitHub
    const repoName = 'beit-halevi-rosh-ayin.github.io'; // <--- החלף בשם המאגר שלך

    // ---- קוד כפתור "חזרה למעלה" ----
    let backToTopButton = document.getElementById("back-to-top-btn");
    if (backToTopButton) {
        window.onscroll = () => {
            if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
                backToTopButton.style.display = "flex";
            } else {
                backToTopButton.style.display = "none";
            }
        };
        backToTopButton.addEventListener("click", () => window.scrollTo({top: 0, behavior: 'smooth'}) );
    }

    // ---- קוד טעינת נתונים דינמיים ----
    async function fetchContent(path) {
        const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Network response was not ok for ${path}`);
            const data = await response.json();
            const files = await Promise.all(data.map(async file => {
                const fileResponse = await fetch(file.download_url);
                return await fileResponse.text();
            }));
            return files;
        } catch (error) {
            console.error(`Error fetching from ${path}:`, error);
            return [];
        }
    }

    function parseMarkdown(content) {
        const metadata = {};
        const bodyMatch = content.match(/---([\s\S]*?)---([\s\S]*)/);
        if (bodyMatch) {
            const metadataStr = bodyMatch[1];
            metadataStr.trim().split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key) metadata[key.trim()] = valueParts.join(':').trim();
            });
            metadata.body = bodyMatch[2].trim();
        }
        return metadata;
    }

    async function loadNews() {
        const newsContainer = document.getElementById('news-container');
        if (!newsContainer) return;
        
        const newsFiles = await fetchContent('_posts/news');
        const newsItems = newsFiles.map(parseMarkdown).sort((a, b) => new Date(b.date) - new Date(a.date));

        newsContainer.innerHTML = '';
        if (newsItems.length === 0) {
            newsContainer.innerHTML = '<p style="text-align:center;">אין עדכונים חדשים כרגע.</p>';
            return;
        }

        newsItems.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
            const newsElement = document.createElement('div');
            newsElement.className = 'news-item';
            newsElement.innerHTML = `<h3>${item.title}</h3><p><strong>פורסם בתאריך: ${formattedDate}</strong></p><p>${item.body.replace(/\n/g, '<br>')}</p>`;
            newsContainer.appendChild(newsElement);
        });
    }

    async function loadGallery() {
        const albumContainer = document.getElementById('album-grid-container');
        if (!albumContainer) return;

        const galleryFiles = await fetchContent('_posts/gallery');
        const albums = galleryFiles.map(parseMarkdown);

        albumContainer.innerHTML = '';
        if (albums.length === 0) {
            albumContainer.innerHTML = '<p style="text-align:center;">לא נמצאו אלבומים.</p>';
            return;
        }

        albums.forEach(album => {
            const albumElement = document.createElement('a');
            albumElement.className = 'album-cover';
            albumElement.innerHTML = `<img src="${album.thumbnail}" alt="${album.title}"><div class="album-title">${album.title}</div>`;
            albumContainer.appendChild(albumElement);
            // כאן נוסיף בעתיד את הקוד לפתיחת הגלריה
        });
    }

    // ---- קוד התאריך והשעה ---
    const dateTimeDisplay = document.getElementById('date-time-display');
    function updateDateTime() {
        const now = new Date();
        const gregorianDate = now.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let hebrewDate = '';
        if (typeof Hebcal !== 'undefined') {
            const hDate = new Hebcal.HDate(now);
            hebrewDate = hDate.toString('h');
        }
        dateTimeDisplay.textContent = `${gregorianDate} | ${hebrewDate} | ${time}`;
    }

    // ---- הפעלה ----
    updateDateTime();
    setInterval(updateDateTime, 1000);
    loadNews();
    loadGallery();
});
