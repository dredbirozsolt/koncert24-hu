/**
 * FAQ Accordion Functionality
 * Handles accordion toggle and search filtering
 */

(function () {
  'use strict';

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', initializeFAQ);

  function initializeFAQ() {
    initializeAccordion();
    initializeSearch();
  }

  /**
   * Accordion Toggle Functionality
   */
  function initializeAccordion() {
    const accordionHeaders = document.querySelectorAll('.accordion__header');

    accordionHeaders.forEach((header) => {
      header.addEventListener('click', function () {
        toggleAccordionItem(this);
      });
    });
  }

  function toggleAccordionItem(header) {
    const item = header.closest('.accordion__item');
    const content = item.querySelector('.accordion__content');
    const isExpanded = header.getAttribute('aria-expanded') === 'true';

    // Toggle aria-expanded
    header.setAttribute('aria-expanded', !isExpanded);
    content.setAttribute('aria-hidden', isExpanded);

    // Toggle active classes
    if (isExpanded) {
      header.classList.remove('accordion__header--active');
      content.classList.remove('accordion__content--active');
    } else {
      header.classList.add('accordion__header--active');
      content.classList.add('accordion__content--active');
    }
  }

  /**
   * FAQ Search Functionality
   */
  function initializeSearch() {
    const searchInput = document.getElementById('faqSearch');
    const clearButton = document.getElementById('faqSearchClear');
    if (!searchInput) {return;}

    // Show/hide clear button
    searchInput.addEventListener('input', function () {
      if (clearButton) {
        if (this.value.length > 0) {
          clearButton.classList.remove('hidden');
        } else {
          clearButton.classList.add('hidden');
        }
      }

      // Debounced search
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

    // Debounce search for performance
    let searchTimeout;
  }

  function performSearch(searchTerm) {
    const normalizedSearch = normalizeText(searchTerm);
    const categories = document.querySelectorAll('.accordion__category');

    if (!searchTerm.trim()) {
      // Show all categories and items
      categories.forEach((category) => {
        category.classList.remove('hidden');
        const items = category.querySelectorAll('.accordion__item');
        items.forEach((item) => item.classList.remove('hidden'));
      });
      return;
    }

    // Search through categories and items
    categories.forEach((category) => {
      const items = category.querySelectorAll('.accordion__item');
      let categoryHasMatch = false;

      items.forEach((item) => {
        const question = item.querySelector('.accordion__title')?.textContent || '';
        const answer = item.querySelector('.accordion__body')?.textContent || '';
        const keywords = item.dataset.keywords || '';

        const searchableText = normalizeText(`${question} ${answer} ${keywords}`);

        if (searchableText.includes(normalizedSearch)) {
          item.classList.remove('hidden');
          categoryHasMatch = true;

          // Auto-expand matching items
          const header = item.querySelector('.accordion__header');
          const content = item.querySelector('.accordion__content');
          if (header && content) {
            header.classList.add('accordion__header--active');
            header.setAttribute('aria-expanded', 'true');
            content.classList.add('accordion__content--active');
            content.setAttribute('aria-hidden', 'false');
          }
        } else {
          item.classList.add('hidden');
        }
      });

      // Hide category if no matches
      if (categoryHasMatch) {
        category.classList.remove('hidden');
      } else {
        category.classList.add('hidden');
      }
    });
  }

  /**
   * Normalize text for search (remove accents, lowercase)
   */
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  }

  /**
   * Keyboard navigation support
   */
  document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('accordion__header')) {
      // Enter or Space to toggle
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleAccordionItem(e.target);
      }
    }
  });
}());

