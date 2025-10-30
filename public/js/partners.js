/**
 * Partners Page JavaScript
 *
 * Handles real-time search functionality with debouncing.
 * Follows design system patterns from faq-accordion.js
 */

(function () {
  'use strict';

  /**
   * Initialize partner search functionality
   */
  function initPartnerSearch() {
    console.log('🔍 Partner search initializing...');

    const searchInput = document.getElementById('partnerSearch');
    const clearButton = document.getElementById('partnerSearchClear');
    const searchForm = document.getElementById('partnerSearchForm');

    console.log('Elements found:', {
      searchInput: Boolean(searchInput),
      clearButton: Boolean(clearButton),
      searchForm: Boolean(searchForm)
    });

    if (!searchInput) {
      console.warn('❌ Search input not found!');
      return;
    }

    let searchTimeout;

    // Prevent form submission (client-side filtering only)
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }

    // Also prevent submit button click
    const submitButton = searchForm?.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }

    // Real-time search with debouncing
    searchInput.addEventListener('input', function () {
      // Show/hide clear button
      if (clearButton) {
        if (this.value.length > 0) {
          clearButton.classList.remove('hidden');
        } else {
          clearButton.classList.add('hidden');
        }
      }

      // Debounced search for performance
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        performSearch(this.value);
      }, 300);
    });

    // Clear button functionality
    if (clearButton) {
      clearButton.addEventListener('click', function () {
        searchInput.value = '';
        this.classList.add('hidden');
        performSearch('');
        searchInput.focus();
      });
    }

    // Escape key to clear search
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        this.value = '';
        if (clearButton) {
          clearButton.classList.add('hidden');
        }
        performSearch('');
      }
    });
  }

  /**
   * Perform search filtering
   */
  function performSearch(searchTerm) {
    console.log('🔎 performSearch called with:', searchTerm);

    const normalizedSearch = normalizeText(searchTerm);
    const partnerCards = document.querySelectorAll('.partner-card-link');
    const noPartnersMessage = document.querySelector('.no-partners');
    const partnersGrid = document.querySelector('.partners-grid');

    console.log('Search elements:', {
      partnerCards: partnerCards.length,
      noPartnersMessage: Boolean(noPartnersMessage),
      partnersGrid: Boolean(partnersGrid)
    });

    if (!searchTerm.trim()) {
      // Show all partners
      partnerCards.forEach((card) => {
        card.classList.remove('hidden');
      });

      if (partnersGrid && noPartnersMessage) {
        partnersGrid.classList.remove('hidden');
        noPartnersMessage.classList.add('hidden');
      }
      return;
    }

    // Search through partners
    let visibleCount = 0;

    partnerCards.forEach((card) => {
      const partnerName = card.querySelector('.partner-name')?.textContent || '';
      const partnerCategory = card.querySelector('.partner-category')?.textContent || '';
      const partnerDescription = card.querySelector('.partner-description')?.textContent || '';

      const searchableText = normalizeText(`${partnerName} ${partnerCategory} ${partnerDescription}`);

      if (searchableText.includes(normalizedSearch)) {
        card.classList.remove('hidden');
        visibleCount += 1;
      } else {
        card.classList.add('hidden');
      }
    });

    // Show/hide "no results" message
    if (partnersGrid && noPartnersMessage) {
      if (visibleCount === 0) {
        partnersGrid.classList.add('hidden');
        noPartnersMessage.classList.remove('hidden');
      } else {
        partnersGrid.classList.remove('hidden');
        noPartnersMessage.classList.add('hidden');
      }
    }
  }

  /**
   * Normalize text for search (remove accents, lowercase)
   * Same as faq-accordion.js
   */
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPartnerSearch);
  } else {
    initPartnerSearch();
  }
}());
