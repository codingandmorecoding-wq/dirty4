/**
 * Test Suite: Video Player Enhancement
 *
 * Tests the enhanced video player functionality including:
 * - Video detection and URL parsing
 * - Player controls (mute, loop, fullscreen)
 * - Video indicator overlays
 * - Format compatibility
 *
 * @module tests/video-player.test
 */

import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

describe('Video Player Enhancement', () => {
  let videoPlayerModule;

  beforeEach(() => {
    document.body.innerHTML = '';

    // Load video player enhancement script content
    const scriptContent = `
      function isVideoUrl(url) {
        if (!url) return false;
        const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
        return videoExtensions.some(ext => url.toLowerCase().includes(ext));
      }

      function createEnhancedVideoPlayer(videoUrl, options = {}) {
        const {
          autoplay = false,
          muted = true,
          loop = false,
          controls = true
        } = options;

        const videoElement = document.createElement('video');
        videoElement.className = 'modal-image';
        videoElement.controls = controls;
        videoElement.muted = muted;
        videoElement.loop = loop;
        videoElement.autoplay = autoplay;

        const ext = videoUrl.split('.').pop().toLowerCase().split('?')[0];
        let mimeType = 'video/mp4';
        if (ext === 'webm') mimeType = 'video/webm';
        if (ext === 'mov') mimeType = 'video/quicktime';
        if (ext === 'avi') mimeType = 'video/x-msvideo';
        if (ext === 'mkv') mimeType = 'video/x-matroska';

        const sourceElement = document.createElement('source');
        sourceElement.src = videoUrl;
        sourceElement.type = mimeType;
        videoElement.appendChild(sourceElement);

        const controlsOverlay = document.createElement('div');
        controlsOverlay.className = 'video-controls-overlay';

        const muteBtn = document.createElement('button');
        muteBtn.className = 'video-control-btn';
        muteBtn.innerHTML = muted ? 'Unmute' : 'Mute';
        muteBtn.onclick = () => {
          videoElement.muted = !videoElement.muted;
          muteBtn.innerHTML = videoElement.muted ? 'Unmute' : 'Mute';
        };

        const loopBtn = document.createElement('button');
        loopBtn.className = 'video-control-btn';
        loopBtn.innerHTML = 'Loop';
        loopBtn.style.opacity = loop ? '1' : '0.5';
        loopBtn.onclick = () => {
          videoElement.loop = !videoElement.loop;
          loopBtn.style.opacity = videoElement.loop ? '1' : '0.5';
        };

        controlsOverlay.appendChild(muteBtn);
        controlsOverlay.appendChild(loopBtn);

        return { videoElement, controlsOverlay };
      }

      function enhanceImageCardForVideos(card, imageData) {
        if (!isVideoUrl(imageData.file_url)) return;

        const indicator = document.createElement('div');
        indicator.className = 'video-indicator';
        indicator.innerHTML = '▶';
        card.appendChild(indicator);

        if (imageData.duration) {
          const durationBadge = document.createElement('div');
          durationBadge.className = 'video-duration';
          durationBadge.textContent = formatDuration(imageData.duration);
          card.appendChild(durationBadge);
        }
      }

      function formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + secs.toString().padStart(2, '0');
      }

      window.isVideoUrl = isVideoUrl;
      window.createEnhancedVideoPlayer = createEnhancedVideoPlayer;
      window.enhanceImageCardForVideos = enhanceImageCardForVideos;
      window.formatDuration = formatDuration;
    `;

    eval(scriptContent);
  });

  describe('isVideoUrl', () => {
    test('should detect MP4 video URLs', () => {
      expect(window.isVideoUrl('https://example.com/video.mp4')).toBe(true);
    });

    test('should detect WebM video URLs', () => {
      expect(window.isVideoUrl('https://example.com/video.webm')).toBe(true);
    });

    test('should detect MOV video URLs', () => {
      expect(window.isVideoUrl('https://example.com/video.mov')).toBe(true);
    });

    test('should detect AVI video URLs', () => {
      expect(window.isVideoUrl('https://example.com/video.avi')).toBe(true);
    });

    test('should detect MKV video URLs', () => {
      expect(window.isVideoUrl('https://example.com/video.mkv')).toBe(true);
    });

    test('should be case-insensitive', () => {
      expect(window.isVideoUrl('https://example.com/VIDEO.MP4')).toBe(true);
    });

    test('should reject image URLs', () => {
      expect(window.isVideoUrl('https://example.com/image.jpg')).toBe(false);
      expect(window.isVideoUrl('https://example.com/image.png')).toBe(false);
      expect(window.isVideoUrl('https://example.com/image.gif')).toBe(false);
    });

    test('should handle URLs with query parameters', () => {
      expect(window.isVideoUrl('https://example.com/video.mp4?token=abc123')).toBe(true);
    });

    test('should return false for null or undefined', () => {
      expect(window.isVideoUrl(null)).toBe(false);
      expect(window.isVideoUrl(undefined)).toBe(false);
      expect(window.isVideoUrl('')).toBe(false);
    });
  });

  describe('createEnhancedVideoPlayer', () => {
    test('should create video element with correct attributes', () => {
      const { videoElement } = window.createEnhancedVideoPlayer('https://example.com/video.mp4', {
        autoplay: true,
        muted: true,
        loop: true,
        controls: true
      });

      expect(videoElement.tagName).toBe('VIDEO');
      expect(videoElement.controls).toBe(true);
      expect(videoElement.muted).toBe(true);
      expect(videoElement.loop).toBe(true);
      expect(videoElement.autoplay).toBe(true);
    });

    test('should apply default options when not specified', () => {
      const { videoElement } = window.createEnhancedVideoPlayer('https://example.com/video.mp4');

      expect(videoElement.muted).toBe(true);
      expect(videoElement.autoplay).toBe(false);
      expect(videoElement.loop).toBe(false);
      expect(videoElement.controls).toBe(true);
    });

    test('should set correct MIME type for MP4', () => {
      const { videoElement } = window.createEnhancedVideoPlayer('https://example.com/video.mp4');
      const source = videoElement.querySelector('source');

      expect(source.type).toBe('video/mp4');
      expect(source.src).toBe('https://example.com/video.mp4');
    });

    test('should set correct MIME type for WebM', () => {
      const { videoElement } = window.createEnhancedVideoPlayer('https://example.com/video.webm');
      const source = videoElement.querySelector('source');

      expect(source.type).toBe('video/webm');
    });

    test('should set correct MIME type for MOV', () => {
      const { videoElement } = window.createEnhancedVideoPlayer('https://example.com/video.mov');
      const source = videoElement.querySelector('source');

      expect(source.type).toBe('video/quicktime');
    });

    test('should create controls overlay', () => {
      const { controlsOverlay } = window.createEnhancedVideoPlayer('https://example.com/video.mp4');

      expect(controlsOverlay.className).toBe('video-controls-overlay');
      expect(controlsOverlay.children.length).toBe(2);
    });

    test('should create mute button with correct initial state', () => {
      const { controlsOverlay, videoElement } = window.createEnhancedVideoPlayer(
        'https://example.com/video.mp4',
        { muted: true }
      );

      const muteBtn = controlsOverlay.querySelector('.video-control-btn');
      expect(muteBtn.innerHTML).toBe('Unmute');
      expect(videoElement.muted).toBe(true);
    });

    test('should toggle mute when button clicked', () => {
      const { controlsOverlay, videoElement } = window.createEnhancedVideoPlayer(
        'https://example.com/video.mp4',
        { muted: true }
      );

      const muteBtn = controlsOverlay.querySelector('.video-control-btn');
      muteBtn.click();

      expect(videoElement.muted).toBe(false);
      expect(muteBtn.innerHTML).toBe('Mute');
    });

    test('should create loop button with correct initial state', () => {
      const { controlsOverlay } = window.createEnhancedVideoPlayer(
        'https://example.com/video.mp4',
        { loop: true }
      );

      const buttons = controlsOverlay.querySelectorAll('.video-control-btn');
      const loopBtn = buttons[1];

      expect(loopBtn.style.opacity).toBe('1');
    });

    test('should toggle loop when button clicked', () => {
      const { controlsOverlay, videoElement } = window.createEnhancedVideoPlayer(
        'https://example.com/video.mp4',
        { loop: false }
      );

      const buttons = controlsOverlay.querySelectorAll('.video-control-btn');
      const loopBtn = buttons[1];

      loopBtn.click();

      expect(videoElement.loop).toBe(true);
      expect(loopBtn.style.opacity).toBe('1');
    });
  });

  describe('enhanceImageCardForVideos', () => {
    test('should add video indicator to card', () => {
      const card = document.createElement('div');
      card.className = 'image-card';
      document.body.appendChild(card);

      const imageData = {
        file_url: 'https://example.com/video.mp4'
      };

      window.enhanceImageCardForVideos(card, imageData);

      const indicator = card.querySelector('.video-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.innerHTML).toBe('▶');
    });

    test('should not add indicator for non-video URLs', () => {
      const card = document.createElement('div');
      card.className = 'image-card';
      document.body.appendChild(card);

      const imageData = {
        file_url: 'https://example.com/image.jpg'
      };

      window.enhanceImageCardForVideos(card, imageData);

      const indicator = card.querySelector('.video-indicator');
      expect(indicator).toBeFalsy();
    });

    test('should add duration badge when duration provided', () => {
      const card = document.createElement('div');
      card.className = 'image-card';
      document.body.appendChild(card);

      const imageData = {
        file_url: 'https://example.com/video.mp4',
        duration: 125
      };

      window.enhanceImageCardForVideos(card, imageData);

      const durationBadge = card.querySelector('.video-duration');
      expect(durationBadge).toBeTruthy();
      expect(durationBadge.textContent).toBe('2:05');
    });
  });

  describe('formatDuration', () => {
    test('should format duration correctly', () => {
      expect(window.formatDuration(0)).toBe('0:00');
      expect(window.formatDuration(30)).toBe('0:30');
      expect(window.formatDuration(60)).toBe('1:00');
      expect(window.formatDuration(90)).toBe('1:30');
      expect(window.formatDuration(125)).toBe('2:05');
      expect(window.formatDuration(3661)).toBe('61:01');
    });

    test('should pad seconds with zero', () => {
      expect(window.formatDuration(5)).toBe('0:05');
      expect(window.formatDuration(65)).toBe('1:05');
    });
  });
});
