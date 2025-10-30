/**
 * Design System Modal Handler
 *
 * Official modal management system for the design-system/components/modal.css
 * Follows best practices:
 * - DOM manipulation (createElement/remove)
 * - Event delegation
 * - Keyboard accessibility (ESC key)
 * - Focus management
 * - Body scroll lock
 * - Promise-based API for confirmations
 *
 * Usage:
 *
 * // Simple modal with custom content
 * const modal = Modal.create({
 *   title: 'Modal Title',
 *   content: '<p>Modal content here</p>',
 *   onClose: () => console.log('Modal closed')
 * });
 * modal.open();
 *
 * // Confirmation dialog
 * Modal.confirm({
 *   title: 'Delete Item?',
 *   message: 'This action cannot be undone.',
 *   confirmText: 'Delete',
 *   cancelText: 'Cancel'
 * }).then(confirmed => {
 *   if (confirmed) {
 *     // User clicked confirm
 *   }
 * });
 *
 * // Info/Error/Success messages
 * Modal.alert({
 *   title: 'Success',
 *   message: 'Operation completed successfully!',
 *   type: 'success' // 'info', 'warning', 'error', 'success'
 * });
 */

(function (window) {
  'use strict';

  // Constants for icon CSS classes (used in confirm/alert/prompt modals)
  const ICON_CLASS_INFO = 'icon-info';
  const ICON_CLASS_SUCCESS = 'icon-success';
  const ICON_CLASS_WARNING = 'icon-warning';
  const ICON_CLASS_ERROR = 'icon-error';

  class Modal {
    constructor(options = {}) {
      this.options = {
        title: options.title || '',
        content: options.content || '',
        size: options.size || 'md', // 'sm', 'md', 'lg', 'xl', 'full'
        closeOnBackdrop: options.closeOnBackdrop !== false,
        closeOnEscape: options.closeOnEscape !== false,
        showCloseButton: options.showCloseButton !== false,
        footer: options.footer || null,
        onOpen: options.onOpen || null,
        onClose: options.onClose || null,
        className: options.className || ''
      };

      this.backdrop = null;
      this.modalElement = null;
      this.isOpen = false;
      this.previousFocus = null;
    }

    /**
     * Create modal DOM structure
     */
    _createDOM() {
      // Create backdrop
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'modal__backdrop';
      this.backdrop.setAttribute('role', 'dialog');
      this.backdrop.setAttribute('aria-modal', 'true');

      // Create modal container
      this.modalElement = document.createElement('div');
      this.modalElement.className = `modal modal-${this.options.size}`;
      if (this.options.className) {
        this.modalElement.className += ` ${this.options.className}`;
      }

      // Create modal structure
      let headerHTML = '';
      if (this.options.title) {
        headerHTML = `
          <div class="modal__header">
            <h3 class="modal-title">${this.options.title}</h3>
            ${this.options.showCloseButton ? '<button type="button" class="modal__close" aria-label="Close"></button>' : ''}
          </div>
        `;
      }

      let footerHTML = '';
      if (this.options.footer) {
        footerHTML = `
          <div class="modal__footer">
            ${this.options.footer}
          </div>
        `;
      }

      this.modalElement.innerHTML = `
        ${headerHTML}
        <div class="modal__body">
          ${this.options.content}
        </div>
        ${footerHTML}
      `;

      this.backdrop.appendChild(this.modalElement);
    }

    /**
     * Open the modal
     */
    open() {
      if (this.isOpen) {return;}

      // Create DOM if not exists
      if (!this.backdrop) {
        this._createDOM();
      }

      // Store current focus
      this.previousFocus = document.activeElement;

      // Add to DOM
      document.body.appendChild(this.backdrop);
      document.body.classList.add('modal-open');

      // Bind events
      this._bindEvents();

      // Focus first focusable element
      setTimeout(() => {
        const firstFocusable = this.modalElement.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }, 100);

      this.isOpen = true;

      // Call onOpen callback
      if (this.options.onOpen) {
        this.options.onOpen(this);
      }

      return this;
    }

    /**
     * Close the modal
     */
    close() {
      if (!this.isOpen) {return;}

      // Add closing animation class
      this.backdrop.classList.add('modal-closing');

      // Wait for animation to finish
      setTimeout(() => {
        if (this.backdrop && this.backdrop.parentNode) {
          this.backdrop.parentNode.removeChild(this.backdrop);
        }
        document.body.classList.remove('modal-open');

        // Restore focus
        if (this.previousFocus) {
          this.previousFocus.focus();
        }

        this.isOpen = false;

        // Call onClose callback
        if (this.options.onClose) {
          this.options.onClose(this);
        }
      }, 200); // Match CSS animation duration

      return this;
    }

    /**
     * Update modal content
     */
    setContent(content) {
      if (this.modalElement) {
        const bodyEl = this.modalElement.querySelector('.modal__body');
        if (bodyEl) {
          bodyEl.innerHTML = content;
        }
      }
      return this;
    }

    /**
     * Bind event listeners
     */
    _bindEvents() {
      // Close on backdrop click
      if (this.options.closeOnBackdrop) {
        this.backdrop.addEventListener('click', (e) => {
          if (e.target === this.backdrop) {
            this.close();
          }
        });
      }

      // Close on ESC key
      if (this.options.closeOnEscape) {
        this._escapeHandler = (e) => {
          if (e.key === 'Escape') {
            this.close();
          }
        };
        document.addEventListener('keydown', this._escapeHandler);
      }

      // Close button
      const closeBtn = this.modalElement.querySelector('.modal__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }
    }

    /**
     * Remove event listeners
     */
    _unbindEvents() {
      if (this._escapeHandler) {
        document.removeEventListener('keydown', this._escapeHandler);
      }
    }

    /**
     * Destroy modal instance
     */
    destroy() {
      this.close();
      this._unbindEvents();
      this.backdrop = null;
      this.modalElement = null;
    }

    // ============================================================================
    // Static factory methods
    // ============================================================================

    /**
     * Create and return a modal instance
     */
    static create(options) {
      return new Modal(options);
    }

    /**
     * Alert modal (info, success, warning, error)
     * Uses design system CSS classes only - no inline styles
     */
    static alert(options) {
      const iconMap = {
        info: { class: ICON_CLASS_INFO, emoji: 'ℹ️' },
        success: { class: ICON_CLASS_SUCCESS, emoji: '✅' },
        warning: { class: ICON_CLASS_WARNING, emoji: '⚠️' },
        error: { class: ICON_CLASS_ERROR, emoji: '❌' }
      };

      const type = options.type || 'info';
      const iconData = iconMap[type] || iconMap.info;

      // Use design system CSS classes from components/modal.css
      const content = `
        <div class="modal-confirm-icon ${iconData.class}">
          ${iconData.emoji}
        </div>
        <p class="modal-confirm-message">${options.message || ''}</p>
      `;

      const footer = `
        <button type="button" class="btn btn-primary modal-alert-ok">OK</button>
      `;

      const modal = new Modal({
        title: options.title || 'Notice',
        content,
        footer,
        size: options.size || 'sm',
        className: `modal-confirm modal-alert-${type}`,
        closeOnBackdrop: options.closeOnBackdrop !== false,
        closeOnEscape: options.closeOnEscape !== false
      });

      modal.open();

      // Bind OK button
      setTimeout(() => {
        const okBtn = modal.modalElement.querySelector('.modal-alert-ok');
        if (okBtn) {
          okBtn.addEventListener('click', () => modal.close());
        }
      }, 0);

      return modal;
    }

    /**
     * Confirmation dialog with Promise
     * Uses design system CSS classes only - no inline styles
     */
    static confirm(options) {
      return new Promise((resolve) => {
        // Use design system CSS classes from components/modal.css
        const content = `
          <div class="modal-confirm-icon icon-info">
            ❓
          </div>
          <p class="modal-confirm-message">${options.message || 'Are you sure?'}</p>
        `;

        const footer = `
          <button type="button" class="btn btn-secondary modal-confirm-cancel">${options.cancelText || 'Cancel'}</button>
          <button type="button" class="btn btn-primary modal-confirm-ok">${options.confirmText || 'Confirm'}</button>
        `;

        const modal = new Modal({
          title: options.title || 'Confirm',
          content,
          footer,
          size: options.size || 'sm',
          className: 'modal-confirm',
          closeOnBackdrop: false,
          closeOnEscape: true,
          onClose: () => resolve(false)
        });

        modal.open();

        // Bind buttons
        setTimeout(() => {
          const cancelBtn = modal.modalElement.querySelector('.modal-confirm-cancel');
          const okBtn = modal.modalElement.querySelector('.modal-confirm-ok');

          if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
              modal.close();
              resolve(false);
            });
          }

          if (okBtn) {
            okBtn.addEventListener('click', () => {
              modal.close();
              resolve(true);
            });
          }
        }, 0);
      });
    }

    /**
     * Loading modal
     * Uses design system CSS classes only - no inline styles
     */
    static loading(message = 'Loading...') {
      // Use design system CSS classes from components/modal.css
      const content = `
        <div class="modal__loading-spinner"></div>
        <p class="modal-loading-message">${message}</p>
      `;

      const modal = new Modal({
        content,
        size: 'sm',
        className: 'modal-loading',
        closeOnBackdrop: false,
        closeOnEscape: false,
        showCloseButton: false
      });

      modal.open();
      return modal;
    }
  }

  // Export to global scope
  window.Modal = Modal;

  // Also expose as DesignSystemModal for clarity
  window.DesignSystemModal = Modal;

  // ============================================================================
  // Global helper functions for backward compatibility and ease of use
  // ============================================================================

  /**
   * Show simple modal with message
   * Uses design system CSS classes from components/modal.css
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {string} type - Modal type: 'info', 'success', 'warning', 'error'
   * @returns {Promise<void>}
   */
  window.showModal = function (title, message, type = 'info') {
    return new Promise((resolve) => {
      // Map type to icon using design system classes
      const iconMap = {
        info: { class: ICON_CLASS_INFO, emoji: 'ℹ️' },
        success: { class: ICON_CLASS_SUCCESS, emoji: '✅' },
        warning: { class: ICON_CLASS_WARNING, emoji: '⚠️' },
        error: { class: ICON_CLASS_ERROR, emoji: '❌' }
      };
      const iconData = iconMap[type] || iconMap.info;

      // Use design system structure with CSS classes only
      const content = `
        <div class="modal-confirm-icon ${iconData.class}">
          ${iconData.emoji}
        </div>
        <p class="modal-confirm-message">${message}</p>
      `;

      const footer = `
        <button type="button" class="btn btn-primary modal-alert-ok">Rendben</button>
      `;

      const modal = Modal.create({
        title,
        content,
        footer,
        size: 'sm',
        className: `modal-confirm modal-alert-${type}`,
        closeOnBackdrop: true,
        closeOnEscape: true,
        onClose: resolve
      });

      modal.open();

      // Bind OK button
      setTimeout(() => {
        const okBtn = modal.modalElement.querySelector('.modal-alert-ok');
        if (okBtn) {
          okBtn.addEventListener('click', () => modal.close());
        }
      }, 0);
    });
  };

  /**
   * Show confirmation modal
   * Uses design system CSS classes from components/modal.css
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {string} type - Icon type: 'info', 'warning', 'error'
   * @returns {Promise<boolean>} - true if confirmed, false if cancelled
   */
  window.showConfirmModal = function (title, message, type = 'warning') {
    return new Promise((resolve) => {
      // Map type to icon using design system classes
      const iconMap = {
        info: { class: ICON_CLASS_INFO, emoji: '❓' },
        warning: { class: ICON_CLASS_WARNING, emoji: '⚠️' },
        error: { class: ICON_CLASS_ERROR, emoji: '❌' }
      };
      const iconData = iconMap[type] || iconMap.warning;

      // Use design system structure with CSS classes only
      const content = `
        <div class="modal-confirm-icon ${iconData.class}">
          ${iconData.emoji}
        </div>
        <p class="modal-confirm-message">${message.replace(/\n/g, '<br>')}</p>
      `;

      const footer = `
        <button type="button" class="btn btn-secondary modal-confirm-cancel">Mégse</button>
        <button type="button" class="btn btn-primary modal-confirm-ok">Rendben</button>
      `;

      const modal = Modal.create({
        title,
        content,
        footer,
        size: 'sm',
        className: `modal-confirm modal-confirm-${type}`,
        closeOnBackdrop: false,
        closeOnEscape: true,
        onClose: () => resolve(false)
      });

      modal.open();

      // Bind buttons
      setTimeout(() => {
        const cancelBtn = modal.modalElement.querySelector('.modal-confirm-cancel');
        const okBtn = modal.modalElement.querySelector('.modal-confirm-ok');

        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            modal.close();
            resolve(false);
          });
        }

        if (okBtn) {
          okBtn.addEventListener('click', () => {
            modal.close();
            resolve(true);
          });
        }
      }, 0);
    });
  };
}(window));
