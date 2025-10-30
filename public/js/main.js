/**
 * Main JavaScript file for koncert24.hu
 * Handles interactive functionality, lazy loading, and progressive enhancement
 */

(function () {
  'use strict';

  // Constants
  const VALIDATION_PREFIX = 'Érvényes';
  const VALIDATION_SUFFIX = ' adjon meg';
  const FORM_ERROR_CLASS = 'form-error';

  // Utility functions
  const utils = {
    // Debounce function for performance optimization
    debounce(func, wait, immediate) {
      let timeout = null;

      return function executedFunction(...args) {
        const later = () => {
          timeout = null;
          if (!immediate) { func.apply(this, args); }
        };
        const callNow = immediate && !timeout;

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) { func.apply(this, args); }
      };
    },

    // Check if element is in viewport
    isInViewport(element) {
      const rect = element.getBoundingClientRect();


      return (
        rect.top >= 0
        && rect.left >= 0
        && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
        && rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },

    // Smooth scroll to element
    scrollToElement(element, offset = 0) {
      const elementPosition = element.offsetTop - offset;

      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    },

    // Show loading state
    showLoading() {
      const loadingOverlay = document.querySelector('.loading-overlay');

      if (loadingOverlay && window.Alpine) {
        Alpine.store('loading', true);
      }
    },

    // Hide loading state
    hideLoading() {
      const loadingOverlay = document.querySelector('.loading-overlay');

      if (loadingOverlay && window.Alpine) {
        Alpine.store('loading', false);
      }
    }
  };

  // Enhanced image lazy loading with modern browser support
  const lazyLoadImages = () => {
    // Use native lazy loading if supported
    if ('loading' in HTMLImageElement.prototype) {
      const images = document.querySelectorAll('img[data-src]');

      images.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.setAttribute('loading', 'lazy');
      });
    } else {
      // Fallback for older browsers
      const images = document.querySelectorAll('img[data-src]');
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target;

            img.src = img.dataset.src;
            img.classList.remove('lazy');
            img.classList.add('loaded');
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
        threshold: 0.01
      });

      images.forEach((img) => {
        img.classList.add('lazy');
        imageObserver.observe(img);
      });
    }
  };

  // Form enhancement
  const enhanceForms = () => {
    const forms = document.querySelectorAll('form');

    forms.forEach((form) => {
      // Skip hero search forms (they handle their own state)
      if (form.id === 'hero-search-form'
          || form.id === 'partnerSearchForm'
          || form.id === 'performerSearchForm'
          || form.id === 'blog-search-form') {
        return;
      }

      // Add loading state to form submissions
      form.addEventListener('submit', () => {
        const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Küldés...';
        }
        utils.showLoading();
      });

      // Real-time validation
      const inputs = form.querySelectorAll('input, textarea, select');

      inputs.forEach((input) => {
        input.addEventListener('blur', validateInput);
        input.addEventListener('input', utils.debounce(validateInput, 300));
      });
    });
  };

  // Validation helper: Check if email is valid
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validation helper: Check if phone is valid
  const isValidPhone = (phone) => {
    const phoneRegex = /^[+]?[0-9\s\-()]{8,20}$/;
    return phoneRegex.test(phone);
  };

  // Validation helper: Check if date is in future
  const isFutureDate = (dateString) => {
    const inputDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return inputDate >= today;
  };

  // Validation helper: Get validation error for input
  const getValidationError = (input) => {
    // Check if required field is empty
    if (input.required && !input.value.trim()) {
      return 'Ez a mező kötelező';
    }

    // Skip validation if field is empty and not required
    if (!input.value) {
      return null;
    }

    // Validate email
    if (input.type === 'email' && !isValidEmail(input.value)) {
      return `${VALIDATION_PREFIX} e-mail címet${VALIDATION_SUFFIX}`;
    }

    // Validate phone
    if (input.type === 'tel' && !isValidPhone(input.value)) {
      return `${VALIDATION_PREFIX} telefonszámot${VALIDATION_SUFFIX}`;
    }

    // Validate date
    if (input.type === 'date' && !isFutureDate(input.value)) {
      return 'A dátum nem lehet a múltban';
    }

    return null;
  };

  // Validation helper: Display error on input
  const displayValidationError = (input, errorMessage) => {
    const errorElement = input.nextElementSibling;
    input.classList.add('error');
    if (errorElement && errorElement.classList.contains(FORM_ERROR_CLASS)) {
      errorElement.textContent = errorMessage;
    }
  };

  // Validation helper: Clear error on input
  const clearValidationError = (input) => {
    const errorElement = input.nextElementSibling;
    input.classList.remove('error');
    if (errorElement && errorElement.classList.contains(FORM_ERROR_CLASS)) {
      errorElement.textContent = '';
    }
  };

  // Input validation
  const validateInput = (e) => {
    const input = e.target;

    // Clear previous errors
    clearValidationError(input);

    // Get validation error if any
    const errorMessage = getValidationError(input);

    // Show error if validation failed
    if (errorMessage) {
      displayValidationError(input, errorMessage);
      return false;
    }

    return true;
  };

  // Search functionality
  const enhanceSearch = () => {
    const searchInputs = document.querySelectorAll('input[type="search"]');

    searchInputs.forEach((input) => {
      const form = input.closest('form');

      if (form) {
        input.addEventListener('input', utils.debounce(() => {
          if (input.value.length > 2 || input.value.length === 0) {
            form.submit();
          }
        }, 500));
      }
    });
  };

  // Back to top button
  const addBackToTop = () => {
    const backToTopButton = document.createElement('button');

    backToTopButton.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
        <path fill-rule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
      </svg>
    `;
    backToTopButton.className = 'back-to-top';
    backToTopButton.setAttribute('aria-label', 'Vissza a tetejére');
    backToTopButton.setAttribute('title', 'Vissza a tetejére');

    document.body.appendChild(backToTopButton);

    // Show/hide based on scroll position
    const toggleBackToTop = () => {
      if (window.pageYOffset > 300) {
        backToTopButton.classList.add('back-to-top--visible');
      } else {
        backToTopButton.classList.remove('back-to-top--visible');
      }
    };

    window.addEventListener('scroll', utils.debounce(toggleBackToTop, 100));

    // Smooth scroll to top
    backToTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  };

  // Analytics and tracking (placeholder for Google Analytics, etc.)
  const initAnalytics = () => {
    // Track outbound links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');

      if (link && link.hostname !== location.hostname && window.gtag) {
        // Track external link clicks
        gtag('event', 'click', {
          event_category: 'outbound',
          event_label: link.href
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;

      if (form.tagName === 'FORM' && window.gtag) {
        gtag('event', 'submit', {
          event_category: 'form',
          event_label: form.id || form.className || 'unnamed_form'
        });
      }
    });
  };

  // Performance optimizations
  const optimizePerformance = () => {
    // Preload critical resources
    const preloadLinks = [
      { href: '/css/style.css', as: 'style' },
      { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap', as: 'style' }
    ];

    preloadLinks.forEach((link) => {
      const linkEl = document.createElement('link');

      linkEl.rel = 'preload';
      linkEl.href = link.href;
      linkEl.as = link.as;
      document.head.appendChild(linkEl);
    });

    // Prefetch likely next pages
    const performerLinks = document.querySelectorAll('a[href*="/eloadok/"]');
    const linkPrefetcher = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = document.createElement('link');

          link.rel = 'prefetch';
          link.href = entry.target.href;
          document.head.appendChild(link);
          linkPrefetcher.unobserve(entry.target);
        }
      });
    });

    performerLinks.forEach((link) => linkPrefetcher.observe(link));
  };

  // Accessibility enhancements
  const enhanceAccessibility = () => {
    // Enhanced keyboard navigation for dropdowns
    const dropdowns = document.querySelectorAll('.nav__dropdown');

    dropdowns.forEach((dropdown) => {
      const trigger = dropdown.querySelector('.nav__dropdown-trigger');
      const menu = dropdown.querySelector('.nav__dropdown-menu');

      if (trigger && menu) {
        trigger.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            trigger.click();
            const firstLink = menu.querySelector('a');

            if (firstLink) { firstLink.focus(); }
          }
        });

        // Escape key to close dropdown
        menu.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            trigger.click();
            trigger.focus();
          }
        });
      }
    });

    // Improve form labels and error announcements
    const forms = document.querySelectorAll('form');

    forms.forEach((form) => {
      const inputs = form.querySelectorAll('input, textarea, select');

      inputs.forEach((input) => {
        // Add aria-describedby for error messages
        const errorElement = input.nextElementSibling;

        if (errorElement && errorElement.classList.contains(FORM_ERROR_CLASS)) {
          const errorId = `error-${input.name || input.id || Math.random().toString(36).substr(2, 9)}`;

          errorElement.id = errorId;
          input.setAttribute('aria-describedby', errorId);
        }
      });
    });
  };

  // Error handling
  window.addEventListener('error', (e) => {
    console.error('JavaScript error:', e.error);

    // Track errors in analytics if available
    if (window.gtag) {
      gtag('event', 'exception', {
        description: e.error.message,
        fatal: false
      });
    }
  });

  // Initialize everything when DOM is ready
  const init = () => {
    lazyLoadImages();
    enhanceForms();
    enhanceSearch();
    addBackToTop();
    initAnalytics();
    optimizePerformance();
    enhanceAccessibility();
    // Cookie consent is now handled by cookie-consent.js module

    console.log('Koncert24.hu JavaScript initialized');
  };

  // DOM ready check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export utils for potential use by other scripts
  window.koncert24Utils = utils;
}());
