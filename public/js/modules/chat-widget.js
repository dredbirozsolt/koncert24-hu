/**
 * Chat Widget - Alpine.js Component
 * User-facing chat interface with AI/Admin support
 */

/* eslint-disable max-lines */
// Justification: Alpine.js component - splitting would break reactivity
/* global Modal */

// Error messages constants
const ERROR_CONNECTION_FAILED = 'Kapcsolati hiba történt';
const HEADER_CONTENT_TYPE_JSON = 'application/json';
const CSRF_TOKEN_SELECTOR = 'meta[name="csrf-token"]';

document.addEventListener('alpine:init', () => {
  Alpine.data('chatWidget', () => ({
    // State
    isOpen: false,
    isMinimized: false,
    pollingActive: false, // Track if polling is already running
    pollInterval: 5000, // Current polling interval (5s, 10s, or 30s)
    consecutiveEmptyPolls: 0, // Counter for empty polls (for adaptive slowdown)
    sessionToken: null,
    messages: [],
    inputMessage: '',
    isTyping: false,
    isLoading: false,
    mode: 'loading', // loading, full_service, admin_only, ai_only, offline_mode
    aiAvailable: false,
    adminAvailable: false,
    showOfflineForm: false,

    // Offline form data
    offlineForm: {
      name: '',
      email: '',
      phone: '',
      message: ''
    },

    // Unread count
    unreadCount: 0,

    // Proactive engagement
    proactiveEngagement: {
      enabled: window.chatProactiveConfig?.enabled !== false,
      delay: window.chatProactiveConfig?.delay || 30000, // 30 seconds default
      triggered: false
    },

    // Initialize
    async init() {
      // Setup proactive engagement (must be before session check)
      this.setupProactiveEngagement();

      // Check if session exists in localStorage
      const savedSession = localStorage.getItem('chat_session_token');
      const sessionTimestamp = localStorage.getItem('chat_session_timestamp');

      // Session expiry: 24 hours (86400000 ms)
      const SESSION_EXPIRY = 24 * 60 * 60 * 1000;

      if (savedSession && sessionTimestamp) {
        const now = Date.now();
        const sessionAge = now - parseInt(sessionTimestamp, 10);

        // Check if session is still valid
        if (sessionAge < SESSION_EXPIRY) {
          this.sessionToken = savedSession;
          await this.loadSession();

          // Update timestamp on activity
          localStorage.setItem('chat_session_timestamp', now.toString());
        } else {
          // Session expired - clear localStorage
          console.log('Chat session expired (24h inactivity)');
          localStorage.removeItem('chat_session_token');
          localStorage.removeItem('chat_session_timestamp');
          this.sessionToken = null;
        }
      }

      // Polling will start when chat is opened (in openChat method)

      // Listen for new messages (if using WebSocket in future)
      // this.listenForMessages();
    },

    // Setup proactive engagement
    setupProactiveEngagement() {
      // Check if feature is enabled
      if (!this.proactiveEngagement.enabled) {
        return;
      }

      // Check if engagement already happened in this session
      const engagementShown = sessionStorage.getItem('engagement_shown');
      if (engagementShown === 'true') {
        return;
      }

      // Wait for configured delay
      setTimeout(() => {
        // Double-check conditions
        const stillValid
          = !this.isOpen // Chat not already open
          && !this.proactiveEngagement.triggered // Not already triggered
          && sessionStorage.getItem('engagement_shown') !== 'true'; // No engagement yet (chat OR exit popup)

        if (stillValid) {
          this.triggerProactiveEngagement();
        }
      }, this.proactiveEngagement.delay);
    },

    // Trigger proactive engagement
    triggerProactiveEngagement() {
      this.proactiveEngagement.triggered = true;

      // Mark engagement as shown in session
      sessionStorage.setItem('engagement_shown', 'true');

      // Add pulse animation to chat button
      const chatButton = document.querySelector('.chat-widget__toggle-btn');
      if (chatButton) {
        chatButton.classList.add('chat-pulse');

        // Show a gentle notification
        this.showProactiveMessage();
      }
    },

    // Show proactive message
    showProactiveMessage() {
      // Get current page context
      const path = window.location.pathname;
      let message = 'Szia! 👋 Segíthetek valamiben?';

      // Customize message based on page
      if (path.includes('/eloadok')) {
        message = 'Segítek kiválasztani a tökéletes előadót? 🎤';
      } else if (path.includes('/esemenyek')) {
        message = 'Kérdésed van az eseményeinkkel kapcsolatban? 🎉';
      } else if (path.includes('/foglalas')) {
        message = 'Segítek a foglalási folyamatban? 📅';
      }

      // Store the proactive message
      localStorage.setItem('chat_proactive_message', message);

      // Auto-open chat with message after a short delay
      setTimeout(() => {
        this.openChat();

        // Add the proactive message after session is created
        setTimeout(() => {
          if (this.messages.length === 0
              || (this.messages.length === 1 && this.messages[0].role === 'system')) {
            // Replace or append the proactive message
            const storedMessage = localStorage.getItem('chat_proactive_message');
            if (storedMessage) {
              this.messages = this.messages.filter((m) => m.role !== 'system');
              this.messages.push({
                id: Date.now(),
                role: 'system',
                content: storedMessage,
                timestamp: new Date().toISOString()
              });
              localStorage.removeItem('chat_proactive_message');
              this.scrollToBottom();
            }
          }
        }, 500);
      }, 2000); // Wait 2 seconds before opening
    },

    // Start polling for new messages with adaptive interval
    startPolling() {
      // Prevent multiple polling instances
      if (this.pollingActive) {
        return;
      }

      this.pollingActive = true;
      this.pollInterval = 5000; // Reset to 5 seconds
      this.consecutiveEmptyPolls = 0; // Reset counter
      let pollTimeout = null;

      const schedulePoll = (delay) => {
        if (pollTimeout) {
          clearTimeout(pollTimeout);
        }
        if (this.isOpen && this.pollingActive) {
          pollTimeout = setTimeout(poll, delay);
        } else {
          this.pollingActive = false;
        }
      };

      const poll = async () => {
        // Skip if chat closed, no session, or currently loading
        if (!this.isOpen || !this.sessionToken || this.isLoading) {
          if (!this.isOpen) {
            this.pollingActive = false;
            return; // Don't reschedule
          }
          schedulePoll(this.pollInterval); // Reschedule with current interval
          return;
        }

        // Check for new admin/assistant messages (both trigger fast polling)
        const lastResponseMessageId = this.messages.filter((m) => m.role === 'admin' || m.role === 'assistant').slice(-1)[0]?.id;
        await this.checkForNewMessages();
        const currentResponseMessageId = this.messages.filter((m) => m.role === 'admin' || m.role === 'assistant').slice(-1)[0]?.id;

        // Admin/AI replied - switch to fast polling immediately
        if (lastResponseMessageId !== currentResponseMessageId) {
          this.pollInterval = 3000;
          this.consecutiveEmptyPolls = 0;
          schedulePoll(this.pollInterval);
          return;
        }

        // No admin message - slow down gradually
        this.consecutiveEmptyPolls += 1;

        if (this.consecutiveEmptyPolls === 4) {
          this.pollInterval = 10000;
        } else if (this.consecutiveEmptyPolls === 7) {
          this.pollInterval = 30000;
        }

        schedulePoll(this.pollInterval);
      };

      // Start first poll
      poll();
    },

    // Check for new messages
    async checkForNewMessages() {
      try {
        const response = await fetch(`/api/chat/session/${this.sessionToken}`);
        const data = await response.json();

        if (data.success) {
          const newMessages = data.session.messages || [];

          // Check if there are new messages
          if (newMessages.length > this.messages.length) {
            // Get only the new messages
            const newCount = newMessages.length - this.messages.length;
            const freshMessages = newMessages.slice(-newCount);

            // Add new messages to the list
            freshMessages.forEach((msg) => {
              // Check if message doesn't already exist (by ID)
              const exists = this.messages.some((m) => m.id === msg.id);
              if (!exists) {
                this.messages.push(msg);

                // If chat is minimized, increase unread count
                if (this.isMinimized && msg.role !== 'user') {
                  this.unreadCount += 1;
                }
              }
            });

            // Auto-scroll to new messages
            this.scrollToBottom(true);
          }
        }
      } catch (error) {
        console.error('Check for new messages error:', error);
        // Silent fail - don't disturb user experience
      }
    },

    // Toggle chat window
    toggleChat() {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    },

    // Open chat
    async openChat() {
      this.isOpen = true;
      this.isMinimized = false;
      this.unreadCount = 0;

      // Start adaptive polling when chat opens (if not already running)
      if (!this.pollingActive) {
        this.startPolling();
      }

      if (this.sessionToken) {
        // Already have a session, just show it
        this.scrollToBottom(true);
      } else {
        // Create new session
        await this.createSession();
      }
    },

    // Close chat
    closeChat() {
      // Close chat window and stop polling (end session)
      this.isOpen = false;
      this.isMinimized = false;
      // pollingActive will be set to false by schedulePoll when it detects isOpen = false
    },

    // Minimize chat
    minimizeChat() {
      this.isMinimized = !this.isMinimized;
    },

    // End conversation and start new session
    async endConversation() {
      // Ask for confirmation if there are messages
      if (this.messages.length > 0) {
        const confirmed = await Modal.confirm({
          title: 'Beszélgetés befejezése',
          message: 'Biztosan befejezed a beszélgetést? Az összes üzenet törlődni fog.',
          confirmText: 'Igen, új beszélgetés',
          cancelText: 'Mégse'
        });

        if (!confirmed) {
          return;
        }
      }

      try {
        // Clear local storage
        localStorage.removeItem('chat_session_token');
        localStorage.removeItem('chat_session_timestamp');

        // Reset state
        this.sessionToken = null;
        this.messages = [];
        this.inputMessage = '';
        this.isTyping = false;
        this.mode = 'loading';
        this.showOfflineForm = false;
        this.pollingActive = false; // Reset polling flag

        // Create new session
        await this.createSession();

        // Restart polling with new session
        this.startPolling();

        // Show system message
        this.messages.push({
          id: Date.now(),
          role: 'system',
          content: 'Új beszélgetés kezdődött. Miben segíthetek?',
          timestamp: new Date().toISOString()
        });

        this.scrollToBottom();
      } catch (error) {
        console.error('Error ending conversation:', error);
        Modal.alert({
          title: 'Hiba',
          message: 'Hiba történt a beszélgetés befejezése során. Próbáld újra!',
          type: 'error'
        });
      }
    },

    // Create new chat session
    async createSession() {
      this.isLoading = true;

      try {
        const csrfToken = document.querySelector(CSRF_TOKEN_SELECTOR)?.getAttribute('content');
        const response = await fetch('/api/chat/session/create', {
          method: 'POST',
          headers: {
            'Content-Type': HEADER_CONTENT_TYPE_JSON,
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            name: '',
            email: '',
            phone: '',
            // Honeypot fields - should be empty for real users
            website: '',
            url: '',
            homepage: '',
            phone2: '',
            fax: ''
          })
        });

        const data = await response.json();

        if (data.success) {
          this.sessionToken = data.sessionToken;
          this.mode = data.mode;
          this.aiAvailable = data.aiAvailable;
          this.adminAvailable = data.adminAvailable;

          // Save session token and timestamp
          localStorage.setItem('chat_session_token', this.sessionToken);
          localStorage.setItem('chat_session_timestamp', Date.now().toString());

          await this.loadSession();

          // Show offline form if in offline mode
          if (this.mode === 'offline_mode') {
            this.showOfflineForm = true;
          }
        } else {
          this.showError('Nem sikerült csatlakozni a chat szolgáltatáshoz');
        }
      } catch (error) {
        console.error('Create session error:', error);
        this.showError(ERROR_CONNECTION_FAILED);
      } finally {
        this.isLoading = false;
      }
    },

    // Load existing session
    async loadSession() {
      if (!this.sessionToken) {return;}

      try {
        const response = await fetch(`/api/chat/session/${this.sessionToken}`);
        const data = await response.json();

        if (data.success) {
          this.messages = data.session.messages || [];
          this.scrollToBottom();
        }
      } catch (error) {
        console.error('Load session error:', error);
      }
    },

    // Send message
    async sendMessage() {
      if (!this.inputMessage.trim() || this.isLoading) {return;}

      const messageText = this.inputMessage.trim();
      this.inputMessage = '';

      // Update session timestamp on activity
      localStorage.setItem('chat_session_timestamp', Date.now().toString());

      // Reset polling to fast interval when user is actively chatting
      if (this.pollingActive) {
        this.pollInterval = 5000; // Back to 5s (user is active)
        this.consecutiveEmptyPolls = 0; // Reset idle counter
      }

      // Add user message to UI immediately with temporary ID
      const tempId = Date.now();
      this.messages.push({
        id: tempId,
        role: 'user',
        content: messageText,
        createdAt: new Date().toISOString()
      });

      this.scrollToBottom(true);
      this.isTyping = true;
      this.isLoading = true;

      try {
        const csrfToken = document.querySelector(CSRF_TOKEN_SELECTOR)?.getAttribute('content');
        const response = await fetch('/api/chat/message/send', {
          method: 'POST',
          headers: {
            'Content-Type': HEADER_CONTENT_TYPE_JSON,
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            message: messageText
          })
        });

        const data = await response.json();

        if (data.success) {
          // Remove temporary user message and add real ones
          this.messages = this.messages.filter((msg) => msg.id !== tempId);
          this.messages.push(data.userMessage);

          // Scroll to user message first
          this.scrollToBottom(true);

          // Check if there's an AI/system response
          if (data.aiMessage) {
            // Wait a bit before adding AI message for better UX
            setTimeout(() => {
              this.messages.push(data.aiMessage);
              this.isTyping = false;

              // Show offline form if AI suggests it (with delay so user can read the message)
              if (data.aiMessage.showOfflineForm) {
                // Delay showing the form by 3 seconds so user can read the message
                setTimeout(() => {
                  this.showOfflineForm = true;
                  this.$nextTick(() => {
                    this.scrollToBottom(true);
                  });
                }, 3000);
              }

              // Switch to fast polling when AI/Admin responds
              if (this.pollingActive) {
                this.pollInterval = 3000;
                this.consecutiveEmptyPolls = 0;
              }

              // Use $nextTick to ensure DOM is updated before scrolling
              this.$nextTick(() => {
                this.scrollToBottom(true);
              });
            }, 500);
          } else {
            // No automatic response (admin will respond manually)
            this.isTyping = false;
          }
        } else {
          this.showError('Nem sikerült elküldeni az üzenetet');
          this.isTyping = false;
        }
      } catch (error) {
        console.error('Send message error:', error);
        this.showError(ERROR_CONNECTION_FAILED);
        this.isTyping = false;
      } finally {
        // Always reset loading state, regardless of success or failure
        // Use $nextTick to ensure Alpine.js reactivity triggers DOM update
        this.$nextTick(() => {
          this.isLoading = false;
        });
      }
    },

    // Submit offline form
    async submitOfflineForm() {
      if (!this.offlineForm.name || !this.offlineForm.email || !this.offlineForm.message) {
        this.showError('Kérjük, töltse ki az összes mezőt');
        return;
      }

      this.isLoading = true;

      try {
        // Get honeypot field values from the form
        const honeypotFields = {
          website: document.querySelector('input[name="website"]')?.value || '',
          url: document.querySelector('input[name="url"]')?.value || '',
          homepage: document.querySelector('input[name="homepage"]')?.value || '',
          phone2: document.querySelector('input[name="phone2"]')?.value || '',
          fax: document.querySelector('input[name="fax"]')?.value || ''
        };

        const csrfToken = document.querySelector(CSRF_TOKEN_SELECTOR)?.getAttribute('content');
        const response = await fetch('/api/chat/offline-message', {
          method: 'POST',
          headers: {
            'Content-Type': HEADER_CONTENT_TYPE_JSON,
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            name: this.offlineForm.name,
            email: this.offlineForm.email,
            phone: this.offlineForm.phone,
            message: this.offlineForm.message,
            // Honeypot fields - should be empty for real users
            ...honeypotFields
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showOfflineForm = false;
          this.messages.push({
            id: Date.now(),
            role: 'system',
            content: `Köszönjük üzenetét! Munkatársunk hamarosan felveszi Önnel a kapcsolatot az alábbi email címen: ${this.offlineForm.email}`,
            createdAt: new Date().toISOString()
          });

          // Reset form
          this.offlineForm = { name: '', email: '', phone: '', message: '' };
          this.scrollToBottom();
        } else {
          this.showError('Nem sikerült elküldeni az üzenetet');
        }
      } catch (error) {
        console.error('Submit offline form error:', error);
        this.showError(ERROR_CONNECTION_FAILED);
      } finally {
        this.isLoading = false;
      }
    },

    // Escalate to sales
    async escalateToSales() {
      console.log('🔄 Escalate to sales clicked, sessionToken:', this.sessionToken);

      if (!this.sessionToken) {
        console.error('❌ No session token available');
        this.showError('Nincs aktív session. Kérjük, indítson új beszélgetést.');
        return;
      }

      this.isLoading = true;

      try {
        const csrfToken = document.querySelector(CSRF_TOKEN_SELECTOR)?.getAttribute('content');
        console.log('📤 Sending escalate request, CSRF:', csrfToken ? 'present' : 'missing');

        const response = await fetch('/api/chat/escalate', {
          method: 'POST',
          headers: {
            'Content-Type': HEADER_CONTENT_TYPE_JSON,
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            sessionToken: this.sessionToken
          })
        });

        console.log('📥 Escalate response status:', response.status);
        const data = await response.json();
        console.log('📥 Escalate response data:', data);

        if (data.success) {
          this.messages.push({
            id: Date.now(),
            role: 'system',
            content: '🔄 Beszélgetés átirányítva egy munkatársunkhoz. Hamarosan válaszolunk!',
            createdAt: new Date().toISOString()
          });

          this.scrollToBottom();
        } else if (response.status === 503 || (data.message && data.message.includes('available'))) {
          // Handle no admin available
          this.messages.push({
            id: Date.now(),
            role: 'system',
            content: '💬 Jelenleg nincs elérhető munkatársunk.\n\n'
              + '**Mit szeretne tenni?**\n\n'
              + '✉️ **Offline üzenetet hagy** → Kitölti az alábbi űrlapot, és 24 órán belül visszahívjuk\n\n'
              + '💬 **AI asszisztenssel folytatja** → Írjon új üzenetet, és szívesen válaszolok további kérdéseire\n\n'
              + '_Az űrlap 3 másodperc múlva jelenik meg..._',
            createdAt: new Date().toISOString()
          });

          this.scrollToBottom();

          // Show offline form with delay so user can read the message
          setTimeout(() => {
            this.showOfflineForm = true;
            this.$nextTick(() => {
              this.scrollToBottom();
            });
          }, 3000);
        } else {
          // Other error
          this.showError(data.message || 'Nem sikerült átirányítani a beszélgetést');
        }
      } catch (error) {
        console.error('Escalate error:', error);
        this.showError('Nem sikerült átirányítani a beszélgetést');
      } finally {
        this.isLoading = false;
      }
    },

    // Show error message
    showError(message) {
      this.messages.push({
        id: Date.now(),
        role: 'system',
        content: `⚠️ ${message}`,
        createdAt: new Date().toISOString()
      });

      this.scrollToBottom();
    },

    // Scroll to bottom (only if user is near bottom)
    scrollToBottom(force = false) {
      this.$nextTick(() => {
        const container = this.$refs.messagesContainer;
        if (container) {
          // Check if user is near bottom (within 100px)
          const isNearBottom = force
            || (container.scrollHeight - container.scrollTop - container.clientHeight) < 100;

          if (isNearBottom) {
            // Smooth scroll to bottom
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            });
          }
        }
      });
    },

    // Format time
    formatTime(dateString) {
      const date = new Date(dateString);
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    },

    // Get message CSS class based on role
    getMessageClass(role) {
      const baseClass = 'chat-message-base';

      switch (role) {
        case 'user':
          return `${baseClass} chat-message-user`;
        case 'assistant':
        case 'admin':
          return `${baseClass} chat-message-assistant`;
        case 'system':
          return `${baseClass} chat-message-system`;
        default:
          return baseClass;
      }
    },

    // Get message sender name
    getSenderName(role) {
      switch (role) {
        case 'user':
          return 'Ön';
        case 'assistant':
          return '🤖 AI Asszisztens';
        case 'admin':
          return '👤 Munkatárs';
        case 'system':
          return 'Rendszer';
        default:
          return '';
      }
    }
  }));
});
