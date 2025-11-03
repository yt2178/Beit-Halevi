   document.addEventListener('DOMContentLoaded', () => {
            // --- [שדרוג] קוד להפעלת כפתור "חזרה למעלה" ---
            let backToTopButton = document.getElementById("back-to-top-btn");

            window.onscroll = function() {
                scrollFunction();
            };

            function scrollFunction() {
                if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
                    backToTopButton.style.display = "block";
                } else {
                    backToTopButton.style.display = "none";
                }
            }

            backToTopButton.addEventListener("click", function() {
                window.scrollTo({top: 0, behavior: 'smooth'});
            });
            // --- סוף קוד הכפתור ---


            // --- קוד הגלריה ---
            const gridOverlay = document.getElementById('grid-overlay');
            const gridCloseBtn = document.getElementById('grid-close');
            const thumbnailGrid = document.getElementById('thumbnail-grid');
            const gridAlbumTitle = document.getElementById('grid-album-title');
            const lightbox = document.getElementById('lightbox');
            const lightboxImg = document.getElementById('lightbox-img');
            const closeBtn = lightbox.querySelector('.lightbox-close');
            const nextBtn = lightbox.querySelector('.lightbox-next');
            const prevBtn = lightbox.querySelector('.lightbox-prev');
            let currentAlbumImages = [];
            let currentIndex = 0;

            document.querySelectorAll('.album-cover').forEach(cover => {
                cover.addEventListener('click', () => {
                    const albumId = cover.dataset.album;
                    const albumContainer = document.getElementById(albumId);
                    const albumTitleText = cover.querySelector('.album-title').textContent;
                    if (albumContainer) {
                        thumbnailGrid.innerHTML = '';
                        gridAlbumTitle.textContent = albumTitleText;
                        currentAlbumImages = Array.from(albumContainer.querySelectorAll('img')).map(img => ({ src: img.src, alt: img.alt }));
                        currentAlbumImages.forEach((imgData, index) => {
                            const thumb = document.createElement('img');
                            thumb.src = imgData.src;
                            thumb.alt = imgData.alt;
                            thumb.dataset.index = index;
                            thumb.addEventListener('click', () => {
                                currentIndex = parseInt(thumb.dataset.index);
                                showLightboxImage();
                                gridOverlay.classList.remove('active');
                                lightbox.classList.add('active');
                            });
                            thumbnailGrid.appendChild(thumb);
                        });
                        gridOverlay.classList.add('active');
                    }
                });
            });

            function showLightboxImage() {
                if (currentAlbumImages.length === 0) return;
                lightboxImg.src = currentAlbumImages[currentIndex].src;
                lightboxImg.alt = currentAlbumImages[currentIndex].alt;
                prevBtn.style.display = (currentIndex === 0) ? 'none' : 'block';
                nextBtn.style.display = (currentIndex === currentAlbumImages.length - 1) ? 'none' : 'block';
            }
            function closeLightbox() { lightbox.classList.remove('active'); }
            function showNextImage() { if (currentIndex < currentAlbumImages.length - 1) { currentIndex++; showLightboxImage(); } }
            function showPrevImage() { if (currentIndex > 0) { currentIndex--; showLightboxImage(); } }
            closeBtn.addEventListener('click', closeLightbox);
            nextBtn.addEventListener('click', showNextImage);
            prevBtn.addEventListener('click', showPrevImage);
            lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
            gridCloseBtn.addEventListener('click', () => gridOverlay.classList.remove('active'));
            // --- סוף קוד הגלריה ---


            // --- קוד התאריך והשעה ---
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
            updateDateTime();
            setInterval(updateDateTime, 1000);
            // --- סוף קוד התאריך והשעה ---
        });
