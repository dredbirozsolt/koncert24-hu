/**
 * Admin Chat Dashboard
 * Real-time chat management for administrators
 */

/* global Modal */

(function () {
  'use strict';

  // State
  let activeSessions = [];
  let selectedSessionId = null;
  let pollingInterval = null;
  let messagePollingInterval = null;

  // DOM Elements
  const sessionsContainer = document.getElementById('active-sessions');
  const sessionDetailsContainer = document.getElementById('session-details');
  const messagesContainer = document.getElementById('session-messages');
  const replyForm = document.getElementById('reply-form');
  const replyInput = document.getElementById('reply-message');

  /**
   * Initialize dashboard
   */
  function init() {
    loadActiveSessions();
    startPolling();
    setupEventListeners();
  }

  /**
   * Load active chat sessions
   */
  async function loadActiveSessions() {
    try {
      const response = await fetch('/admin/chat/api/sessions');
      const data = await response.json();

      if (data.success) {
        activeSessions = data.sessions;
        renderSessions();
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      showNotification('Hiba történt a munkamenetek betöltésekor', 'error');
    }
  }

  /**
   * Render sessions list
   */
  function renderSessions() {
    if (!sessionsContainer) {return;}

    if (activeSessions.length === 0) {
      sessionsContainer.innerHTML = `
        <div class="alert alert-info">
          ℹ️ Nincs aktív chat munkamenet
        </div>
      `;
      return;
    }

    sessionsContainer.innerHTML = activeSessions.map((session) => `
      <div class="card session-card ${session.id === selectedSessionId ? 'active' : ''}" 
           data-session-id="${session.id}"
           onclick="chatDashboard.selectSession(${session.id})">
        <div class="card__body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h6 class="mb-1">
                ${session.user_name || 'Névtelen látogató'}
                ${session.status === 'escalated' ? '<span class="badge bg-warning">Eskalálva</span>' : ''}
              </h6>
              <p class="text-sm text-muted mb-1">
                ${session.user_email || 'Nincs email'}
              </p>
              <p class="text-xs text-muted mb-0">
                ⏱️ ${formatTime(session.created_at)}
              </p>
            </div>
            <div class="text-end">
              <span class="badge ${getStatusBadgeClass(session.status)}">
                ${getStatusText(session.status)}
              </span>
              ${session.unread_count > 0 ? `
                <span class="badge bg-danger rounded-pill mt-1">
                  ${session.unread_count}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Select a session
   */
  async function selectSession(sessionId) {
    selectedSessionId = sessionId;
    renderSessions();
    await loadSessionDetails(sessionId);
    await loadSessionMessages(sessionId);
    startMessagePolling();
  }

  /**
   * Load session details
   */
  async function loadSessionDetails(sessionId) {
    try {
      const response = await fetch(`/admin/chat/api/session/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        renderSessionDetails(data.session);
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  }

  /**
   * Render session details
   */
  function renderSessionDetails(session) {
    if (!sessionDetailsContainer) {return;}

    sessionDetailsContainer.innerHTML = `
      <div class="card">
        <div class="card__header">
          <h5 class="mb-0">
            👤 ${session.user_name || 'Névtelen látogató'}
          </h5>
        </div>
        <div class="card__body">
          <dl class="row mb-0">
            <dt class="col-sm-4">Email:</dt>
            <dd class="col-sm-8">${session.user_email || '-'}</dd>
            
            <dt class="col-sm-4">Telefon:</dt>
            <dd class="col-sm-8">${session.user_phone || '-'}</dd>
            
            <dt class="col-sm-4">Státusz:</dt>
            <dd class="col-sm-8">
              <span class="badge ${getStatusBadgeClass(session.status)}">
                ${getStatusText(session.status)}
              </span>
            </dd>
            
            <dt class="col-sm-4">Kezdés:</dt>
            <dd class="col-sm-8">${formatDateTime(session.created_at)}</dd>
            
            ${session.escalated_to_admin ? `
              <dt class="col-sm-4">Eskalálva:</dt>
              <dd class="col-sm-8">${formatDateTime(session.escalated_at)}</dd>
            ` : ''}
          </dl>

          <div class="mt-3 d-flex gap-2">
            ${session.status === 'active' ? `
              <button class="btn btn-sm btn-warning" onclick="chatDashboard.escalateSession(${session.id})">
                ⬆️ Eskalálás
              </button>
            ` : ''}
            
            ${session.status === 'resolved' ? '' : `
              <button class="btn btn-sm btn-success" onclick="chatDashboard.resolveSession(${session.id})">
                ✅ Lezárás
              </button>
            `}
            
            <button class="btn btn-sm btn-info" onclick="chatDashboard.summarizeSession(${session.id})">
                📄 AI Összegzés
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Load session messages
   */
  async function loadSessionMessages(sessionId) {
    try {
      const response = await fetch(`/admin/chat/api/session/${sessionId}/messages`);
      const data = await response.json();

      if (data.success) {
        renderMessages(data.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  /**
   * Render messages
   */
  function renderMessages(messages) {
    if (!messagesContainer) {return;}

    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="alert alert-info">
          ℹ️ Még nincs üzenet ebben a munkamenetben
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = messages.map((msg) => `
      <div class="message message-${msg.sender_type}">
        <div class="message-header">
          <strong>${getSenderName(msg.sender_type)}</strong>
          <span class="text-muted">${formatDateTime(msg.created_at)}</span>
        </div>
        <div class="message-content">
          ${escapeHtml(msg.message_content)}
        </div>
      </div>
    `).join('');
  }

  /**
   * Send admin reply
   */
  async function sendReply(event) {
    event.preventDefault();

    if (!selectedSessionId || !replyInput || !replyInput.value.trim()) {
      return;
    }

    const message = replyInput.value.trim();
    const submitBtn = event.target.querySelector('button[type="submit"]');

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Küldés...';

      const response = await fetch(`/admin/chat/api/session/${selectedSessionId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const data = await response.json();

      if (data.success) {
        replyInput.value = '';
        await loadSessionMessages(selectedSessionId);
        showNotification('Üzenet elküldve', 'success');
      } else {
        showNotification('Hiba történt az üzenet küldésekor', 'error');
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      showNotification('Hiba történt az üzenet küldésekor', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '📤 Küldés';
    }
  }

  /**
   * Escalate session to admin
   */
  async function escalateSession(sessionId) {
    const confirmed = await Modal.confirm({
      title: 'Eskalálás megerősítése',
      message: 'Biztosan eskalálni szeretné ezt a munkamenetet?',
      confirmText: 'Eskalálás',
      cancelText: 'Mégse'
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/admin/chat/api/session/${sessionId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'admin_manual' })
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Munkamenet eskalálva', 'success');
        await loadActiveSessions();
        await loadSessionDetails(sessionId);
      } else {
        showNotification('Hiba történt az eskalálás során', 'error');
      }
    } catch (error) {
      console.error('Failed to escalate session:', error);
      showNotification('Hiba történt az eskalálás során', 'error');
    }
  }

  /**
   * Resolve session
   */
  async function resolveSession(sessionId) {
    const confirmed = await Modal.confirm({
      title: 'Munkamenet lezárása',
      message: 'Biztosan lezárja ezt a munkamenetet?',
      confirmText: 'Lezárás',
      cancelText: 'Mégse'
    });

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/admin/chat/api/session/${sessionId}/resolve`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        showNotification('Munkamenet lezárva', 'success');
        selectedSessionId = null;
        await loadActiveSessions();
        if (sessionDetailsContainer) {
          sessionDetailsContainer.innerHTML = '';
        }
        if (messagesContainer) {
          messagesContainer.innerHTML = '';
        }
      } else {
        showNotification('Hiba történt a lezárás során', 'error');
      }
    } catch (error) {
      console.error('Failed to resolve session:', error);
      showNotification('Hiba történt a lezárás során', 'error');
    }
  }

  /**
   * Generate AI summary
   */
  async function summarizeSession(sessionId) {
    try {
      showNotification('AI összegzés generálása...', 'info');

      const response = await fetch(`/admin/chat/api/session/${sessionId}/summarize`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        showNotification('AI összegzés elkészült', 'success');

        // Show summary in modal
        Modal.alert({
          title: 'AI Összegzés',
          message: data.summary,
          type: 'info'
        });
      } else {
        showNotification('Hiba történt az összegzés során', 'error');
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      showNotification('Hiba történt az összegzés során', 'error');
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    if (replyForm) {
      replyForm.addEventListener('submit', sendReply);
    }

    // Keyboard shortcut for reply (Ctrl/Cmd + Enter)
    if (replyInput) {
      replyInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          sendReply(new Event('submit'));
        }
      });
    }
  }

  /**
   * Start polling for updates
   */
  function startPolling() {
    // Poll sessions every 10 seconds
    pollingInterval = setInterval(() => {
      loadActiveSessions();
    }, 10000);
  }

  /**
   * Start polling for message updates
   */
  function startMessagePolling() {
    // Clear existing interval
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
    }

    // Poll messages every 3 seconds
    if (selectedSessionId) {
      messagePollingInterval = setInterval(() => {
        if (selectedSessionId) {
          loadSessionMessages(selectedSessionId);
        }
      }, 3000);
    }
  }

  /**
   * Helper Functions
   */

  function getStatusBadgeClass(status) {
    const classes = {
      active: 'bg-success',
      escalated: 'bg-warning',
      waiting: 'bg-info',
      resolved: 'bg-secondary'
    };
    return classes[status] || 'bg-secondary';
  }

  function getStatusText(status) {
    const texts = {
      active: 'Aktív',
      escalated: 'Eskalálva',
      waiting: 'Várakozás',
      resolved: 'Lezárva'
    };
    return texts[status] || status;
  }

  function getSenderName(senderType) {
    const names = {
      user: 'Látogató',
      ai: 'AI Asszisztens',
      admin: 'Admin',
      system: 'Rendszer'
    };
    return names[senderType] || senderType;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {return 'Most';}
    if (minutes < 60) {return `${minutes} perce`;}
    if (minutes < 1440) {return `${Math.floor(minutes / 60)} órája`;}
    return `${Math.floor(minutes / 1440)} napja`;
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function showNotification(message, type = 'info') {
    // You can integrate with a toast library here
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Simple alert for now
    if (type === 'error') {
      // Could show a toast instead
    }
  }

  /**
   * Cleanup on page unload
   */
  window.addEventListener('beforeunload', () => {
    if (pollingInterval) {clearInterval(pollingInterval);}
    if (messagePollingInterval) {clearInterval(messagePollingInterval);}
  });

  /**
   * Public API
   */
  window.chatDashboard = {
    init,
    selectSession,
    escalateSession,
    resolveSession,
    summarizeSession
  };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
