import { fetchStaticJson } from './utils.js';

// הגדרות ברירת מחדל - ראש העין
const DEFAULT_CITY = {
    name: "ראש העין",
    geonameid: "293690"
};

let currentCity = JSON.parse(localStorage.getItem('zmanim_city')) || DEFAULT_CITY;

const POPULAR_CITIES = [
    { name: "ראש העין", geonameid: "293690" },
    { name: "ירושלים", geonameid: "281184" },
    { name: "בני ברק", geonameid: "295514" },
    { name: "תל אביב", geonameid: "293397" },
    { name: "פתח תקווה", geonameid: "293918" },
    { name: "אלעד", geonameid: "8199300" },
    { name: "מודיעין עילית", geonameid: "8302060" },
    { name: "בית שמש", geonameid: "295548" },
    { name: "אשדוד", geonameid: "295629" },
    { name: "חיפה", geonameid: "294801" },
    { name: "באר שבע", geonameid: "295530" },
    { name: "נתניה", geonameid: "294071" }
];

export async function initZmanim() {
    const container = document.getElementById('zmanim-container');
    if (!container) return;
    renderWidgetStructure(container);
    await loadZmanimData();
    document.getElementById('change-city-btn').addEventListener('click', () => {
        document.getElementById('city-modal').classList.add('active');
    });
}

function renderWidgetStructure(container) {
    container.innerHTML = `
        <div class="zmanim-widget">
            <div class="zmanim-layout">
                <div class="current-date-box">
                    <span id="hebrew-date">טוען...</span>
                    <span id="parasha-name" class="parasha-tag"></span>
                </div>
                <div class="zmanim-grid" id="zmanim-times">
                    <div class="zman-item loading"></div>
                    <div class="zman-item loading"></div>
                    <div class="zman-item loading"></div>
                    <div class="zman-item loading"></div>
                </div>
                <div class="location-box">
                    <i class="fas fa-map-marker-alt"></i>
                    <span id="current-city-name">${currentCity.name}</span>
                    <button id="change-city-btn" title="החלף עיר"><i class="fas fa-cog"></i></button>
                </div>
            </div>
        </div>
        <div id="city-modal" class="city-modal">
            <div class="city-modal-content">
                <span class="city-close" onclick="document.getElementById('city-modal').classList.remove('active')">&times;</span>
                <h3>בחר עיר להצגת זמנים</h3>
                <div class="city-list">
                    ${POPULAR_CITIES.map(city =>
                        `<button class="city-option ${city.geonameid === currentCity.geonameid ? 'active' : ''}" 
                          data-id="${city.geonameid}" data-name="${city.name}">
                          ${city.name}
                        </button>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;

    document.querySelectorAll('.city-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newCity = { name: e.target.dataset.name, geonameid: e.target.dataset.id };
            currentCity = newCity;
            localStorage.setItem('zmanim_city', JSON.stringify(newCity));
            document.getElementById('current-city-name').textContent = newCity.name;
            document.getElementById('city-modal').classList.remove('active');
            loadZmanimData();
            document.querySelectorAll('.city-option').forEach(b => b.classList.toggle('active', b.dataset.id === newCity.geonameid));
        });
    });
}

async function loadZmanimData() {
    const timesContainer = document.getElementById('zmanim-times');
    const hebrewDateEl = document.getElementById('hebrew-date');
    const parashaEl = document.getElementById('parasha-name');

    try {
        const today = new Date().toISOString().split('T')[0];
        const cb = Date.now();
        
        // [תיקון קריטי] שימוש במחרוזת מקודדת כדי למנוע שיבושים של "צנזורה" או באגים בדפדפן
        // המחרוזת היא "https://www.hebcal.com/zmanim" מקודדת
        const zmanimBase = decodeURIComponent("https" + "%3A%2F%2Fwww" + ".hebcal.com%2Fzmanim");
        const zmanimUrl = zmanimBase + "?cfg=json&geonameid=" + currentCity.geonameid + "&date=" + today + "&v=" + cb;
        
        console.log("DEBUG: Final URL =", zmanimUrl);
        const response = await fetch(zmanimUrl);
        const data = await response.json();

        const converterBase = decodeURIComponent("https" + "%3A%2F%2Fwww" + ".hebcal.com%2Fconverter");
        const converterUrl = converterBase + "?cfg=json&date=" + today + "&g2h=1&strict=1&v=" + cb;
        const calendarResponse = await fetch(converterUrl);
        const calendarData = await calendarResponse.json();
        hebrewDateEl.textContent = calendarData.hebrew;
        
        const shabbatBase = decodeURIComponent("https" + "%3A%2F%2Fwww" + ".hebcal.com%2Fshabbat");
        const shabbatUrl = shabbatBase + "?cfg=json&geonameid=" + currentCity.geonameid + "&m=50&v=" + cb;
        const shabbatResponse = await fetch(shabbatUrl);
        const shabbatData = await shabbatResponse.json();
        const parashaItem = shabbatData.items.find(item => item.category === "parashat");
        if (parashaItem) parashaEl.textContent = parashaItem.hebrew;

        const times = data.times;
        const importantTimes = [
            { label: "עלות השחר", time: times.alotHaShachar },
            { label: "נץ החמה", time: times.sunrise },
            { label: "סוף זמן ק''ש", time: times.sofZmanShma },
            { label: "סוף זמן תפילה", time: times.sofZmanTfilla },
            { label: "חצות היום", time: times.chatzot },
            { label: "שקיעה", time: times.sunset },
            { label: "צאת הכוכבים", time: times.tzeit50min }
        ];

        timesContainer.innerHTML = importantTimes.map(item => `
            <div class="zman-item">
                <span class="zman-label">${item.label}</span>
                <span class="zman-time">${formatTime(item.time)}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error("Zmanim Error:", error);
        timesContainer.innerHTML = '<div class="error-msg">שגיאה בטעינת זמנים</div>';
    }
}

function formatTime(isoTime) {
    if (!isoTime) return "--:--";
    const date = new Date(isoTime);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}
