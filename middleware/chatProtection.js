/**
 * Chat Protection Middleware
 * Védi a chat rendszert bot támadások és spam ellen
 */

const logger = require('../config/logger');
const rateLimit = require('express-rate-limit');

// Constants
const USER_AGENT_HEADER = 'User-Agent';


/**
 * Session creation rate limiter
 * Max 3 új session 15 percenként IP címenként
 */
const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 perc
  max: 3, // Max 3 session
  message: {
    success: false,
    error: 'Túl sok chat munkamenet indítva. Kérjük várj 15 percet és próbáld újra.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator - IP + User Agent kombináció
  keyGenerator: (req) => `${req.ip}-${req.get(USER_AGENT_HEADER)}`
});

/**
 * Message sending rate limiter
 * Max 20 üzenet percenként sessionenként
 */
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 perc
  max: 20, // Max 20 üzenet
  message: {
    success: false,
    error: 'Túl sok üzenet küldve. Kérjük lassíts egy kicsit.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    // Session token alapú limitálás
    req.body.sessionToken || req.ip

});

/**
 * Offline message rate limiter
 * Max 2 offline üzenet óránként
 */
const offlineLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 óra
  max: 2,
  message: {
    success: false,
    error: 'Túl sok offline üzenet. Kérjük próbáld újra 1 óra múlva.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Honeypot field checker
 * Bot-ok kitöltik az összes mezőt, emberek nem látják
 */
const honeypotChecker = (req, res, next) => {
  // Honeypot mezők: website, url, homepage, phone2, fax
  const honeypotFields = ['website', 'url', 'homepage', 'phone2', 'fax'];

  for (const field of honeypotFields) {
    if (req.body[field] && req.body[field].trim() !== '') {
      logger.warn(
        {
          event: 'security_chat_honeypot',
          ip: req.ip,
          userAgent: req.get(USER_AGENT_HEADER),
          field,
          value: req.body[field]
        },
        'Bot detected via honeypot'
      );

      return res.status(403).json({
        success: false,
        error: 'Invalid request'
      });
    }
  }

  next();
};

/**
 * Check for repeated messages in recent history
 */
async function checkRepeatedMessages(message, _sessionToken) {
  const { ChatMessage } = require('../models');
  const { Op } = require('sequelize');

  const recentMessages = await ChatMessage.findAll({
    where: {
      content: message,
      createdAt: { [Op.gt]: new Date(Date.now() - (5 * 60 * 1000)) }
    },
    limit: 5
  });

  return recentMessages.length >= 3;
}

/**
 * Check for excessive URLs in message
 */
function checkExcessiveUrls(message) {
  const urlCount = (message.match(/https?:\/\//gi) || []).length;
  return urlCount > 3;
}

/**
 * Check for suspicious spam patterns
 */
function checkSuspiciousPatterns(message) {
  const suspiciousPatterns = [
    /\b(viagra|cialis|pharmacy|casino|lottery|winner)\b/i,
    /\$\$\$/,
    /!!!!!+/,
    /FREE\s+FREE/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return pattern.toString();
    }
  }
  return null;
}

/**
 * Handle repeated message spam detection
 */
async function handleRepeatedMessageCheck(message, sessionToken, req, res) {
  const hasRepeatedMessages = await checkRepeatedMessages(message, sessionToken);
  if (hasRepeatedMessages) {
    logger.warn(
      {
        event: 'security_chat_spam_repeated',
        ip: req.ip,
        messagePreview: message.substring(0, 50)
      },
      'Spam detected - repeated message'
    );

    return res.status(429).json({
      success: false,
      error: 'Kérjük ne ismételd ugyanazt az üzenetet többször.'
    });
  }
  return null;
}

/**
 * Helper: Handle excessive URLs in message
 */
function handleExcessiveUrls(message, req, res) {
  const urlCount = (message.match(/https?:\/\//gi) || []).length;
  logger.warn(
    { event: 'security_chat_spam_urls', ip: req.ip, urlCount },
    'Spam detected - too many URLs'
  );

  return res.status(403).json({
    success: false,
    error: 'Túl sok link az üzenetben.'
  });
}

/**
 * Helper: Handle message too long
 */
function handleMessageTooLong(res) {
  return res.status(400).json({
    success: false,
    error: 'Az üzenet túl hosszú (max 2000 karakter).'
  });
}

/**
 * Helper: Handle suspicious pattern detected
 */
function handleSuspiciousPattern(pattern, req, res) {
  logger.warn(
    { event: 'security_chat_spam_pattern', ip: req.ip, pattern },
    'Spam detected - suspicious content'
  );

  return res.status(403).json({
    success: false,
    error: 'Az üzenet gyanús tartalmat tartalmaz.'
  });
}

/**
 * Pattern detection - Spam üzenetek detektálása
 */
const patternDetector = async (req, res, next) => {
  try {
    const message = req.body.message || '';
    const { sessionToken } = req.body;

    if (!sessionToken) {
      return next();
    }

    // Ellenőrzés 1: Ugyanaz az üzenet ismétlődik?
    const repeatedResult = await handleRepeatedMessageCheck(message, sessionToken, req, res);
    if (repeatedResult) {return;}

    // Ellenőrzés 2: Túl sok URL az üzenetben?
    if (checkExcessiveUrls(message)) {
      return handleExcessiveUrls(message, req, res);
    }

    // Ellenőrzés 3: Túl hosszú üzenet?
    if (message.length > 2000) {
      return handleMessageTooLong(res);
    }

    // Ellenőrzés 4: Gyanús karakterek (spam botok jellemzői)
    const suspiciousPattern = checkSuspiciousPatterns(message);
    if (suspiciousPattern) {
      return handleSuspiciousPattern(suspiciousPattern, req, res);
    }

    next();
  } catch (error) {
    logger.error({ err: error, service: 'chatProtection', operation: 'patternDetector' }, 'Pattern detection error');
    next();
  }
};

/**
 * User Agent validator
 * Blokkolja a known bad botokat
 */
const userAgentValidator = (req, res, next) => {
  const userAgent = req.get(USER_AGENT_HEADER) || '';

  // Known bad bots
  const blockedAgents = [
    'curl',
    'wget',
    'python-requests',
    'scrapy',
    'bot',
    'crawler',
    'spider',
    'scraper'
  ];

  const userAgentLower = userAgent.toLowerCase();

  for (const blocked of blockedAgents) {
    if (userAgentLower.includes(blocked)) {
      logger.warn(
        { event: 'security_chat_blocked_agent', ip: req.ip, userAgent },
        'Blocked user agent'
      );

      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
  }

  // User Agent túl rövid vagy hiányzik?
  if (userAgent.length < 10) {
    logger.warn(
      { event: 'security_chat_suspicious_agent', ip: req.ip, userAgent },
      'Suspicious user agent'
    );

    return res.status(403).json({
      success: false,
      error: 'Invalid request'
    });
  }

  next();
};

/**
 * IP Blacklist checker
 * Ellenőrzi hogy az IP black listán van-e
 */
const ipBlacklist = new Set();

const ipBlacklistChecker = (req, res, next) => {
  const { ip } = req;

  if (ipBlacklist.has(ip)) {
    logger.warn({ event: 'security_chat_blacklisted_ip', ip }, 'Blacklisted IP attempt');

    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  next();
};

/**
 * Add IP to blacklist
 */
const addToBlacklist = (ip, duration = 24 * 60 * 60 * 1000) => {
  ipBlacklist.add(ip);
  logger.info(
    { service: 'chatProtection', ip, durationMinutes: duration / 1000 / 60 },
    'IP added to blacklist'
  );

  // Auto remove after duration
  setTimeout(() => {
    ipBlacklist.delete(ip);
    logger.info({ service: 'chatProtection', ip }, 'IP removed from blacklist');
  }, duration);
};

/**
 * Session timeout checker
 * Automatikusan zárja a régi sessionöket
 */
const sessionTimeoutChecker = async () => {
  const { ChatSession } = require('../models');
  const { Op } = require('sequelize');

  try {
    const thirtyMinutesAgo = new Date(Date.now() - (30 * 60 * 1000));

    const result = await ChatSession.update(
      {
        status: 'closed',
        closedAt: new Date()
      },
      {
        where: {
          status: 'active',
          updatedAt: { [Op.lt]: thirtyMinutesAgo }
        }
      }
    );

    if (result[0] > 0) {
      logger.info(
        { service: 'chatProtection', closedCount: result[0] },
        'Closed inactive sessions due to timeout'
      );
    }
  } catch (error) {
    logger.error(
      { err: error, service: 'chatProtection', operation: 'sessionTimeoutChecker' },
      'Session timeout checker error'
    );
  }
};

// Run session timeout checker every 5 minutes
setInterval(sessionTimeoutChecker, 5 * 60 * 1000);

module.exports = {
  sessionLimiter,
  messageLimiter,
  offlineLimiter,
  honeypotChecker,
  patternDetector,
  userAgentValidator,
  ipBlacklistChecker,
  addToBlacklist,
  sessionTimeoutChecker
};
