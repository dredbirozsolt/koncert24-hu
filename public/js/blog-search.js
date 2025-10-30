/**
 * Blog Page Search JavaScript
 *
 * Handles real-time search functionality with debouncing.
 * Follows design system patterns from partners.js
 */

(function () {
  'use strict';

  /**
   * Initialize blog search functionality
   */
  function initBlogSearch() {
    console.log('🔍 Blog search initializing...');

    const searchInput = document.getElementById('blog-search-input');
    const clearButton = document.getElementById('blog-search-clear');
    const searchForm = document.getElementById('blog-search-form');

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
    const blogCards = document.querySelectorAll('.card__grid .card');
    const featuredPost = document.querySelector('.featured-post');
    const resultCount = document.querySelector('.result-count__number');
    const noResultsMessage = document.getElementById('blog-no-results');
    const cardGrid = document.querySelector('.card__grid');

    console.log('Search elements:', {
      blogCards: blogCards.length,
      featuredPost: Boolean(featuredPost),
      resultCount: Boolean(resultCount),
      noResultsMessage: Boolean(noResultsMessage)
    });

    if (!searchTerm.trim()) {
      // Show all
      blogCards.forEach((card) => {
        card.classList.remove('hidden');
      });

      if (featuredPost) {
        featuredPost.classList.remove('hidden');
      }

      if (cardGrid) {
        cardGrid.style.display = '';
      }

      if (noResultsMessage) {
        noResultsMessage.style.display = 'none';
      }

      // Reset count
      if (resultCount) {
        const totalCards = blogCards.length + (featuredPost ? 1 : 0);
        resultCount.textContent = totalCards;
      }

      return;
    }

    // Search through blog posts
    let visibleCount = 0;

    // Search featured post
    if (featuredPost) {
      const title = featuredPost.querySelector('.featured-post__title')?.textContent || '';
      const excerpt = featuredPost.querySelector('.featured-post__excerpt')?.textContent || '';
      const category = featuredPost.querySelector('.featured-post__badge')?.textContent || '';

      const searchableText = normalizeText(`${title} ${excerpt} ${category}`);

      if (searchableText.includes(normalizedSearch)) {
        featuredPost.classList.remove('hidden');
        visibleCount += 1;
      } else {
        featuredPost.classList.add('hidden');
      }
    }

    // Search regular cards
    blogCards.forEach((card) => {
      const title = card.querySelector('.card__title')?.textContent || '';
      const excerpt = card.querySelector('.card__text')?.textContent || '';
      const category = card.querySelector('.badge')?.textContent || '';

      const searchableText = normalizeText(`${title} ${excerpt} ${category}`);

      if (searchableText.includes(normalizedSearch)) {
        card.classList.remove('hidden');
        visibleCount += 1;
      } else {
        card.classList.add('hidden');
      }
    });

    // Show/hide no results message
    if (noResultsMessage && cardGrid) {
      if (visibleCount === 0) {
        cardGrid.style.display = 'none';
        noResultsMessage.style.display = 'block';
      } else {
        cardGrid.style.display = '';
        noResultsMessage.style.display = 'none';
      }
    }

    // Update result count
    if (resultCount) {
      resultCount.textContent = visibleCount;
    }
  }

  /**
   * Normalize text for search (remove accents, lowercase)
   * Same as partners.js and faq-accordion.js
   */
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlogSearch);
  } else {
    initBlogSearch();
  }
}());
