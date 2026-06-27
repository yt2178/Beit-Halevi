# ישיבת בית הלוי - אתר רשמי 🏛️

**🌐 [לכניסה לאתר](https://yt2178.github.io/Beit-Halevi/)**

אתר אינטרנט מודרני, מהיר ורספונסיבי עבור **ישיבת "בית הלוי"** בראש העין, בראשותו של הגה״צ אבנר עפג׳ין שליט״א.

האתר נועד לספק עדכונים שוטפים, גלריות תמונות מאירועים, מידע על הישיבה ואפשרות ליצירת קשר ותרומה.

---

## ✨ פיצ׳רים עיקריים

### 🎨 ממשק משתמש (Frontend)
- **מהירות מקסימלית:** האתר בנוי ב-Vanilla JavaScript ללא Frameworks כבדים, מה שמבטיח טעינה כמעט מיידית.
- **עיצוב פרימיום:** שילוב צבעים יוקרתי (כחול עמוק וזהב), אנימציות עדינות ותמיכה מלאה במצב כהה (Dark Mode).
- **גלריה חכמה:** תמיכה במחוות מגע (Swipe) במובייל, תצוגה מקדימה וניווט מהיר בתמונות.
- **PWA (אפליקציה):** ניתן להתקנה כקיצור דרך במסך הבית של הטלפון ומתנהג כאפליקציה אמתית עם עבודה ללא אינטרנט.
- **נגישות מלאה:** תמיכה בניווט מקלדת, ARIA labels וקוראי מסך.
- **זמני היום:** תצוגה דינמית של זמני הקדיש (זמנים) לפי הלוח היהודי.
- **התראות:** קבלת עדכונים בזמן אמת על חדשות ואלבומים חדשים (OneSignal + fallback לNetive API).

### 🔐 מערכת ניהול (Admin Panel)
- **ניהול עצמאי:** הוספה, עריכה ומחיקה של ידיעות ואלבומי תמונות ללא צורך בידע טכני.
- **עורך תוכן (Markdown):** עריכת ידיעות עם תמיכה בעיצוב טקסט עשיר וקישורים.
- **דחיסת תמונות אוטומטית:** חיסכון בשטח אחסון ב-Google Drive באמצעות דחיסה והקטנת תמונות לפני ההעלאה.
- **עורך אתר (Site Editor):** שינוי טקסטים דינמיים, צבעים וקישורים (כמו דף תרומות) ישירות מהממשק.
- **מערכת משימות:** ניהול משימות פנימי פשוט ויעיל לצוות האתר.
- **אימות GitHub:** אבטחה מבוססת על GitHub API עם Decap CMS.

---

## 🛠️ טכנולוגיות

### Frontend
- **HTML5, CSS3, JavaScript (ES6+)**
- **ספריות:** marked.js (Markdown), DOMPurify (XSS protection), FontAwesome 6, OneSignal (Push)

### Backend (Serverless)
- **GitHub API:** משמש כמסד נתונים (Database) לשמירת הגדרות, משימות וידיעות.
- **Google Drive API:** משמש לאחסון והגשת תמונות בתבנית מוצמצמת.
- **Decap CMS:** ממשק ניהול עם GitHub auth.

### פריסה וCDN
- **GitHub Pages** להגשה מהירה של האתר.
- **Service Worker** לעבודה ללא אינטרנט וטעינה מהירה.

### בדיקות
- **Jest** + **jsdom** לבדיקות יחידה וטעינה של DOM.
- **benchmark.cjs** למדידת ביצועים.

---

## 📁 מבנה הפרויקט

```
📦 Beit-Halevi
├── 📄 index.html                 הדף הראשי (עברית RTL)
├── 📄 admin.html                 ממשק הניהול (admin panel)
├── 📜 main.js                    נקודת כניסה: ערכת נושא, זמנים, נווט
├── 📜 data-loader.js             טוען חדשות וגלריה מ-GitHub
├── 📜 gallery.js                 ממשק הגלריה: lightbox, swipe
├── 📜 news.js                    מודאל החדשות
├── 📜 zmanim.js                  זמני הקדיש (לוח יהודי)
├── 📜 utils.js                   פונקציות עזר (Hebrew dates, etc.)
├── 📜 admin.js                   ממשק ניהול - ראשי
├── 📜 admin-core.js              שירותים משותפים לניהול
├── 📜 admin-gallery.js           עריכה/דחיסה/העלאת תמונות
├── 📜 admin-site-editor.js       עריכת טקסט וצבעים דינמיים
├── 📜 admin-tasks.js             מערכת ניהול משימות
├── 📄 sw.js                      Service Worker (פעולה ללא אינטרנט)
├── 📄 manifest.json              PWA metadata
│
├── 🎨 CSS Files (Modular)
│   ├── style.css                 Entry point לכל ה-CSS
│   ├── base.css                  עיצוב בסיסי וצבעים
│   ├── layout.css                Grid ו-Flexbox
│   ├── responsive.css            Mobile-first (19KB)
│   ├── animations.css            אנימציות וטרנזיציות
│   ├── header.css, footer.css    Navigation ו-Footer
│   ├── gallery.css               סגנון גלריה ו-Lightbox
│   ├── news.css                  כרטיסי חדשות ומודאל
│   ├── admin.css                 ממשק ניהול
│   ├── components.css            כפתורים, טפסים, כרטיסיות
│   ├── contact.css               טופס יצירת קשר
│   ├── zmanim.css                זמני היום
│   └── notifications.css         UI התראות
│
├── 📂 data/                      אחסון JSON (משמש כ-DB)
│   ├── news.json                 הודעות חדשות
│   ├── gallery.json              אלבומים וקישורי תמונות
│   ├── site-config.json          הגדרות אתר (טקסט, צבעים, OneSignal ID)
│   ├── admin-tasks.json          רשימת משימות
│   ├── history.json              היסטוריית עריכות
│   └── deleted_messages.json     הודעות מחוקות
│
├── 📂 admin/                     מערכת Decap CMS
│   ├── config.yml                הגדרות Decap (GitHub auth)
│   └── index.html                עמוד טעינה של Decap
│
├── 📂 assets/                    קבצי מדיה
│   ├── icons/                    לוגו ואייקונים (PWA)
│   └── social-preview.png        תצוגה מקדימה לשיתוף
│
├── 📜 package.json               Dependencies (Jest, jsdom)
├── 📜 jest.config.js             הגדרות בדיקות
├── 📜 jest.setup.js              Setup לסביבת בדיקות
├── 📜 benchmark.cjs              מדידת ביצועים
├── 📄 _config.yml                Jekyll config (GitHub Pages)
├── 📄 robots.txt                 SEO directives
├── 📄 sitemap.xml                מפת אתר
└── 📄 .gitignore                 קבצים להתעלם מהם
```

---

## 🚀 התחלה מהירה

### עבור מפתחים

```bash
# הקצאת dependencies
npm install

# הרצת בדיקות
npm test

# מדידת ביצועים
node benchmark.cjs
```

### פריסה
האתר מנוהל ב-GitHub Pages באופן אוטומטי:
- **דחיפה ל-main** ➜ האתר מתעדכן בעצמו.
- **אין צורך ב-build process** — הקבצים מוגשים ישירות.

---

## 👤 שימוש לניהלים

### גישה לפאנל הניהול
1. פתח את [https://yt2178.github.io/Beit-Halevi/admin.html](https://yt2178.github.io/Beit-Halevi/admin.html)
2. התחבר ב-GitHub (דרך Decap CMS)
3. התחל להעלות תמונות וחדשות

### הוספת חדשה
- גש לסעיף "חדשות" בפאנל
- כתוב תוכן בעברית עם Markdown format
- פרסם! — התראות יישלחו לרשומים.

### העלאת אלבום
- גש לסעיף "גלריה"
- העלה תמונות (דחיסה אוטומטית ל-Google Drive)
- בחר תמונת עטיפה
- שמור — האלבום יופיע לכל הגולשים.

---

## 🔔 התראות (Push Notifications)

האתר תומך בשתי שיטות:
1. **OneSignal** (אם מוגדר ב-`data/site-config.json`):
   - התראות עצמאיות באמצעות OneSignal dashboard
   - סיווג מינויים לפי סוג (חדשות / עדכונים)

2. **Fallback ל-Notifications API**:
   - אם OneSignal לא זמין, האתר משתמש ב-Notification API המקומית של הדפדפן

---

## ⚙️ הגדרות מותאמות

בקובץ `data/site-config.json` אפשר לשנות:
- **טקסטים** (כותרות, תיאורים)
- **צבעים** (primary color)
- **OneSignal App ID** (להתראות)
- **קישורים** (דף תרומות, וכו׳)

דוגמה:
```json
{
  "oneSignalAppId": "YOUR_APP_ID",
  "primaryColor": "#1a3a52",
  "theme": "light",
  "texts": {
    "about_title": "אודות הישיבה",
    "about_body": "ישיבת בית הלוי...",
    "donation_title": "היו שותפים",
    "donation_body": "כל תרומה חשובה..."
  }
}
```

---

## 📊 בדיקות וביצועים

```bash
# הרץ את כל הבדיקות
npm test

# בדיקה של קבצים ספציפיים
npm test -- data-loader.test.js
npm test -- gallery.test.js

# מדידת ביצועים (Benchmark)
node benchmark.cjs
```

---

## ♿ נגישות

- ✅ ניווט מקלדת מלא (Tab, Enter, Escape)
- ✅ ARIA labels על כל הכפתורים
- ✅ עברית RTL תמיכה מלאה
- ✅ יחסי קונטרסט WCAG AA
- ✅ תמונות עם alt text
- ✅ קוראי מסך תואמים

---

## 🔒 אבטחה

- **XSS Protection:** DOMPurify לטקסט משתמש
- **CORS Policy:** GitHub Pages + Google Drive API
- **Honeypot:** הגנה מ-spam בטופס יצירת קשר
- **GitHub Auth:** אבטחה מבוססת GitHub tokens

---

## 📱 PWA (Progressive Web App)

- ✅ הותקנו כ"קיצור דרך" במסך הבית
- ✅ עבודה ללא אינטרנט (Offline-first)
- ✅ ממשק ידידותי להתקנה
- ✅ Update badge על אייקון האפליקציה

---

## 🌐 SEO ו-Meta Tags

- Schema.org markup (ReligiousOrganization)
- Open Graph + Twitter Card support
- Sitemap ו-Robots.txt
- Google Site Verification

---

## 💡 עצות פיתוח

### הוספת תכונה חדשה
1. צור branch: `git checkout -b feature/name`
2. שנה את הקבצים המתאימים
3. בדוק בעזרת: `npm test`
4. דחוף ל-main להפעלה

### דיבוג
- וקנסול ה-Browser (F12) להערות לוג
- Service Worker Devtools לטעינה מהמטמון
- Decap CMS dashboard לתוכן

---

## 📞 יצירת קשר וסיוע

- **טלפון:** 054-8500-158
- **כתובת:** רחוב חפץ חיים 6, ראש העין
- **טופס contact:** בעמוד הראשי

---

## 📄 רישיון

ISC License — פותח עבור ישיבת בית הלוי בראש העין.

**פותח ע״י The Creator YT עבור ישיבת בית הלוי.**

🔐 **[כניסה לפאנל ניהול](https://yt2178.github.io/Beit-Halevi/admin.html)**

---

בס״ד — בעזרת ה׳ יתברך
