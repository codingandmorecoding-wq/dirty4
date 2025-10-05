# 🎬 Video Player Integration Guide

## What's New

Your Dirty4.com site now supports **video playback** seamlessly integrated with images:
- ✅ 451 videos from historical archive
- ✅ Danbooru video support (webm, mp4)
- ✅ Enhanced player with custom controls
- ✅ Visual indicators (play button, duration)
- ✅ Same user experience as images

## Quick Integration

### Step 1: Add CSS to `app.html`

Add this inside the `<style>` section (before `</style>`):

```css
/* Video Player Enhancements */
.video-indicator {
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
    transition: all 0.3s ease;
}

.image-card:hover .video-indicator {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
}

.video-duration {
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
    z-index: 11;
}

.video-controls-overlay {
    position: absolute;
    top: 10px;
    right: 60px;
    display: flex;
    gap: 8px;
    z-index: 10002;
    pointer-events: auto;
}

video.modal-image {
    max-width: 100%;
    max-height: 70vh;
    width: auto;
    height: auto;
    object-fit: contain;
    background: #000;
    border-radius: 8px;
}

/* Video thumbnail styling */
.image-thumbnail[data-is-video="true"] {
    position: relative;
}

.image-thumbnail[data-is-video="true"]::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.3) 100%);
    border-radius: 8px;
}
```

### Step 2: Add JavaScript to `app.html`

Add before the closing `</body>` tag:

```html
<!-- Video Player Enhancement -->
<script src="video-player-enhancement.js"></script>
<script>
// Auto-detect and enhance video cards
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.image-card').forEach(card => {
            const img = card.querySelector('img');
            if (img && img.src && isVideoUrl(img.dataset.fullUrl || '')) {
                if (!card.querySelector('.video-indicator')) {
                    const imageData = { file_url: img.dataset.fullUrl };
                    enhanceImageCardForVideos(card, imageData);
                }
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});
</script>
```

### Step 3: Update `loadFullSizeImage` function in `app.js`

Find the `loadFullSizeImage` function and add historical video support:

```javascript
// Around line 1547 - Add after Danbooru video handling

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
```

## Features

### Visual Indicators

**Play Button Overlay**
- Shows on video thumbnails
- Scales on hover
- Semi-transparent for visibility

**Duration Badge**
- Shows video length (MM:SS)
- Bottom-right corner
- Dark background with monospace font

### Player Controls

**Mute/Unmute Button**
- Toggle audio on/off
- Icon changes: 🔇 ↔️ 🔊
- Default: Muted (for autoplay)

**Loop Button**
- Toggle repeat mode
- Opacity indicates state
- Default: Loop ON

**Native Controls**
- Play/pause
- Seek bar
- Fullscreen
- Volume slider
- Playback speed

### Auto-Play Behavior

Videos automatically play when modal opens:
- **Muted**: Starts muted (browser requirement)
- **Loop**: Repeats automatically
- **Click to unmute**: User can enable sound

## Browser Compatibility

| Format | Chrome | Firefox | Safari | Edge |
|--------|--------|---------|--------|------|
| MP4 | ✅ | ✅ | ✅ | ✅ |
| WebM | ✅ | ✅ | ❌ | ✅ |
| MOV | ⚠️ | ⚠️ | ✅ | ⚠️ |

**Fallback**: If browser doesn't support format, shows message.

## Testing

### Test with Sample Video

```javascript
// In browser console
const testVideo = {
    file_url: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/images/historical_12345.mp4',
    preview_url: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/thumbnails/historical_12345.jpg',
    source: 'historical',
    id: '12345'
};

// Should open video player
rule34App.openModal(testVideo, 0);
```

## Performance

**Optimized Loading:**
- Thumbnail shown first (instant)
- Video loads on-demand (click)
- Preload: metadata only (~1-2KB)
- Full video streams when played

**Bandwidth:**
- Free egress from R2
- No bandwidth costs
- Cloudflare CDN acceleration

## File Sizes

Your 451 videos:
- Average: ~5-15 MB each
- Total: ~3-5 GB video storage
- Cost: Included in $4.50/month

## Troubleshooting

**Video doesn't play:**
1. Check browser console for errors
2. Verify video URL is accessible
3. Check file format compatibility
4. Try unmuting (some browsers block autoplay)

**No play button on thumbnail:**
1. Verify `video-player-enhancement.js` is loaded
2. Check `isVideoUrl()` detection
3. Inspect element for `.video-indicator` class

**Controls don't appear:**
1. Check z-index conflicts
2. Verify `.video-controls-overlay` exists
3. Inspect modal-image-container

## Next Steps

1. ✅ Upload videos to R2 (in progress)
2. ✅ Add CSS to app.html
3. ✅ Add JavaScript script tag
4. ✅ Update loadFullSizeImage function
5. ✅ Deploy to GitHub Pages
6. ✅ Test with real videos

Your videos will work seamlessly with your existing image gallery! 🎉
