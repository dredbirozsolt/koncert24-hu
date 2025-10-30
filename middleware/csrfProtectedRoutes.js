/**
 * CSRF Protected Routes Configuration
 * Ezek az útvonalak CSRF token ellenőrzést igényelnek
 */

const logger = require('../config/logger');
const { csrfProtection } = require('./advancedSecurity');

/**
 * CSRF védett útvonalak listája
 * GET/HEAD/OPTIONS kérések automatikusan kihagyva
 */
const protectedPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/profile/update-basic-info',
  '/auth/profile/change-password',
  '/auth/profile/change-email',
  '/bookings/*',
  '/wizard/submit',
  '/performers/*',
  '/locations/*',
  '/admin/*',
  '/api/*',
  '/install/*'
];

/**
 * CSRF mentesített útvonalak
 * - Fetch alapú endpointok, ahol a token headerben van
 * - Multipart form endpointok, ahol a CSRF validálás route szinten történik (multer után)
 * - Public stateless endpointok, ahol nincs state-changing művelet
 * Ezek az endpointok NEM igényelnek CSRF tokent a központi middleware-ben
 */
const exemptedPaths = [
  '/admin/chat/heartbeat',   // Admin heartbeat (automatic background)
  '/api/cookie-consent'      // Public stateless endpoint
];

/**
 * Multipart form útvonalak regex pattern listája
 * Ezek az útvonalak CSRF validálást route szinten végzik (multer után)
 */
const multipartFormPatterns = [
  /^\/admin\/partners\/?$/,          // POST /admin/partners (create)
  /^\/admin\/partners\/\d+$/,        // POST /admin/partners/:id (update)
  /^\/admin\/blog\/?$/,              // POST /admin/blog (create)
  /^\/admin\/blog\/\d+$/             // POST /admin/blog/:id (update)
];

// Helper: Check if path is exempted
function isPathExempted(path) {
  return exemptedPaths.some((exemptedPath) => path === exemptedPath);
}

// Helper: Check if path is multipart form route
function isMultipartFormRoute(path) {
  return multipartFormPatterns.some((pattern) => pattern.test(path));
}

// Helper: Check if path needs CSRF protection
function pathNeedsProtection(path) {
  return protectedPaths.some((pattern) => {
    if (pattern.endsWith('*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}

/**
 * Apply CSRF protection to routes that need it
 * Csak POST/PUT/PATCH/DELETE kérésekre vonatkozik
 *
 * Két típusú CSRF validálás:
 * 1. Form POST: csurf middleware (body _csrf token)
 * 2. JSON POST: manual validation (X-CSRF-Token header)
 */
function applyCsrfProtection(req, res, next) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check if path is exempted
  if (isPathExempted(req.path)) {
    return next();
  }

  // Check if this is a multipart form route (handles CSRF at route level after multer)
  if (isMultipartFormRoute(req.path)) {
    return next();
  }

  // Check if path needs CSRF protection
  if (pathNeedsProtection(req.path)) {
    const contentType = req.headers['content-type'] || '';
    const isJsonRequest = contentType.includes('application/json');

    logger.debug(
      {
        service: 'csrf',
        path: req.path,
        contentType,
        isJsonRequest,
        hasCookie: Boolean(req.cookies?.koncert24_csrf),
        hasBodyToken: Boolean(req.body?._csrf),
        hasHeaderToken: Boolean(req.headers?.['x-csrf-token'])
      },
      'CSRF validation'
    );

    // JSON request: manual CSRF validation using X-CSRF-Token header
    if (isJsonRequest) {
      const token = req.headers['x-csrf-token'];
      const expectedToken = res.locals.csrfToken || req.session?.csrfToken;

      if (!token || !expectedToken || token !== expectedToken) {
        logger.warn(
          {
            event: 'security_csrf_invalid_json',
            ip: req.ip,
            path: req.path,
            method: req.method,
            hasToken: Boolean(token),
            hasExpectedToken: Boolean(expectedToken),
            tokensMatch: token === expectedToken
          },
          'JSON CSRF token validation failed'
        );

        return res.status(403).json({
          success: false,
          message: 'Érvénytelen biztonsági token',
          code: 'INVALID_CSRF_TOKEN'
        });
      }

      // CSRF valid for JSON request
      return next();
    }

    // Form request: use csurf middleware
    console.log('🔴 Using csurf middleware for form request');
    return csrfProtection(req, res, next);
  }

  next();
}

/**
 * CSRF Error Handler
 */
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
    logger.warn(
      {
        event: 'security_csrf_invalid',
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      },
      'CSRF token invalid'
    );

    // Ajax request
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        success: false,
        error: 'Érvénytelen biztonsági token. Kérjük, frissítse az oldalt és próbálja újra.',
        code: 'INVALID_CSRF_TOKEN'
      });
    }

    // Regular request
    return res.status(403).render('error', {
      title: 'Biztonsági hiba',
      message: 'Érvénytelen biztonsági token. Kérjük, frissítse az oldalt és próbálja újra.',
      statusCode: 403
    });
  }

  next(err);
}

module.exports = {
  applyCsrfProtection,
  csrfErrorHandler,
  protectedPaths
};
