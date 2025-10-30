/**
 * Admin Alerts - Globális visszajelzési rendszer
 * Egységes alert megjelenítés minden admin oldalon
 *
 * ✅ DESIGN SYSTEM COMPLIANT
 * Uses toast-notification CSS classes from admin.css
 * No inline styles, only CSS variables and utility classes
 *
 * @version 2.0.0 - Design System Migration
 */

(function () {
  'use strict';

  /**
   * Globális alert megjelenítő függvény
   * @param {string} type - Alert típusa: 'success', 'error', 'warning', 'info'
   * @param {string} message - Megjelenítendő üzenet
   * @param {number} duration - Meddig maradjon látható (ms), default: 5000, 0 = no auto-hide
   */
  window.showAlert = function (type, message, duration = 5000) {
    // Eltávolítjuk a korábbi toast-eket
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach((toast) => {
      toast.remove();
    });

    // Toast icon mapping
    const icons = {
      info: '📧',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };

    // Remove emoji from message if present (to avoid duplication)
    // Emoji regex: matches common emojis at the start of string
    const cleanMessage = message.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();

    // Create toast element with design system classes
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-notification--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    // Create toast content (design system structure)
    toast.innerHTML = `
      <div class="toast-notification__content">
        <span class="toast-notification__icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
        <span class="toast-notification__message">${cleanMessage}</span>
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

    // Auto-hide after duration (if duration > 0)
    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.classList.add('toast-notification--hiding');
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }

    // Trigger show animation
    requestAnimationFrame(() => {
      toast.classList.add('toast-notification--visible');
    });
  };

  /**
   * Page load flash message-ek konvertálása showAlert-re
   * Ez automatikusan átalakítja a server-side flash message-eket
   * FONTOS: Dashboard kritikus alert-okat (.dashboard-critical-alert) kihagyja
   */
  window.convertFlashMessages = function () {
    // Success alert
    const successAlert = document.querySelector('.alert-success:not(.admin-alert):not(.dashboard-critical-alert)');
    if (successAlert && successAlert.textContent.trim()) {
      const message = successAlert.textContent.trim();
      successAlert.remove();
      window.showAlert('success', message);
    }

    // Error alert
    const errorAlert = document.querySelector('.alert-error:not(.admin-alert):not(.dashboard-critical-alert)');
    if (errorAlert && errorAlert.textContent.trim()) {
      const message = errorAlert.textContent.trim();
      errorAlert.remove();
      window.showAlert('error', message);
    }

    // Warning alert
    const warningAlert = document.querySelector('.alert-warning:not(.admin-alert):not(.dashboard-critical-alert)');
    if (warningAlert && warningAlert.textContent.trim()) {
      const message = warningAlert.textContent.trim();
      warningAlert.remove();
      window.showAlert('warning', message);
    }

    // Info alert
    const infoAlert = document.querySelector('.alert-info:not(.admin-alert):not(.dashboard-critical-alert)');
    if (infoAlert && infoAlert.textContent.trim()) {
      const message = infoAlert.textContent.trim();
      infoAlert.remove();
      window.showAlert('info', message);
    }
  };

  /**
   * Helper: Get CSRF token from form or meta tag
   * @param {HTMLFormElement} form - Form element
   * @returns {string|null} CSRF token or null
   */
  function getCsrfToken(form) {
    return form.querySelector('input[name="_csrf"]')?.value
          || document.querySelector('meta[name="csrf-token"]')?.content
          || null;
  }

  /**
   * Helper: Handle successful form submission
   * @param {Object} result - Response data
   * @param {Object} options - Submit options
   */
  function handleFormSuccess(result, options) {
    const { successMessage, onSuccess, redirectUrl, redirectDelay } = options;
    window.showAlert('success', result.message || successMessage);

    if (onSuccess) {
      onSuccess(result);
    }

    if (redirectUrl) {
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, redirectDelay);
    }
  }

  /**
   * Helper: Handle form submission error
   * @param {Object} result - Error response data
   * @param {Object} options - Submit options
   */
  function handleFormError(result, options) {
    const { errorMessage, onError } = options;
    window.showAlert('error', result.message || errorMessage);

    if (onError) {
      onError(result);
    }
  }

  /**
   * Helper: Handle network/exception error
   * @param {Error} error - Exception object
   * @param {Function} onError - Error callback
   */
  function handleNetworkError(error, onError) {
    console.error('Form submission error:', error);
    window.showAlert('error', '❌ Hálózati hiba történt');

    if (onError) {
      onError(error);
    }
  }

  /**
   * AJAX form submit helper
   * @param {HTMLFormElement} form - Form elem
   * @param {Object} options - Opciók
   * @returns {Promise}
   */
  window.submitFormAjax = async function (form, options = {}) {
    const {
      successMessage = 'Sikeresen mentve',
      errorMessage = 'Hiba történt a mentés során',
      redirectUrl = null,
      redirectDelay = 1000,
      onSuccess = null,
      onError = null
    } = options;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Mentés...';
    }

    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);

      // Get CSRF token
      const csrfToken = getCsrfToken(form);

      const response = await fetch(form.action, {
        method: form.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        handleFormSuccess(result, { successMessage, onSuccess, redirectUrl, redirectDelay });
      } else {
        handleFormError(result, { errorMessage, onError });
      }

      return result;
    } catch (error) {
      handleNetworkError(error, onError);
      throw error;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  };

  /**
   * Auto-init: Flash message-ek konvertálása page load-kor
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.convertFlashMessages);
  } else {
    window.convertFlashMessages();
  }
}());
