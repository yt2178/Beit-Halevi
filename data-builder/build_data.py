# data-builder/build_data.py

import os
import json
import re

GALLERY_DIR = 'assets/gallery'
OUTPUT_FILE = 'data/gallery.json'

def create_slug(title):
    """יוצר slug מותאם ל-URL, מנקה תווי רווח ומיוחדים"""
    # מחליף רווחים במקפים
    slug = title.replace(' ', '-')
    # מנקה תווים שאינם עברית, אנגלית, מספרים או מקפים
    slug = re.sub(r'[^\u05D0-\u05EA\w-]', '', slug)
    return slug

def build_gallery_data():
    """סורק את תיקיית הגלריה ומייצר את מבנה הנתונים"""
    gallery_list = []
    
    # ודא שתיקיית הגלריה קיימת
    if not os.path.exists(GALLERY_DIR):
        print(f"Directory not found: {GALLERY_DIR}")
        return

    # סורק את תיקיות האלבומים (רמה אחת מתחת ל-GALLERY_DIR)
    for album_name in os.listdir(GALLERY_DIR):
        album_path = os.path.join(GALLERY_DIR, album_name)
        
        # אם זה לא תיקייה, דלג
        if not os.path.isdir(album_path):
            continue
            
        album_data = {
            "title": album_name,
            "slug": create_slug(album_name),
            "thumbnail": "",
            "images": []
        }
        
        # סורק את קבצי התמונות בתוך האלבום
        image_files = [f for f in os.listdir(album_path) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        for filename in sorted(image_files):
            file_path = os.path.join(album_path, filename).replace('\\', '/')

            if filename.lower().startswith('thumb.'):
                album_data['thumbnail'] = file_path
            else:
                album_data['images'].append(file_path)

        # רק אם יש תמונה ראשית ותמונות בפנים, שמור את האלבום
        if album_data['thumbnail'] and album_data['images']:
            gallery_list.append({"data": album_data, "content": ""})

    # כתיבה לקובץ JSON
    # ודא שתיקיית data קיימת
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        # json.dump הופך את המערך ל-JSON. indent=2 מוסיף כניסות יפות.
        json.dump(gallery_list, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully updated {OUTPUT_FILE} with {len(gallery_list)} albums.")

if __name__ == "__main__":
    build_gallery_data()
