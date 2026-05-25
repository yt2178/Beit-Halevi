// Mock DOM elements needed by main.js
document.body.innerHTML = `
    <div id="date-time-display"></div>
    <div id="hebrew-year-display"></div>
    <div id="theme-toggle"></div>
    <div id="contact-form"></div>
    <div class="menu-toggle"></div>
    <div class="nav-links"></div>
    <div id="back-to-top-btn"></div>
    <div id="grid-overlay"></div>
    <div id="lightbox">
        <div class="lightbox-close"></div>
        <div class="lightbox-next"></div>
        <div class="lightbox-prev"></div>
    </div>
    <div id="download-btn"></div>
    <div class="grid-close"></div>
    <div id="thumbnail-grid"></div>
    <div id="grid-album-title"></div>
    <div id="lightbox-img"></div>
    <div id="share-btn"></div>
    <div id="album-share-btn"></div>
    <div id="search-input"></div>
    <div id="search-btn"></div>
    <div id="search-results"></div>
    <div id="search-overlay"></div>
    <div id="search-close"></div>
    <div class="news-list"></div>
    <div class="albums-grid"></div>
`;

// Mock global objects
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

global.MutationObserver = class MutationObserver {
    constructor() {}
    observe() {}
    disconnect() {}
};

global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve([])
}));
