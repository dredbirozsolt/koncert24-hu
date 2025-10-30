/**
 * GDPR-Compliant Cookie Consent Manager
 * Manages user consent for different cookie categories
 */

(function () {
  'use strict';

  const CookieConsent = {
    // Configuration
    config: {
      consentCookieName: 'cookieConsentV2',
      consentExpiryDays: 365,
      apiEndpoint: '/api/cookie-consent',
      categories: {
        essential: {
          name: 'Elengedhetetlen',
          description: 'Ezek a sütik nélkülözhetetlenek az oldal működéséhez (pl. munkamenet-azonosító, biztonsági beállítások). Ezek nem kapcsolhatók ki.',
          required: true,
          retention: 'Munkamenet / 1 év'
        },
        statistics: {
          name: 'Statisztikai',
          description: 'Segítenek megérteni, hogyan használják a látogatók az oldalt, így javíthatjuk a felhasználói élményt.',
          required: false,
          retention: 'Maximum 2 év'
        },
        marketing: {
          name: 'Marketing',
          description: 'Személyre szabott hirdetések megjelenítéséhez és mérésükhöz használjuk ezeket a sütiket.',
          required: false,
          retention: 'Maximum 1 év'
        }
      }
    },

    // Current consent state
    consent: {
      essential: true,
      statistics: false,
      marketing: false,
      timestamp: null,
      consentId: null,
      expiresAt: null
    },

    // Initialize the consent manager
    init() {
      this.loadConsent();

      if (this.hasValidConsent()) {
        this.applyConsent();
      } else {
        this.showBanner();
      }

      // Note: Cookie settings link is already in footer (layout.ejs)
      // No need to add it dynamically
    },

    // Load consent from localStorage
    loadConsent() {
      try {
        const stored = localStorage.getItem(this.config.consentCookieName);
        if (stored) {
          const parsed = JSON.parse(stored);

          // Check if consent is expired
          if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
            this.consent = parsed;
            return true;
          }
          // Expired, remove it
          localStorage.removeItem(this.config.consentCookieName);
        }
      } catch (e) {
        console.error('Error loading cookie consent:', e);
      }
      return false;
    },

    // Save consent to localStorage and backend
    async saveConsent(method, preferences) {
      const prefs = preferences || {};
      const consentId = this.generateConsentId();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.config.consentExpiryDays);

      this.consent = {
        essential: true,
        statistics: prefs.statistics || false,
        marketing: prefs.marketing || false,
        timestamp: new Date().toISOString(),
        consentId,
        expiresAt: expiresAt.toISOString(),
        method
      };

      // Save to localStorage
      try {
        localStorage.setItem(this.config.consentCookieName, JSON.stringify(this.consent));

        // Also keep legacy format for backward compatibility
        localStorage.setItem('cookieConsent', 'true');
        localStorage.setItem('cookieConsentDetails', JSON.stringify({
          statistics: this.consent.statistics,
          marketing: this.consent.marketing
        }));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }

      // Send to backend for logging
      try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const response = await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            consentId,
            essential: true,
            statistics: this.consent.statistics,
            marketing: this.consent.marketing,
            consentMethod: method
          })
        });

        if (!response.ok) {
          console.warn('Failed to log consent to backend');
        }
      } catch (e) {
        console.warn('Error sending consent to backend:', e);
      }

      this.applyConsent();
    },

    // Check if we have valid consent
    hasValidConsent() {
      return this.consent.consentId
        && this.consent.expiresAt
        && new Date(this.consent.expiresAt) > new Date();
    },

    // Generate unique consent ID
    generateConsentId() {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      return `consent_${timestamp}_${random}`;
    },

    // Apply consent (load scripts based on preferences)
    applyConsent() {
      // Update Google Analytics consent mode (if GA4 is loaded)
      if (typeof gtag === 'function') {
        gtag('consent', 'update', {
          analytics_storage: this.consent.statistics ? 'granted' : 'denied',
          ad_storage: this.consent.marketing ? 'granted' : 'denied'
        });
      }

      // Trigger GTM consent mode update
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'consent_update',
          consent_statistics: this.consent.statistics,
          consent_marketing: this.consent.marketing
        });
      }

      // Inject GTM if user consented and it's not already loaded
      if ((this.consent.statistics || this.consent.marketing) && typeof window.gtmInjected === 'undefined') {
        this.injectGTM();
      }

      // Trigger custom event for other scripts to listen to
      window.dispatchEvent(new CustomEvent('cookieConsentUpdated', {
        detail: this.consent
      }));
    },

    // Inject Google Tag Manager
    injectGTM() {
      // Check if GTM code is available in the page
      const gtmCodeElement = document.querySelector('[data-gtm-code]');
      if (!gtmCodeElement) {
        return;
      }

      const gtmId = gtmCodeElement.getAttribute('data-gtm-code');
      if (!gtmId || !/^GTM-[A-Z0-9]+$/.test(gtmId)) {
        return;
      }

      // Mark as injected
      window.gtmInjected = true;

      // Initialize dataLayer
      window.dataLayer = window.dataLayer || [];

      // GTM consent mode
      window.dataLayer.push({
        event: 'consent_init',
        consent_statistics: this.consent.statistics,
        consent_marketing: this.consent.marketing
      });

      // Inject GTM script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
      document.head.appendChild(script);

      // Inject GTM noscript iframe
      const noscript = document.createElement('noscript');
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
      iframe.height = '0';
      iframe.width = '0';
      iframe.style.display = 'none';
      iframe.style.visibility = 'hidden';
      noscript.appendChild(iframe);
      document.body.insertBefore(noscript, document.body.firstChild);
    },

    // Show consent banner
    showBanner() {
      const banner = this.createBannerHTML();
      document.body.appendChild(banner);

      // Load current preferences into checkboxes
      this.loadPreferencesIntoUI(banner);

      // Animate in
      setTimeout(() => {
        banner.classList.add('cookie-banner--visible');
      }, 100);

      // Attach event listeners
      this.attachBannerListeners(banner);
    },

    // Load saved preferences into UI
    loadPreferencesIntoUI(banner) {
      const statisticsCheckbox = banner.querySelector('[data-category="statistics"]');
      const marketingCheckbox = banner.querySelector('[data-category="marketing"]');

      if (statisticsCheckbox) {
        statisticsCheckbox.checked = this.consent.statistics;
      }
      if (marketingCheckbox) {
        marketingCheckbox.checked = this.consent.marketing;
      }
    },

    // Create banner HTML
    createBannerHTML() {
      const banner = document.createElement('div');
      banner.className = 'cookie-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-label', 'Süti beállítások');
      banner.setAttribute('aria-modal', 'true');

      const basePathValue = window.basePath || '/';

      banner.innerHTML = `
        <div class="cookie-banner__simple">
          <div class="cookie-banner__content">
            <div class="cookie-banner__text">
              <p>Ez a weboldal sütiket használ a legjobb felhasználói élmény biztosítása érdekében. 
              <a href="${basePathValue}info/adatkezeles" target="_blank" class="cookie-banner__link">Adatkezelési tájékoztató</a></p>
            </div>
            <div class="cookie-banner__actions">
              <button type="button" class="btn btn--primary" data-action="accept-all">
                Minden cookie elfogadása
              </button>
              <button type="button" class="btn btn--secondary" data-action="show-details">
                További lehetőségek
              </button>
            </div>
          </div>
        </div>

        <div class="cookie-banner__detailed" style="display: none;">
          <div class="cookie-banner__header">
            <h2 class="cookie-banner__title">Süti beállítások</h2>
            <button type="button" class="cookie-banner__close" data-action="close-details" aria-label="Bezárás">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="cookie-banner__categories">
            ${this.createCategoryHTML('essential')}
            ${this.createCategoryHTML('statistics')}
            ${this.createCategoryHTML('marketing')}
          </div>

          <div class="cookie-banner__actions">
            <button type="button" class="btn btn--primary" data-action="accept-all">
              Minden cookie elfogadása
            </button>
            <button type="button" class="btn btn--secondary" data-action="accept-selected">
              Kiválasztottak elfogadása
            </button>
            <button type="button" class="btn btn--outline-secondary" data-action="essential-only">
              Csak az elengedhetetlen elfogadása
            </button>
          </div>
        </div>
      `;

      return banner;
    },

    // Create category HTML
    createCategoryHTML(categoryKey) {
      const category = this.config.categories[categoryKey];
      const checked = category.required ? 'checked' : '';
      const disabled = category.required ? 'disabled' : '';

      return `
        <div class="cookie-category">
          <div class="cookie-category__header">
            <label class="cookie-category__label">
              <input
                type="checkbox"
                class="cookie-category__checkbox"
                data-category="${categoryKey}"
                ${checked}
                ${disabled}
              >
              <span class="cookie-category__name">${category.name}</span>
              ${category.required ? '<span class="cookie-category__required">(Kötelező)</span>' : ''}
            </label>
          </div>
          <div class="cookie-category__body">
            <p class="cookie-category__description">${category.description}</p>
            <p class="cookie-category__retention"><strong>Megőrzési idő:</strong> ${category.retention}</p>
          </div>
        </div>
      `;
    },

    // Attach event listeners to banner
    attachBannerListeners(banner) {
      // Accept all
      banner.querySelectorAll('[data-action="accept-all"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.saveConsent('accept_all', { statistics: true, marketing: true });
          this.removeBanner(banner);
        });
      });

      // Essential only
      banner.querySelectorAll('[data-action="essential-only"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.saveConsent('essential_only', { statistics: false, marketing: false });
          this.removeBanner(banner);
        });
      });

      // Show details
      banner.querySelectorAll('[data-action="show-details"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          banner.querySelector('.cookie-banner__simple').style.display = 'none';
          banner.querySelector('.cookie-banner__detailed').style.display = 'block';
        });
      });

      // Close details
      banner.querySelectorAll('[data-action="close-details"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          banner.querySelector('.cookie-banner__detailed').style.display = 'none';
          banner.querySelector('.cookie-banner__simple').style.display = 'block';
        });
      });

      // Accept selected
      banner.querySelectorAll('[data-action="accept-selected"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const statistics = banner.querySelector('[data-category="statistics"]').checked;
          const marketing = banner.querySelector('[data-category="marketing"]').checked;
          this.saveConsent('accept_selected', { statistics, marketing });
          this.removeBanner(banner);
        });
      });
    },

    // Remove banner from DOM
    removeBanner(banner) {
      banner.classList.remove('cookie-banner--visible');
      setTimeout(() => {
        banner.remove();
      }, 300);
    }

    // Note: The "Cookie settings" link is already in the footer via layout.ejs
    // with proper event handling. No need to add it dynamically.
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      CookieConsent.init();
    });
  } else {
    CookieConsent.init();
  }

  // Expose to window for debugging and external access
  window.CookieConsent = CookieConsent;
}());
