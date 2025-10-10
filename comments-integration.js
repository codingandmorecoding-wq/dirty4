/**
 * DISQUS COMMENTS INTEGRATION
 * Adds user comments to each image - CRITICAL for AdSense approval
 *
 * Setup Instructions:
 * 1. Sign up at https://disqus.com/
 * 2. Create new site with name: "dirty4" (or your choice)
 * 3. Get your shortname from: https://disqus.com/admin/settings/general/
 * 4. Replace 'YOUR_DISQUS_SHORTNAME' below with your actual shortname
 * 5. Include this file in your HTML: <script src="comments-integration.js"></script>
 * 6. Add comments div: <div id="disqus_thread"></div>
 */

// ============================================================================
// CONFIGURATION - CHANGE THIS!
// ============================================================================
const DISQUS_SHORTNAME = 'YOUR_DISQUS_SHORTNAME';  // Get from https://disqus.com/admin/

// ============================================================================

/**
 * Initialize Disqus comments for current page
 * @param {string} pageUrl - Unique URL for this page
 * @param {string} pageIdentifier - Unique identifier (e.g., post ID)
 * @param {string} pageTitle - Title to show in comments
 */
function initializeComments(pageUrl, pageIdentifier, pageTitle) {
    // Disqus configuration
    window.disqus_config = function () {
        this.page.url = pageUrl;
        this.page.identifier = pageIdentifier;
        this.page.title = pageTitle;
    };

    // Load Disqus script
    (function() {
        const d = document;
        const s = d.createElement('script');
        s.src = `https://${DISQUS_SHORTNAME}.disqus.com/embed.js`;
        s.setAttribute('data-timestamp', +new Date());
        (d.head || d.body).appendChild(s);
    })();

    console.log('✅ Disqus comments loaded for:', pageTitle);
}

/**
 * Initialize comments for an image post
 * Call this when viewing an image
 * @param {string} postId - The post ID
 * @param {string} postTitle - The post title/tags
 */
function initImageComments(postId, postTitle) {
    const pageUrl = `${window.location.origin}${window.location.pathname}?id=${postId}`;
    const pageIdentifier = `post-${postId}`;
    const title = postTitle || `Post ${postId}`;

    initializeComments(pageUrl, pageIdentifier, title);
}

/**
 * Initialize comments for an artist page
 * @param {string} artistName - The artist name
 */
function initArtistComments(artistName) {
    const pageUrl = `${window.location.origin}/artist/${encodeURIComponent(artistName)}`;
    const pageIdentifier = `artist-${artistName}`;
    const title = `Artist: ${artistName}`;

    initializeComments(pageUrl, pageIdentifier, title);
}

/**
 * Get comment count for a post
 * @param {string} postId - The post ID
 * @returns {Promise<number>} Number of comments
 */
async function getCommentCount(postId) {
    try {
        const response = await fetch(
            `https://disqus.com/api/3.0/threads/details.json?` +
            `api_key=YOUR_PUBLIC_API_KEY&` +
            `forum=${DISQUS_SHORTNAME}&` +
            `thread:ident=post-${postId}`
        );
        const data = await response.json();
        return data.response?.posts || 0;
    } catch (error) {
        console.error('Failed to get comment count:', error);
        return 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initImageComments,
        initArtistComments,
        getCommentCount
    };
}
