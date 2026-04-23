/**
 * search.js - רכיב חיפוש גלובלי לאתר
 * מאפשר חיפוש וסינון מהיר של ידיעות ואלבומים
 */

export function initSearch(newsContainerId, galleryContainerId) {
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'search-wrapper sticky-wrapper';
    searchWrapper.innerHTML = `
        <div class="search-container">
            <i class="fas fa-search search-icon"></i>
            <input type="text" id="global-search" placeholder="חיפוש בידיעות ובאלבומים..." aria-label="חיפוש באתר">
            <button id="clear-search" class="clear-search-btn" style="display:none;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // הזרקה לפני אזור החדשות
    const mainContent = document.getElementById('main-content');
    const newsSection = document.getElementById('news');
    if (mainContent && newsSection) {
        mainContent.insertBefore(searchWrapper, newsSection);
    }

    const searchInput = document.getElementById('global-search');
    const clearBtn = document.getElementById('clear-search');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim().toLowerCase();
            clearBtn.style.display = query ? 'block' : 'none';
            filterContent(query);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            filterContent('');
            searchInput.focus();
        });
    }
}

function filterContent(query) {
    // סינון חדשות
    const newsCards = document.querySelectorAll('.news-card');
    let newsVisible = 0;
    newsCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const body = card.querySelector('p')?.textContent.toLowerCase() || '';
        if (title.includes(query) || body.includes(query)) {
            card.style.display = 'flex';
            newsVisible++;
        } else {
            card.style.display = 'none';
        }
    });

    // סינון גלריה
    const albumCards = document.querySelectorAll('.album-card');
    let albumsVisible = 0;
    albumCards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        if (title.includes(query)) {
            card.style.display = 'block';
            albumsVisible++;
        } else {
            card.style.display = 'none';
        }
    });

    // טיפול במצב של "אין תוצאות"
    updateEmptyResults('news', newsVisible, query);
    updateEmptyResults('gallery', albumsVisible, query);
}

function updateEmptyResults(type, count, query) {
    const containerId = type === 'news' ? 'news-container' : 'album-grid-container';
    const container = document.getElementById(containerId);
    if (!container) return;

    let emptyMsg = container.querySelector('.search-no-results');
    
    if (count === 0 && query !== '') {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-state search-no-results';
            emptyMsg.innerHTML = `
                <i class="fas fa-search-minus"></i>
                <p>לא נמצאו תוצאות עבור "${query}"</p>
            `;
            container.appendChild(emptyMsg);
        } else {
            emptyMsg.querySelector('p').textContent = `לא נמצאו תוצאות עבור "${query}"`;
            emptyMsg.style.display = 'block';
        }
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
}
