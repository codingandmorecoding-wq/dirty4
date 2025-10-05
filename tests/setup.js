/**
 * Test Setup Configuration
 *
 * Configures the testing environment for frontend tests.
 * Includes global mocks and utilities for DOM testing.
 *
 * @module tests/setup
 */

import '@testing-library/jest-dom';

/**
 * Mock window.matchMedia for responsive tests
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

/**
 * Mock IntersectionObserver for lazy loading tests
 */
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

/**
 * Suppress console errors in tests unless explicitly needed
 */
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
