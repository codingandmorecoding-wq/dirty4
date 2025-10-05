# Frontend Testing Documentation

## Overview

This document describes the testing strategy for the Dirty4.com frontend, specifically focusing on video player functionality and historical archive integration.

## Test Structure

```
frontend-github-pages/
├── tests/
│   ├── setup.js                # Test configuration
│   └── video-player.test.js    # Video player tests
├── video-player-enhancement.js # Implementation
├── package.json                # Test configuration
└── TESTING.md                 # This file
```

## Running Tests

### Prerequisites

Install development dependencies:

```bash
npm install
```

### Test Commands

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Video Player Tests

### Test Categories

#### 1. Video URL Detection
Tests for `isVideoUrl()` function:
- Detects MP4, WebM, MOV, AVI, MKV formats
- Case-insensitive detection
- Handles query parameters
- Rejects image URLs
- Handles null/undefined input

#### 2. Video Player Creation
Tests for `createEnhancedVideoPlayer()` function:
- Creates video element with correct attributes
- Applies default options
- Sets correct MIME types for different formats
- Creates control overlay
- Implements mute/unmute functionality
- Implements loop toggle

#### 3. Video Card Enhancement
Tests for `enhanceImageCardForVideos()` function:
- Adds video indicator overlay
- Skips non-video content
- Adds duration badge when available
- Properly formats duration display

#### 4. Duration Formatting
Tests for `formatDuration()` function:
- Formats seconds to MM:SS
- Pads seconds with leading zero
- Handles edge cases (0 seconds, long videos)

## Test Environment

Tests run in a JSDOM environment that simulates a browser:

```javascript
{
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"]
}
```

### Mocked Browser APIs

The test setup mocks browser APIs not available in Node:
- `window.matchMedia` - for responsive design tests
- `IntersectionObserver` - for lazy loading tests
- Console methods - to suppress noise in test output

## Writing New Tests

### Example Test

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
  });

  test('should perform expected behavior', () => {
    // Arrange
    const element = document.createElement('div');

    // Act
    const result = functionToTest(element);

    // Assert
    expect(result).toBeDefined();
    expect(element.className).toBe('expected-class');
  });
});
```

### Testing DOM Manipulation

For functions that modify the DOM:

```javascript
test('should add element to DOM', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  addElementToDOM(container);

  expect(container.children.length).toBe(1);
  expect(container.firstChild.tagName).toBe('DIV');
});
```

### Testing Event Handlers

For functions with event listeners:

```javascript
test('should handle click events', () => {
  const button = document.createElement('button');
  let clicked = false;

  button.onclick = () => { clicked = true; };
  button.click();

  expect(clicked).toBe(true);
});
```

## Coverage Goals

Target coverage thresholds:
- Branch coverage: 60%
- Function coverage: 60%
- Line coverage: 60%
- Statement coverage: 60%

View detailed coverage in `coverage/lcov-report/index.html` after running:
```bash
npm run test:coverage
```

## Integration with Backend

While unit tests focus on individual functions, integration testing should verify:
- Video player works with real R2 URLs
- Search results correctly identify video content
- Video thumbnails load properly
- Player controls function in production environment

Manual integration testing checklist:
1. Open site in browser
2. Search for tags with video content
3. Click video thumbnail
4. Verify player loads and displays controls
5. Test mute/unmute functionality
6. Test loop toggle
7. Test fullscreen mode
8. Test playback on different browsers

## Browser Compatibility

Tests verify JavaScript functionality, but manual testing is required for:
- Chrome/Edge (WebM, MP4 support)
- Firefox (WebM, MP4 support)
- Safari (MP4, MOV support - WebM not supported)

## Debugging Tests

### Running Single Test File

```bash
npm test video-player.test.js
```

### Running Tests Matching Pattern

```bash
npm test -- --testNamePattern="isVideoUrl"
```

### Verbose Output

```bash
npm test -- --verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the function does, not how
2. **Keep tests simple**: Each test should verify one thing
3. **Use descriptive names**: Test names should explain what is being tested
4. **Avoid test interdependence**: Tests should run in any order
5. **Clean up after tests**: Reset DOM and mocks in `afterEach`

## Common Pitfalls

### Asynchronous Operations

When testing async code, ensure promises are returned or `async/await` is used:

```javascript
test('should load video', async () => {
  const result = await loadVideo('url');
  expect(result).toBeDefined();
});
```

### DOM Timing Issues

When testing DOM updates that happen asynchronously:

```javascript
test('should update DOM', (done) => {
  updateDOM();

  setTimeout(() => {
    expect(document.body.children.length).toBe(1);
    done();
  }, 0);
});
```

## Continuous Testing

Recommended workflow:
1. Write test first (TDD approach)
2. Run `npm run test:watch` in background
3. Implement feature
4. Watch tests pass
5. Refactor if needed
6. Commit when all tests pass

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [JSDOM](https://github.com/jsdom/jsdom)
- [TDD Guide](https://github.com/testdouble/contributing-tests/wiki/Test-Driven-Development)
