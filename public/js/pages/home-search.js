/**
 * Home Page Hero Search with Autocomplete
 * Design system compliant autocomplete functionality
 */

(function () {
  'use strict';

  const searchInput = document.getElementById('hero-search-input');
  const searchForm = document.getElementById('hero-search-form');
  const resultsContainer = document.getElementById('hero-search-results');

  let debounceTimer;
  let currentResults = [];

  if (!searchInput || !resultsContainer) {
    return; // Exit if elements don't exist
  }

  // Reset button state on page load (back button fix)
  const submitButton = searchForm?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = 'Keresés';
  }

  // Prevent form submission - autocomplete only
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // If there's a search query, redirect to performers page with search
      const query = searchInput.value.trim();
      if (query) {
        const basePath = window.location.pathname.includes('/admin/') ? '/' : '';
        window.location.href = `${basePath}eloadok?search=${encodeURIComponent(query)}`;
      }

      return false;
    });
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
   * Display search results
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

    const html = performers.map((performer) => `
      <a href="${basePath}eloadok/${performer.slug}" class="hero-search__result-item">
        ${performer.imageUrl
    ? `<img src="${performer.imageUrl}" alt="${escapeHtml(performer.name)}" class="hero-search__result-image">`
    : `<div class="hero-search__result-image" style="display: flex; align-items: center; justify-content: center; color: var(--color-gray-400);">
               <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                 <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
               </svg>
             </div>`
  }
        <div class="hero-search__result-content">
          <div class="hero-search__result-name">${highlightMatch(escapeHtml(performer.name), query)}</div>
          <div class="hero-search__result-category">${escapeHtml(performer.categoryDisplayName || performer.category || 'Előadó')}</div>
        </div>
      </a>
    `).join('');

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
  }, 300));

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
