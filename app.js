// Production Configuration
const CONFIG = {
    PRODUCTION: true,
    API_BASE: 'https://dirty4-vercel-b18y66uhz-codingandmorecoding-wqs-projects.vercel.app/api',
    FALLBACK_PROXIES: [
        'https://api.allorigins.win/get?url=',
        'https://thingproxy.freeboard.io/fetch/',
        'https://cors.eu.org/',
        'https://proxy.cors.sh/',
        'https://corsproxy.io/?'
    ],
    SITES: {
        RULE34: {
            name: 'Rule34.xxx',
            id: 'rule34',
            baseUrl: 'https://rule34.xxx',
            requiresProxy: true,
            description: 'Original Rule34 content'
        },
        DANBOORU: {
            name: 'Danbooru',
            id: 'danbooru',
            baseUrl: 'https://danbooru.donmai.us',
            requiresProxy: false,
            description: 'High-quality anime artwork'
        }
    },
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
        // currentSite removed - now uses automatic multiple sources

        this.init();
    }

    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal
                // Removed User-Agent header to avoid CORS issues
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async fetchWithFallback(targetUrl, fastMode = false) {
        const timeout = fastMode ? 5000 : 10000; // Faster timeout for fast mode
        const maxDelay = fastMode ? 500 : 2000; // Shorter delays for fast mode

        // Try Vercel API first
        const primaryProxyUrl = `${CONFIG.API_BASE}/proxy-debug?url=${encodeURIComponent(targetUrl)}`;

        try {
            console.log(`Trying primary proxy: ${primaryProxyUrl}`);
            const response = await this.fetchWithTimeout(primaryProxyUrl, timeout);
            if (response.ok) {
                const data = await response.json();
                if (data.contents) {
                    return data.contents;
                }
            }
        } catch (error) {
            console.warn('Primary proxy failed:', error.message);
        }

        // In fast mode, only try first fallback proxy
        const fallbackLimit = fastMode ? 1 : CONFIG.FALLBACK_PROXIES.length;

        // Try fallback proxies with shorter delays
        for (let i = 0; i < fallbackLimit; i++) {
            const proxyBase = CONFIG.FALLBACK_PROXIES[i];
            try {
                // Add shorter delay between fallback attempts
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, maxDelay));
                }

                const fallbackUrl = proxyBase + encodeURIComponent(targetUrl);
                console.log(`Trying fallback proxy: ${fallbackUrl}`);

                const response = await this.fetchWithTimeout(fallbackUrl, timeout);
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

    async fetchDanbooruData(searchQuery, page) {
        console.log(`fetchDanbooruData called - Searching for: "${searchQuery}", page: ${page}`);

        const limit = 42; // Match Rule34's posts per page
        // Try without page parameter first, then try different API endpoints
        const targetUrls = [
            `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(searchQuery)}&limit=${limit}`,
            `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(searchQuery)}&limit=${limit}&page=${page + 1}`,
            `https://danbooru.donmai.us/posts.json?q=${encodeURIComponent(searchQuery)}&limit=${limit}`
        ];

        // Try multiple Danbooru API endpoints
        for (const [index, targetUrl] of targetUrls.entries()) {
            console.log(`Trying Danbooru URL ${index + 1}: ${targetUrl}`);

            try {
                // Try direct fetch first with timeout
                const response = await this.fetchWithTimeout(targetUrl, 8000);
                if (response.ok) {
                    const jsonData = await response.json();
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        console.log(`Success with Danbooru URL ${index + 1}`);
                        return this.processDanbooruData(jsonData);
                    }
                }
            } catch (error) {
                console.warn(`Direct Danbooru fetch failed for URL ${index + 1}:`, error.message);
            }
        }

        // Fallback to proxy if direct fetch fails (try first URL only)
        try {
            console.log('Trying Danbooru via proxy...');
            const jsonContent = await this.fetchWithFallback(targetUrls[0], true);
            if (jsonContent) {
                // Check if we got HTML instead of JSON
                if (jsonContent.trim().startsWith('<')) {
                    console.warn('Got HTML response instead of JSON from Danbooru proxy');
                    throw new Error('Proxy returned HTML instead of JSON');
                }

                try {
                    const jsonData = JSON.parse(jsonContent);
                    if (Array.isArray(jsonData)) {
                        return this.processDanbooruData(jsonData);
                    } else {
                        console.warn('Danbooru response is not an array:', jsonData);
                        throw new Error('Invalid Danbooru response format');
                    }
                } catch (parseError) {
                    console.error('Failed to parse Danbooru JSON:', parseError);
                    console.log('Response content (first 200 chars):', jsonContent.substring(0, 200));
                    throw parseError;
                }
            }
        } catch (error) {
            console.error('Proxy Danbooru fetch failed:', error);
        }

        // Temporary fallback with sample data to test functionality
        console.log('All Danbooru methods failed, using sample data for testing');
        return this.processDanbooruData([
            {
                id: 999001,
                preview_file_url: "https://cdn.donmai.us/preview/d3/4f/d34f05d0d1006c1ab7fb27ea0b13b5de.jpg",
                file_url: "https://cdn.donmai.us/original/d3/4f/d34f05d0d1006c1ab7fb27ea0b13b5de.jpg",
                large_file_url: "https://cdn.donmai.us/original/d3/4f/d34f05d0d1006c1ab7fb27ea0b13b5de.jpg",
                image_width: 800,
                image_height: 1200,
                file_size: 500000,
                file_ext: "jpg",
                rating: "s",
                score: 100,
                fav_count: 50,
                source: "https://example.com",
                created_at: "2024-01-01T00:00:00.000Z",
                tag_string_artist: "artist_example test_artist",
                tag_string_character: "ahri",
                tag_string_copyright: "league_of_legends",
                tag_string_general: "1girl fox_ears"
            }
        ]);
    }

    processDanbooruData(jsonData) {
        console.log(`Processing ${jsonData.length} Danbooru posts`);

        const imageDataList = [];

        for (const post of jsonData) {
            if (post.id && post.preview_file_url && post.file_url) {
                const imageData = {
                    id: post.id.toString(),
                    thumbUrl: post.preview_file_url,
                    fullUrl: post.file_url,
                    largeUrl: post.large_file_url || post.file_url,
                    width: post.image_width,
                    height: post.image_height,
                    fileSize: post.file_size,
                    fileExt: post.file_ext,
                    rating: post.rating,
                    score: post.score,
                    favCount: post.fav_count,
                    source: post.source,
                    createdAt: post.created_at,
                    artists: post.tag_string_artist ? post.tag_string_artist.split(' ') : [],
                    characters: post.tag_string_character ? post.tag_string_character.split(' ') : [],
                    copyright: post.tag_string_copyright ? post.tag_string_copyright.split(' ') : [],
                    generalTags: post.tag_string_general ? post.tag_string_general.split(' ') : [],
                    site: 'danbooru'
                };

                // Ensure URLs are absolute
                if (imageData.thumbUrl && imageData.thumbUrl.startsWith('//')) {
                    imageData.thumbUrl = 'https:' + imageData.thumbUrl;
                }
                if (imageData.fullUrl && imageData.fullUrl.startsWith('//')) {
                    imageData.fullUrl = 'https:' + imageData.fullUrl;
                }
                if (imageData.largeUrl && imageData.largeUrl.startsWith('//')) {
                    imageData.largeUrl = 'https:' + imageData.largeUrl;
                }

                imageDataList.push(imageData);
            }
        }

        return imageDataList;
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

        // Site switcher removed - now uses automatic multiple sources

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

    // switchSite method removed - now uses automatic multiple sources

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
            console.log('Starring image with data:', imageData.id, 'thumbUrl:', imageData.thumbUrl, 'thumbnailUrl:', imageData.thumbnailUrl);
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
            // For Danbooru images, we already have the full image URL
            // For historical archive images, we already have the full image URL
            if (imageData.source === 'historical') {
                console.log(`Downloading historical archive image: ${imageData.id}`);

                const imageUrl = imageData.file_url || imageData.large_file_url;
                const fileName = `historical_${imageData.id}.${imageUrl.split('.').pop()}`;

                // Create download link
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = fileName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                return true;
            }

            if (imageData.site === 'danbooru') {
                console.log(`Downloading Danbooru image: ${imageData.fullUrl}`);

                const imageUrl = imageData.fullUrl || imageData.largeUrl;
                const fileName = `danbooru_${imageData.id}.${imageData.fileExt || 'jpg'}`;

                // Create download link
                const link = document.createElement('a');
                link.href = imageUrl;
                link.download = fileName;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                return true;
            }

            console.log(`Downloading image from post: ${imageData.postUrl}`);

            // For Rule34, get the real image URL by scraping the post page
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
        console.log(`startBrowsing called with query: "${searchQuery}"`);

        if (!searchQuery) {
            this.showToast('Please enter a search query', 'error');
            return;
        }

        this.currentSearchQuery = searchQuery;
        this.currentPage = 0;
        console.log(`Set currentSearchQuery to: "${this.currentSearchQuery}", page: ${this.currentPage}`);
        await this.loadBrowserImages();
    }

    async loadBrowserImages() {
        const imageGrid = document.getElementById('image-grid');
        imageGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><div class="spinner"></div><p style="margin-top: 16px; color: var(--text-muted);">Searching multiple sources...</p></div>';

        try {
            console.log(`Loading browser images for query: "${this.currentSearchQuery}", page: ${this.currentPage}`);

            // Use progressive loading
            await this.loadBrowserImagesProgressive();

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

    async loadBrowserImagesProgressive() {
        const imageGrid = document.getElementById('image-grid');

        try {
            // Use unified search API that prioritizes historical archive
            const backendUrl = 'https://dirty4-vercel.vercel.app/api/search';
            const params = new URLSearchParams({
                tags: this.currentSearchQuery || '',
                page: (this.currentPage + 1).toString(),
                limit: '42',
                mode: 'unified'
            });

            console.log(`Fetching from unified search API: ${backendUrl}?${params}`);

            const response = await fetch(`${backendUrl}?${params}`);
            const data = await response.json();

            console.log(`Unified search returned: ${data.posts?.length || 0} results`);
            console.log(`Sources: Historical=${data.sources?.historical || 0}, Danbooru=${data.sources?.danbooru || 0}`);

            if (data.posts && data.posts.length > 0) {
                imageGrid.innerHTML = '';
                this.currentImages = data.posts;
                this.displayBrowserImages(data.posts);
                this.updatePagination();
                return;
            }

            // No results found
            imageGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No results found</h3>
                    <p>Try different tags or check your spelling</p>
                </div>
            `;

        } catch (error) {
            console.error('Unified search API failed, falling back to legacy method:', error);

            // Fallback to old method if API fails
            await this.loadBrowserImagesProgressive_Legacy();
        }
    }

    async loadBrowserImagesProgressive_Legacy() {
        const imageGrid = document.getElementById('image-grid');
        let danbooruResults = [];
        let rule34Results = [];
        let hasShownResults = false;

        // Function to update display when results come in
        const updateDisplay = (source, newResults) => {
            if (source === 'danbooru') {
                danbooruResults = newResults || [];
            } else if (source === 'rule34') {
                rule34Results = newResults || [];
            }

            // Combine all available results
            const allResults = [...danbooruResults, ...rule34Results];

            if (allResults.length > 0) {
                if (!hasShownResults) {
                    // First results - clear loading spinner
                    imageGrid.innerHTML = '';
                    hasShownResults = true;
                }

                // Shuffle and limit combined results
                const shuffledResults = this.shuffleAndLimitResults(allResults, 42);
                this.currentImages = shuffledResults;
                this.displayBrowserImages(shuffledResults);
                this.updatePagination();

                console.log(`Updated display: ${danbooruResults.length} Danbooru + ${rule34Results.length} Rule34 = ${allResults.length} total`);
            }
        };

        // Start both searches in parallel
        const searchPromises = [
            // Search Danbooru
            this.fetchDanbooruData(this.currentSearchQuery, this.currentPage)
                .then(results => {
                    if (results && results.length > 0) {
                        console.log(`Danbooru returned ${results.length} results`);
                        updateDisplay('danbooru', results);
                    }
                    return results || [];
                })
                .catch(error => {
                    console.log('Danbooru failed:', error.message);
                    return [];
                }),

            // Search Rule34
            this.fetchRule34Data(this.currentSearchQuery, this.currentPage)
                .then(results => {
                    if (results && results.length > 0) {
                        console.log(`Rule34 returned ${results.length} results`);
                        updateDisplay('rule34', results);
                    }
                    return results || [];
                })
                .catch(error => {
                    console.log('Rule34 failed:', error.message);
                    return [];
                })
        ];

        // Wait for both to complete
        const results = await Promise.all(searchPromises);

        // Final check - if no results from either source
        const totalResults = danbooruResults.length + rule34Results.length;
        if (totalResults === 0) {
            // Try demo mode with sample data as last resort
            console.log('All sources failed, attempting demo mode...');
            const demoResults = this.generateDemoResults(this.currentSearchQuery);
            if (demoResults.length > 0) {
                this.currentImages = demoResults;
                this.displayBrowserImages(demoResults);
                this.updatePagination();
                this.showToast('Demo mode: Showing sample data (external sources unavailable)', 'warning');
                return;
            }

            // Show helpful error message with troubleshooting info
            throw new Error('Unable to connect to image sources. This may be due to network restrictions or proxy service issues. Please try again later or check your internet connection.');
        }

        console.log(`Progressive loading complete: ${totalResults} total images`);
    }

    generateDemoResults(searchQuery) {
        // Generate demo data when external sources are unavailable
        const demoImages = [
            {
                id: 'demo_1',
                thumbUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAxPC90ZXh0Pjwvc3ZnPg==',
                fullUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzY2N2VlYSIvPjx0ZXh0IHg9IjQwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAxIC0gRnVsbCBTaXplPC90ZXh0Pjwvc3ZnPg==',
                title: `Demo Image 1 - ${searchQuery}`,
                site: 'danbooru',
                artists: ['demo_artist', 'sample_creator']
            },
            {
                id: 'demo_2',
                thumbUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1NTc2YyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAyPC90ZXh0Pjwvc3ZnPg==',
                fullUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Y1NTc2YyIvPjx0ZXh0IHg9IjQwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAyIC0gRnVsbCBTaXplPC90ZXh0Pjwvc3ZnPg==',
                title: `Demo Image 2 - ${searchQuery}`,
                site: 'danbooru',
                artists: ['another_artist']
            },
            {
                id: 'demo_3',
                thumbUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzRmYWNmZSIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAzPC90ZXh0Pjwvc3ZnPg==',
                fullUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzRmYWNmZSIvPjx0ZXh0IHg9IjQwMCIgeT0iMzAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RGVtbyBJbWFnZSAzIC0gRnVsbCBTaXplPC90ZXh0Pjwvc3ZnPg==',
                title: `Demo Image 3 - ${searchQuery}`,
                site: 'rule34'
            }
        ];

        console.log(`Generated ${demoImages.length} demo images for search: "${searchQuery}"`);
        return demoImages;
    }

    async getBrowserImageData(searchQuery, page) {
        console.log(`getBrowserImageData called - Searching for: "${searchQuery}", page: ${page}`);

        // Search both sources simultaneously
        console.log('Searching Rule34 and Danbooru in parallel...');
        const searchPromises = [
            this.fetchRule34Data(searchQuery, page).catch(error => {
                console.log('Rule34 failed:', error.message);
                return [];
            }),
            this.fetchDanbooruData(searchQuery, page).catch(error => {
                console.log('Danbooru failed:', error.message);
                return [];
            })
        ];

        // Wait for both searches to complete
        const results = await Promise.all(searchPromises);

        const allResults = [];

        // Process Rule34 results
        if (results[0] && results[0].length > 0) {
            console.log(`Rule34 returned ${results[0].length} results`);
            allResults.push(...results[0]);
        }

        // Process Danbooru results
        if (results[1] && results[1].length > 0) {
            console.log(`Danbooru returned ${results[1].length} results`);
            allResults.push(...results[1]);
        }

        // If we have results from either source, shuffle them for variety
        if (allResults.length > 0) {
            console.log(`Combined total: ${allResults.length} results from multiple sources`);
            return this.shuffleAndLimitResults(allResults, 42);
        }

        // If no results from either source
        throw new Error('No results found from any source');
    }

    // Progressive loading version that shows results as they come in
    async getBrowserImageDataProgressive(searchQuery, page, onResultsCallback) {
        console.log(`Progressive search for: "${searchQuery}", page: ${page}`);

        const allResults = [];
        let completedSources = 0;
        const totalSources = 2;

        // Function to handle results from each source
        const handleResults = (sourceResults, sourceName) => {
            if (sourceResults && sourceResults.length > 0) {
                console.log(`${sourceName} returned ${sourceResults.length} results`);
                allResults.push(...sourceResults);

                // Shuffle and show current results
                const currentResults = this.shuffleAndLimitResults([...allResults], 42);
                onResultsCallback(currentResults, completedSources + 1, totalSources);
            }

            completedSources++;

            // If all sources completed and no results, show error
            if (completedSources === totalSources && allResults.length === 0) {
                throw new Error('No results found from any source');
            }
        };

        // Start both searches
        this.fetchRule34Data(searchQuery, page)
            .then(results => handleResults(results, 'Rule34'))
            .catch(error => {
                console.log('Rule34 failed:', error.message);
                handleResults([], 'Rule34');
            });

        this.fetchDanbooruData(searchQuery, page)
            .then(results => handleResults(results, 'Danbooru'))
            .catch(error => {
                console.log('Danbooru failed:', error.message);
                handleResults([], 'Danbooru');
            });
    }

    shuffleAndLimitResults(results, limit) {
        // Shuffle the combined results for variety
        const shuffled = [...results];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        // Limit to the requested number
        return shuffled.slice(0, limit);
    }

    async fetchRule34Data(searchQuery, page) {
        const postsPerPage = 42;
        const targetUrl = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(searchQuery)}${page > 0 ? `&pid=${page * postsPerPage}` : ''}`;

        console.log(`Rule34 URL: ${targetUrl}`);

        const htmlContent = await this.fetchWithFallback(targetUrl, true); // Use fast mode
        if (!htmlContent) {
            throw new Error('No HTML content in response');
        }

        console.log(`HTML content length: ${htmlContent.length}`);

        // Check for CAPTCHA or blocking page
        if (htmlContent.includes('CAPTCHA') ||
            htmlContent.includes('Cloudflare') ||
            htmlContent.includes('challenge') ||
            htmlContent.includes('Please wait while your request is being verified') ||
            htmlContent.includes('Enable JavaScript and cookies') ||
            htmlContent.includes('Rule34.xxx CAPTCHA')) {

            console.log('CAPTCHA or blocking page detected');
            throw new Error('Rule34.xxx is currently blocking requests. This is a temporary protection measure by the site. Please try again later or use a different search term.');
        }

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
                        thumbUrl: thumbUrl,
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
                        ],
                        site: 'rule34'
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

        const thumbnailUrl = imageData.thumbUrl || imageData.thumbnailUrl || imageData.preview_url;

        // Skip if no valid thumbnail URL
        if (!thumbnailUrl) {
            console.warn('Skipping image with no thumbnail URL:', imageData);
            loadingDiv.innerHTML = '<i class="fas fa-image" style="color: var(--text-muted); font-size: 24px;"></i><div style="margin-top: 8px; font-size: 12px;">No thumbnail</div>';
            card.appendChild(loadingDiv);
            return card;
        }

        // Check if this is a video file for display purposes (but always use img element for thumbnails)
        const fileExt = imageData.fileExt || imageData.file_ext || '';
        const fullUrl = imageData.fullUrl || imageData.file_url || '';
        const isVideoContent = (fileExt && ['webm', 'mp4', 'mov'].includes(fileExt.toLowerCase()) &&
                               fullUrl && !fullUrl.toLowerCase().includes('.jpg') &&
                               !fullUrl.toLowerCase().includes('.png') &&
                               !fullUrl.toLowerCase().includes('.gif')) ||
                               // Also check historical archive videos by file URL
                               (imageData.file_url && isVideoUrl(imageData.file_url));

        const isVideo = false; // Always use img element for thumbnails to avoid JPEG loading issues

        let mediaElement;
        if (isVideo) {
            // Create video element for video files
            mediaElement = document.createElement('video');
            mediaElement.className = 'image-thumbnail';
            mediaElement.style.display = 'none';
            mediaElement.muted = true;
            mediaElement.loop = true;
            mediaElement.playsInline = true;
            mediaElement.preload = 'metadata';

            // Add video controls overlay
            const videoOverlay = document.createElement('div');
            videoOverlay.className = 'video-overlay';
            videoOverlay.innerHTML = '<i class="fas fa-play-circle"></i>';
            videoOverlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 24px;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                padding: 8px;
                pointer-events: none;
                z-index: 1;
            `;
            card.style.position = 'relative';
            card.appendChild(videoOverlay);
        } else {
            // Create img element for images
            mediaElement = document.createElement('img');
            mediaElement.className = 'image-thumbnail';
            mediaElement.alt = imageData.title;
            mediaElement.style.display = 'none';
        }

        // Add video overlay even for image thumbnails if content is actually video
        if (isVideoContent && !isVideo) {
            const videoOverlay = document.createElement('div');
            videoOverlay.className = 'video-overlay';
            videoOverlay.innerHTML = '<i class="fas fa-play-circle"></i>';
            videoOverlay.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 24px;
                background: rgba(0,0,0,0.5);
                border-radius: 50%;
                padding: 8px;
                pointer-events: none;
                z-index: 1;
            `;
            card.style.position = 'relative';
            card.appendChild(videoOverlay);
        }

        const img = mediaElement; // Keep compatibility with existing code

        const handleMediaLoad = () => {
            loadingDiv.style.display = 'none';
            img.style.display = 'block';
            console.log(`Successfully loaded ${isVideo ? 'video' : 'image'} thumbnail: ${thumbnailUrl}`);

            // Auto-play video on hover for preview
            if (isVideo) {
                img.addEventListener('mouseenter', () => {
                    img.play().catch(() => {}); // Ignore autoplay failures
                });
                img.addEventListener('mouseleave', () => {
                    img.pause();
                    img.currentTime = 0;
                });
            }
        };

        const handleMediaError = () => {
            console.error(`Failed to load ${isVideo ? 'video' : 'image'} thumbnail: ${thumbnailUrl}`);
            // Try alternative image proxy services
            const alternativeProxies = [
                `https://images.weserv.nl/?url=${encodeURIComponent(thumbnailUrl)}&w=200&h=200&fit=cover`,
                `https://wsrv.nl/?url=${encodeURIComponent(thumbnailUrl)}&w=200&h=200&fit=cover`,
                thumbnailUrl // Try direct URL as fallback
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

        // Assign event listeners based on media type
        if (isVideo) {
            console.log(`Creating video element for: ${thumbnailUrl}, fileExt: ${imageData.fileExt}`);
            img.onloadeddata = handleMediaLoad;
            img.onerror = (e) => {
                console.error(`Video failed to load, falling back to image: ${thumbnailUrl}`, e);
                // If video fails, create an image element instead
                const imgElement = document.createElement('img');
                imgElement.className = 'image-thumbnail';
                imgElement.alt = imageData.title;
                imgElement.style.display = 'none';
                imgElement.src = thumbnailUrl;
                imgElement.onload = handleMediaLoad;
                imgElement.onerror = handleMediaError;
                imgElement.onclick = () => this.showImagePreview(imageData, index);

                // Replace video with image
                img.parentNode.replaceChild(imgElement, img);

                // Remove video overlay if it exists
                const overlay = card.querySelector('.video-overlay');
                if (overlay) overlay.remove();
            };
        } else {
            img.onload = handleMediaLoad;
            img.onerror = handleMediaError;
        }

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

        // Add artist info for Danbooru images
        let artistInfo = null;
        if (imageData.site === 'danbooru' && imageData.artists && imageData.artists.length > 0) {
            artistInfo = document.createElement('div');
            artistInfo.className = 'image-artist-info';
            artistInfo.style.cssText = `
                padding: 8px 0 4px 0;
                font-size: 11px;
                color: var(--text-muted);
                text-align: center;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 8px;
            `;

            const validArtists = imageData.artists.filter(artist => artist && artist.trim().length > 0);
            if (validArtists.length > 0) {
                const artistLabel = validArtists.length === 1 ? 'Artist:' : 'Artists:';
                const artistLinksHtml = validArtists.map(artist =>
                    `<span class="artist-link" data-artist="${artist}" style="color: #667eea; cursor: pointer; text-decoration: underline; margin: 0 2px;">${artist}</span>`
                ).join(', ');

                artistInfo.innerHTML = `${artistLabel} ${artistLinksHtml}`;

                // Add click event listeners to artist links
                artistInfo.addEventListener('click', (e) => {
                    if (e.target.classList.contains('artist-link')) {
                        e.preventDefault();
                        e.stopPropagation();
                        const artist = e.target.getAttribute('data-artist');
                        this.searchByArtist(artist);
                    }
                });
            }
        }

        card.appendChild(loadingDiv);
        card.appendChild(img);
        if (artistInfo) {
            card.appendChild(artistInfo);
        }
        card.appendChild(actions);

        // Set image source to start loading
        img.src = thumbnailUrl;

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

    searchByArtist(artistName) {
        console.log(`Searching for artist: ${artistName}`);

        // Close the modal first
        this.closeModal();

        // Set the search input to the artist name
        const searchInput = document.getElementById('browser-search');
        searchInput.value = artistName;

        // Use the standard search flow
        this.startBrowsing();

        // Show success message
        this.showToast(`Searching for artist: ${artistName}`, 'info');
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

        console.log('Loading gallery with', this.starredImages.length, 'starred images');
        this.starredImages.forEach((imageData, index) => {
            console.log('Creating gallery card for:', imageData.id, imageData);
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

        img.onerror = (e) => {
            console.error('Gallery thumbnail failed to load:', img.src, 'for image:', imageData.id, e);
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

        // Set image source - handle both property names (thumbUrl, thumbnailUrl, preview_url)
        const thumbnailUrl = imageData.thumbUrl || imageData.thumbnailUrl || imageData.preview_url;
        console.log('Gallery image:', imageData.id, 'thumbUrl:', imageData.thumbUrl, 'thumbnailUrl:', imageData.thumbnailUrl, 'preview_url:', imageData.preview_url, 'using:', thumbnailUrl);

        if (thumbnailUrl) {
            img.src = thumbnailUrl;
            console.log('Setting gallery thumbnail src to:', thumbnailUrl);
        } else {
            console.error('No thumbnail URL found for gallery image:', imageData.id, imageData);
            loadingDiv.innerHTML = '<i class="fas fa-image" style="color: var(--text-muted); font-size: 24px;"></i><div style="margin-top: 8px; font-size: 12px;">No thumbnail</div>';
        }

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
        let modalImage = document.getElementById('modal-image');
        const modalStar = document.getElementById('modal-star');

        // Ensure we have a proper image element (not video) at start
        if (!modalImage || modalImage.tagName !== 'IMG') {
            const container = modal.querySelector('.modal-image-container');
            if (modalImage) {
                container.removeChild(modalImage);
            }
            modalImage = document.createElement('img');
            modalImage.id = 'modal-image';
            modalImage.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
            container.appendChild(modalImage);
        }

        // Set modal title with artist info when available
        let titleText = '';
        let artistName = '';

        // Prioritize tag_string_artist field (from R2 search API)
        if (imageData.tag_string_artist && imageData.tag_string_artist.trim().length > 0) {
            artistName = imageData.tag_string_artist.trim();
        }
        // Fallback to artists array (for Danbooru content)
        else if (imageData.artists && imageData.artists.length > 0) {
            const validArtists = imageData.artists.filter(artist => artist && artist.trim().length > 0);
            if (validArtists.length > 0) {
                artistName = validArtists.join(', ');
            }
        }

        if (artistName && artistName.length > 0 && artistName !== 'unknown') {
            // Show artist name as primary title
            titleText = artistName;

            // Check if this is Danbooru content with clickable artists
            if (imageData.artists && imageData.artists.length > 0) {
                const validArtists = imageData.artists.filter(artist => artist && artist.trim().length > 0);
                if (validArtists.length > 0) {
                    const artistLinksHtml = validArtists.map(artist =>
                        `<span class="artist-link" data-artist="${artist}" style="color: #667eea; cursor: pointer; text-decoration: underline;">${artist}</span>`
                    ).join(', ');

                    modalTitle.innerHTML = `${titleText}<br><small style="color: #aaa; font-weight: normal; font-size: 14px; margin-top: 4px; display: block;">ID: ${imageData.id}</small>`;

                    // Add click event listeners to artist links
                    setTimeout(() => {
                        const artistLinks = modalTitle.querySelectorAll('.artist-link');
                        artistLinks.forEach(link => {
                            link.addEventListener('click', (e) => {
                                e.preventDefault();
                                const artist = e.target.getAttribute('data-artist');
                                this.searchByArtist(artist);
                            });
                        });
                    }, 0);
                } else {
                    modalTitle.innerHTML = `${titleText}<br><small style="color: #aaa; font-weight: normal; font-size: 14px; margin-top: 4px; display: block;">ID: ${imageData.id}</small>`;
                }
            } else {
                modalTitle.innerHTML = `${titleText}<br><small style="color: #aaa; font-weight: normal; font-size: 14px; margin-top: 4px; display: block;">ID: ${imageData.id}</small>`;
            }
        } else {
            // Fallback to ID when no artist info available
            titleText = `Image ID: ${imageData.id}`;
            modalTitle.innerHTML = titleText;
        }

        // Use correct thumbnail URL for different sites
        const thumbnailUrl = imageData.thumbUrl || imageData.thumbnailUrl;
        modalImage.src = thumbnailUrl; // Start with thumbnail

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
            // For Danbooru images, we already have the full image URL
            if (imageData.source === 'danbooru' || imageData.site === 'danbooru') {
                const fullImageUrl = imageData.large_file_url || imageData.file_url || imageData.largeUrl || imageData.fullUrl;
                console.log(`Loading Danbooru full-size media: ${fullImageUrl}`);

                // Check if this is a video file - be more careful about detection
                const fileExt = imageData.fileExt || imageData.file_ext || '';
                const isVideo = fileExt && ['webm', 'mp4', 'mov'].includes(fileExt.toLowerCase()) &&
                               fullImageUrl && !fullImageUrl.toLowerCase().includes('.jpg') &&
                               !fullImageUrl.toLowerCase().includes('.png') &&
                               !fullImageUrl.toLowerCase().includes('.gif');

                if (isVideo) {
                    // Create video element for modal
                    const videoElement = document.createElement('video');
                    videoElement.id = 'modal-image'; // Keep the same ID
                    videoElement.className = 'modal-image';
                    videoElement.controls = true;
                    videoElement.muted = true;
                    videoElement.loop = true;

                    videoElement.src = fullImageUrl;

                    // Replace the image with video
                    const container = modalImage.parentNode;
                    container.removeChild(modalImage);
                    container.appendChild(videoElement);
                    videoElement.style.opacity = '1';

                    // Auto-play the video
                    videoElement.play().catch(() => {});
                } else {
                    // Use large or full URL directly for images
                    modalImage.src = fullImageUrl;
                    modalImage.style.opacity = '1';
                }
                return;
            }

            // Check if historical archive video
            if (imageData.source === 'historical' && isVideoUrl(imageData.file_url)) {
                console.log(`Loading historical video: ${imageData.file_url}`);

                const { videoElement, controlsOverlay } = createEnhancedVideoPlayer(imageData.file_url, {
                    autoplay: true,
                    muted: true,
                    loop: true
                });

                // Replace image with video
                const container = modalImage.parentNode;
                container.removeChild(modalImage);
                container.appendChild(videoElement);

                // Add controls overlay
                const modalContent = container.closest('.modal-image-container');
                if (modalContent && !modalContent.querySelector('.video-controls-overlay')) {
                    modalContent.appendChild(controlsOverlay);
                }

                videoElement.style.opacity = '1';
                videoElement.play().catch(() => {});
                return;
            }

            // Check if historical archive image (not video)
            if (imageData.source === 'historical' && imageData.file_url) {
                console.log(`Loading historical image: ${imageData.file_url}`);
                modalImage.src = imageData.file_url;
                modalImage.style.opacity = '1';
                return;
            }

            // Skip if no postUrl (for test data or incomplete records)
            if (!imageData.postUrl) {
                console.warn('No postUrl available, cannot load full image');
                modalImage.src = imageData.preview_url || imageData.thumbnailUrl || '';
                modalImage.style.opacity = '1';
                return;
            }

            console.log(`Loading full-size image from post: ${imageData.postUrl}`);

            // For Rule34, fetch the post page to get the real image URL
            const postHtmlContent = await this.fetchWithFallback(imageData.postUrl);

            if (!postHtmlContent) {
                throw new Error('Failed to load post page');
            }

            // Parse the post page HTML
            const parser = new DOMParser();
            const postDoc = parser.parseFromString(postHtmlContent, 'text/html');

            // Extract artist information from tags
            let artistNames = [];

            // For Danbooru images, use the artist data directly
            if (imageData.site === 'danbooru' && imageData.artists && imageData.artists.length > 0) {
                artistNames = imageData.artists.filter(artist => artist && artist.trim().length > 0);
                console.log(`Found Danbooru artists: ${artistNames.join(', ')}`);
            } else {
                // For Rule34 or other sites, try multiple selectors to find artist tags
            const artistSelectors = [
                '.tag-type-artist a',           // Direct artist tag links
                'a[href*="tags="][href*="artist"]', // Links with artist in href
                '.tag-type-artist',             // Artist tag containers
                'a[href*="&tags="][style*="color"]', // Colored artist links
                '.tag-container .artist a'     // Artist tags in tag containers
            ];

            for (const selector of artistSelectors) {
                const elements = postDoc.querySelectorAll(selector);
                for (const element of elements) {
                    const candidateName = element.textContent?.trim();
                    if (candidateName && candidateName.length > 0) {
                        // Clean up the artist name - remove question marks and other unwanted characters
                        const cleanName = candidateName.replace(/^\?+/, '').trim();
                        if (cleanName.length > 0 && !artistNames.includes(cleanName)) {
                            artistNames.push(cleanName);
                            console.log(`Found artist: "${cleanName}" using selector: ${selector}`);
                        }
                    }
                }
            }

            // If no artists found with the above selectors, try looking in the tags list
            if (artistNames.length === 0) {
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
                            const cleanName = text.replace(/^\?+/, '').trim();
                            if (cleanName.length > 0 && !artistNames.includes(cleanName)) {
                                artistNames.push(cleanName);
                                console.log(`Found artist via fallback: "${cleanName}"`);
                            }
                        }
                    }
                }
            }
            } // End of Rule34 artist extraction

            // Update modal title with artist info if available
            const modalTitle = document.getElementById('modal-title');
            if (artistNames.length > 0) {
                // Create clickable links for all artists
                const artistLinksHtml = artistNames.map(artist =>
                    `<span class="artist-link" data-artist="${artist}" style="color: #667eea; cursor: pointer; text-decoration: underline;">${artist}</span>`
                ).join(', ');

                const artistLabel = artistNames.length === 1 ? 'Artist' : 'Artists';
                modalTitle.innerHTML = `Image ID: ${imageData.id}<br><small style="color: #aaa; font-weight: normal;">${artistLabel}: ${artistLinksHtml}</small>`;

                // Add click event listeners to all artist links
                const artistLinks = modalTitle.querySelectorAll('.artist-link');
                artistLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const artist = e.target.getAttribute('data-artist');
                        this.searchByArtist(artist);
                    });
                });
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
        // Initialize suggestion cache
        this.suggestionCache = new Map();
        this.lastCacheClean = Date.now();
        // Pre-populate with common suggestions for instant results
        this.initCommonSuggestions();
        this.setupAutocompleteInput('search-query', 'downloader-autocomplete');
        this.setupAutocompleteInput('browser-search', 'browser-autocomplete');
        console.log('Autocomplete setup complete');
    }

    initCommonSuggestions() {
        // Pre-populate cache with common tags for instant results
        const commonTags = [
            'anime', 'manga', 'girl', 'cute', 'kawaii', 'beautiful', 'art', 'artwork',
            'digital_art', 'illustration', 'character', 'original', 'fan_art',
            'blonde_hair', 'brown_hair', 'black_hair', 'red_hair', 'blue_hair',
            'blue_eyes', 'green_eyes', 'brown_eyes', 'long_hair', 'short_hair',
            'dress', 'school_uniform', 'bikini', 'swimsuit', 'casual',
            'smile', 'happy', 'sad', 'serious', 'blush', 'wink',
            'solo', 'duo', 'group', 'sitting', 'standing', 'lying',
            'outdoors', 'indoors', 'beach', 'school', 'bedroom', 'kitchen'
        ];

        commonTags.forEach(tag => {
            const suggestions = commonTags.filter(t => t.includes(tag) && t !== tag);
            this.suggestionCache.set(tag, {
                suggestions: suggestions.slice(0, 8).map(s => ({ name: s, count: '∞' })),
                timestamp: Date.now(),
                isCommon: true
            });
        });
        console.log(`Pre-populated cache with ${commonTags.length} common suggestions`);
    }

    async fetchNetworkSuggestions(query) {
        // Use our backend autocomplete API backed by historical archive
        const backendUrl = `https://dirty4-vercel.vercel.app/api/search?autocomplete=${encodeURIComponent(query)}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10s for cold starts

            const response = await fetch(backendUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const tags = await response.json();
                console.log(`Backend autocomplete returned ${tags.length} suggestions for "${query}"`);
                return tags.map(tag => ({
                    name: tag.name,
                    count: tag.post_count || 0
                })).slice(0, 8);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Backend autocomplete timed out, using local cache');
            } else {
                console.error('Backend autocomplete error:', error);
            }
        }

        return [];
    }

    getLocalMatches(query) {
        // Get instant matches from cached data
        const matches = [];

        for (const [cachedQuery, data] of this.suggestionCache.entries()) {
            if (cachedQuery.includes(query) || query.includes(cachedQuery)) {
                matches.push(...data.suggestions.filter(s =>
                    s.name.toLowerCase().includes(query) &&
                    !matches.some(m => m.name === s.name)
                ));
            }
        }

        // Also check direct tag matches
        const directMatches = Array.from(this.suggestionCache.keys())
            .filter(tag => tag.includes(query))
            .slice(0, 5)
            .map(tag => ({ name: tag, count: 'cached' }));

        const combined = [...directMatches, ...matches].slice(0, 8);
        return combined;
    }

    displaySuggestions(suggestions, updateCallback) {
        if (suggestions && suggestions.length > 0) {
            updateCallback(suggestions);
        }
    }

    async fetchDanbooruSuggestions(query, updateSuggestions, hideSuggestions) {
        try {
            // For Danbooru, use a pre-defined list of popular tags instead of API calls
            const popularTags = [
                'ahri', 'lux', 'jinx', 'akali', 'katarina', 'sona', 'miss_fortune', 'ashe', 'caitlyn', 'leona',
                'anime', 'manga', 'original', 'touhou', 'fate/stay_night', 'fate/grand_order', 'azur_lane',
                'kantai_collection', 'pokemon', 'genshin_impact', 'honkai_impact_3rd', 'blue_archive',
                'solo', '1girl', '1boy', 'breasts', 'long_hair', 'short_hair', 'blonde_hair', 'brown_hair',
                'black_hair', 'blue_eyes', 'brown_eyes', 'green_eyes', 'smile', 'blush', 'looking_at_viewer',
                'large_breasts', 'medium_breasts', 'small_breasts', 'nipples', 'nude', 'pussy', 'ass',
                'thighs', 'underwear', 'panties', 'bra', 'bikini', 'swimsuit', 'dress', 'skirt', 'shirt'
            ];

            const matches = popularTags
                .filter(tag => tag.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
                .map(tag => ({
                    name: tag,
                    count: Math.floor(Math.random() * 10000) + 500
                }));

            if (matches.length > 0) {
                updateSuggestions(matches);
            } else {
                updateSuggestions([{ name: query, count: 0 }]);
            }
        } catch (error) {
            console.error('Danbooru suggestions error:', error);
            hideSuggestions();
        }
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

        // Create overlay container that covers entire viewport
        const overlay = document.createElement('div');
        overlay.id = dropdownId + '-overlay';
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
            display: none;
        `;

        // Create dropdown inside overlay
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'autocomplete-dropdown-body';
        dropdown.style.cssText = `
            position: absolute !important;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1 !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            pointer-events: auto !important;
        `;

        overlay.appendChild(dropdown);
        document.body.appendChild(overlay);

        let debounceTimeout;
        let selectedIndex = -1;
        let suggestions = [];
        let pendingFetchController = null;

        const hideSuggestions = () => {
            overlay.style.display = 'none';
            selectedIndex = -1;
            // Cancel any pending fetch
            if (pendingFetchController) {
                pendingFetchController.abort();
                pendingFetchController = null;
            }
        };

        const showSuggestions = () => {
            // Only show if input is currently focused
            if (document.activeElement !== input) {
                return;
            }
            if (suggestions.length > 0) {
                console.log('Showing autocomplete dropdown for:', inputId);

                // Get input position for positioning within overlay
                const rect = input.getBoundingClientRect();
                dropdown.style.left = rect.left + 'px';
                dropdown.style.top = (rect.bottom + 2) + 'px';
                dropdown.style.width = rect.width + 'px';

                overlay.style.display = 'block';
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
            if (overlay.style.display === 'none') return;

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

            const queryLower = query.toLowerCase();

            // Check cache first (keep recent network results)
            const cached = this.suggestionCache.get(queryLower);
            if (cached && Date.now() - cached.timestamp < 60000) { // 1 min cache for network results
                this.displaySuggestions(cached.suggestions, updateSuggestions);
                showSuggestions();
                return;
            }

            // Cancel previous pending fetch
            if (pendingFetchController) {
                pendingFetchController.abort();
            }
            pendingFetchController = new AbortController();

            // Show loading immediately and fetch from Danbooru API (fastest)
            dropdown.innerHTML = '<div class="autocomplete-loading">Loading...</div>';
            showSuggestions();

            try {
                const networkSuggestions = await this.fetchNetworkSuggestions(queryLower);
                if (networkSuggestions.length > 0) {
                    // Cache the results for 1 minute
                    this.suggestionCache.set(queryLower, {
                        suggestions: networkSuggestions,
                        timestamp: Date.now(),
                        isCommon: false
                    });
                    this.displaySuggestions(networkSuggestions, updateSuggestions);
                } else {
                    // Fallback to local matches if API returns nothing
                    const localMatches = this.getLocalMatches(queryLower);
                    if (localMatches.length > 0) {
                        this.displaySuggestions(localMatches, updateSuggestions);
                    } else {
                        dropdown.innerHTML = '<div class="autocomplete-no-results">No suggestions found</div>';
                        showSuggestions();
                        setTimeout(hideSuggestions, 2000);
                    }
                }
            } catch (error) {
                // Ignore aborted requests (user moved focus)
                if (error.name === 'AbortError') {
                    return;
                }
                console.log('Danbooru API failed, using local suggestions:', error.message);
                // Fallback to local matches
                const localMatches = this.getLocalMatches(queryLower);
                if (localMatches.length > 0) {
                    this.displaySuggestions(localMatches, updateSuggestions);
                } else {
                    dropdown.innerHTML = '<div class="autocomplete-no-results">No suggestions available</div>';
                    showSuggestions();
                    setTimeout(hideSuggestions, 2000);
                }
                if (localMatches.length === 0) {
                    hideSuggestions();
                }
            } finally {
                pendingFetchController = null;
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
            }, 50); // Instant autocomplete response
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