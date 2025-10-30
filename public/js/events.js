/**
 * Events Page JavaScript
 * Handles search, filtering, and interactive features
 */

(function () {
  'use strict';

  // DOM Elements
  const searchInput = document.getElementById('eventSearch');
  const clearSearchBtn = document.getElementById('clearSearch');
  const filterButtons = document.querySelectorAll('.events__filter-btn');
  const mobileFilterToggle = document.querySelector('.events__mobile-filter-toggle');
  const dateFiltersContainer = document.querySelector('.events__date-filters');
  const eventCards = document.querySelectorAll('.event__card');
  const eventsGrid = document.querySelector('.events__grid');

  // State
  let currentFilter = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  // Initialize
  function init() {
    if (searchInput) {
      searchInput.addEventListener('input', handleSearch);
    }

    // Global Escape key listener for clearing search and filters
    document.addEventListener('keydown', handleGlobalKeydown);

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', clearSearch);
    }

    filterButtons.forEach((btn) => {
      btn.addEventListener('click', handleFilterClick);
    });

    if (mobileFilterToggle) {
      mobileFilterToggle.addEventListener('click', toggleMobileFilters);
    }

    // Close mobile filters when clicking outside
    document.addEventListener('click', handleOutsideClick);
  }

  // Search functionality
  function handleSearch(e) {
    searchQuery = e.target.value.toLowerCase().trim();

    // Show/hide clear button
    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle('hidden', !searchQuery);
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filterEvents();
    }, 300);
  }

  function handleGlobalKeydown(e) {
    // Clear search and filters on Escape key
    if (e.key === 'Escape') {
      // Clear search input
      if (searchInput) {
        searchInput.value = '';
      }
      searchQuery = '';
      if (clearSearchBtn) {
        clearSearchBtn.classList.add('hidden');
      }

      // Reset filters
      const allFilterButtons = document.querySelectorAll('.events__filter-btn');
      allFilterButtons.forEach((b) => {
        b.classList.remove('active');
      });
      const allButton = document.querySelector('.events__filter-btn[data-filter="all"]');
      if (allButton) {
        allButton.classList.add('active');
      }
      currentFilter = 'all';

      // Apply changes
      filterEvents();

      // Focus search input
      if (searchInput) {
        searchInput.focus();
      }
    }
  }

  function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    if (clearSearchBtn) {
      clearSearchBtn.classList.add('hidden');
    }
    filterEvents();
    searchInput.focus();
  }

  function resetFilters() {
    // Reset to "Összes" filter
    filterButtons.forEach((b) => b.classList.remove('active'));
    const allButton = document.querySelector('.events__filter-btn[data-filter="all"]');
    if (allButton) {
      allButton.classList.add('active');
    }
    currentFilter = 'all';
    filterEvents();
  }

  // Filter functionality
  function handleFilterClick(e) {
    const btn = e.currentTarget;
    const { filter } = btn.dataset;

    // Update active state
    filterButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Update current filter
    currentFilter = filter;

    // Filter events
    filterEvents();

    // Close mobile filters
    if (window.innerWidth <= 768 && dateFiltersContainer) {
      dateFiltersContainer.classList.remove('active');
    }
  }

  // Mobile filter toggle
  function toggleMobileFilters(e) {
    e.stopPropagation();
    if (dateFiltersContainer) {
      dateFiltersContainer.classList.toggle('active');
    }
  }

  function handleOutsideClick(e) {
    if (window.innerWidth <= 768
        && dateFiltersContainer
        && dateFiltersContainer.classList.contains('active')
        && !dateFiltersContainer.contains(e.target)
        && !mobileFilterToggle.contains(e.target)) {
      dateFiltersContainer.classList.remove('active');
    }
  }

  // Main filter function
  function filterEvents() {
    // Dispatch event to notify infinite scroll
    window.dispatchEvent(new CustomEvent('eventsFilterChanged', {
      detail: {
        search: searchQuery,
        filter: currentFilter
      }
    }));

    // Clear existing events and reload from API
    if (eventsGrid) {
      // Remove all event cards (keep only static content)
      const cards = eventsGrid.querySelectorAll('.event__card, .skeleton-loader-item');
      cards.forEach((card) => card.remove());

      // Remove empty state if exists
      const emptyState = eventsGrid.querySelector('.events__empty-state');
      if (emptyState) {
        emptyState.remove();
      }
    }
  }

  // Check if card matches search query
  function checkSearchMatch(card) {
    if (!searchQuery) {return true;}

    const title = card.querySelector('.event__title')?.textContent.toLowerCase() || '';
    const performer = card.querySelector('.event-performer')?.textContent.toLowerCase() || '';
    const location = card.querySelector('.event-location')?.textContent.toLowerCase() || '';

    return title.includes(searchQuery)
           || performer.includes(searchQuery)
           || location.includes(searchQuery);
  }

  // Check if card matches date filter
  function checkDateMatch(card) {
    if (currentFilter === 'all') {return true;}

    const dateStr = card.dataset.date;
    if (!dateStr) {return false;}

    const eventDate = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (currentFilter) {
      case 'today':
        const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDay.getTime() === today.getTime();

      case 'week':
        // Aktuális hét (hétfő-vasárnap)
        const currentDay = now.getDay(); // 0 = vasárnap, 1 = hétfő, ...
        const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + daysToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        return eventDate >= weekStart && eventDate < weekEnd;

      case 'month':
        // Aktuális hónap (1-31)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return eventDate >= monthStart && eventDate < monthEnd;

      default:
        return true;
    }
  }

  // Show/hide empty state
  function showEmptyState(show) {
    let emptyState = document.querySelector('.events__empty-state');

    if (show) {
      if (!emptyState) {
        emptyState = document.createElement('div');
        emptyState.className = 'events__empty-state';
        emptyState.innerHTML = `
          <svg class="events__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
            <path d="M11 8v6"></path>
            <path d="M8 11h6"></path>
          </svg>
          <h3 class="events__empty-title">Nincs találat</h3>
          <p class="events__empty-text">
            Próbálj meg más keresési feltételeket használni
          </p>
        `;
        eventsGrid?.appendChild(emptyState);
      } else {
        emptyState.classList.remove('hidden');
      }
    } else if (emptyState) {
      emptyState.classList.add('hidden');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

/**
 * Infinite Scroll Functionality
 */
(function () {
  'use strict';

  let isLoading = false;
  let hasMore = true;
  let currentPage = 1; // Start at page 1 since page 1 is already loaded
  const ITEMS_PER_PAGE = 12;
  let currentSearchQuery = '';
  let currentFilter = 'all';

  function initInfiniteScroll() {
    // Check if we're on the events page
    const eventsGrid = document.querySelector('.events__grid');
    if (!eventsGrid) {
      return;
    }

    // Check if there are already events loaded (first page)
    const existingCards = eventsGrid.querySelectorAll('.event__card');
    if (existingCards.length > 0) {
      // First page already loaded, so we start infinite scroll from page 2
      currentPage = 1;
    }

    // Create intersection observer for infinite scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoading && hasMore) {
            loadMoreEvents();
          }
        });
      },
      {
        rootMargin: '200px'
      }
    );

    // Create and observe the sentinel element
    const sentinel = document.createElement('div');
    sentinel.className = 'events__sentinel';
    sentinel.style.height = '1px';
    eventsGrid.parentNode.appendChild(sentinel);
    observer.observe(sentinel);

    console.log('Sentinel element created and observer attached');

    // Listen for search/filter changes
    window.addEventListener('eventsFilterChanged', (e) => {
      currentSearchQuery = e.detail.search || '';
      currentFilter = e.detail.filter || 'all';
      currentPage = 0; // Reset to 0 so next load will be page 1
      hasMore = true;

      // Immediately load first page with new filters
      loadMoreEvents();
    });
  }

  function loadMoreEvents() {
    if (isLoading || !hasMore) {
      return;
    }

    isLoading = true;
    currentPage += 1;

    // Show skeleton loaders
    showSkeletonLoaders();

    // Build API URL
    const params = new URLSearchParams({
      page: currentPage,
      limit: ITEMS_PER_PAGE
    });

    if (currentSearchQuery) {
      params.append('search', currentSearchQuery);
    }

    if (currentFilter !== 'all') {
      params.append('filter', currentFilter);
    }

    // Fetch events from API
    fetch(`/esemenyek/api/events?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        if (data.success && data.events.length > 0) {
          appendEvents(data.events);
          hasMore = data.pagination.hasMore;
        } else {
          hasMore = false;
          // Show empty state only if this is the first page and no results
          if (currentPage === 1) {
            showEmptyState();
          }
        }
        removeSkeletonLoaders();
        isLoading = false;
      })
      .catch((error) => {
        console.error('Error loading events:', error);
        removeSkeletonLoaders();
        isLoading = false;
        hasMore = false;
      });
  }

  function appendEvents(events) {
    const eventsGrid = document.querySelector('.events__grid');
    if (!eventsGrid) {
      return;
    }

    const newCards = [];
    events.forEach((event) => {
      const eventCard = createEventCard(event);
      eventsGrid.appendChild(eventCard);
      newCards.push(eventCard);
    });

    // Animate new cards with staggered fade-in
    animateNewCards(newCards);
  }

  /**
   * Animate new event cards with smooth fade-in effect
   * @param {Array<HTMLElement>} cards - Array of card elements to animate
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

  function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'event__card';
    card.setAttribute('data-date', event.performanceDate);

    const eventDate = new Date(event.performanceDate);
    const year = eventDate.getFullYear();
    const month = eventDate.toLocaleDateString('hu-HU', { month: 'short' });
    const day = eventDate.getDate();

    let imageHtml = '';
    if (event.imageUrl) {
      imageHtml = `<div class="event__image bg-image" style="--bg-image: url('${event.imageUrl}')"></div>`;
    } else if (event.performer && event.performer.imageUrl) {
      imageHtml = `<div class="event__image bg-image" style="--bg-image: url('${event.performer.imageUrl}')"></div>`;
    } else {
      imageHtml = '<div class="event__image event-image-placeholder"><div class="placeholder-icon">🎭</div></div>';
    }

    const performerHtml = event.performer ? `
      <div class="event-performer">
        <span class="icon icon--sm icon-microphone"></span>
        <a href="/eloadok/${event.performer.slug || event.performer.id}">${event.performer.name}</a>
      </div>
    ` : '';

    const timeHtml = event.performanceTime ? `
      <div class="event-time">
        <span class="icon icon--sm icon-clock"></span>
        ${event.performanceTime.substring(0, 5)}
      </div>
    ` : '';

    const locationHtml = event.performanceLocation ? `
      <div class="event-location">
        <span class="icon icon--sm icon-location"></span>
        ${event.performanceLocation}
      </div>
    ` : '';

    const eventDateTime = event.performanceDate + (event.performanceTime ? `T${event.performanceTime}` : 'T19:00:00');
    const eventDateISO = new Date(eventDateTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const eventEndISO = new Date(new Date(eventDateTime).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const actionsHtml = event.performer ? `
      <div class="event__actions">
        <a href="/eloadok/${event.performer.slug || event.performer.id}" class="btn btn--primary">
          Előadó Megtekintése
        </a>
      </div>
      
      <div class="event__secondary-actions">
        <div class="event__calendar-dropdown">
          <button class="event__calendar-btn">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
            </svg>
            Naptárhoz
          </button>
          <div class="event__calendar-menu">
            <a href="https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.subject)}&dates=${eventDateISO}/${eventEndISO}&details=${encodeURIComponent(event.performer ? `Előadó: ${event.performer.name}` : '')}&location=${encodeURIComponent(event.performanceLocation || '')}" target="_blank" class="event__calendar-option">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-1V1m-1 11h-5v5h5v-5z"/>
              </svg>
              Google Calendar
            </a>
            <a href="/esemenyek/${event.id}/calendar.ics" class="event__calendar-option" download>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V8h14m0-5h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2m-2.47 8.06L15.47 10l-4.88 4.88-2.12-2.12-1.06 1.06L10.59 17l5.94-5.94z"/>
              </svg>
              Apple / Outlook
            </a>
          </div>
        </div>
        
        <div class="event__share-dropdown">
          <button class="event__share-btn">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            Megosztás
          </button>
          <div class="event__share-menu">
            <button class="event__share-option" data-platform="facebook" data-title="${event.subject}" data-url="${window.location.origin}/esemenyek">
              <svg viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </button>
            <button class="event__share-option" data-platform="whatsapp" data-title="${event.subject}" data-url="${window.location.origin}/esemenyek">
              <svg viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              WhatsApp
            </button>
            <button class="event__share-option" data-platform="email" data-title="${event.subject}" data-url="${window.location.origin}/esemenyek">
              <svg viewBox="0 0 24 24" fill="#666">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              Email
            </button>
            <button class="event__share-option" data-platform="copy" data-title="${event.subject}" data-url="${window.location.origin}/esemenyek">
              <svg viewBox="0 0 24 24" fill="#666">
                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
              </svg>
              Link másolása
            </button>
          </div>
        </div>
      </div>
    ` : '';

    card.innerHTML = `
      ${imageHtml}
      <div class="event__content">
        <div class="event__date">
          <div class="event__date-year">${year}</div>
          <div class="event__date-month">${month}</div>
          <div class="event__date-day">${day}</div>
        </div>
        <div class="event__details">
          <h3 class="event__title">${event.subject}</h3>
          ${performerHtml}
          ${timeHtml}
          ${locationHtml}
        </div>
        ${actionsHtml}
      </div>
    `;

    return card;
  }

  function showSkeletonLoaders() {
    const eventsGrid = document.querySelector('.events__grid');
    if (!eventsGrid) {
      return;
    }

    // Add 3 skeleton cards with fade-in animation
    for (let i = 0; i < 3; i += 1) {
      const skeleton = createSkeletonCard();
      skeleton.classList.add('skeleton-loader-item');
      skeleton.style.opacity = '0';
      skeleton.style.transition = 'opacity 0.3s ease';
      eventsGrid.appendChild(skeleton);

      // Trigger fade-in
      setTimeout(() => {
        skeleton.style.opacity = '1';
      }, 10);
    }
  }

  function removeSkeletonLoaders() {
    const skeletons = document.querySelectorAll('.skeleton-loader-item');
    skeletons.forEach((skeleton) => {
      // Fade out animation
      skeleton.style.opacity = '0';
      skeleton.style.transition = 'opacity 0.3s ease';

      // Remove from DOM after animation
      setTimeout(() => {
        skeleton.remove();
      }, 300);
    });
  }

  function showEmptyState() {
    const eventsGrid = document.querySelector('.events__grid');
    if (!eventsGrid) {
      return;
    }

    // Remove any existing empty state
    const existingEmptyState = eventsGrid.querySelector('.events__empty-state');
    if (existingEmptyState) {
      existingEmptyState.remove();
    }

    const emptyState = document.createElement('div');
    emptyState.className = 'events__empty-state';
    emptyState.innerHTML = `
      <svg class="events__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
        <path d="M11 8v6"></path>
        <path d="M8 11h6"></path>
      </svg>
      <h3 class="events__empty-title">Nincs találat</h3>
      <p class="events__empty-text">
        Próbálj meg más keresési feltételeket használni
      </p>
    `;
    eventsGrid.appendChild(emptyState);
  }

  function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'skeleton-event-card';
    card.innerHTML = `
      <div class="skeleton-event-card__image"></div>
      <div class="skeleton-event-card__date">
        <div class="skeleton-event-card__date-item"></div>
        <div class="skeleton-event-card__date-item"></div>
        <div class="skeleton-event-card__date-item"></div>
      </div>
      <div class="skeleton-event-card__content">
        <div class="skeleton-event-card__title"></div>
        <div class="skeleton-event-card__details">
          <div class="skeleton-event-card__detail"></div>
          <div class="skeleton-event-card__detail"></div>
          <div class="skeleton-event-card__detail"></div>
        </div>
        <div class="skeleton-event-card__actions">
          <div class="skeleton-event-card__button"></div>
          <div class="skeleton-event-card__secondary">
            <div class="skeleton-event-card__secondary-btn"></div>
            <div class="skeleton-event-card__secondary-btn"></div>
          </div>
        </div>
      </div>
    `;
    return card;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInfiniteScroll);
  } else {
    initInfiniteScroll();
  }
}());

/**
 * Calendar and Share Functionality
 */
(function () {
  'use strict';

  function initCalendarAndShare() {
    // Use event delegation for dynamically loaded content
    const eventsContainer = document.querySelector('.events__container');
    if (!eventsContainer) {return;}

    // Calendar dropdowns - event delegation
    eventsContainer.addEventListener('click', (e) => {
      const calendarBtn = e.target.closest('.event__calendar-btn');
      if (calendarBtn) {
        e.stopPropagation();
        const dropdown = calendarBtn.nextElementSibling;
        if (dropdown && dropdown.classList.contains('event__calendar-menu')) {
          // Close all other dropdowns
          document.querySelectorAll('.event__calendar-menu.active, .event__share-menu.active')
            .forEach((menu) => menu.classList.remove('active'));
          // Toggle current dropdown
          dropdown.classList.toggle('active');
        }
        return;
      }

      // Share dropdowns - event delegation
      const shareBtn = e.target.closest('.event__share-btn');
      if (shareBtn) {
        e.stopPropagation();
        const dropdown = shareBtn.nextElementSibling;
        if (dropdown && dropdown.classList.contains('event__share-menu')) {
          // Close all other dropdowns
          document.querySelectorAll('.event__calendar-menu.active, .event__share-menu.active')
            .forEach((menu) => menu.classList.remove('active'));
          // Toggle current dropdown
          dropdown.classList.toggle('active');
        }
        return;
      }

      // Share functionality - event delegation
      const shareOption = e.target.closest('.event__share-option');
      if (shareOption) {
        e.preventDefault();
        const { platform } = shareOption.dataset;
        const eventTitle = shareOption.dataset.title;
        const eventUrl = shareOption.dataset.url || window.location.href;
        handleShare(platform, eventTitle, eventUrl);
      }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.event__calendar-menu.active, .event__share-menu.active')
        .forEach((menu) => menu.classList.remove('active'));
    });
  }

  function handleShare(platform, title, url) {
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(url);

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;

      case 'instagram':
        // Instagram doesn't support direct URL sharing
        // Copy URL and show instructions
        copyToClipboard(url, title);
        showToast('Link vágólapra másolva! Oszd meg Instagram Story-ban vagy Post-ban! 📸');
        return;

      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        break;

      case 'tiktok':
        // TikTok doesn't support direct URL sharing
        // Copy URL and show instructions
        copyToClipboard(url, title);
        showToast('Link vágólapra másolva! Oszd meg TikTok videó leírásban! 🎵');
        return;

      case 'youtube':
        // YouTube Community tab sharing
        // Copy URL and show instructions
        copyToClipboard(url, title);
        showToast('Link vágólapra másolva! Oszd meg YouTube közösségi bejegyzésben! 🎬');
        return;

      case 'email':
        shareUrl = `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A%0A${encodedUrl}`;
        break;

      case 'copy':
        copyToClipboard(url, title);
        return;

      default:
        return;
    }

    // Open share window
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  }

  function copyToClipboard(url, title) {
    const text = `${title}\n${url}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Link vágólapra másolva!');
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.classList.add('sr-only');
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Link vágólapra másolva!');
    } catch {
      showToast('Hiba történt a másolás során');
    }
    document.body.removeChild(textarea);
  }

  function showToast(message) {
    // Remove any existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach((t) => t.remove());

    // Create toast container if it doesn't exist
    let container = document.querySelector('.toast__container--bottom-right');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast__container toast__container--bottom-right';
      document.body.appendChild(container);
    }

    // Create toast using design system classes
    const toast = document.createElement('div');
    toast.className = 'toast toast--success';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <div class="toast__icon">
        <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
      </div>
      <div class="toast__content">
        <p class="toast__message">${message}</p>
      </div>
    `;

    container.appendChild(toast);

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      toast.classList.add('toast--exiting');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
        // Remove container if empty
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, 3000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendarAndShare);
  } else {
    initCalendarAndShare();
  }
}());
