import { fetchStaticJson } from './utils.js';

// הגדרות ברירת מחדל - ראש העין
const DEFAULT_CITY = {
    name: "ראש העין",
    geonameid: "293690"
};

let currentCity = JSON.parse(localStorage.getItem('zmanim_city')) || DEFAULT_CITY;

// רשימת ערים פופולריות לבחירה מהירה
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

    // האזנה לשינוי עיר
    document.getElementById('change-city-btn').addEventListener('click', openCityModal);
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
        
        <!-- מודאל בחירת עיר -->
        <div id="city-modal" class="city-modal">
            <div class="city-modal-content">
                <span class="city-close">&times;</span>
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

    // סגירת מודאל
    document.querySelector('.city-close').addEventListener('click', () => {
        document.getElementById('city-modal').classList.remove('active');
    });

    // בחירת עיר
    document.querySelectorAll('.city-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newCity = {
                name: e.target.dataset.name,
                geonameid: e.target.dataset.id
            };
            saveCity(newCity);
        });
    });
}

async function loadZmanimData() {
    const timesContainer = document.getElementById('zmanim-times');
    const hebrewDateEl = document.getElementById('hebrew-date');
    const parashaEl = document.getElementById('parasha-name');

    try {
        const today = new Date().toISOString().split('T')[0];
        
        // [שיפור] שימוש באובייקט URL כדי להבטיח נתיב אבסולוטי ומניעת שגיאות 404 מוזרות
        const zmanimUrl = new URL('https://www.hebcal.com/zmanim');
        zmanimUrl.searchParams.set('cfg', 'json');
        zmanimUrl.searchParams.set('geonameid', currentCity.geonameid);
        zmanimUrl.searchParams.set('date', today);
        zmanimUrl.searchParams.set('v', Date.now()); // [בונוס] מניעת מטמון (Cache Busting)
        
        const response = await fetch(zmanimUrl.toString());
        const data = await response.json();

        const calendarUrl = new URL('https://www.hebcal.com/converter');
        calendarUrl.searchParams.set('cfg', 'json');
        calendarUrl.searchParams.set('date', today);
        calendarUrl.searchParams.set('g2h', '1');
        calendarUrl.searchParams.set('strict', '1');
        
        const calendarResponse = await fetch(calendarUrl.toString());
        const calendarData = await calendarResponse.json();

        // עדכון תאריך ופרשה
        hebrewDateEl.textContent = calendarData.hebrew;
        
        const shabbatUrl = new URL('https://www.hebcal.com/shabbat');
        shabbatUrl.searchParams.set('cfg', 'json');
        shabbatUrl.searchParams.set('geonameid', currentCity.geonameid);
        shabbatUrl.searchParams.set('m', '50');
        
        const shabbatResponse = await fetch(shabbatUrl.toString());
        const shabbatData = await shabbatResponse.json();
        const parashaItem = shabbatData.items.find(item => item.category === "parashat");
        if (parashaItem) {
            parashaEl.textContent = parashaItem.hebrew;
        }

        // עיבוד זמנים חשובים
        const times = data.times;
        const importantTimes = [
            { label: "עלות השחר", time: times.alotHaShachar },
            { label: "נץ החמה", time: times.sunrise },
            { label: "סוף זמן ק''ש (גר''א)", time: times.sofZmanShma },
            { label: "סוף זמן תפילה (גר''א)", time: times.sofZmanTfilla },
            { label: "חצות היום", time: times.chatzot },
            { label: "שקיעה", time: times.sunset },
            { label: "צאת הכוכבים", time: times.tzeit50min } // לפי שיטת הישיבה (בדרך כלל 50 דקות או דומה)
        ];

        timesContainer.innerHTML = importantTimes.map(item => `
            <div class="zman-item">
                <span class="zman-label">${item.label}</span>
                <span class="zman-time">${formatTime(item.time)}</span>
            </div>
        `).join('');

    } catch (error) {
        timesContainer.innerHTML = `
            <div class="error-msg" style="grid-column: 1/-1; text-align: center; padding: 20px;">
                <i class="fas fa-exclamation-circle"></i> 
                אירעה שגיאה בטעינת הזמנים. 
                <button onclick="location.reload()" style="background: none; border: underline; color: var(--primary-color); cursor: pointer;">נסה שוב</button>
            </div>`;
    }
}

function formatTime(isoTime) {
    if (!isoTime) return "--:--";
    const date = new Date(isoTime);
    return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function openCityModal() {
    document.getElementById('city-modal').classList.add('active');
}

function saveCity(city) {
    currentCity = city;
    localStorage.setItem('zmanim_city', JSON.stringify(city));

    // עדכון UI
    document.getElementById('current-city-name').textContent = city.name;
    document.getElementById('city-modal').classList.remove('active');

    // טעינה מחדש של הנתונים
    loadZmanimData();

    // עדכון מחלקת active ברשימה
    document.querySelectorAll('.city-option').forEach(btn => {
        if (btn.dataset.id === city.geonameid) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}
