// utils.js
    // ---- פונקציית עזר לניקוי נתיבים ----
    export function cleanPath(path) {
        if (!path) return '';
        let p = String(path).trim();
        if (p.startsWith('- ')) p = p.slice(2).trim();
        p = p.replace(/^['"]|['"]$/g, '').trim();
        p = p.replace(/^(?:\.\/|\/)+/, '');
        try { p = decodeURIComponent(p); } catch (e) { /* silent */ }
        return p;
}
    // ---- פונקציה פשוטה לפירוק Front Matter ----
    export  function parseFrontMatter(content) {
        const match = /^---\s*([\s\S]+?)\s*---/.exec(content);
        if (!match) return { data: {}, content };

        const yamlText = match[1];
        const body = content.slice(match[0].length).trim();

        const data = {};
        let currentListKey = null;

        yamlText.trim().split('\n').forEach(line => {
            const keyValueMatch = line.match(/^([^:]+):(.*)/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim();
                const value = keyValueMatch[2].trim();
                if (value) {
                    data[key] = value.replace(/^['"]|['"]$/g, '');
                    currentListKey = null;
                } else {
                    data[key] = [];
                    currentListKey = key;
                }
            } else if (currentListKey && line.trim().startsWith('- ')) {
                const listItemMatch = line.match(/-\s*['"]?([^'"]+)['"]?$/);
                if (listItemMatch && listItemMatch[1]) {
                    data[currentListKey].push(listItemMatch[1].trim());
                }
            }
        });
        return { data, content: body };
}
    // ---- פונקציה לטעינת JSON סטטי ----
    export  async function fetchStaticJson(path) {
    const url = `./data/${path}.json`; // מצפה לקובץ בנתיב /data/news.json או /data/gallery.json
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Network response error for ${url}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching static JSON ${path}:`, error);
        return { error: true, message: 'אירעה שגיאה בטעינת הנתונים (JSON). נא לנסות שוב מאוחר יותר.' };
    }
}
    // פונקציות עזר לנעילת הפוקוס
    export function focusLock(modalElement, focusTarget = null) {
    const focusable = modalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (focusTarget) {
        focusTarget.focus();
    } else if (first) {
        first.focus();
    }

    modalElement.addEventListener('keydown', (e) => {
        const isTab = (e.key === 'Tab' || e.keyCode === 9);
        if (!isTab) return;

        if (e.shiftKey) { // Shift + Tab
            if (document.activeElement === first) {
                last.focus();
                e.preventDefault();
            }
        } else { // Tab
            if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
            }
        }
    });
}