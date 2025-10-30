/**
 * Security View Helpers
 * EJS template-ekhez használható segédfüggvények
 */

const logger = require('../config/logger');

// Constants
const CSRF_TOKEN_MISSING_WARNING = '⚠️ CSRF token not found in template context';

/**
 * CSRF Token mező generálása form-okhoz
 * Használat EJS-ben: <%- csrfField() %>
 *
 * Példa:
 * <form method="POST" action="/auth/login">
 *   <%- csrfField() %>
 *   <input type="email" name="email">
 *   <button type="submit">Bejelentkezés</button>
 * </form>
 */
function csrfField() {
  // eslint-disable-next-line no-invalid-this
  const csrfToken = this.locals?.csrfToken || this.csrfToken;

  if (!csrfToken) {
    logger.warn({ service: 'securityHelpers', helper: 'csrfField' }, CSRF_TOKEN_MISSING_WARNING);
    return '';
  }

  return `<input type="hidden" name="_csrf" value="${csrfToken}">`;
}

/**
 * CSRF Token meta tag generálása (AJAX kérésekhez)
 * Használat EJS layout.ejs head-ben: <%- csrfMeta() %>
 *
 * JavaScript-ben:
 * const token = document.querySelector('meta[name="csrf-token"]').content;
 * fetch('/api/endpoint', {
 *   method: 'POST',
 *   headers: { 'X-CSRF-Token': token }
 * });
 */
function csrfMeta() {
  // eslint-disable-next-line no-invalid-this
  const csrfToken = this.locals?.csrfToken || this.csrfToken;

  if (!csrfToken) {
    logger.warn({ service: 'securityHelpers', helper: 'csrfMeta' }, CSRF_TOKEN_MISSING_WARNING);
    return '';
  }

  return `<meta name="csrf-token" content="${csrfToken}">`;
}

/**
 * CSRF Token lekérése (JavaScript változóként)
 * Használat EJS-ben: <script><%- csrfScript() %></script>
 */
function csrfScript() {
  // eslint-disable-next-line no-invalid-this
  const csrfToken = this.locals?.csrfToken || this.csrfToken;

  if (!csrfToken) {
    logger.warn({ service: 'securityHelpers', helper: 'csrfScript' }, CSRF_TOKEN_MISSING_WARNING);
    return 'const CSRF_TOKEN = null;';
  }

  return `const CSRF_TOKEN = '${csrfToken}';`;
}

/**
 * Security header for forms (multiple protections)
 * Használat: <%- securityHeaders() %>
 */
function securityHeaders() {
  return `${csrfField.call(this)}\n`
    + '<input type="hidden" name="_security_check" value="1">';
}

module.exports = {
  csrfField,
  csrfMeta,
  csrfScript,
  securityHeaders
};
