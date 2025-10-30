/**
 * Exit Popup Manager
 * Handles exit-intent, mobile back, and timed popups
 */

(function () {
  'use strict';

  const ExitPopup = {
    config: {
      storageKey: 'exitPopupShown',
      sessionKey: 'exitPopupSession',
      enabled: false,
      title: '',
      message: '',
      cta_text: '',
      cta_link: '',
      trigger_exit_intent: true,
      trigger_mobile_exit: false,
      trigger_timed: false,
      delay: 10 // seconds for timed popup
    },

    state: {
      shown: false,
      listeners: [],
      popup: null
    },

    // Initialize the exit popup
    init(settings) {
      // Load settings from server
      if (settings) {
        this.config = { ...this.config, ...settings };
      }

      // Check if popup is enabled
      if (!this.config.enabled) {
        return;
      }

      // Check if already shown in this session
      if (this.hasShownInSession()) {
        return;
      }

      // Setup triggers based on configuration
      this.setupTriggers();
    },

    // Check if popup was shown in current session
    hasShownInSession() {
      try {
        // Check both exit popup session AND general engagement flag
        const sessionShown = sessionStorage.getItem(this.config.sessionKey);
        const engagementShown = sessionStorage.getItem('engagement_shown');
        return sessionShown === 'true' || engagementShown === 'true';
      } catch {
        return false;
      }
    },

    // Mark popup as shown in session
    markAsShown() {
      try {
        sessionStorage.setItem(this.config.sessionKey, 'true');
        this.state.shown = true;
      } catch {
        console.warn('Failed to save exit popup state');
      }
    },

    // Setup triggers based on configuration
    setupTriggers() {
      // Setup exit intent if enabled
      if (this.config.trigger_exit_intent) {
        this.setupExitIntent();
      }

      // Setup mobile exit if enabled
      if (this.config.trigger_mobile_exit) {
        this.setupMobileBack();
      }

      // Setup timed popup if enabled
      if (this.config.trigger_timed) {
        this.setupTimed();
      }
    },

    // Setup exit intent detection (desktop)
    setupExitIntent() {
      const handler = (e) => {
        // Check if mouse is leaving from top of viewport
        if (e.clientY <= 0 && !this.state.shown) {
          this.show();
        }
      };

      document.addEventListener('mouseout', handler);
      this.state.listeners.push({ event: 'mouseout', handler });
    },

    // Setup mobile back button detection
    setupMobileBack() {
      let lastScrollTop = 0;
      let scrollUpCount = 0;

      const handler = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Detect rapid scroll up (potential exit behavior)
        if (scrollTop < lastScrollTop && scrollTop < 100) {
          scrollUpCount += 1;

          if (scrollUpCount >= 2 && !this.state.shown) {
            this.show();
          }
        } else {
          scrollUpCount = 0;
        }

        lastScrollTop = scrollTop;
      };

      window.addEventListener('scroll', handler, { passive: true });
      this.state.listeners.push({ event: 'scroll', handler });

      // Also detect back button via history
      const popstateHandler = () => {
        if (!this.state.shown) {
          this.show();
          // Push state back to prevent actual navigation
          window.history.pushState(null, '', window.location.href);
        }
      };

      // Add a history entry to catch back button
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', popstateHandler);
      this.state.listeners.push({ event: 'popstate', handler: popstateHandler });
    },

    // Setup timed popup
    setupTimed() {
      const delay = this.config.delay * 1000; // Convert to milliseconds

      setTimeout(() => {
        if (!this.state.shown) {
          this.show();
        }
      }, delay);
    },

    // Show the popup
    show() {
      if (this.state.shown) {
        return;
      }

      // Mark engagement as shown (coordinate with chat)
      try {
        sessionStorage.setItem('engagement_shown', 'true');
      } catch {
        console.warn('Failed to set engagement flag');
      }

      this.state.popup = this.createPopup();
      document.body.appendChild(this.state.popup);

      // Trigger animation
      setTimeout(() => {
        this.state.popup.classList.add('exit-popup--visible');
      }, 10);

      this.markAsShown();
      this.attachListeners();
      this.removeEventListeners();
    },

    // Create popup HTML
    createPopup() {
      const popup = document.createElement('div');
      popup.className = 'exit-popup';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-modal', 'true');
      popup.setAttribute('aria-labelledby', 'exit-popup-title');

      const basePathValue = window.basePath || '/';

      // Escape values before using in template
      const escapedTitle = this.escapeHtml(this.config.title);
      const escapedMessage = this.escapeHtml(this.config.message);
      const escapedCtaText = this.escapeHtml(this.config.cta_text);

      popup.innerHTML = `
        <div class="exit-popup__overlay"></div>
        <div class="exit-popup__content">
          <button type="button" class="exit-popup__close" aria-label="Bezárás">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div class="exit-popup__body">
            <h2 id="exit-popup-title" class="exit-popup__title">${escapedTitle}</h2>
            <p class="exit-popup__message">${escapedMessage}</p>
            
            <div class="exit-popup__actions">
              <a href="${basePathValue}${this.config.cta_link.replace(/^\//, '')}" class="exit-popup__cta">
                ${escapedCtaText}
              </a>
              <button type="button" class="exit-popup__dismiss">
                Nem, köszönöm
              </button>
            </div>
          </div>
        </div>
      `;

      return popup;
    },

    // Attach event listeners to popup
    attachListeners() {
      const { popup } = this.state;

      // Close button
      popup.querySelector('.exit-popup__close').addEventListener('click', () => {
        this.hide();
      });

      // Dismiss button
      popup.querySelector('.exit-popup__dismiss').addEventListener('click', () => {
        this.hide();
      });

      // Overlay click
      popup.querySelector('.exit-popup__overlay').addEventListener('click', () => {
        this.hide();
      });

      // ESC key
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.hide();
        }
      };
      document.addEventListener('keydown', escHandler);
      this.state.listeners.push({ event: 'keydown', handler: escHandler });
    },

    // Hide the popup
    hide() {
      if (!this.state.popup) {
        return;
      }

      this.state.popup.classList.remove('exit-popup--visible');

      setTimeout(() => {
        if (this.state.popup && this.state.popup.parentNode) {
          this.state.popup.remove();
        }
        this.state.popup = null;
      }, 300);
    },

    // Remove event listeners
    removeEventListeners() {
      this.state.listeners.forEach(({ event, handler }) => {
        if (event === 'scroll') {
          window.removeEventListener(event, handler);
        } else if (event === 'popstate') {
          window.removeEventListener(event, handler);
        } else {
          document.removeEventListener(event, handler);
        }
      });
      this.state.listeners = [];
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  };

  // Expose to window
  window.ExitPopup = ExitPopup;

  // Auto-initialize if settings are available
  if (window.exitPopupSettings) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ExitPopup.init(window.exitPopupSettings);
      });
    } else {
      ExitPopup.init(window.exitPopupSettings);
    }
  }
}());
