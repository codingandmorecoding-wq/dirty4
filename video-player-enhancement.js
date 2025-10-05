// 🎬 VIDEO PLAYER ENHANCEMENT FOR DIRTY4
// Add this to your app.js to enhance video playback

// Enhanced video player with controls and features
function createEnhancedVideoPlayer(videoUrl, options = {}) {
    const {
        autoplay = true,
        muted = true,
        loop = true,
        controls = true,
        preload = 'metadata'
    } = options;

    const videoElement = document.createElement('video');
    videoElement.id = 'modal-image'; // Keep same ID for consistency
    videoElement.controls = controls;
    videoElement.muted = muted;
    videoElement.loop = loop;
    videoElement.preload = preload;
    videoElement.style.cssText = `
        max-width: 100%;
        max-height: 70vh;
        width: auto;
        height: auto;
        object-fit: contain;
        background: #000;
        border-radius: 8px;
    `;

    // Detect video format
    const ext = videoUrl.split('.').pop().toLowerCase().split('?')[0];
    let mimeType = 'video/mp4';
    if (ext === 'webm') mimeType = 'video/webm';
    if (ext === 'mov') mimeType = 'video/quicktime';

    // Create source element with proper MIME type
    const source = document.createElement('source');
    source.src = videoUrl;
    source.type = mimeType;
    videoElement.appendChild(source);

    // Fallback text
    videoElement.innerHTML += 'Your browser does not support the video tag.';

    // Add custom controls overlay
    const controlsOverlay = document.createElement('div');
    controlsOverlay.className = 'video-controls-overlay';
    controlsOverlay.style.cssText = `
        position: absolute;
        top: 10px;
        right: 60px;
        display: flex;
        gap: 8px;
        z-index: 10002;
    `;

    // Mute/Unmute button
    const muteBtn = document.createElement('button');
    muteBtn.innerHTML = muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
    muteBtn.className = 'btn btn-secondary btn-icon';
    muteBtn.title = muted ? 'Unmute' : 'Mute';
    muteBtn.onclick = (e) => {
        e.stopPropagation();
        videoElement.muted = !videoElement.muted;
        muteBtn.innerHTML = videoElement.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
        muteBtn.title = videoElement.muted ? 'Unmute' : 'Mute';
    };

    // Loop button
    const loopBtn = document.createElement('button');
    loopBtn.innerHTML = '<i class="fas fa-redo"></i>';
    loopBtn.className = 'btn btn-secondary btn-icon';
    loopBtn.title = loop ? 'Loop: ON' : 'Loop: OFF';
    loopBtn.style.opacity = loop ? '1' : '0.5';
    loopBtn.onclick = (e) => {
        e.stopPropagation();
        videoElement.loop = !videoElement.loop;
        loopBtn.style.opacity = videoElement.loop ? '1' : '0.5';
        loopBtn.title = videoElement.loop ? 'Loop: ON' : 'Loop: OFF';
    };

    controlsOverlay.appendChild(muteBtn);
    controlsOverlay.appendChild(loopBtn);

    // Auto-play when loaded
    if (autoplay) {
        videoElement.addEventListener('loadedmetadata', () => {
            videoElement.play().catch(err => {
                console.log('Autoplay prevented, user interaction required');
            });
        });
    }

    // Loading indicator
    videoElement.addEventListener('waiting', () => {
        videoElement.style.opacity = '0.7';
    });

    videoElement.addEventListener('canplay', () => {
        videoElement.style.opacity = '1';
    });

    return { videoElement, controlsOverlay };
}

// Helper function to detect if URL is a video
function isVideoUrl(url) {
    if (!url) return false;
    const videoExtensions = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    const ext = url.split('.').pop().toLowerCase().split('?')[0];
    return videoExtensions.includes(ext);
}

// Helper function to get video thumbnail
function getVideoThumbnail(videoUrl, imageData) {
    // If historical archive, use thumbnail URL
    if (imageData.source === 'historical' && imageData.preview_url) {
        return imageData.preview_url;
    }

    // If danbooru, use preview URL
    if (imageData.previewUrl) {
        return imageData.previewUrl;
    }

    // Fallback to generic video icon
    return null;
}

// Add to your existing createImageCard function
function enhanceImageCardForVideos(card, imageData) {
    const thumbnail = card.querySelector('.image-thumbnail');

    if (isVideoUrl(imageData.file_url || imageData.fullUrl)) {
        // Add video indicator
        const videoIndicator = document.createElement('div');
        videoIndicator.className = 'video-indicator';
        videoIndicator.innerHTML = '<i class="fas fa-play-circle"></i>';
        videoIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 48px;
            color: white;
            text-shadow: 0 2px 8px rgba(0,0,0,0.8);
            pointer-events: none;
            opacity: 0.9;
            z-index: 10;
        `;

        thumbnail.parentElement.style.position = 'relative';
        thumbnail.parentElement.appendChild(videoIndicator);

        // Add video duration if available
        if (imageData.duration) {
            const durationBadge = document.createElement('div');
            durationBadge.className = 'video-duration';
            durationBadge.textContent = formatDuration(imageData.duration);
            durationBadge.style.cssText = `
                position: absolute;
                bottom: 8px;
                right: 8px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                font-family: 'JetBrains Mono', monospace;
            `;
            thumbnail.parentElement.appendChild(durationBadge);
        }
    }
}

// Format duration from seconds to MM:SS
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createEnhancedVideoPlayer,
        isVideoUrl,
        getVideoThumbnail,
        enhanceImageCardForVideos,
        formatDuration
    };
}
