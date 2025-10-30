/**
 * Alternative Homepage JavaScript - Enhanced UX
 * Interaktív funkciók az alternatív főoldalhoz
 */

(function () {
  'use strict';

  // ========================================
  // HERO SEARCH AUTOCOMPLETE
  // ========================================
  const heroSearch = document.getElementById('heroSearch');
  const heroSearchResults = document.getElementById('heroSearchResults');

  if (heroSearch) {
    let searchTimeout;

    heroSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();

      clearTimeout(searchTimeout);

      if (query.length < 2) {
        heroSearchResults.classList.remove('search-box__results--visible');
        return;
      }

      searchTimeout = setTimeout(() => {
        performSearch(query, heroSearchResults);
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!heroSearch.contains(e.target) && !heroSearchResults.contains(e.target)) {
        heroSearchResults.classList.remove('search-box__results--visible');
      }
    });
  }

  // ========================================
  // PATH 1: SEARCH PERFORMER BY NAME
  // ========================================
  const pathSearch1 = document.getElementById('pathSearch1');

  if (pathSearch1) {
    let searchTimeout;

    pathSearch1.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(searchTimeout);

      if (query.length < 2) {return;}

      searchTimeout = setTimeout(() => {
        console.log('Searching for:', query);
      }, 300);
    });
  }

  window.searchPerformerByName = function () {
    const query = pathSearch1.value.trim();
    if (query) {
      window.location.href = `/eloadok?q=${encodeURIComponent(query)}`;
    }
  };

  // ========================================
  // PATH 2: WIZARD - DATE & CITY
  // ========================================
  const pathDate = document.getElementById('pathDate');
  const pathCity = document.getElementById('pathCity');

  window.startWizard = function () {
    const date = pathDate.value;
    const city = pathCity.value.trim();

    if (!date || !city) {
      alert('Kérlek add meg a dátumot és a helyszínt!');
      return;
    }

    window.location.href = `/ajanlo-wizard?date=${date}&city=${encodeURIComponent(city)}`;
  };

  // ========================================
  // PATH 4: PRICE SLIDER
  // ========================================
  const priceRange = document.getElementById('priceRange');
  const priceLabel = document.getElementById('priceLabel');

  window.updatePriceLabel = function (value) {
    const formatted = new Intl.NumberFormat('hu-HU').format(value);
    priceLabel.textContent = `${formatted} Ft`;
  };

  window.searchByPrice = function () {
    const maxPrice = priceRange.value;
    window.location.href = `/eloadok?maxPrice=${maxPrice}`;
  };

  // ========================================
  // PATH 5: EVENT TYPE SELECTION
  // ========================================
  window.selectEventType = function (type) {
    const typeMap = {
      private: 'maganevenyek',
      corporate: 'ceges-esemenyek',
      community: 'kozossegi-esemenyek',
      conference: 'konferenciak',
      festival: 'fesztivalok'
    };

    const slug = typeMap[type] || type;
    window.location.href = `/tipus/${slug}`;
  };

  window.viewAllEventTypes = function () {
    window.location.href = '/esemenytipusok';
  };

  // ========================================
  // SMOOTH SCROLL TO PATH SELECTOR
  // ========================================
  window.scrollToPathSelector = function () {
    const pathSelector = document.getElementById('pathSelector');
    if (pathSelector) {
      pathSelector.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  window.scrollToPath = function (pathNumber) {
    const pathSelector = document.getElementById('pathSelector');
    const pathCards = document.querySelectorAll('.path-card');

    if (pathSelector) {
      pathSelector.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // On mobile, scroll the specific card into view
      if (window.innerWidth <= 768 && pathCards[pathNumber - 1]) {
        setTimeout(() => {
          pathCards[pathNumber - 1].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }, 600);
      } else if (pathCards[pathNumber - 1]) {
        // Desktop: highlight animation
        setTimeout(() => {
          pathCards[pathNumber - 1].style.transform = 'scale(1.02)';
          pathCards[pathNumber - 1].style.boxShadow = '0 16px 32px rgba(0,0,0,0.12)';
          setTimeout(() => {
            pathCards[pathNumber - 1].style.transform = '';
            pathCards[pathNumber - 1].style.boxShadow = '';
          }, 500);
        }, 600);
      }
    }
  };

  // ========================================
  // SEARCH FUNCTION (AUTOCOMPLETE)
  // ========================================
  async function performSearch(query, resultsContainer) {
    try {
      const response = await fetch(`/api/performers/search?q=${encodeURIComponent(query)}&limit=5`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      if (data.performers && data.performers.length > 0) {
        displaySearchResults(data.performers, resultsContainer);
      } else {
        displayNoResults(resultsContainer);
      }
    } catch (error) {
      console.error('Search error:', error);
      displayNoResults(resultsContainer);
    }
  }

  function displaySearchResults(performers, container) {
    const html = performers.map((performer) =>
      `<a href="/eloadok/${performer.slug}" class="search-result-item">${
        performer.imageUrl
          ? `<img src="${performer.imageUrl}" alt="${performer.name}" class="search-result-image">`
          : '<div class="search-result-placeholder">👤</div>'
      }<div class="search-result-info">`
                    + `<div class="search-result-name">${performer.name}</div>${
                      performer.category ? `<div class="search-result-category">${performer.category}</div>` : ''
                    }</div>`
            + '</a>'
    ).join('');

    container.innerHTML = html;
    container.classList.add('search-box__results--visible');
  }

  function displayNoResults(container) {
    container.innerHTML
            = '<div class="search-result-item" style="justify-content: center; color: var(--color-text-secondary);">'
                + 'Nincs találat'
            + '</div>';
    container.classList.add('search-box__results--visible');
  }

  // ========================================
  // MOBILE STICKY BAR - SHOW ON SCROLL
  // ========================================
  const stickyBar = document.getElementById('stickyBar');

  if (stickyBar && window.innerWidth <= 768) {
    let lastScrollTop = 0;
    let isVisible = false;

    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop > 200 && !isVisible) {
        stickyBar.style.display = 'flex';
        isVisible = true;
      } else if (scrollTop <= 200 && isVisible) {
        stickyBar.style.display = 'none';
        isVisible = false;
      }

      lastScrollTop = scrollTop;
    });
  }

  // ========================================
  // PATH CARD INTERACTIONS
  // ========================================
  document.querySelectorAll('.path-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
        return;
      }

      const ripple = document.createElement('span');
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.classList.add('ripple');

      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      card.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });

  // ========================================
  // ENTER KEY HANDLERS
  // ========================================
  if (heroSearch) {
    heroSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = heroSearch.value.trim();
        if (query) {
          window.location.href = `/eloadok?q=${encodeURIComponent(query)}`;
        }
      }
    });
  }

  if (pathSearch1) {
    pathSearch1.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchPerformerByName();
      }
    });
  }

  if (pathCity) {
    pathCity.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startWizard();
      }
    });
  }

  // ========================================
  // ANALYTICS TRACKING
  // ========================================
  function trackPathSelection(pathName) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'path_selection', {
        event_category: 'alternative_homepage',
        event_label: pathName
      });
    }
  }

  document.querySelectorAll('.path-card').forEach((card, index) => {
    const pathNames = [
      'tudom_kit_keresek',
      'ajanlatok_nekem',
      'bongeszek',
      'koltsegkeret',
      'rendezveny_tipus'
    ];

    card.addEventListener('click', () => {
      trackPathSelection(pathNames[index] || `path_${index + 1}`);
    });
  });

  console.log('Alternative Homepage initialized - Enhanced UX');
}());
