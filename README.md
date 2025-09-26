# Rule34 Mobile Downloader

A modern, responsive web application for browsing and downloading content with a sophisticated mobile-first design.

## Features

- **Responsive Design**: Optimized for all screen sizes with mobile-first approach
- **Image Browser**: Paginated thumbnail browsing with full-screen preview modals
- **Video Support**: Automatic video detection with streaming capabilities
- **Favorites System**: Star and save favorite images with local storage persistence
- **Smart Navigation**: Touch-optimized controls with swipe gesture support
- **Dark Theme**: Modern dark interface with gradient accents

## Live Demo

Visit the application: [GitHub Pages URL will be here]

## Technical Features

- **Progressive Web App**: Fast loading with offline capabilities
- **Touch Optimized**: Designed specifically for mobile touch interactions
- **Modern CSS**: Glass morphism effects, animations, and responsive grid
- **Vanilla JavaScript**: No frameworks, pure ES6+ implementation
- **CORS Handling**: Seamless cross-origin content loading

## Browser Compatibility

- Chrome/Chromium 70+
- Firefox 65+
- Safari 12+
- Mobile browsers with ES6+ support

## Setup Instructions

Before deploying, you need to:

1. **Update API Configuration**:
   - Edit `app.js` line 4
   - Replace `YOUR-NETLIFY-APP-NAME` with your actual Netlify app URL

2. **Deploy Backend First**:
   - Deploy the backend to Netlify Functions
   - Get your Netlify app URL
   - Update the CONFIG.API_BASE in app.js

3. **Deploy to GitHub Pages**:
   - Push this repository to GitHub
   - Enable Pages in repository settings
   - Access via your GitHub Pages URL

## Architecture

- **Frontend**: GitHub Pages (Static hosting)
- **Backend**: Netlify Functions (API endpoints)
- **Storage**: Local browser storage for user preferences

## Privacy

- No personal data collection
- Local storage only for favorites
- No external analytics or tracking
- All data stays on your device

## License

MIT License - Open source and free to use

---

**A modern mobile-first web application with professional design and comprehensive functionality.**