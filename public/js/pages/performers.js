/**
 * Performers Page JavaScript
 * Handles search, filtering, and infinite scroll
 */

// Server data from EJS template (injected by template)
const serverData = {
  basePath: window.basePath || '/',
  currentPage: parseInt(document.querySelector('[data-current-page]')?.dataset.currentPage) || 1,
  totalPages: parseInt(document.querySelector('[data-total-pages]')?.dataset.totalPages) || 1,
  search: document.querySelector('[data-search]')?.dataset.search || '',
  category: document.querySelector('[data-category]')?.dataset.category || '',
  sort: document.querySelector('[data-sort]')?.dataset.sort || 'name'
};

// Global flag to disable infinite scroll during search
let isSearchActive = false;

/**
 * Clear search function
 */
function clearSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }

  // Re-enable infinite scroll
  isSearchActive = false;

  // Navigate to base URL without search
  window.location.href = `${serverData.basePath}eloadok`;
}

/**
 * Toggle search clear button visibility
 */
function toggleSearchClearButton() {
  const searchInput = document.getElementById('search-input');
  const clearButton = document.getElementById('search-clear-btn');

  if (searchInput && clearButton) {
    if (searchInput.value.trim() !== '') {
      clearButton.classList.remove('hidden');
    } else {
      clearButton.classList.add('hidden');
    }
  }
}

/**
 * Clear category filter function
 */
function clearCategoryFilter(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Build URL without category but preserve search and sort
  const params = new URLSearchParams();
  if (serverData.search) {
    params.set('search', serverData.search);
  }
  if (serverData.sort && serverData.sort !== 'name') {
    params.set('sort', serverData.sort);
  }
  const paramString = params.toString();

  let clearUrl = `${serverData.basePath}eloadok`;
  if (paramString) {
    clearUrl += `?${paramString}`;
  }

  window.location.href = clearUrl;
}

/**
 * Clear performance type filter function
 */
function clearPerformanceTypeFilter(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Build URL without performanceType but preserve search, sort, and style
  const params = new URLSearchParams(window.location.search);
  params.delete('performanceType');
  const paramString = params.toString();

  let clearUrl = `${serverData.basePath}eloadok`;
  if (paramString) {
    clearUrl += `?${paramString}`;
  }

  window.location.href = clearUrl;
}

/**
 * Clear sort filter function
 */
function clearSortFilter(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Build URL without sort but preserve search and category
  const params = new URLSearchParams();
  if (serverData.search) {
    params.set('search', serverData.search);
  }
  const paramString = params.toString();

  let clearUrl;
  if (serverData.category) {
    clearUrl = `${serverData.basePath}eloadok/kategoria/${serverData.category}`;
  } else {
    clearUrl = `${serverData.basePath}eloadok`;
  }

  if (paramString) {
    clearUrl += `?${paramString}`;
  }

  window.location.href = clearUrl;
}

/**
 * Clear price filter function
 */
function clearPriceFilter(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Build URL without price filters but preserve search, category, and sort
  const params = new URLSearchParams(window.location.search);
  params.delete('priceMin');
  params.delete('priceMax');

  const paramString = params.toString();

  let clearUrl;
  if (serverData.category) {
    clearUrl = `${serverData.basePath}eloadok/kategoria/${serverData.category}`;
  } else {
    clearUrl = `${serverData.basePath}eloadok`;
  }

  if (paramString) {
    clearUrl += `?${paramString}`;
  }

  window.location.href = clearUrl;
}

/**
 * Clear style filter function
 */
function clearStyleFilter(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  // Build URL without style filter but preserve other params
  const params = new URLSearchParams(window.location.search);
  params.delete('style');

  const paramString = params.toString();

  let clearUrl;
  if (serverData.category) {
    clearUrl = `${serverData.basePath}eloadok/kategoria/${serverData.category}`;
  } else {
    clearUrl = `${serverData.basePath}eloadok`;
  }

  if (paramString) {
    clearUrl += `?${paramString}`;
  }

  window.location.href = clearUrl;
}

/**
 * Simple live search without cursor issues
 */
let liveSearchTimeout;

function handleLiveSearch(value) {
  clearTimeout(liveSearchTimeout);

  // Set search active flag to disable infinite scroll
  isSearchActive = value.trim().length > 0;

  // Show loading spinner
  const searchLoading = document.getElementById('search-loading');
  if (searchLoading) {
    searchLoading.classList.add('active');
    searchLoading.setAttribute('aria-hidden', 'false');
  }

  liveSearchTimeout = setTimeout(() => {
    // Only update results, never touch the input field
    updateSearchResults(value);
  }, 400);
}

function updateSearchResults(searchTerm) {
  const params = new URLSearchParams();
  if (searchTerm.trim()) {
    params.set('search', searchTerm.trim());
  }
  if (serverData.sort && serverData.sort !== 'name') {
    params.set('sort', serverData.sort);
  }

  let searchUrl;
  if (serverData.category) {
    searchUrl = `${serverData.basePath}eloadok/kategoria/${serverData.category}`;
  } else {
    searchUrl = `${serverData.basePath}eloadok`;
  }

  if (params.toString()) {
    searchUrl += `?${params.toString()}`;
  }

  fetch(searchUrl)
    .then((response) => response.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Update entire results container (includes grid AND empty state)
      const newResultsContainer = doc.getElementById('performers-results-container');
      const currentResultsContainer = document.getElementById('performers-results-container');
      if (newResultsContainer && currentResultsContainer) {
        currentResultsContainer.innerHTML = newResultsContainer.innerHTML;
      }

      // Update result count
      const newResultCount = doc.getElementById('result-count');
      const currentResultCount = document.getElementById('result-count');
      if (newResultCount && currentResultCount) {
        currentResultCount.innerHTML = newResultCount.innerHTML;
      }

      // Update active filters
      const newActiveFilters = doc.getElementById('active-filters');
      const currentActiveFilters = document.getElementById('active-filters');
      if (newActiveFilters && currentActiveFilters) {
        currentActiveFilters.innerHTML = newActiveFilters.innerHTML;
      } else if (!newActiveFilters && currentActiveFilters) {
        currentActiveFilters.remove();
      }

      // Announce results to screen readers
      const searchStatus = document.getElementById('search-status');
      if (searchStatus && newResultCount) {
        const resultText = newResultCount.textContent.trim();
        searchStatus.textContent = `Keresés befejezve. ${resultText}`;

        // Clear announcement after 3 seconds
        setTimeout(() => {
          searchStatus.textContent = '';
        }, 3000);
      }

      // Hide loading spinner
      const searchLoading = document.getElementById('search-loading');
      if (searchLoading) {
        searchLoading.classList.remove('active');
        searchLoading.setAttribute('aria-hidden', 'true');
      }

      // Re-observe lazy images for new content
      observeLazyImages();

      // Update URL silently
      history.replaceState(null, '', searchUrl);
    })
    .catch((error) => {
      console.log('Search error:', error);

      // Hide loading spinner on error
      const searchLoading = document.getElementById('search-loading');
      if (searchLoading) {
        searchLoading.classList.remove('active');
        searchLoading.setAttribute('aria-hidden', 'true');
      }

      // Announce error to screen readers
      const searchStatus = document.getElementById('search-status');
      if (searchStatus) {
        searchStatus.textContent = 'Hiba történt a keresés során. Kérjük, próbálja újra.';
      }
    });
}

/**
 * Infinite scroll implementation
 */

// Enhanced Lazy Load with Blur-up Effect (Global scope)
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;

      // Add loaded class when image loads
      if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
        imageObserver.unobserve(img);
      } else {
        img.addEventListener('load', () => {
          img.classList.add('loaded');
        }, { once: true });
        imageObserver.unobserve(img);
      }
    }
  });
}, {
  rootMargin: '200px',
  threshold: 0
});

// Function to observe lazy images (Global scope)
function observeLazyImages() {
  const images = document.querySelectorAll('.performer__image img:not(.observed)');

  images.forEach((img) => {
    img.classList.add('observed');

    // If image is already loaded (cached), add loaded class immediately
    if (img.complete && img.naturalHeight !== 0) {
      img.classList.add('loaded');
    } else {
      // Otherwise, observe it
      imageObserver.observe(img);
    }
  });
}

// Try to observe images immediately if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      observeLazyImages();
    } catch (error) {
      console.error('Error in observeLazyImages:', error);
    }
  });
} else {
  // DOM already loaded, but give it a tiny delay to ensure all images are in DOM
  setTimeout(() => {
    try {
      observeLazyImages();
    } catch (error) {
      console.error('Error in observeLazyImages:', error);
    }
  }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  const performersGrid = document.getElementById('performers-grid');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const loadingIndicator = document.getElementById('loading-indicator');
  const endOfResults = document.getElementById('end-of-results');

  // Show skeleton on initial load if grid is empty
  if (performersGrid && performersGrid.children.length === 0 && skeletonGrid) {
    skeletonGrid.style.display = 'grid';

    // Hide skeleton after content loads (simulated delay for demo)
    setTimeout(() => {
      skeletonGrid.style.display = 'none';
    }, 500);
  }

  // Search input Escape key handler
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        clearSearch();
      }
    });
  }

  // Infinite scroll state
  let currentPageNum = serverData.currentPage;
  let isLoading = false;
  let hasMorePages = serverData.totalPages > currentPageNum;
  const searchTerm = serverData.search;
  const categoryFilter = serverData.category;
  const sortFilter = serverData.sort;

  /**
   * Get status badge HTML
   */
  function getStatusBadge(performer) {
    if (!performer.status) {
      return '';
    }

    let badgeClass = '';
    let badgeEmoji = '';

    if (performer.status === 'Kiemelt') {
      badgeClass = 'badge--featured';
      badgeEmoji = '⭐';
    } else if (performer.status === 'Népszerű') {
      badgeClass = 'badge--popular';
      badgeEmoji = '🔥';
    } else if (performer.status === 'Kedvezményes' || performer.status === 'Akciós') {
      badgeClass = 'badge--discount';
      badgeEmoji = '💰';
    }

    return `<span class="badge ${badgeClass} performer__status-badge">${badgeEmoji} ${performer.status}</span>`;
  }

  /**
   * Create performer card HTML
   */
  function createPerformerCard(performer) {
    return `
      <div class="performer__card">
        <div class="performer__image">
          <a href="${serverData.basePath}eloadok/${performer.slug}">
            ${performer.imageUrl
    ? `<img src="${performer.imageUrl}" alt="${performer.name}" loading="lazy">`
    : `<div class="performer__placeholder">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
              </div>`
}
          </a>
          ${getStatusBadge(performer)}
        </div>
        <div class="performer__content">
          <div class="performer__header">
            <div class="performer-category">
              ${performer.performanceType || ''}
            </div>
            ${performer.price && performer.showPrice
    ? `<div class="performer-price-badge">
                ${new Intl.NumberFormat('hu-HU').format(performer.price)} Ft-tól
              </div>`
    : ''
}
          </div>
          <h2 class="performer__name">
            <a href="${serverData.basePath}eloadok/${performer.slug}">
              ${performer.name}
            </a>
          </h2>
          ${performer.shortDescription
    ? `<p class="performer__description">${performer.shortDescription}</p>`
    : ''
}
          ${performer.style && Array.isArray(performer.style) && performer.style.length > 0
    ? `<div class="performer__styles">
              ${performer.style.map((style) => `<span class="badge badge--style">${style}</span>`).join('')}
            </div>`
    : ''
}
          <div class="performer__actions">
            <a href="${serverData.basePath}eloadok/${performer.slug}" class="btn btn--outline">
              <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
              </svg>
              Részletek
            </a>
            <a href="${serverData.basePath}foglalas/${performer.id}" class="btn btn--primary">
              <svg viewBox="0 0 20 20" fill="currentColor" class="btn-icon">
                <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
              </svg>
              Foglalás
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Animate new performer cards with stagger effect
   */
  function animateNewCards(cards) {
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

      setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, index * 50);
    });
  }

  /**
   * Load more performers
   */
  function loadMorePerformers() {
    if (isLoading || !hasMorePages) {
      return;
    }

    isLoading = true;
    if (loadingIndicator) {
      loadingIndicator.classList.remove('hidden');
    }

    const nextPage = currentPageNum + 1;
    const urlParams = new URLSearchParams();
    urlParams.set('page', nextPage);

    if (searchTerm) {
      urlParams.set('search', searchTerm);
    }
    if (categoryFilter) {
      urlParams.set('category', categoryFilter);
    }
    if (sortFilter && sortFilter !== 'name') {
      urlParams.set('sort', sortFilter);
    }

    // Add price, style, and performanceType filters
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('priceMin')) {
      urlParams.set('priceMin', currentParams.get('priceMin'));
    }
    if (currentParams.has('priceMax')) {
      urlParams.set('priceMax', currentParams.get('priceMax'));
    }
    if (currentParams.has('style')) {
      urlParams.set('style', currentParams.get('style'));
    }
    if (currentParams.has('performanceType')) {
      urlParams.set('performanceType', currentParams.get('performanceType'));
    }

    const url = `${serverData.basePath}eloadok/api/load-more?${urlParams.toString()}`;

    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.performers.length > 0) {
          const performerCards = data.performers.map(createPerformerCard).join('');
          performersGrid.insertAdjacentHTML('beforeend', performerCards);

          // Add fade-in animation to new cards
          const allCards = performersGrid.querySelectorAll('.performer__card');
          const newCards = Array.from(allCards).slice(-data.performers.length);
          animateNewCards(newCards);

          // Observe newly added lazy images
          observeLazyImages();

          currentPageNum = data.currentPage;
          hasMorePages = data.hasMore;

          if (!hasMorePages && endOfResults) {
            endOfResults.classList.remove('hidden');
          }
        } else {
          hasMorePages = false;
          if (endOfResults) {
            endOfResults.classList.remove('hidden');
          }
        }
      })
      .catch((error) => {
        console.error('Error loading more performers:', error);
        hasMorePages = false;
      })
      .finally(() => {
        isLoading = false;
        if (loadingIndicator) {
          loadingIndicator.classList.add('hidden');
        }
      });
  }

  /**
   * Scroll event handler
   */
  function handleScroll() {
    // Disable infinite scroll only during active live search
    if (isSearchActive || isLoading || !hasMorePages) {
      return;
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Load more when user is 800px from bottom (better UX)
    if (scrollTop + windowHeight >= documentHeight - 800) {
      loadMorePerformers();
    }
  }

  // Attach scroll listener
  window.addEventListener('scroll', handleScroll);

  // Show end message if no more pages on initial load
  if (!hasMorePages && endOfResults) {
    endOfResults.classList.remove('hidden');
  }
});
