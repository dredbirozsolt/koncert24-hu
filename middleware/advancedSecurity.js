/**
 * Advanced Security Middleware
 * Simple, reliable CSRF protection + XSS + SQL/NoSQL injection protection
 */

const mongoSanitize = require('express-mongo-sanitize');
const crypto = require('crypto');
const logger = require('../config/logger');


// Constants
const SECURITY_ERROR_TITLE = 'Biztonsági hiba';
const USER_AGENT_HEADER = 'User-Agent';

/**
 * ============================================
 * CSRF PROTECTION - Session-based (Simple & Reliable)
 * ============================================
 */

/**
 * ============================================
 * CSRF PROTECTION - Session-based (Simple & Reliable)
 * ============================================
 */

// CSRF token generálás
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRF middleware - token generálás és hozzáadás res.locals-hoz
function csrfTokenMiddleware(req, res, next) {
  // GET kérésekhez generálunk tokent ha még nincs
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  // Minden kéréshez hozzáadjuk az res.locals-hoz, hogy a view-k mindig elérjék
  // Minden kéréshez hozzáadjuk az res.locals-hoz, hogy a view-k mindig elérjék
  // (pl. POST után error rendereléskor is kell)
  if (req.session.csrfToken) {
    res.locals.csrfToken = req.session.csrfToken;
  }

  next();
}

// Helper: Check if request is AJAX/fetch
function isAjaxRequest(req) {
  return req.xhr
    || req.headers.accept?.indexOf('json') > -1
    || req.headers['content-type']?.indexOf('json') > -1;
}

// Helper: Determine return path for auth route CSRF errors
function getAuthReturnPath(requestPath) {
  if (requestPath.includes('login')) {
    return '/auth/login';
  }
  if (requestPath.includes('register')) {
    return '/auth/register';
  }
  return requestPath;
}

// Helper: Handle auth route CSRF errors with redirect
function handleAuthRouteCsrfError(req, res) {
  const returnPath = getAuthReturnPath(req.path);
  return res.redirect(`${returnPath}?error=csrf`);
}

// Helper: Send CSRF error response (JSON or HTML)
function sendCsrfError(res, isAjax, code, message) {
  if (isAjax) {
    return res.status(403).json({
      success: false,
      error: message,
      code
    });
  }
  return res.status(403).render('error', {
    title: SECURITY_ERROR_TITLE,
    message,
    statusCode: 403
  });
}

// Helper: Validate token comparison
function validateTokenMatch(tokenFromSession, tokenFromRequest) {
  const bufferA = Buffer.from(tokenFromSession);
  const bufferB = Buffer.from(tokenFromRequest);
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

// Helper: Handle missing session token
function handleMissingSessionToken(req, res, isAjax) {
  logger.warn({
    event: 'security_csrf_no_session_token',
    ip: req.ip,
    path: req.path,
    method: req.method,
    sessionID: req.sessionID,
    hasSession: Boolean(req.session),
    userAgent: req.get(USER_AGENT_HEADER)
  }, 'CSRF: No token in session');

  if (req.path.startsWith('/auth/')) {
    return handleAuthRouteCsrfError(req, res);
  }

  return sendCsrfError(res, isAjax, 'CSRF_NO_SESSION_TOKEN',
    'CSRF token hiányzik a session-ből. Kérjük, jelentkezz be újra.');
}

// Helper: Handle missing request token
function handleMissingRequestToken(req, res, isAjax) {
  logger.warn({
    event: 'security_csrf_no_request_token',
    ip: req.ip,
    path: req.path,
    method: req.method,
    bodyKeys: Object.keys(req.body || {}),
    userAgent: req.get(USER_AGENT_HEADER)
  }, 'CSRF: No token in request');

  if (req.path.startsWith('/auth/')) {
    return handleAuthRouteCsrfError(req, res);
  }

  return sendCsrfError(res, isAjax, 'CSRF_NO_REQUEST_TOKEN',
    'CSRF token hiányzik a kérésben. Kérjük, frissítsd az oldalt.');
}

// Helper: Handle token mismatch
function handleTokenMismatch(req, res, isAjax, tokenFromSession, tokenFromRequest) {
  logger.warn({
    event: 'security_csrf_token_mismatch',
    ip: req.ip,
    path: req.path,
    method: req.method,
    tokenFromSession: `${tokenFromSession?.substring(0, 20)}...`,
    tokenFromRequest: `${tokenFromRequest?.substring(0, 20)}...`,
    userAgent: req.get(USER_AGENT_HEADER)
  }, 'CSRF: Token mismatch');

  if (req.path.startsWith('/auth/')) {
    return handleAuthRouteCsrfError(req, res);
  }

  return sendCsrfError(res, isAjax, 'CSRF_TOKEN_MISMATCH',
    'Érvénytelen CSRF token. Kérjük, frissítsd az oldalt és próbáld újra.');
}

// CSRF validálás POST/PUT/PATCH/DELETE kérésekhez
function validateCsrfToken(req, res, next) {
  // Skip biztonságos metódusok
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const tokenFromRequest = req.body._csrf || req.body.csrfToken || req.headers['x-csrf-token'];
  const tokenFromSession = req.session.csrfToken;
  const isAjax = isAjaxRequest(req);

  // Check: Session-ben van-e token?
  if (!tokenFromSession) {
    return handleMissingSessionToken(req, res, isAjax);
  }

  // Check: Request-ben van-e token?
  if (!tokenFromRequest) {
    return handleMissingRequestToken(req, res, isAjax);
  }

  // Check: Egyeznek-e a tokenek?
  if (!validateTokenMatch(tokenFromSession, tokenFromRequest)) {
    return handleTokenMismatch(req, res, isAjax, tokenFromSession, tokenFromRequest);
  }

  // Token valid, folytathatjuk
  next();
}

// Export CSRF middleware
const generateCsrfTokenMiddleware = csrfTokenMiddleware;
const csrfProtection = validateCsrfToken;

/**
 * XSS Protection Middleware
 * Tisztítja a request bodyban, query-ben és params-ban lévő potenciális XSS kódot
 */
function xssProtection(req, res, next) {
  // XSS pattern detection
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, stb.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
    /expression\(/gi
  ];

  function checkForXSS(value) {
    if (typeof value === 'string') {
      return xssPatterns.some((pattern) => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkForXSS);
    }
    return false;
  }

  // Check all input sources
  if (checkForXSS(req.body) || checkForXSS(req.query) || checkForXSS(req.params)) {
    logger.warn({
      event: 'security_xss_blocked',
      attackType: 'xss',
      ip: req.ip,
      userAgent: req.get(USER_AGENT_HEADER),
      path: req.path,
      method: req.method,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      queryKeys: req.query ? Object.keys(req.query) : []
    }, 'XSS attack detected and blocked');

    return res.status(400).json({
      success: false,
      error: 'Biztonsági okokból a kérés elutasítva. Nem megengedett karakterek találhatók.'
    });
  }

  next();
}

/**
 * SQL Injection Protection (extended)
 */
function sqlInjectionProtection(req, res, next) {
  // Skip SQL injection check for cron schedule updates (contains * character)
  if (req.path === '/admin/cron/update' && req.body?.schedule) {
    return next();
  }

  // More strict SQL injection patterns - avoid false positives for content fields
  const sqlPatterns = [
    // SQL keywords with suspicious context (spaces/special chars before/after)
    /(\s|^)(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)(\s+|\()/gi,
    // SQL comments
    /(--|\/\*|\*\/)/g,
    // Suspicious OR/AND with equals (SQL injection classic)
    /(\bOR\b|\bAND\b)\s+[\w]+\s*=\s*[\w'"]/gi,
    // exec with parenthesis (code execution)
    /exec\s*\(/gi,
    // javascript: protocol
    /javascript\s*:/gi,
    // Classic 1=1 or '1'='1'
    /(1\s*=\s*1|'1'\s*=\s*'1')/gi,
    // Quotes with OR (SQL injection)
    /'.*\bOR\b.*'/gi
  ];

  function checkForSQL(value) {
    if (typeof value === 'string') {
      return sqlPatterns.some((pattern) => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkForSQL);
    }
    return false;
  }

  if (checkForSQL(req.body) || checkForSQL(req.query) || checkForSQL(req.params)) {
    logger.warn({
      event: 'security_sql_injection_blocked',
      attackType: 'sql_injection',
      ip: req.ip,
      userAgent: req.get(USER_AGENT_HEADER),
      path: req.path,
      method: req.method,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      queryKeys: req.query ? Object.keys(req.query) : []
    }, 'SQL injection attack detected and blocked');

    return res.status(400).json({
      success: false,
      error: 'Biztonsági okokból a kérés elutasítva.'
    });
  }

  next();
}

/**
 * NoSQL Injection Protection
 */
const noSQLProtection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    // Skip warning for legitimate admin settings updates (keys with dots are normal)
    const isSettingsUpdate = req.path.startsWith('/admin/settings/section/');
    const isIntegrationsUpdate = req.path.startsWith('/admin/integrations/');
    const isExitPopupUpdate = req.path === '/admin/exit-popup';
    const isEmailUpdate = req.path === '/admin/email/save';

    if (!isSettingsUpdate && !isIntegrationsUpdate && !isExitPopupUpdate && !isEmailUpdate) {
      logger.warn({
        event: 'security_nosql_injection_blocked',
        attackType: 'nosql_injection',
        ip: req.ip,
        key,
        path: req.path,
        userAgent: req.get(USER_AGENT_HEADER)
      }, 'NoSQL injection attempt detected and sanitized');
    }
  }
});

/**
 * ============================================
 * ADDITIONAL SECURITY MIDDLEWARE
 * ============================================
 */

/**
 * IP Reputation Check
 * Blokkolja a gyanús IP címeket
 */
const blockedIPs = new Set();
const ipAttempts = new Map();

function ipReputationCheck(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;

  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    logger.warn({
      event: 'security_blocked_ip_access',
      ip,
      path: req.path,
      method: req.method,
      userAgent: req.get(USER_AGENT_HEADER)
    }, 'Blocked IP attempted access');

    return res.status(403).json({
      success: false,
      error: 'Access denied from this IP address'
    });
  }

  // Track failed attempts
  const attempts = ipAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Reset counter if more than 1 hour passed
  if (now - attempts.firstAttempt > oneHour) {
    ipAttempts.delete(ip);
  }

  next();
}

/**
 * Add IP to blocklist
 */
function blockIP(ip, reason = 'Security violation') {
  blockedIPs.add(ip);
  logger.warn({
    event: 'security_ip_blocked',
    ip,
    reason,
    timestamp: new Date().toISOString()
  }, `IP blocked: ${reason}`);
}

/**
 * Suspicious Pattern Detection
 * Figyeli a gyanús URL mintákat
 */
function suspiciousPatternDetection(req, res, next) {
  const suspiciousPatterns = [
    /\.\./g,  // Directory traversal
    /\/etc\/passwd/gi,
    /\/proc\//gi,
    /\0/g,  // Null bytes
    /%00/g,  // URL encoded null bytes
    /\$\{/g,  // Template injection
    /<%/g,  // Template injection
    /__proto__/gi,  // Prototype pollution
    /constructor/gi,  // Prototype pollution
    /wp-admin/gi,  // WordPress scanning
    /phpmyadmin/gi,  // phpMyAdmin scanning
    /\.env/gi,  // Environment file access
    /\.git/gi,  // Git file access
    /admin\.php/gi,
    /xmlrpc\.php/gi
  ];

  const fullUrl = req.originalUrl || req.url;
  const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(fullUrl));

  if (isSuspicious) {
    logger.warn({
      event: 'security_suspicious_pattern',
      ip: req.ip,
      url: fullUrl,
      method: req.method,
      userAgent: req.get(USER_AGENT_HEADER),
      path: req.path
    }, 'Suspicious pattern detected in URL');

    // Increment IP attempts
    const ip = req.ip || req.connection.remoteAddress;
    const attempts = ipAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
    attempts.count += 1;
    ipAttempts.set(ip, attempts);

    // Block IP after 5 suspicious attempts
    if (attempts.count >= 5) {
      blockIP(ip, 'Multiple suspicious requests');
    }

    return res.status(404).send('Not Found');
  }

  next();
}

/**
 * HTTP Parameter Pollution Protection
 * Megakadályozza az ugyanazon paraméter többszöri elküldését
 */
function hppProtection(req, res, next) {
  // Check query parameters
  for (const key in req.query) {
    if (Array.isArray(req.query[key])) {
      logger.warn({
        event: 'security_hpp_detected',
        location: 'query',
        ip: req.ip,
        key,
        valueCount: req.query[key].length,
        path: req.path
      }, 'HTTP Parameter Pollution detected in query');

      // Keep only the last value
      req.query[key] = req.query[key][req.query[key].length - 1];
    }
  }

  // Check body parameters
  if (req.body) {
    for (const key in req.body) {
      if (Array.isArray(req.body[key]) && !key.endsWith('[]')) {
        logger.warn({
          event: 'security_hpp_detected',
          location: 'body',
          ip: req.ip,
          key,
          valueCount: req.body[key].length,
          path: req.path
        }, 'HTTP Parameter Pollution detected in body');

        // Keep only the last value
        req.body[key] = req.body[key][req.body[key].length - 1];
      }
    }
  }

  next();
}

/**
 * Request Size Limit
 * DoS védelem - korlátozza a request body méretét
 */
function requestSizeLimit(maxSizeMB = 10) {
  const maxBytes = maxSizeMB * 1024 * 1024;

  return (req, res, next) => {
    const contentLength = req.get('content-length');

    if (contentLength && parseInt(contentLength) > maxBytes) {
      logger.warn({
        event: 'security_request_too_large',
        ip: req.ip,
        size: contentLength,
        maxSize: maxBytes,
        path: req.path,
        method: req.method
      }, 'Request size limit exceeded');

      return res.status(413).json({
        success: false,
        error: `Request too large. Maximum size is ${maxSizeMB}MB`
      });
    }

    next();
  };
}

/**
 * Additional Security Headers
 * Extra biztonsági headerek (Helmet már ad néhányat)
 */
function additionalSecurityHeaders(req, res, next) {
  // X-Powered-By elrejtése
  res.removeHeader('X-Powered-By');

  // Additional headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * EXPORTS
 */
module.exports = {
  // CSRF Protection
  generateCsrfTokenMiddleware,
  csrfTokenMiddleware,
  validateCsrfToken,
  csrfProtection,
  // XSS & Injection Protection
  xssProtection,
  sqlInjectionProtection,
  noSQLProtection,
  // Additional Security
  ipReputationCheck,
  suspiciousPatternDetection,
  hppProtection,
  requestSizeLimit,
  additionalSecurityHeaders,
  // Utilities
  blockIP
};

