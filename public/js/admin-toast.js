/**
 * 🎨 Admin Toast Notification System
 *
 * Design System Compliant Toast/Alert component
 * Uses CSS variables and utility classes from admin.css
 *
 * @module admin-toast
 * @author Design System
 * @version 1.0.0
 */

(function (window) {
  'use strict';

  /**
   * Show toast notification
   * @param {string} type - 'info' | 'success' | 'error' | 'warning'
   * @param {string} message - Toast message
   * @param {number} duration - Auto-hide duration (ms), 0 = no auto-hide
   */
  function showToast(type, message, duration = 5000) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach((toast) => {
      toast.remove();
    });

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-notification--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Toast icon mapping
    const icons = {
      info: '📧',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };

    // Create toast content
    toast.innerHTML = `
      <div class="toast-notification__content">
        <span class="toast-notification__icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
        <span class="toast-notification__message">${message}</span>
      </div>
      <button type="button" class="toast-notification__close" aria-label="Bezárás">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;

    // Append to body
    document.body.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-notification__close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('toast-notification--hiding');
      setTimeout(() => toast.remove(), 300);
    });

    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add('toast-notification--hiding');
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-notification--visible');
    });
  }

  /**
   * Legacy alias for backwards compatibility
   * @deprecated Use showToast() instead
   */
  function showAlert(type, message) {
    showToast(type, message);
  }

  // Export to global scope
  window.showToast = showToast;
  window.showAlert = showAlert; // Legacy compatibility
}(window));
