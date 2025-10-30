/**
 * Alternative Page Hero Search with Autocomplete (No Images)
 * Design system compliant autocomplete functionality
 */

(function () {
  'use strict';

  const searchInput = document.getElementById('hero-search-input');
  const searchForm = document.getElementById('hero-search-form');
  const resultsContainer = document.getElementById('hero-search-results');
  const clearButton = document.getElementById('hero-search-clear');

  let debounceTimer;
  let currentResults = [];

  if (!searchInput || !resultsContainer) {
    return; // Exit if elements don't exist
  }

  /**
   * Toggle clear button visibility
   */
  function toggleClearButton() {
    if (clearButton) {
      if (searchInput.value.trim().length > 0) {
        clearButton.classList.remove('hidden');
      } else {
        clearButton.classList.add('hidden');
      }
    }
  }

  /**
   * Clear search input and results
   */
  function clearSearch() {
    searchInput.value = '';
    hideResults();
    toggleClearButton();
    searchInput.focus();
  }

  /**
   * Debounce function to limit API calls
   */
  function debounce(func, delay) {
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => func.apply(context, args), delay);
    };
  }

  /**
   * Fetch performers from API
   */
  async function searchPerformers(query) {
    if (!query || query.length < 2) {
      hideResults();
      return;
    }

    try {
      const response = await fetch(`/eloadok/api/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();

      if (data.success) {
        currentResults = data.performers || [];
        displayResults(currentResults, query);
      } else {
        hideResults();
      }
    } catch (error) {
      console.error('Search error:', error);
      hideResults();
    }
  }

  /**
   * Display search results (WITHOUT images - text only with price)
   */
  function displayResults(performers, query) {
    if (performers.length === 0) {
      resultsContainer.innerHTML = `
        <div class="hero-search__no-results">
          Nem találtunk előadót a keresésre: "${escapeHtml(query)}"
        </div>
      `;
      resultsContainer.style.display = 'block';
      return;
    }

    const basePath = window.location.pathname.includes('/admin/') ? '/' : '';

    // NO IMAGES - only text content with price if logged in
    const html = performers.map((performer) => {
      // Build price display if available and user is logged in
      let priceDisplay = '';
      if (performer.price && performer.price > 0) {
        const formattedPrice = new Intl.NumberFormat('hu-HU').format(performer.price);
        priceDisplay = `<div class="hero-search__result-price">${formattedPrice} Ft</div>`;
      }

      // Use style instead of category
      let styleDisplay = 'Előadó';
      if (performer.style && Array.isArray(performer.style) && performer.style.length > 0) {
        styleDisplay = performer.style.join(', ');
      } else if (performer.style && typeof performer.style === 'string') {
        styleDisplay = performer.style;
      }

      return `
        <a href="${basePath}eloadok/${performer.slug}" class="hero-search__result-item hero-search__result-item--text-only">
          <div class="hero-search__result-content">
            <div class="hero-search__result-name">${highlightMatch(escapeHtml(performer.name), query)}</div>
            <div class="hero-search__result-category">${escapeHtml(styleDisplay)}</div>
          </div>
          ${priceDisplay}
        </a>
      `;
    }).join('');

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
  }

  /**
   * Hide results dropdown
   */
  function hideResults() {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    currentResults = [];
  }

  /**
   * Highlight matching text
   */
  function highlightMatch(text, query) {
    if (!query) {return text;}

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape special regex characters
   */
  function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Event listeners
   */

  // Input event with debounce
  searchInput.addEventListener('input', debounce((e) => {
    const query = e.target.value.trim();
    searchPerformers(query);
    toggleClearButton();
  }, 300));

  // Clear button click
  if (clearButton) {
    clearButton.addEventListener('click', clearSearch);
  }

  // Focus event - show results if we have them
  searchInput.addEventListener('focus', () => {
    if (currentResults.length > 0) {
      resultsContainer.style.display = 'block';
    }
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) {
      hideResults();
    }
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const items = resultsContainer.querySelectorAll('.hero-search__result-item');

    if (items.length === 0) {return;}

    const currentIndex = Array.from(items).findIndex((item) => item === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < items.length - 1) {
        items[currentIndex + 1].focus();
      } else {
        items[0].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        items[currentIndex - 1].focus();
      } else {
        searchInput.focus();
      }
    } else if (e.key === 'Escape') {
      hideResults();
      searchInput.blur();
    }
  });

  // Prevent form submission when clicking on results
  resultsContainer.addEventListener('click', (e) => {
    if (e.target.closest('.hero-search__result-item')) {
      e.preventDefault();
      window.location.href = e.target.closest('.hero-search__result-item').href;
    }
  });
}());
