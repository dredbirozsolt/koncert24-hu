/**
 * Dark Mode Toggle
 * koncert24.hu
 *
 * Features:
 * - System preference detection (prefers-color-scheme)
 * - Manual toggle with localStorage persistence
 * - Smooth transitions
 * - WCAG 2.1 compliant
 */

(function () {
  'use strict';

  // Constants
  const STORAGE_KEY = 'koncert24-theme';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';
  const ATTR_DATA_THEME = 'data-theme';

  /**
     * Get system preference
     * @returns {string} 'light' or 'dark'
     */
  function getSystemPreference() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_DARK : THEME_LIGHT;
  }

  /**
     * Get stored preference or fallback to system
     * @returns {string} 'light' or 'dark'
     */
  function getThemePreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || getSystemPreference();
  }

  /**
     * Apply theme to document
     * @param {string} theme - 'light' or 'dark'
     */
  function applyTheme(theme) {
    document.documentElement.setAttribute(ATTR_DATA_THEME, theme);
  }

  /**
     * Save theme preference
     * @param {string} theme - 'light' or 'dark'
     */
  function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEY, theme);
  }

  /**
     * Toggle theme
     */
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute(ATTR_DATA_THEME);
    const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;

    applyTheme(newTheme);
    saveTheme(newTheme);

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: newTheme }
    }));
  }

  /**
     * Initialize theme system
     */
  function init() {
    // Apply initial theme (before DOM loads to prevent flash)
    const initialTheme = getThemePreference();
    applyTheme(initialTheme);

    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupToggle);
    } else {
      setupToggle();
    }
  }

  /**
     * Setup toggle button
     */
  function setupToggle() {
    // Support both IDs: 'theme-toggle' (admin) and 'themeToggle' (public)
    const toggleButton = document.getElementById('theme-toggle')
      || document.getElementById('themeToggle');

    if (!toggleButton) {
      console.warn('Theme toggle button not found');
      return;
    }

    // Add click listener
    toggleButton.addEventListener('click', toggleTheme);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
      }
    });
  }

  // Initialize immediately (before DOM loads)
  init();

  // Export for debugging
  window.themeToggle = {
    getTheme: () => document.documentElement.getAttribute(ATTR_DATA_THEME),
    setTheme: applyTheme,
    toggle: toggleTheme,
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      applyTheme(getSystemPreference());
    }
  };
}());
