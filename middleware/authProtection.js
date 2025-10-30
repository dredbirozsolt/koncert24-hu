/**
 * Auth Protection Middleware
 * Védi a bejelentkezési és regisztrációs rendszert bot támadások ellen
 */

const logger = require('../config/logger');
const rateLimit = require('express-rate-limit');

// Constants
const USER_AGENT_HEADER = 'User-Agent';
const LOGIN_VALIDATION_ERROR_URL = '/auth/login?error=validation';

/**
 * Login rate limiter
 * Max 5 login kísérlet 15 percenként IP címenként
 * Brute force támadások ellen
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 perc
  max: 5, // Max 5 próbálkozás
  message: 'Túl sok bejelentkezési kísérlet. Kérjük várj 15 percet és próbáld újra.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Sikeres próbálkozások is számítanak
  keyGenerator: (req) =>
    // IP + User Agent kombináció
    `${req.ip}-${req.get(USER_AGENT_HEADER)}`

});

/**
 * Register rate limiter
 * Max 3 regisztráció 1 órában IP címenként
 * Spam regisztrációk ellen
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 óra
  max: 3, // Max 3 regisztráció
  message: 'Túl sok regisztrációs kísérlet. Kérjük várj 1 órát és próbáld újra.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}-${req.get(USER_AGENT_HEADER)}`
});

/**
 * Password reset rate limiter
 * Max 3 jelszó reset kérés 1 órában email címenként
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 óra
  max: 3,
  message: 'Túl sok jelszó visszaállítási kérés. Kérjük várj 1 órát.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email || req.ip
});

/**
 * User Agent validator
 * Blokkolja az ismert bot user agent-eket
 */
const userAgentValidator = (req, res, next) => {
  const userAgent = req.get(USER_AGENT_HEADER) || '';

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /postman/i,
    /insomnia/i
  ];

  const isBot = botPatterns.some((pattern) => pattern.test(userAgent));

  if (isBot) {
    return res.status(403).json({
      success: false,
      error: 'Automated requests are not allowed'
    });
  }

  next();
};

/**
 * Honeypot field checker
 * Ellenőrzi, hogy a rejtett honeypot mezők kitöltve vannak-e
 */
const honeypotChecker = (req, res, next) => {
  // Honeypot mezők (rejtett mezők, amit bot kitölt, de ember nem lát)
  const honeypotFields = [
    'website',
    'url',
    'homepage',
    'company_name',
    'phone_number'
  ];

  // Check if any honeypot field is filled
  for (const field of honeypotFields) {
    const value = req.body[field];

    // Only trigger if field has actual content (not empty string or undefined)
    if (value && value.trim && value.trim().length > 0) {
      // Bot filled the honeypot field
      // Silent response - bot won't know it was blocked
      return res.redirect(LOGIN_VALIDATION_ERROR_URL);
    }
  }

  next();
};

/**
 * Suspicious pattern detector
 * Gyanús minták keresése a bemenetben
 */
const patternDetector = (req, res, next) => {
  const { email, name, password } = req.body;

  // SQL injection próbálkozás
  const sqlPatterns = [
    /('|(--)|;|\/\*|\*\/|xp_|exec|execute|select|insert|update|delete|drop|create|alter)/gi
  ];

  // XSS próbálkozás
  const xssPatterns = [
    /<script>/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /<iframe>/i
  ];

  // Ellenőrzés
  const fieldsToCheck = [email, name, password].filter(Boolean);

  for (const field of fieldsToCheck) {
    // SQL injection check
    if (sqlPatterns.some((pattern) => pattern.test(field))) {
      logger.warn(
        { event: 'security_auth_sql_injection', ip: req.ip, field: field.substring(0, 50) },
        'SQL injection attempt detected'
      );
      return res.redirect(LOGIN_VALIDATION_ERROR_URL);
    }

    // XSS check
    if (xssPatterns.some((pattern) => pattern.test(field))) {
      logger.warn(
        { event: 'security_auth_xss', ip: req.ip, field: field.substring(0, 50) },
        'XSS attempt detected'
      );
      return res.redirect(LOGIN_VALIDATION_ERROR_URL);
    }
  }

  next();
};

/**
 * Email domain validator
 * Blokkolja a túl gyanús/ideiglenes email szolgáltatókat
 */
const emailDomainValidator = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next();
  }

  const domain = email.split('@')[1]?.toLowerCase();

  // Ismert ideiglenes/spam email szolgáltatók
  const suspiciousDomains = [
    'guerrillamail.com',
    'mailinator.com',
    '10minutemail.com',
    'tempmail.com',
    'throwaway.email',
    'yopmail.com',
    'maildrop.cc',
    'fakeinbox.com'
  ];

  if (suspiciousDomains.includes(domain)) {
    logger.warn({ event: 'security_auth_suspicious_domain', ip: req.ip, domain }, 'Suspicious email domain');
    return res.redirect('/auth/register?error=invalid_email');
  }

  next();
};

/**
 * Combine all login protections
 */
const loginProtection = [
  userAgentValidator,
  loginLimiter,
  honeypotChecker,
  patternDetector
];

/**
 * Combine all register protections
 */
const registerProtection = [
  userAgentValidator,
  registerLimiter,
  honeypotChecker,
  patternDetector,
  emailDomainValidator
];

/**
 * Combine all password reset protections
 */
const passwordResetProtection = [
  userAgentValidator,
  passwordResetLimiter,
  patternDetector
];

module.exports = {
  loginProtection,
  registerProtection,
  passwordResetProtection,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  userAgentValidator,
  honeypotChecker,
  patternDetector,
  emailDomainValidator
};
