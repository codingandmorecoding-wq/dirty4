// Production Configuration
const CONFIG = {
    PRODUCTION: true,
    API_BASE: 'https://dirty4-vercel-4l9gc8bsb-codingandmorecoding-wqs-projects.vercel.app/api',
    FALLBACK_PROXIES: [
        'https://api.allorigins.win/get?url=',
        'https://thingproxy.freeboard.io/fetch/',
        'https://cors.eu.org/',
        'https://proxy.cors.sh/',
        'https://corsproxy.io/?'
    ],
    VERSION: '1.0.0'
};

// Rule34 Mobile Downloader App
class Rule34MobileApp {
    constructor() {
        this.currentMode = 'browser'; // Start with browser mode (downloader hidden for web version)
        this.currentPage = 0;
        this.isDownloading = false;
        this.starredImages = this.loadStarredImages();
        this.currentImages = [];
        this.currentSearchQuery = '';

        this.init();
    }

    async fetchWithFallback(targetUrl) {
        // Try Vercel API first
        const primaryProxyUrl = `${CONFIG.API_BASE}/proxy-debug?url=${encodeURIComponent(targetUrl)}`;

        try {
            console.log(`Trying primary proxy: ${primaryProxyUrl}`);
            const response = await fetch(primaryProxyUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.contents) {
                    return data.contents;
                }
            }
        } catch (error) {
            console.warn('Primary proxy failed:', error.message);
        }

        // Try fallback proxies
        for (const proxyBase of CONFIG.FALLBACK_PROXIES) {
            try {
                const fallbackUrl = proxyBase + encodeURIComponent(targetUrl);
                console.log(`Trying fallback proxy: ${fallbackUrl}`);

                const response = await fetch(fallbackUrl);
                if (response.ok) {
                    // Try JSON first
                    try {
                        const data = await response.json();
                        // Handle different proxy response formats
                        if (data.contents) {
                            return data.contents; // allorigins format
                        } else if (typeof data === 'string') {
                            return data; // plain text response
                        } else if (data.body) {
                            return data.body; // some proxies use body field
                        }
                    } catch (jsonError) {
                        // If JSON parsing fails, try as text
                        const text = await response.text();
                        if (text && text.length > 0) {
                            return text;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Fallback proxy failed: ${proxyBase}`, error.message);
            }
        }

        throw new Error('All proxy services failed');
    }

    init() {
        this.setupEventListeners();
        this.loadGallery();
        this.setupAutocomplete();
    }

    setupEventListeners() {
        // Mode tabs
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const mode = tab.dataset.mode;
                this.switchMode(mode);
            });
        });

        // COMMENTED OUT FOR WEB VERSION - NEEDED FOR ANDROID APP ONLY
        // Downloader controls
        // document.getElementById('start-download').addEventListener('click', () => {
        //     this.startDownload();
        // });

        // Browser controls
        document.getElementById('browse-btn').addEventListener('click', () => {
            this.startBrowsing();
        });

        document.getElementById('browser-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startBrowsing();
            }
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.nextPage();
        });

        // Gallery controls
        document.getElementById('clear-stars').addEventListener('click', () => {
            this.clearStarredImages();
        });

        // Modal controls
        document.getElementById('modal-star').addEventListener('click', () => {
            this.toggleStarInModal();
        });

        document.getElementById('modal-download').addEventListener('click', () => {
            this.downloadFromModal();
        });

        // Close modal on background click
        document.getElementById('image-modal').addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                this.closeModal();
            }
        });
    }

    switchMode(mode) {
        // Update tab states
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Update view states
        document.querySelectorAll('.mode-view').forEach(view => {
            view.classList.toggle('active', view.id === `${mode}-view`);
        });

        this.currentMode = mode;

        // Load data for specific modes
        if (mode === 'gallery') {
            this.loadGallery();
        }
    }

    // === STARRED IMAGES MANAGEMENT ===
    loadStarredImages() {
        try {
            const stored = localStorage.getItem('rule34_starred_images');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading starred images:', error);
            return [];
        }
    }

    saveStarredImages() {
        try {
            localStorage.setItem('rule34_starred_images', JSON.stringify(this.starredImages));
        } catch (error) {
            console.error('Error saving starred images:', error);
        }
    }

    toggleStar(imageData) {
        const imageId = imageData.id;
        const existingIndex = this.starredImages.findIndex(img => img.id === imageId);

        if (existingIndex !== -1) {
            // Remove from starred
            this.starredImages.splice(existingIndex, 1);
            this.saveStarredImages();
            return false;
        } else {
            // Add to starred
            this.starredImages.push(imageData);
            this.saveStarredImages();
            return true;
        }
    }

    isStarred(imageId) {
        return this.starredImages.some(img => img.id === imageId);
    }

    clearStarredImages() {
        if (confirm('Are you sure you want to clear all starred images?')) {
            this.starredImages = [];
            this.saveStarredImages();
            this.loadGallery();
            this.showToast('All starred images cleared', 'warning');
        }
    }

    // === DOWNLOAD FUNCTIONALITY ===
    async startDownload() {
        const searchQuery = document.getElementById('search-query').value.trim();
        const searchType = document.querySelector('input[name="searchType"]:checked').value;
        const maxImages = parseInt(document.getElementById('max-images').value) || 0;

        if (!searchQuery) {
            this.showToast('Please enter a search query', 'error');
            return;
        }

        if (this.isDownloading) {
            this.showToast('Download already in progress', 'warning');
            return;
        }

        this.isDownloading = true;
        this.updateDownloadUI(true);
        this.clearLog();

        try {
            this.log(`Starting ${searchType} download for: ${searchQuery}`);
            this.log(`Max images: ${maxImages === 0 ? 'ALL' : maxImages}`);

            // Get image URLs
            const imageUrls = await this.getImageUrls(searchQuery, searchType, maxImages);

            if (imageUrls.length === 0) {
                this.log('No images found for the search query');
                this.showToast('No images found', 'warning');
                return;
            }

            this.log(`Found ${imageUrls.length} images to download`);

            // Start downloading
            await this.downloadImages(imageUrls, maxImages);

        } catch (error) {
            this.log(`Error: ${error.message}`);
            this.showToast('Download failed', 'error');
        } finally {
            this.isDownloading = false;
            this.updateDownloadUI(false);
        }
    }

    async getImageUrls(searchQuery, searchType, maxImages) {
        const imageUrls = [];
        let pageNum = 0;
        const postsPerPage = 42;

        try {
            while (maxImages === 0 || imageUrls.length < maxImages) {
                this.log(`Scraping page ${pageNum + 1}...`);
                this.updateProgress(imageUrls.length, maxImages, `Scraping page ${pageNum + 1}`);

                const targetUrl = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(searchQuery)}${pageNum > 0 ? `&pid=${pageNum * postsPerPage}` : ''}`;

                const htmlContent = await this.fetchWithFallback(targetUrl);

                if (!htmlContent) {
                    this.log('Failed to fetch page content');
                    break;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlContent, 'text/html');

                // Find post links
                const postLinks = doc.querySelectorAll('a[href*="page=post&s=view&id="]');

                if (postLinks.length === 0) {
                    this.log('No more posts found. Reached end of results.');
                    break;
                }

                this.log(`Found ${postLinks.length} posts on page ${pageNum + 1}`);

                // Extract image URLs from posts
                for (const link of postLinks) {
                    if (maxImages > 0 && imageUrls.length >= maxImages) {
                        break;
                    }

                    const href = link.getAttribute('href');
                    const postId = href.match(/id=(\d+)/)?.[1];

                    if (postId) {
                        // Try to construct direct image URL
                        const directUrls = [
                            `https://img.rule34.xxx/images/${postId}.jpg`,
                            `https://img.rule34.xxx/images/${postId}.png`,
                            `https://img.rule34.xxx/images/${postId}.gif`,
                            `https://img.rule34.xxx/images/${postId}.webp`,
                            `https://wimg.rule34.xxx/images/${postId}.jpg`,
                            `https://wimg.rule34.xxx/images/${postId}.png`,
                            `https://wimg.rule34.xxx/images/${postId}.gif`,
                            `https://wimg.rule34.xxx/images/${postId}.webp`
                        ];

                        // Add the first available URL
                        imageUrls.push({
                            id: postId,
                            directUrls: directUrls,
                            postUrl: `https://rule34.xxx/index.php${href}`
                        });
                    }
                }

                pageNum++;

                // Small delay between pages
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            this.log(`Error scraping: ${error.message}`);
        }

        return imageUrls;
    }

    async downloadImages(imageUrls, maxImages) {
        const imagesToDownload = maxImages === 0 ? imageUrls : imageUrls.slice(0, maxImages);
        let downloaded = 0;

        for (let i = 0; i < imagesToDownload.length; i++) {
            try {
                const imageData = imagesToDownload[i];
                this.updateProgress(i + 1, imagesToDownload.length, `Downloading image ${i + 1}`);

                // Try to download using direct URLs
                const success = await this.downloadSingleImage(imageData);

                if (success) {
                    downloaded++;
                    this.log(`Downloaded: image_${imageData.id}`);
                } else {
                    this.log(`Failed to download: image_${imageData.id}`);
                }

                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                this.log(`Error downloading image ${i + 1}: ${error.message}`);
            }
        }

        this.log(`Download completed. ${downloaded} images downloaded successfully.`);
        this.showToast(`Downloaded ${downloaded} images`, 'success');
        this.updateProgress(imagesToDownload.length, imagesToDownload.length, 'Download complete');
    }

    async downloadSingleImage(imageData) {
        try {
            console.log(`Downloading image from post: ${imageData.postUrl}`);

            // Get the real image URL by scraping the post page
            const postHtmlContent = await this.fetchWithFallback(imageData.postUrl);

            if (!postHtmlContent) {
                throw new Error('Failed to load post page for download');
            }

            // Parse the post page HTML
            const parser = new DOMParser();
            const postDoc = parser.parseFromString(postHtmlContent, 'text/html');

            // Find the main image URL
            let fullImageUrl = null;
            const selectors = [
                'img#image',
                '.content img',
                'img[src*="/images/"]',
                'img[onclick*="Note"]',
                'img[style*="max-width"]'
            ];

            for (const selector of selectors) {
                const element = postDoc.querySelector(selector);
                if (element) {
                    fullImageUrl = element.getAttribute('src') || element.getAttribute('data-src');
                    if (fullImageUrl) {
                        console.log(`Found download URL with selector "${selector}": ${fullImageUrl}`);
                        break;
                    }
                }
            }

            if (!fullImageUrl) {
                // Fallback: look for any large image
                const allImages = postDoc.querySelectorAll('img[src]');
                for (const img of allImages) {
                    const src = img.getAttribute('src');
                    if (src && !src.includes('thumbnail') && !src.includes('sample') &&
                        !src.includes('icon') && !src.includes('button') &&
                        (src.includes('/images/') || src.includes('rule34'))) {
                        fullImageUrl = src;
                        console.log(`Found fallback download URL: ${fullImageUrl}`);
                        break;
                    }
                }
            }

            if (fullImageUrl) {
                // Make URL absolute
                if (fullImageUrl.startsWith('//')) {
                    fullImageUrl = 'https:' + fullImageUrl;
                } else if (fullImageUrl.startsWith('/')) {
                    fullImageUrl = 'https://rule34.xxx' + fullImageUrl;
                } else if (!fullImageUrl.startsWith('http')) {
                    fullImageUrl = 'https://rule34.xxx/' + fullImageUrl;
                }

                console.log(`Triggering download for: ${fullImageUrl}`);

                // Create download link
                const link = document.createElement('a');
                link.href = fullImageUrl;
                link.download = `rule34_${imageData.id}${this.getFileExtension(fullImageUrl)}`;
                link.target = '_blank';
                link.rel = 'noopener';

                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                return true;
            } else {
                console.error('No downloadable image found on post page');
                return false;
            }

        } catch (error) {
            console.error('Error downloading image:', error);
            // Fallback to direct URL attempts
            for (const url of imageData.directUrls) {
                try {
                    console.log(`Trying fallback download: ${url}`);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `rule34_${imageData.id}${this.getFileExtension(url)}`;
                    link.target = '_blank';
                    link.rel = 'noopener';

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    return true;
                } catch (fallbackError) {
                    continue;
                }
            }
            return false;
        }
    }

    getFileExtension(url) {
        const match = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        return match ? match[0] : '.jpg';
    }

    // === BROWSER FUNCTIONALITY ===
    async startBrowsing() {
        const searchQuery = document.getElementById('browser-search').value.trim();

        if (!searchQuery) {
            this.showToast('Please enter a search query', 'error');
            return;
        }

        this.currentSearchQuery = searchQuery;
        this.currentPage = 0;
        await this.loadBrowserImages();
    }

    async loadBrowserImages() {
        const imageGrid = document.getElementById('image-grid');
        imageGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><div class="spinner"></div><p style="margin-top: 16px; color: var(--text-muted);">Loading images...</p></div>';

        try {
            console.log(`Loading browser images for query: "${this.currentSearchQuery}", page: ${this.currentPage}`);

            const imageData = await this.getBrowserImageData(this.currentSearchQuery, this.currentPage);
            this.currentImages = imageData;

            console.log(`Successfully loaded ${imageData.length} images`);

            this.displayBrowserImages(imageData);
            this.updatePagination();

        } catch (error) {
            console.error('Failed to load browser images:', error);
            this.showToast(`Failed to load images: ${error.message}`, 'error');
            imageGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 8px;">Failed to load images</h3>
                    <p style="margin-bottom: 16px;">Error: ${error.message}</p>
                    <button class="btn btn-primary" onclick="rule34App.loadBrowserImages()">
                        <i class="fas fa-retry"></i>
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    async getBrowserImageData(searchQuery, page) {
        console.log(`Searching for: ${searchQuery}, page: ${page}`);

        const postsPerPage = 42;
        const targetUrl = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(searchQuery)}${page > 0 ? `&pid=${page * postsPerPage}` : ''}`;

        console.log(`Target URL: ${targetUrl}`);

        const htmlContent = await this.fetchWithFallback(targetUrl);
        if (!htmlContent) {
            throw new Error('No HTML content in response');
        }

        console.log(`HTML content length: ${htmlContent.length}`);

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const imageDataList = [];

        // Debug: Log a sample of the HTML to see the structure
        const sampleHTML = htmlContent.substring(0, 2000);
        console.log('HTML sample:', sampleHTML);

        // Find thumbnail images and their links - try multiple selectors
        let thumbLinks = doc.querySelectorAll('a[href*="page=post&s=view&id="]');

        // Also try looking for preview images specifically
        if (thumbLinks.length === 0) {
            thumbLinks = doc.querySelectorAll('.preview a, a .preview, .thumb a, a .thumb, span[id^="s"] a');
        }

        console.log(`Found ${thumbLinks.length} thumbnail links`);

        // Debug: let's also check what we actually got in the HTML
        const allLinks = doc.querySelectorAll('a');
        console.log(`Total links found: ${allLinks.length}`);

        const allImages = doc.querySelectorAll('img');
        console.log(`Total images found: ${allImages.length}`);

        const previewImages = doc.querySelectorAll('.preview, .thumb, img[class*="preview"]');
        console.log(`Preview/thumb images found: ${previewImages.length}`);

        for (const link of thumbLinks) {
            const href = link.getAttribute('href');
            let img = link.querySelector('img');

            // If no img in link, check if link itself is an img or has preview class
            if (!img && link.classList.contains('preview')) {
                img = link;
            }

            // Try to find img in parent/sibling elements
            if (!img) {
                img = link.closest('span, div')?.querySelector('img') ||
                      link.parentElement?.querySelector('img');
            }

            if (href && img) {
                const postId = href.match(/id=(\d+)/)?.[1];
                let thumbUrl = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');

                if (postId && thumbUrl) {
                    // Clean up thumbnail URL
                    if (thumbUrl.startsWith('//')) {
                        thumbUrl = 'https:' + thumbUrl;
                    } else if (thumbUrl.startsWith('/') && !thumbUrl.includes('rule34.xxx')) {
                        thumbUrl = 'https://rule34.xxx' + thumbUrl;
                    }

                    // Filter out non-content images (merch, banners, UI elements)
                    const excludePatterns = [
                        'rule34_merch',
                        'r34chibi',
                        'mascot',
                        'banner',
                        'ad_',
                        'advertisement',
                        'sponsor',
                        'promo',
                        'logo',
                        'button',
                        'icon',
                        'ui_',
                        'navigation'
                    ];

                    const shouldExclude = excludePatterns.some(pattern =>
                        thumbUrl.toLowerCase().includes(pattern.toLowerCase())
                    );

                    if (shouldExclude) {
                        console.log(`Excluding non-content image: ${thumbUrl}`);
                        continue; // Skip this image
                    }

                    // Extract actual ID from thumbnail URL
                    let actualId = postId;
                    if (thumbUrl.includes('?')) {
                        actualId = thumbUrl.split('?').pop();
                    }

                    console.log(`Found image: ID=${postId}, ActualID=${actualId}, Thumb=${thumbUrl}`);

                    imageDataList.push({
                        id: postId,
                        actualId: actualId,
                        thumbnailUrl: thumbUrl,
                        postUrl: `https://rule34.xxx/index.php${href}`,
                        title: img.getAttribute('title') || img.getAttribute('alt') || `Image ${postId}`,
                        directUrls: [
                            `https://img.rule34.xxx/images/${actualId}.jpg`,
                            `https://img.rule34.xxx/images/${actualId}.png`,
                            `https://img.rule34.xxx/images/${actualId}.gif`,
                            `https://img.rule34.xxx/images/${actualId}.webp`,
                            `https://wimg.rule34.xxx/images/${actualId}.jpg`,
                            `https://wimg.rule34.xxx/images/${actualId}.png`,
                            `https://wimg.rule34.xxx/images/${actualId}.gif`,
                            `https://wimg.rule34.xxx/images/${actualId}.webp`
                        ]
                    });
                }
            }
        }

        console.log(`Parsed ${imageDataList.length} images`);
        return imageDataList;
    }

    displayBrowserImages(imageDataList) {
        const imageGrid = document.getElementById('image-grid');
        imageGrid.innerHTML = '';

        if (imageDataList.length === 0) {
            imageGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No images found for this search.</div>';
            return;
        }

        imageDataList.forEach((imageData, index) => {
            const imageCard = this.createImageCard(imageData, index);
            imageGrid.appendChild(imageCard);
        });

        // Show pagination
        document.getElementById('pagination').style.display = 'flex';
    }

    createImageCard(imageData, index = -1) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        loadingDiv.innerHTML = '<div class="spinner"></div>';

        const img = document.createElement('img');
        img.className = 'image-thumbnail';
        img.alt = imageData.title;
        img.style.display = 'none';

        img.onload = () => {
            loadingDiv.style.display = 'none';
            img.style.display = 'block';
            console.log(`Successfully loaded thumbnail: ${imageData.thumbnailUrl}`);
        };

        img.onerror = () => {
            console.error(`Failed to load thumbnail: ${imageData.thumbnailUrl}`);
            // Try alternative image proxy services
            const alternativeProxies = [
                `https://images.weserv.nl/?url=${encodeURIComponent(imageData.thumbnailUrl)}&w=200&h=200&fit=cover`,
                `https://wsrv.nl/?url=${encodeURIComponent(imageData.thumbnailUrl)}&w=200&h=200&fit=cover`,
                imageData.thumbnailUrl // Try direct URL as fallback
            ];

            let proxyIndex = 0;
            const tryNextProxy = () => {
                if (proxyIndex < alternativeProxies.length) {
                    console.log(`Trying alternative proxy ${proxyIndex + 1}: ${alternativeProxies[proxyIndex]}`);
                    img.src = alternativeProxies[proxyIndex];
                    proxyIndex++;
                } else {
                    loadingDiv.innerHTML = '<i class="fas fa-image" style="color: var(--text-muted); font-size: 24px;"></i><div style="margin-top: 8px; font-size: 12px;">Failed to load</div>';
                }
            };

            img.onerror = tryNextProxy;
            tryNextProxy();
        };

        img.onclick = () => this.showImagePreview(imageData, index);

        const actions = document.createElement('div');
        actions.className = 'image-actions';

        const starBtn = document.createElement('button');
        starBtn.className = `star-btn ${this.isStarred(imageData.id) ? 'starred' : ''}`;
        starBtn.innerHTML = this.isStarred(imageData.id) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
        starBtn.title = 'Toggle star';
        starBtn.onclick = (e) => {
            e.stopPropagation();
            const isNowStarred = this.toggleStar(imageData);
            starBtn.className = `star-btn ${isNowStarred ? 'starred' : ''}`;
            starBtn.innerHTML = isNowStarred ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            this.showToast(isNowStarred ? 'Image starred' : 'Star removed', 'success');
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-success btn-icon';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.title = 'Download image';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            this.downloadSingleImage(imageData);
            this.showToast('Download started', 'success');
        };

        actions.appendChild(starBtn);
        actions.appendChild(downloadBtn);

        card.appendChild(loadingDiv);
        card.appendChild(img);
        card.appendChild(actions);

        // Set image source to start loading
        img.src = imageData.thumbnailUrl;

        return card;
    }

    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.loadBrowserImages();
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadBrowserImages();
    }

    updatePagination() {
        document.getElementById('page-info').textContent = `Page ${this.currentPage + 1}`;
        document.getElementById('prev-page').disabled = this.currentPage === 0;
        // Note: We don't know if there are more pages until we try to load them
        document.getElementById('next-page').disabled = this.currentImages.length === 0;
    }

    // === GALLERY FUNCTIONALITY ===
    loadGallery() {
        const galleryGrid = document.getElementById('gallery-grid');
        const emptyGallery = document.getElementById('empty-gallery');

        galleryGrid.innerHTML = '';

        if (this.starredImages.length === 0) {
            emptyGallery.style.display = 'block';
            return;
        }

        emptyGallery.style.display = 'none';

        // Set current images for gallery navigation
        this.currentImages = this.starredImages;

        this.starredImages.forEach((imageData, index) => {
            const imageCard = this.createGalleryCard(imageData, index);
            galleryGrid.appendChild(imageCard);
        });
    }

    createGalleryCard(imageData, index = -1) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        loadingDiv.innerHTML = '<div class="spinner"></div>';

        const img = document.createElement('img');
        img.className = 'image-thumbnail';
        img.alt = imageData.title;
        img.style.display = 'none';

        img.onload = () => {
            loadingDiv.style.display = 'none';
            img.style.display = 'block';
        };

        img.onerror = () => {
            loadingDiv.innerHTML = '<i class="fas fa-image" style="color: var(--text-muted); font-size: 24px;"></i><div style="margin-top: 8px; font-size: 12px;">Failed to load</div>';
        };

        img.onclick = () => this.showImagePreview(imageData, index);

        const actions = document.createElement('div');
        actions.className = 'image-actions';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-warning btn-icon';
        removeBtn.innerHTML = '<i class="fas fa-star"></i>';
        removeBtn.title = 'Remove from gallery';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleStar(imageData);
            this.loadGallery();
            this.showToast('Removed from gallery', 'warning');
        };

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-success btn-icon';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.title = 'Download image';
        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            this.downloadSingleImage(imageData);
            this.showToast('Download started', 'success');
        };

        actions.appendChild(removeBtn);
        actions.appendChild(downloadBtn);

        card.appendChild(loadingDiv);
        card.appendChild(img);
        card.appendChild(actions);

        // Set image source
        img.src = imageData.thumbnailUrl;

        return card;
    }

    // === MODAL FUNCTIONALITY ===
    showImagePreview(imageData, imageIndex = null) {
        this.currentModalImage = imageData;

        // Set current image index for navigation
        if (imageIndex !== null) {
            this.currentModalImageIndex = imageIndex;
        } else {
            // Find index in current images array
            this.currentModalImageIndex = this.currentImages ? this.currentImages.findIndex(img => img.id === imageData.id) : -1;
        }

        const modal = document.getElementById('image-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalImage = document.getElementById('modal-image');
        const modalStar = document.getElementById('modal-star');

        modalTitle.innerHTML = `Image ID: ${imageData.id}`;
        modalImage.src = imageData.thumbnailUrl; // Start with thumbnail

        // Update star button
        const isStarred = this.isStarred(imageData.id);
        modalStar.className = `btn ${isStarred ? 'btn-warning' : 'btn-secondary'}`;
        modalStar.innerHTML = `<i class="fas fa-star"></i> ${isStarred ? 'Starred' : 'Star'}`;

        // Add navigation button event listeners first
        this.setupNavigationButtons();

        // Then update their state
        this.updateNavigationButtons();

        modal.classList.add('active');

        // Setup swipe detection
        this.setupSwipeNavigation();

        // Try to load full-size image
        this.loadFullSizeImage(imageData);
    }

    async loadFullSizeImage(imageData) {
        const modalImage = document.getElementById('modal-image');

        // Start with modal image hidden for fade-in effect
        modalImage.style.opacity = '0';
        modalImage.style.transition = 'opacity 0.3s ease-in-out';

        try {
            console.log(`Loading full-size image from post: ${imageData.postUrl}`);

            // Fetch the post page to get the real image URL
            const postHtmlContent = await this.fetchWithFallback(imageData.postUrl);

            if (!postHtmlContent) {
                throw new Error('Failed to load post page');
            }

            // Parse the post page HTML
            const parser = new DOMParser();
            const postDoc = parser.parseFromString(postHtmlContent, 'text/html');

            // Extract artist information from tags
            let artistName = null;

            // Try multiple selectors to find artist tags
            const artistSelectors = [
                '.tag-type-artist a',           // Direct artist tag links
                'a[href*="tags="][href*="artist"]', // Links with artist in href
                '.tag-type-artist',             // Artist tag containers
                'a[href*="&tags="][style*="color"]', // Colored artist links
                '.tag-container .artist a'     // Artist tags in tag containers
            ];

            for (const selector of artistSelectors) {
                const elements = postDoc.querySelectorAll(selector);
                if (elements.length > 0) {
                    const candidateName = elements[0].textContent?.trim();
                    if (candidateName && candidateName.length > 0) {
                        // Clean up the artist name - remove question marks and other unwanted characters
                        artistName = candidateName.replace(/^\?+/, '').trim();
                        console.log(`Found artist: "${artistName}" using selector: ${selector}`);
                        if (artistName.length > 0) {
                            break;
                        }
                    }
                }
            }

            // If no artist found with the above selectors, try looking in the tags list
            if (!artistName) {
                const allTagLinks = postDoc.querySelectorAll('a[href*="tags="]');
                for (const link of allTagLinks) {
                    const href = link.getAttribute('href');
                    const text = link.textContent?.trim();
                    // Check if this looks like an artist tag
                    if (href && text && text.length > 2) {
                        // Look for artist indicators in href or check if it's styled as an artist tag
                        const isArtistTag = href.includes('artist') ||
                                          href.includes('type%3Aartist') ||
                                          link.style.color === 'rgb(170, 170, 0)' || // Common artist tag color
                                          link.classList.contains('tag-type-artist');

                        if (isArtistTag) {
                            // Clean up the artist name
                            artistName = text.replace(/^\?+/, '').trim();
                            console.log(`Found artist via fallback: "${artistName}"`);
                            if (artistName.length > 0) {
                                break;
                            }
                        }
                    }
                }
            }

            // Update modal title with artist info if available
            const modalTitle = document.getElementById('modal-title');
            if (artistName) {
                modalTitle.innerHTML = `Image ID: ${imageData.id}<br><small style="color: #aaa; font-weight: normal;">Artist: ${artistName}</small>`;
            } else {
                modalTitle.innerHTML = `Image ID: ${imageData.id}`;
            }

            // Find the main image - try multiple selectors
            let fullImageUrl = null;
            const selectors = [
                'img#image',                    // Main image with ID
                '.content img',                 // Image in content area
                'img[src*="/images/"]',        // Images from images directory
                'img[onclick*="Note"]',        // Images with Note onclick
                'img[style*="max-width"]',     // Styled images
                '#gelcomVideoPlayer source',   // Video sources
                'video source'                  // Other video sources
            ];

            // Filter function to check if image should be excluded
            const shouldExcludeImage = (url) => {
                if (!url) return true;
                const excludePatterns = [
                    'rule34_merch',
                    'r34chibi',
                    'mascot',
                    'banner',
                    'ad_',
                    'advertisement',
                    'sponsor',
                    'promo',
                    'logo',
                    'button',
                    'icon',
                    'ui_',
                    'navigation'
                ];
                return excludePatterns.some(pattern =>
                    url.toLowerCase().includes(pattern.toLowerCase())
                );
            };

            for (const selector of selectors) {
                const elements = postDoc.querySelectorAll(selector); // Use querySelectorAll to get all matches
                for (const element of elements) {
                    const candidateUrl = element.getAttribute('src') || element.getAttribute('data-src');
                    if (candidateUrl && !shouldExcludeImage(candidateUrl)) {
                        fullImageUrl = candidateUrl;
                        console.log(`Found valid full image URL with selector "${selector}": ${fullImageUrl}`);
                        break;
                    } else if (candidateUrl) {
                        console.log(`Skipping excluded image: ${candidateUrl}`);
                    }
                }
                if (fullImageUrl) break; // Found a valid image, stop searching
            }

            if (!fullImageUrl) {
                // Fallback: look for any large image in the page
                const allImages = postDoc.querySelectorAll('img[src]');
                for (const img of allImages) {
                    const src = img.getAttribute('src');
                    // Skip thumbnails, samples, and use our exclusion filter
                    if (src && !src.includes('thumbnail') && !src.includes('sample') &&
                        !shouldExcludeImage(src) &&
                        (src.includes('/images/') || src.includes('rule34'))) {
                        fullImageUrl = src;
                        console.log(`Found fallback image URL: ${fullImageUrl}`);
                        break;
                    }
                }
            }


            if (fullImageUrl) {
                // Make URL absolute
                if (fullImageUrl.startsWith('//')) {
                    fullImageUrl = 'https:' + fullImageUrl;
                } else if (fullImageUrl.startsWith('/')) {
                    fullImageUrl = 'https://rule34.xxx' + fullImageUrl;
                } else if (!fullImageUrl.startsWith('http')) {
                    fullImageUrl = 'https://rule34.xxx/' + fullImageUrl;
                }

                console.log(`Loading full-size media: ${fullImageUrl}`);

                // Check if it's a video file
                const isVideo = /\.(mp4|webm|mov|avi|wmv)(\?.*)?$/i.test(fullImageUrl);

                if (isVideo) {
                    console.log(`Detected video file: ${fullImageUrl}`);

                    // Replace img element with loading element first
                    const modalImageWrapper = document.querySelector('.modal-image-wrapper');
                    const currentElement = document.getElementById('modal-image');

                    // Create video element with fade-in effect
                    const videoElement = document.createElement('video');
                    videoElement.id = 'modal-image';
                    videoElement.className = 'modal-image';
                    videoElement.controls = true;
                    videoElement.autoplay = true;
                    videoElement.loop = true;
                    videoElement.muted = true; // Start muted to allow autoplay

                    // Start hidden for fade-in effect
                    videoElement.style.opacity = '0';
                    videoElement.style.transition = 'opacity 0.3s ease-in-out';

                    // Replace current element with video
                    currentElement.replaceWith(videoElement);

                    // Try loading video through proxy directly (skip direct attempt to avoid CORS error)
                    const proxiedVideoUrl = `${CONFIG.API_BASE}/video-proxy?url=${encodeURIComponent(fullImageUrl)}`;

                    videoElement.onloadeddata = () => {
                        console.log(`Successfully loaded video through proxy: ${proxiedVideoUrl}`);
                        // Fade in the video when it's ready
                        videoElement.style.opacity = '1';
                    };

                    videoElement.onerror = () => {
                        console.error(`Failed to load video through proxy: ${proxiedVideoUrl}`);
                        // Show error message
                        const errorElement = this.createVideoErrorElement();
                        const currentLoading = document.getElementById('modal-image');
                        if (currentLoading) {
                            currentLoading.replaceWith(errorElement);
                            // Fade in the error element
                            setTimeout(() => {
                                errorElement.style.opacity = '1';
                            }, 50);
                        }
                    };

                    // Set source to start loading
                    videoElement.src = proxiedVideoUrl;

                } else {
                    // Handle as image
                    // Make sure we have an img element (in case previous was video)
                    const modalImageWrapper = document.querySelector('.modal-image-wrapper');
                    const currentElement = document.getElementById('modal-image');

                    if (currentElement.tagName.toLowerCase() === 'video') {
                        // Replace video with img element
                        const imgElement = document.createElement('img');
                        imgElement.id = 'modal-image';
                        imgElement.className = 'modal-image';
                        imgElement.alt = 'Preview';
                        currentElement.replaceWith(imgElement);
                        modalImage = imgElement; // Update reference
                    }

                    // Create new image element to test loading
                    const img = new Image();

                    // Add comprehensive event listeners for better GIF handling
                    img.addEventListener('loadstart', () => {
                        console.log('Image loading started');
                    });

                    img.addEventListener('progress', () => {
                        console.log('Image loading in progress');
                    });

                    img.onload = () => {
                        // Set the source and fade in when loaded
                        modalImage.src = fullImageUrl;
                        modalImage.onload = () => {
                            modalImage.style.opacity = '1';
                            console.log(`Modal image faded in: ${fullImageUrl}`);
                        };

                        console.log(`Successfully loaded test image: ${fullImageUrl}`);
                    };

                    img.onerror = () => {
                        console.error(`Failed to load image: ${fullImageUrl}`);
                        // Try using a proxy for the image
                        const proxyImageUrl = `https://images.weserv.nl/?url=${encodeURIComponent(fullImageUrl)}`;
                        console.log(`Trying proxied image: ${proxyImageUrl}`);

                        // Setup proxy image loading handlers
                        const proxyImg = new Image();
                        proxyImg.onload = () => {
                            // Set the source and fade in when loaded
                            modalImage.src = proxyImageUrl;
                            modalImage.onload = () => {
                                modalImage.style.opacity = '1';
                                console.log(`Modal proxied image faded in: ${proxyImageUrl}`);
                            };

                            console.log(`Successfully loaded proxied test image: ${proxyImageUrl}`);
                        };
                        proxyImg.onerror = () => {
                            modalImage.style.opacity = '1'; // Show anyway
                            console.error(`Failed to load proxied image: ${proxyImageUrl}`);
                        };
                        proxyImg.src = proxyImageUrl;
                    };

                    img.src = fullImageUrl;
                }
            } else {
                console.error('No full-size image found on post page');
                // Keep the thumbnail as fallback
            }

        } catch (error) {
            console.error('Error loading full-size image:', error);
            const modalImage = document.getElementById('modal-image');
            modalImage.style.opacity = '1'; // Show thumbnail anyway
            // Keep the thumbnail as fallback
        }
    }

    toggleStarInModal() {
        const imageData = this.currentModalImage;
        const modalStar = document.getElementById('modal-star');

        const isNowStarred = this.toggleStar(imageData);
        modalStar.className = `btn ${isNowStarred ? 'btn-warning' : 'btn-secondary'}`;
        modalStar.innerHTML = `<i class="fas fa-star"></i> ${isNowStarred ? 'Starred' : 'Star'}`;

        this.showToast(isNowStarred ? 'Image starred' : 'Star removed', 'success');

        // Refresh gallery if we're in gallery mode
        if (this.currentMode === 'gallery') {
            this.loadGallery();
        }
    }

    downloadFromModal() {
        this.downloadSingleImage(this.currentModalImage);
        this.showToast('Download started', 'success');
    }

    closeModal() {
        document.getElementById('image-modal').classList.remove('active');

        // Reset zoom state completely
        const modalContainer = document.querySelector('.modal-image-container');
        const modalWrapper = document.querySelector('.modal-image-wrapper');
        if (modalContainer && modalWrapper) {
            modalContainer.classList.remove('zoomed');
            modalWrapper.style.transform = 'translate(0px, 0px) scale(1)';
        }

        // IMPORTANT: Force replace video element with img element to clean up video handlers
        const currentElement = document.getElementById('modal-image');
        if (currentElement && currentElement.tagName.toLowerCase() === 'video') {
            const imgElement = document.createElement('img');
            imgElement.id = 'modal-image';
            imgElement.className = 'modal-image';
            imgElement.alt = 'Preview';
            imgElement.src = ''; // Empty src
            currentElement.replaceWith(imgElement);
        }

        // Reset zoom if resetZoom function exists
        if (this.resetZoom) {
            this.resetZoom();
        }

        this.currentModalImage = null;
        this.currentModalImageIndex = -1;
        this.cleanupSwipeListeners();
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('modal-prev');
        const nextBtn = document.getElementById('modal-next');

        if (!this.currentImages || this.currentModalImageIndex === -1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            return;
        }

        prevBtn.style.display = 'block';
        nextBtn.style.display = 'block';

        prevBtn.disabled = this.currentModalImageIndex <= 0;
        nextBtn.disabled = this.currentModalImageIndex >= this.currentImages.length - 1;
    }

    setupNavigationButtons() {
        const prevBtn = document.getElementById('modal-prev');
        const nextBtn = document.getElementById('modal-next');

        if (!prevBtn || !nextBtn) {
            console.error('Navigation buttons not found');
            return;
        }

        // Remove existing listeners by cloning
        const prevClone = prevBtn.cloneNode(true);
        const nextClone = nextBtn.cloneNode(true);

        // Replace in DOM
        prevBtn.parentNode.replaceChild(prevClone, prevBtn);
        nextBtn.parentNode.replaceChild(nextClone, nextBtn);

        // Add new event listeners for both click and touch
        const handlePrev = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showPreviousImage();
        };

        const handleNext = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showNextImage();
        };

        // Add both click and touchstart events for mobile compatibility
        prevClone.addEventListener('click', handlePrev);
        prevClone.addEventListener('touchstart', handlePrev);

        nextClone.addEventListener('click', handleNext);
        nextClone.addEventListener('touchstart', handleNext);
    }

    showPreviousImage() {
        if (!this.currentImages || this.currentModalImageIndex <= 0) return;

        // Reset zoom before changing image
        if (this.resetZoom) this.resetZoom();

        const prevIndex = this.currentModalImageIndex - 1;
        const prevImage = this.currentImages[prevIndex];
        this.showImagePreview(prevImage, prevIndex);
    }

    showNextImage() {
        if (!this.currentImages || this.currentModalImageIndex >= this.currentImages.length - 1) return;

        // Reset zoom before changing image
        if (this.resetZoom) this.resetZoom();

        const nextIndex = this.currentModalImageIndex + 1;
        const nextImage = this.currentImages[nextIndex];
        this.showImagePreview(nextImage, nextIndex);
    }

    setupSwipeNavigation() {
        const modalContainer = document.querySelector('.modal-image-container');
        const modalWrapper = document.querySelector('.modal-image-wrapper');
        const modal = document.getElementById('image-modal');

        // Clean up existing listeners first
        this.cleanupSwipeListeners();

        // Zoom and pan state
        let scale = 1;
        let translateX = 0;
        let translateY = 0;

        // Touch/drag state
        let isDragging = false;
        let isPinching = false;
        let startDistance = 0;
        let startScale = 1;
        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;
        let pinchCenter = { x: 0, y: 0 };
        let startTranslateX = 0;
        let startTranslateY = 0;

        const getDistance = (touches) => {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        const getCenter = (touches) => {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        };

        const getBounds = () => {
            const containerRect = modalContainer.getBoundingClientRect();
            const wrapperRect = modalWrapper.getBoundingClientRect();

            const scaledWidth = wrapperRect.width * scale;
            const scaledHeight = wrapperRect.height * scale;

            const maxTranslateX = Math.max(0, (scaledWidth - containerRect.width) / 2);
            const maxTranslateY = Math.max(0, (scaledHeight - containerRect.height) / 2);

            return { maxTranslateX, maxTranslateY };
        };

        const constrainTranslation = () => {
            const { maxTranslateX, maxTranslateY } = getBounds();

            translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
            translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
        };

        const applyTransform = () => {
            constrainTranslation();
            modalWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            modalContainer.classList.toggle('zoomed', scale > 1);
        };

        const resetZoom = () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
        };

        const handleTouchStart = (e) => {
            // Don't interfere with navigation button clicks
            if (e.target.closest('.modal-nav-btn')) {
                return;
            }

            // Don't interfere with video controls
            const videoElement = document.getElementById('modal-image');
            if (videoElement && videoElement.tagName.toLowerCase() === 'video') {
                // Check if touch is near the bottom where video controls are
                const videoRect = videoElement.getBoundingClientRect();
                const controlsHeight = 40; // Approximate height of video controls
                const touch = e.touches[0];
                if (touch.clientY > videoRect.bottom - controlsHeight) {
                    return; // Let video controls handle this
                }
            }

            e.preventDefault();
            e.stopPropagation();

            if (e.touches.length === 1) {
                // Single touch - start drag or swipe
                isDragging = true;
                startX = lastX = e.touches[0].clientX;
                startY = lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Two fingers - start pinch
                isPinching = true;
                isDragging = false;
                startDistance = getDistance(e.touches);
                startScale = scale;

                // Calculate pinch center relative to container
                const rect = modalContainer.getBoundingClientRect();
                const center = getCenter(e.touches);
                pinchCenter = {
                    x: center.x - rect.left - rect.width / 2,
                    y: center.y - rect.top - rect.height / 2
                };

                // Store current translation
                startTranslateX = translateX;
                startTranslateY = translateY;
            }
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isPinching && e.touches.length === 2) {
                // Handle pinch zoom
                const currentDistance = getDistance(e.touches);
                const newScale = (currentDistance / startDistance) * startScale;
                const oldScale = scale;
                scale = Math.min(Math.max(newScale, 0.5), 4); // Limit zoom between 0.5x and 4x

                // Zoom towards pinch center
                if (scale !== oldScale) {
                    const scaleChange = scale / startScale;
                    translateX = startTranslateX * scaleChange - pinchCenter.x * (scaleChange - 1);
                    translateY = startTranslateY * scaleChange - pinchCenter.y * (scaleChange - 1);
                }

                applyTransform();
            } else if (isDragging && e.touches.length === 1) {
                // Handle pan/swipe
                const currentX = e.touches[0].clientX;
                const currentY = e.touches[0].clientY;

                if (scale > 1) {
                    // Pan when zoomed
                    translateX += currentX - lastX;
                    translateY += currentY - lastY;
                    applyTransform();
                }

                lastX = currentX;
                lastY = currentY;
            }
        };

        const handleTouchEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isPinching) {
                isPinching = false;
            } else if (isDragging) {
                // Check for double-tap first
                handleDoubleTap(e);

                // Check for swipe gesture only if not zoomed
                if (scale <= 1.1) {
                    const deltaX = lastX - startX;
                    const deltaY = lastY - startY;
                    const threshold = 50;

                    // Only treat as swipe if moved significantly
                    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                        if (deltaX > 0) {
                            this.showPreviousImage();
                        } else {
                            this.showNextImage();
                        }
                    }
                }
                isDragging = false;
            }
        };

        const handleMouseDown = (e) => {
            if (e.target !== modalContainer && !modalContainer.contains(e.target)) return;

            // Don't interfere with navigation button clicks
            if (e.target.closest('.modal-nav-btn')) {
                return;
            }

            // Don't interfere with video controls
            const videoElement = document.getElementById('modal-image');
            if (videoElement && videoElement.tagName.toLowerCase() === 'video') {
                // Check if click is near the bottom where video controls are
                const videoRect = videoElement.getBoundingClientRect();
                const controlsHeight = 40; // Approximate height of video controls
                if (e.clientY > videoRect.bottom - controlsHeight) {
                    return; // Let video controls handle this
                }
            }

            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            startX = lastX = e.clientX;
            startY = lastY = e.clientY;
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            e.stopPropagation();

            const currentX = e.clientX;
            const currentY = e.clientY;

            if (scale > 1) {
                // Pan when zoomed
                translateX += currentX - lastX;
                translateY += currentY - lastY;
                applyTransform();
            }

            lastX = currentX;
            lastY = currentY;
        };

        const handleMouseUp = (e) => {
            if (!isDragging) return;

            // Check for swipe gesture only if not zoomed
            if (scale <= 1.1) {
                const deltaX = lastX - startX;
                const deltaY = lastY - startY;
                const threshold = 50;

                if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 0) {
                        this.showPreviousImage();
                    } else {
                        this.showNextImage();
                    }
                }
            }

            isDragging = false;
            e.stopPropagation();
        };

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = modalContainer.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Calculate zoom point relative to center
            const zoomPointX = e.clientX - rect.left - centerX;
            const zoomPointY = e.clientY - rect.top - centerY;

            const oldScale = scale;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.min(Math.max(scale * delta, 0.5), 4);

            // Adjust translation to zoom towards mouse position
            if (scale !== oldScale) {
                const scaleChange = scale / oldScale;
                translateX = translateX * scaleChange - zoomPointX * (scaleChange - 1);
                translateY = translateY * scaleChange - zoomPointY * (scaleChange - 1);
            }

            applyTransform();
        };

        let tapTimeout;
        let lastTap = 0;

        const handleDoubleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (scale > 1) {
                resetZoom();
            } else {
                // Zoom towards mouse position
                const rect = modalContainer.getBoundingClientRect();
                const mouseX = e.clientX - rect.left - rect.width / 2;
                const mouseY = e.clientY - rect.top - rect.height / 2;

                const oldScale = scale;
                scale = 2;
                const scaleChange = scale / oldScale;

                translateX = translateX * scaleChange - mouseX * (scaleChange - 1);
                translateY = translateY * scaleChange - mouseY * (scaleChange - 1);

                applyTransform();
            }
        };

        const handleDoubleTap = (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            if (tapLength < 500 && tapLength > 0) {
                e.preventDefault();
                e.stopPropagation();

                if (scale > 1) {
                    resetZoom();
                } else {
                    // Zoom towards tap position
                    const rect = modalContainer.getBoundingClientRect();
                    const tapX = e.changedTouches[0].clientX - rect.left - rect.width / 2;
                    const tapY = e.changedTouches[0].clientY - rect.top - rect.height / 2;

                    const oldScale = scale;
                    scale = 2;
                    const scaleChange = scale / oldScale;

                    translateX = translateX * scaleChange - tapX * (scaleChange - 1);
                    translateY = translateY * scaleChange - tapY * (scaleChange - 1);

                    applyTransform();
                }
            }
            lastTap = currentTime;
        };

        // Store handlers for cleanup
        this.zoomHandlers = {
            touchstart: handleTouchStart,
            touchmove: handleTouchMove,
            touchend: handleTouchEnd,
            mousedown: handleMouseDown,
            wheel: handleWheel,
            dblclick: handleDoubleClick,
            resetZoom
        };

        // Touch events
        modalContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        modalContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        modalContainer.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Mouse events
        modalContainer.addEventListener('mousedown', handleMouseDown);
        modalContainer.addEventListener('wheel', handleWheel, { passive: false });
        modalContainer.addEventListener('dblclick', handleDoubleClick);

        // Document mouse events
        const documentMouseMove = (e) => {
            if (isDragging) {
                handleMouseMove(e);
            }
        };

        const documentMouseUp = (e) => {
            if (isDragging) {
                handleMouseUp(e);
            }
        };

        document.addEventListener('mousemove', documentMouseMove);
        document.addEventListener('mouseup', documentMouseUp);

        // Store document handlers for cleanup
        this.documentHandlers = {
            mousemove: documentMouseMove,
            mouseup: documentMouseUp
        };

        // Keyboard navigation
        const handleKeydown = (e) => {
            if (modal.classList.contains('active')) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (scale <= 1.1) this.showPreviousImage();
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (scale <= 1.1) this.showNextImage();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeModal();
                } else if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    scale = Math.min(scale * 1.2, 4);
                    applyTransform();
                } else if (e.key === '-') {
                    e.preventDefault();
                    scale = Math.max(scale * 0.8, 0.5);
                    applyTransform();
                } else if (e.key === '0' || e.key === 'r') {
                    e.preventDefault();
                    resetZoom();
                }
            }
        };

        this.handleKeydown = handleKeydown;
        document.addEventListener('keydown', handleKeydown);

        // Reset zoom when image changes
        this.resetZoom = resetZoom;
    }

    cleanupSwipeListeners() {
        const modalContainer = document.querySelector('.modal-image-container');

        if (this.zoomHandlers) {
            modalContainer?.removeEventListener('touchstart', this.zoomHandlers.touchstart);
            modalContainer?.removeEventListener('touchmove', this.zoomHandlers.touchmove);
            modalContainer?.removeEventListener('touchend', this.zoomHandlers.touchend);
            modalContainer?.removeEventListener('mousedown', this.zoomHandlers.mousedown);
            modalContainer?.removeEventListener('wheel', this.zoomHandlers.wheel);
            modalContainer?.removeEventListener('dblclick', this.zoomHandlers.dblclick);
            this.zoomHandlers = null; // Clear the reference
        }

        if (this.documentHandlers) {
            document.removeEventListener('mousemove', this.documentHandlers.mousemove);
            document.removeEventListener('mouseup', this.documentHandlers.mouseup);
            this.documentHandlers = null; // Clear the reference
        }

        if (this.handleKeydown) {
            document.removeEventListener('keydown', this.handleKeydown);
            this.handleKeydown = null; // Clear the reference
        }

        // Clear resetZoom function reference
        this.resetZoom = null;
    }

    // === UI HELPERS ===
    showImageLoadingCat(modalImage) {
        // Create overlay with loading cat
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'image-loading-overlay';
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 999;
            border-radius: 12px;
        `;

        loadingOverlay.innerHTML = `
            <div class="cat-loading" style="
                font-size: 3rem;
                animation: bounce 1s infinite, rotate 2s linear infinite;
                margin-bottom: 16px;
                filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3));
            ">🐱</div>
            <div style="
                color: white;
                font-size: 1.1rem;
                text-align: center;
                font-weight: 500;
                text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
            ">Loading full-size image...</div>
        `;

        // Find the modal image wrapper and add overlay
        const modalWrapper = modalImage.parentElement;
        if (modalWrapper) {
            modalWrapper.style.position = 'relative';
            modalWrapper.appendChild(loadingOverlay);
        }

        // Store reference for removal
        modalImage.loadingOverlay = loadingOverlay;
    }

    hideImageLoadingCat(modalImage) {
        if (modalImage && modalImage.loadingOverlay) {
            modalImage.loadingOverlay.remove();
            modalImage.loadingOverlay = null;
        }

        // Clear timeout if it exists
        if (modalImage && modalImage.loadingTimeout) {
            clearTimeout(modalImage.loadingTimeout);
            modalImage.loadingTimeout = null;
        }
    }

    createVideoErrorElement() {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'modal-image';
        errorDiv.className = 'modal-image';
        errorDiv.style.display = 'flex';
        errorDiv.style.flexDirection = 'column';
        errorDiv.style.alignItems = 'center';
        errorDiv.style.justifyContent = 'center';
        errorDiv.style.minHeight = '200px';
        errorDiv.style.background = 'rgba(255, 255, 255, 0.05)';
        errorDiv.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.color = '#ff6b6b';

        // Add fade-in effect
        errorDiv.style.opacity = '0';
        errorDiv.style.transition = 'opacity 0.3s ease-in-out';
        errorDiv.innerHTML = `
            <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 16px; opacity: 0.7;"></i>
            <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Video Unavailable</div>
            <div style="font-size: 14px; opacity: 0.8; text-align: center; max-width: 300px;">
                This video cannot be loaded due to CORS restrictions or format issues.
            </div>
        `;
        return errorDiv;
    }

    updateDownloadUI(isDownloading) {
        const startBtn = document.getElementById('start-download');
        const progressContainer = document.getElementById('download-progress');
        const logContainer = document.getElementById('download-log');

        if (isDownloading) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<div class="spinner"></div> Downloading...';
            progressContainer.style.display = 'block';
            logContainer.style.display = 'block';
        } else {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> Start Download';
        }
    }

    updateProgress(current, total, message) {
        const progressText = document.getElementById('progress-text');
        const progressPercent = document.getElementById('progress-percent');
        const progressFill = document.getElementById('progress-fill');

        if (total > 0) {
            const percent = Math.round((current / total) * 100);
            progressPercent.textContent = `${percent}%`;
            progressFill.style.width = `${percent}%`;
        } else {
            progressPercent.textContent = '0%';
            progressFill.style.width = '0%';
        }

        progressText.textContent = message;
    }

    log(message) {
        const logText = document.getElementById('log-text');
        const timestamp = new Date().toLocaleTimeString();
        logText.textContent += `[${timestamp}] ${message}\n`;
        logText.scrollTop = logText.scrollHeight;
    }

    clearLog() {
        document.getElementById('log-text').textContent = '';
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';

        const icon = {
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle'
        }[type] || 'fas fa-info-circle';

        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <i class="${icon}" style="color: var(--text-primary);"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    // === AUTOCOMPLETE FUNCTIONALITY ===
    setupAutocomplete() {
        console.log('Setting up autocomplete...');
        this.setupAutocompleteInput('search-query', 'downloader-autocomplete');
        this.setupAutocompleteInput('browser-search', 'browser-autocomplete');
        console.log('Autocomplete setup complete');
    }

    setupAutocompleteInput(inputId, dropdownId) {
        console.log(`Setting up autocomplete for input: ${inputId}, dropdown: ${dropdownId}`);
        const input = document.getElementById(inputId);
        let dropdown = document.getElementById(dropdownId);

        if (!input) {
            console.error(`Missing input element: ${inputId}`);
            return;
        }

        // Remove existing dropdown if it exists
        if (dropdown) {
            dropdown.remove();
        }

        // Create new dropdown and append to body
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'autocomplete-dropdown-body';
        dropdown.style.cssText = `
            position: fixed !important;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            max-height: 200px;
            overflow-y: auto;
            z-index: 2147483647 !important;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            pointer-events: auto !important;
        `;
        document.body.appendChild(dropdown);

        let debounceTimeout;
        let selectedIndex = -1;
        let suggestions = [];

        const hideSuggestions = () => {
            dropdown.style.display = 'none';
            selectedIndex = -1;
        };

        const showSuggestions = () => {
            if (suggestions.length > 0) {
                console.log('Showing autocomplete dropdown for:', inputId);

                // Get input position for fixed positioning
                const rect = input.getBoundingClientRect();
                dropdown.style.left = rect.left + 'px';
                dropdown.style.top = (rect.bottom + 2) + 'px';
                dropdown.style.width = rect.width + 'px';
                dropdown.style.display = 'block';
            }
        };

        const updateSuggestions = (newSuggestions) => {
            suggestions = newSuggestions;
            dropdown.innerHTML = '';

            if (suggestions.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-no-results">No suggestions found</div>';
                showSuggestions();
                return;
            }

            suggestions.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'autocomplete-item';
                item.style.cssText = `
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    color: var(--text-primary);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                `;
                item.innerHTML = `
                    <span style="font-weight: 500;">${suggestion.name}</span>
                    <span style="font-size: 0.85em; color: var(--text-muted); margin-left: 8px;">(${suggestion.count})</span>
                `;

                item.addEventListener('mouseenter', () => {
                    item.style.background = 'rgba(102, 126, 234, 0.2)';
                });

                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });

                item.addEventListener('click', () => {
                    const currentValue = input.value;
                    const words = currentValue.split(/\s+/);

                    // Replace the last word with the selected suggestion
                    words[words.length - 1] = suggestion.name;
                    input.value = words.join(' ') + ' ';
                    input.focus();
                    hideSuggestions();
                });

                dropdown.appendChild(item);
            });

            showSuggestions();
        };

        const handleKeyNavigation = (e) => {
            if (dropdown.style.display === 'none') return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                    updateSelection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                        const suggestion = suggestions[selectedIndex];
                        const currentValue = input.value;
                        const words = currentValue.split(/\s+/);
                        words[words.length - 1] = suggestion.name;
                        input.value = words.join(' ') + ' ';
                        hideSuggestions();
                    }
                    break;
                case 'Escape':
                    hideSuggestions();
                    break;
            }
        };

        const updateSelection = () => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            items.forEach((item, index) => {
                item.classList.toggle('selected', index === selectedIndex);
            });
        };

        const fetchSuggestions = async (query) => {
            if (!query || query.length < 2) {
                hideSuggestions();
                return;
            }

            try {
                dropdown.innerHTML = '<div class="autocomplete-loading">Loading...</div>';
                showSuggestions();

                // Try to get real tags from Rule34 search results
                const searchUrl = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(query)}*`;
                const htmlContent = await this.fetchWithFallback(searchUrl);

                let extractedTags = [];

                if (htmlContent) {
                    // Parse HTML to extract tags from search results
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Extract tags from tag links and tag lists
                    const tagElements = doc.querySelectorAll('a[href*="tags="]');
                    const tagSet = new Set();

                    tagElements.forEach(element => {
                        const href = element.getAttribute('href');
                        if (href && href.includes('tags=')) {
                            const tagMatch = href.match(/tags=([^&]+)/);
                            if (tagMatch) {
                                const tag = decodeURIComponent(tagMatch[1]).toLowerCase();
                                if (tag.includes(query.toLowerCase()) && tag.length > 1) {
                                    tagSet.add(tag);
                                }
                            }
                        }
                    });

                    // Also check for tag spans and other tag containers
                    const tagSpans = doc.querySelectorAll('.tag, .tag-type-general, .tag-type-character, .tag-type-copyright, .tag-type-artist');
                    tagSpans.forEach(span => {
                        const tagText = span.textContent?.trim().toLowerCase();
                        if (tagText && tagText.includes(query.toLowerCase()) && tagText.length > 1) {
                            tagSet.add(tagText);
                        }
                    });

                    extractedTags = Array.from(tagSet)
                        .filter(tag => tag.includes(query.toLowerCase()))
                        .slice(0, 8)
                        .map(tag => ({
                            name: tag,
                            count: Math.floor(Math.random() * 5000) + 100 // Mock count for display
                        }));
                }

                // Fallback to static popular tags if no dynamic tags found
                if (extractedTags.length === 0) {
                    const popularTags = [
                        'ahri', 'jinx', 'lux', 'katarina', 'sona', 'miss_fortune', 'akali', 'riven',
                        'senna_(league_of_legends)', 'vi_(league_of_legends)', 'caitlyn_(league_of_legends)',
                        'ashe_(league_of_legends)', 'annie_(league_of_legends)', 'diana_(league_of_legends)',
                        'league_of_legends', 'pokemon', 'naruto', 'one_piece', 'attack_on_titan',
                        'my_hero_academia', 'demon_slayer', 'overwatch', 'genshin_impact',
                        'solo', 'nude', 'breasts', 'ass', 'thighs', 'blonde_hair', 'brown_hair',
                        'big_breasts', 'small_breasts', 'long_hair', 'short_hair', 'blue_eyes',
                        'sakimichan', 'personalami', 'cutesexyrobutts', 'dandon_fuga', 'neocoill'
                    ];

                    const queryLower = query.toLowerCase();
                    extractedTags = popularTags
                        .filter(tag => tag.includes(queryLower))
                        .slice(0, 8)
                        .map(tag => ({
                            name: tag,
                            count: Math.floor(Math.random() * 5000) + 100
                        }));
                }

                updateSuggestions(extractedTags);

            } catch (error) {
                console.error('Autocomplete error:', error);

                // Final fallback to static tags
                const popularTags = [
                    'ahri', 'jinx', 'lux', 'katarina', 'sona', 'miss_fortune', 'akali', 'riven',
                    'league_of_legends', 'pokemon', 'naruto', 'one_piece', 'overwatch', 'genshin_impact',
                    'solo', 'nude', 'breasts', 'ass', 'thighs', 'blonde_hair', 'brown_hair',
                    'sakimichan', 'personalami', 'cutesexyrobutts', 'dandon_fuga', 'neocoill'
                ];

                const queryLower = query.toLowerCase();
                const fallbackSuggestions = popularTags
                    .filter(tag => tag.includes(queryLower))
                    .slice(0, 8)
                    .map(tag => ({
                        name: tag,
                        count: Math.floor(Math.random() * 5000) + 100
                    }));

                if (fallbackSuggestions.length > 0) {
                    updateSuggestions(fallbackSuggestions);
                } else {
                    dropdown.innerHTML = '<div class="autocomplete-no-results">No suggestions found</div>';
                    showSuggestions();
                    setTimeout(hideSuggestions, 2000);
                }
            }
        };

        // Event listeners
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);

            const value = e.target.value;
            const words = value.split(/\s+/);
            const lastWord = words[words.length - 1];

            debounceTimeout = setTimeout(() => {
                fetchSuggestions(lastWord);
            }, 300);
        });

        input.addEventListener('keydown', handleKeyNavigation);

        input.addEventListener('focus', (e) => {
            const value = e.target.value;
            const words = value.split(/\s+/);
            const lastWord = words[words.length - 1];

            if (lastWord && lastWord.length >= 2) {
                fetchSuggestions(lastWord);
            }
        });

        input.addEventListener('blur', () => {
            // Delay hiding to allow click events on suggestions
            setTimeout(hideSuggestions, 150);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideSuggestions();
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.rule34App = new Rule34MobileApp();
});

// Global functions for modal and other interactions
function closeModal() {
    if (window.rule34App) {
        window.rule34App.closeModal();
    }
}

function showSettings() {
    // Settings functionality can be implemented here
    if (window.rule34App) {
        window.rule34App.showToast('Settings coming soon!', 'success');
    }
}

// === MONETIZATION FUNCTIONS ===
function closeBanner(bannerId) {
    const banner = document.getElementById(bannerId);
    if (banner) {
        banner.style.display = 'none';

        // Store banner closure in localStorage to remember user preference
        const closedBanners = JSON.parse(localStorage.getItem('closedBanners') || '{}');
        closedBanners[bannerId] = Date.now();
        localStorage.setItem('closedBanners', JSON.stringify(closedBanners));
    }
}

function initMonetization() {
    // Check for previously closed banners and hide them
    const closedBanners = JSON.parse(localStorage.getItem('closedBanners') || '{}');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    Object.keys(closedBanners).forEach(bannerId => {
        const closedTime = closedBanners[bannerId];

        // Show banner again after 24 hours
        if (closedTime > oneDayAgo) {
            const banner = document.getElementById(bannerId);
            if (banner) {
                banner.style.display = 'none';
            }
        } else {
            // Remove old entry
            delete closedBanners[bannerId];
        }
    });

    // Update localStorage with cleaned up data
    localStorage.setItem('closedBanners', JSON.stringify(closedBanners));

    // AdSense ads are automatically managed by Google
}

function rotateBannerAds() {
    const bannerRotations = [
        {
            id: 'top-banner',
            ads: [
                {
                    title: '🔒 Secure Your Privacy',
                    subtitle: 'Browse anonymously with NordVPN - 68% OFF',
                    cta: 'Get VPN',
                    link: 'https://nordvpn.com'
                },
                {
                    title: '🎮 Gaming Deals',
                    subtitle: 'Steam Gift Cards - Instant Delivery',
                    cta: 'Buy Now',
                    link: 'https://www.amazon.com/dp/B004RMK4BC'
                },
                {
                    title: '💻 Upgrade Your Setup',
                    subtitle: '144Hz Gaming Monitor - 27" 1440p',
                    cta: 'Shop Now',
                    link: 'https://amzn.to/your-affiliate-link'
                }
            ]
        },
        {
            id: 'gallery-banner',
            ads: [
                {
                    title: '💾 Need More Storage?',
                    subtitle: '1TB External SSD - Perfect for large collections',
                    cta: 'Shop Now',
                    link: 'https://amzn.to/your-affiliate-link'
                },
                {
                    title: '🖥️ High-Resolution Display',
                    subtitle: '4K Monitor for crystal clear image viewing',
                    cta: 'View Deals',
                    link: 'https://amzn.to/your-affiliate-link'
                },
                {
                    title: '🎧 Premium Audio',
                    subtitle: 'Wireless Headphones - Noise Cancelling',
                    cta: 'Listen Now',
                    link: 'https://amzn.to/your-affiliate-link'
                }
            ]
        }
    ];

    bannerRotations.forEach(rotation => {
        let currentIndex = 0;

        setInterval(() => {
            const banner = document.getElementById(rotation.id);
            if (!banner || banner.style.display === 'none') return;

            const ad = rotation.ads[currentIndex];
            const titleElement = banner.querySelector('.banner-ad-title');
            const subtitleElement = banner.querySelector('.banner-ad-subtitle');
            const ctaElement = banner.querySelector('.banner-ad-cta');

            if (titleElement) titleElement.textContent = ad.title;
            if (subtitleElement) subtitleElement.textContent = ad.subtitle;
            if (ctaElement) {
                ctaElement.textContent = ad.cta;
                ctaElement.href = ad.link;
            }

            currentIndex = (currentIndex + 1) % rotation.ads.length;
        }, 30000); // Rotate every 30 seconds
    });
}

// Initialize monetization when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure everything is loaded
    setTimeout(initMonetization, 1000);
});