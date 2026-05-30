import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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

global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
};

global.fetch = jest.fn((url) => {
    return Promise.resolve({
        json: () => {
            if (url && url.includes('shabbat')) {
                return Promise.resolve({
                    items: [ { category: "parashat", hebrew: "Test Parashat" } ]
                });
            }
            if (url && url.includes('zmanim')) {
                return Promise.resolve({
                    location: { title: 'Test Location' },
                    times: { alotHaShachar: "2023-01-01T04:00:00.000Z", tzeit7083deg: "2023-01-01T20:00:00.000Z" }
                });
            }
            return Promise.resolve([]); // Should be an array for items
        },
        ok: true
    });
});

document.body.innerHTML = `
  <div id="date-time-display"></div>
  <div id="hebrew-year-display"></div>
  <button id="theme-toggle"></button>
  <form id="contact-form"></form>
  <button id="back-to-top-btn"></button>
  <div id="grid-overlay"></div>
  <div id="lightbox">
    <button class="lightbox-close"></button>
    <button class="lightbox-next"></button>
    <button class="lightbox-prev"></button>
    <img id="lightbox-img" />
    <div id="lightbox-caption"></div>
    <div class="lightbox-content"></div>
  </div>
  <button id="download-btn"></button>
  <div id="thumbnail-grid"></div>
  <div id="grid-album-title"></div>
  <img id="lightbox-img"></img>
  <button id="share-btn"></button>
  <button id="album-share-btn"></button>
  <button id="album-download-btn"></button>
  <div id="news-modal">
    <button class="modal-close"></button>
  </div>
  <div id="modal-title"></div>
  <div id="modal-date"></div>
  <div id="modal-body"></div>
  <button id="news-share-btn"></button>
  <button id="news-prev-btn"></button>
  <button id="news-next-btn"></button>
  <button id="subscribe-btn"></button>
  <button id="fab-subscribe-btn"></button>
  <div id="subscribe-modal"><p></p><button class="subscribe-close"></button></div>
  <div id="pwa-install-banner"></div>
  <button id="pwa-install-btn"></button>
  <button id="pwa-close-btn"></button>
  <div id="sticky-header-wrapper"></div>

  <button class="menu-toggle"></button>
  <div class="nav-links"></div>
  <button class="grid-close"></button>
  <div id="header-container"></div>
  <div id="footer-container"></div>
  <div id="news-container"></div>
  <div id="albums-container"></div>
  <div class="contact-section"></div>
  <div id="zmanim-container"></div>
  <div id="times-container"></div>
  <div id="parasha-name"></div>
  <button class="share-btn"></button>
  <div id="share-modal">
    <button class="close-share"></button>
    <button class="share-option"></button>
    <button class="copy-link-btn"></button>
    <input id="share-link-input" />
  </div>
  <nav class="main-nav"></nav>
  <button class="mobile-menu-btn"></button>
  <div id="about"><h2></h2><p></p></div>
  <div id="donations"><h2></h2><p></p></div>
`;
