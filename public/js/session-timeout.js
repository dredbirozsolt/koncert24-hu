/**
 * Session Timeout Warning
 * Figyelmeztet a felhasználót, mielőtt a session lejár
 */

(function () {
  'use strict';

  // Konfiguráció
  const CONFIG = {
    sessionDuration: 24 * 60 * 60 * 1000, // 24 óra (development)
    warningTime: 2 * 60 * 1000, // 2 perc a lejárat előtt figyelmezt
    checkInterval: 30 * 1000, // 30 másodpercenként ellenőriz
    extendUrl: '/api/session/extend' // API endpoint a session meghosszabbításához
  };

  const LOGOUT_URL = '/auth/logout';

  let lastActivity = Date.now();
  let warningShown = false;
  let sessionCheckInterval = null;

  // Modal HTML
  function createWarningModal() {
    const modal = document.createElement('div');
    modal.id = 'session-timeout-modal';
    modal.innerHTML = `
      <div class="session-modal-overlay">
        <div class="session-modal-content">
          <div class="session-modal-icon">⏱️</div>
          <h2>Munkamenet hamarosan lejár</h2>
          <p>A munkamenete 2 percen belül lejár inaktivitás miatt.</p>
          <p>Szeretné meghosszabbítani?</p>
          <div class="session-modal-actions">
            <button id="session-extend-btn" class="session-btn session-btn-primary">
              ✅ Munkamenet meghosszabbítása
            </button>
            <button id="session-logout-btn" class="session-btn session-btn-secondary">
              🚪 Kijelentkezés most
            </button>
          </div>
          <div class="session-modal-timer">
            Automatikus kijelentkezés: <span id="session-countdown">120</span> másodperc
          </div>
        </div>
      </div>
    `;

    // Link external CSS file instead of inline styles
    if (!document.querySelector('link[href*="session-timeout.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/modules/session-timeout.css';
      document.head.appendChild(link);
    }

    document.body.appendChild(modal);
    return modal;
  }

  // User aktivitás követése
  function resetActivity() {
    lastActivity = Date.now();
    warningShown = false;
  }

  // Ellenőrzi, hogy kell-e figyelmeztetni
  function checkTimeout() {
    const now = Date.now();
    const elapsed = now - lastActivity;
    const remaining = CONFIG.sessionDuration - elapsed;

    // Ha lejárt, kijelentkeztetés
    if (remaining <= 0) {
      window.location.href = LOGOUT_URL;
      return;
    }

    // Ha 2 percnél kevesebb van hátra és még nem jelent meg a modal
    if (remaining <= CONFIG.warningTime && !warningShown) {
      showWarning(remaining);
    }
  }

  // Figyelmeztető modal megjelenítése
  function showWarning(remainingTime) {
    warningShown = true;
    const modal = document.getElementById('session-timeout-modal') || createWarningModal();
    modal.classList.add('show');

    let countdown = Math.floor(remainingTime / 1000);
    const countdownEl = document.getElementById('session-countdown');

    // Countdown timer
    const countdownInterval = setInterval(() => {
      countdown -= 1;
      if (countdownEl) {
        countdownEl.textContent = countdown;
      }

      if (countdown <= 0) {
        clearInterval(countdownInterval);
        window.location.href = LOGOUT_URL;
      }
    }, 1000);

    // Meghosszabbítás gomb
    document.getElementById('session-extend-btn').onclick = function () {
      extendSession();
      modal.classList.remove('show');
      clearInterval(countdownInterval);
      resetActivity();
    };

    // Kijelentkezés gomb
    document.getElementById('session-logout-btn').onclick = function () {
      window.location.href = LOGOUT_URL;
    };
  }

  // Session meghosszabbítása
  function extendSession() {
    fetch(CONFIG.extendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      credentials: 'same-origin'
    })
      .then((response) => {
        if (response.ok) {
          console.log('✅ Session extended successfully');
          resetActivity();
        } else {
          console.error('❌ Failed to extend session');
        }
      })
      .catch((error) => {
        console.error('❌ Error extending session:', error);
      });
  }

  // CSRF token lekérése
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  // Aktivitás figyelők
  function setupActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      document.addEventListener(event, resetActivity, { passive: true });
    });
  }

  // Cleanup function
  function cleanup() {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  }

  // Inicializálás
  function init() {
    // Csak bejelentkezett usereknek
    if (!document.body.classList.contains('logged-in')) {
      return;
    }

    setupActivityListeners();
    sessionCheckInterval = setInterval(checkTimeout, CONFIG.checkInterval);
    console.log('🔐 Session timeout warning initialized');
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  // DOM ready után indítás
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
