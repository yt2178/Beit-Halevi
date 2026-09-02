import fs from 'fs';

const news = JSON.parse(fs.readFileSync('data/news.json', 'utf8'));
const gallery = JSON.parse(fs.readFileSync('data/gallery.json', 'utf8'));

function generateSlug(title, date) {
    const filename_slug = (title || '').replace(/\s/g, '-').replace(/[^a-zA-Z0-9\u05D0-\u05EA-]/gi, '');
    return `${date}-${filename_slug}`;
}

let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#about</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#zmanim</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#news</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#gallery</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;

news.forEach(item => {
    if (item.data && item.data.title && item.data.date) {
        const slug = encodeURIComponent(generateSlug(item.data.title, item.data.date));
        sitemap += `  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#news/${slug}</loc>
    <lastmod>${item.data.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }
});

gallery.forEach(item => {
    if (item.data && item.data.title) {
        const cleanTitle = encodeURIComponent(item.data.title.replace(/\s/g, '-').replace(/[^a-zA-Z0-9\u05D0-\u05EA-]/gi, ''));
        sitemap += `  <url>
    <loc>https://yt2178.github.io/Beit-Halevi/#gallery/${cleanTitle}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    }
});

sitemap += `</urlset>\n`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');
console.log('sitemap.xml regenerated successfully with', news.length, 'news and', gallery.length, 'gallery items.');
