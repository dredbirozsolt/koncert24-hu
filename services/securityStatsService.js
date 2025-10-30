/**
 * Security Statistics Service
 * Biztonsági statisztikák gyűjtése és elemzése
 */

const logger = require('../config/logger');
const { User, SecurityLog } = require('../models');
const { Op } = require('sequelize');

/**
 * In-memory tárolás a blokkolt kérésekhez
 * Production környezetben Redis-t érdemes használni
 */
const securityEvents = {
  auth: {
    loginAttempts: [],
    loginBlocked: [],
    registerAttempts: [],
    registerBlocked: [],
    passwordResetBlocked: []
  },
  chat: {
    sessionBlocked: [],
    messageBlocked: [],
    offlineBlocked: [],
    honeypotTriggered: []
  },
  attacks: {
    sqlInjection: [],
    xss: [],
    botDetected: [],
    suspiciousDomain: []
  },
  fileUpload: {
    uploaded: [],
    validationFailed: [],
    blacklisted: [],
    magicBytesFailed: []
  }
};

/**
 * Esemény rögzítése
 */
function logSecurityEvent(category, type, details = {}) {
  const event = {
    timestamp: new Date(),
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
    details
  };

  if (securityEvents[category] && securityEvents[category][type]) {
    securityEvents[category][type].push(event);

    // Csak az utolsó 1000 eseményt tartjuk meg memóriában
    if (securityEvents[category][type].length > 1000) {
      securityEvents[category][type].shift();
    }
  }
}

/**
 * Események lekérdezése időtartományban
 */
function getEventsSince(category, type, minutes) {
  if (!securityEvents[category] || !securityEvents[category][type]) {
    return [];
  }

  const cutoff = new Date(Date.now() - (minutes * 60 * 1000));
  return securityEvents[category][type].filter((e) => e.timestamp >= cutoff);
}

/**
 * Összes blokkolt kérés az elmúlt X percben
 */
function getTotalBlockedSince(minutes) {
  let total = 0;

  Object.keys(securityEvents).forEach((category) => {
    Object.keys(securityEvents[category]).forEach((type) => {
      total += getEventsSince(category, type, minutes).length;
    });
  });

  return total;
}

/**
 * Auth védelem statisztikák gyűjtése
 */
function getAuthStats() {
  return {
    loginBlocked15min: getEventsSince('auth', 'loginBlocked', 15).length,
    loginBlocked1hour: getEventsSince('auth', 'loginBlocked', 60).length,
    loginBlocked24hour: getEventsSince('auth', 'loginBlocked', 1440).length,
    registerBlocked1hour: getEventsSince('auth', 'registerBlocked', 60).length,
    registerBlocked24hour: getEventsSince('auth', 'registerBlocked', 1440).length,
    passwordResetBlocked1hour: getEventsSince('auth', 'passwordResetBlocked', 60).length,
    recentLoginAttempts: getEventsSince('auth', 'loginAttempts', 15).length,
    recentRegisterAttempts: getEventsSince('auth', 'registerAttempts', 60).length
  };
}

/**
 * Chat védelem statisztikák gyűjtése
 */
function getChatStats() {
  return {
    sessionBlocked15min: getEventsSince('chat', 'sessionBlocked', 15).length,
    messageBlocked1min: getEventsSince('chat', 'messageBlocked', 1).length,
    offlineBlocked1hour: getEventsSince('chat', 'offlineBlocked', 60).length,
    honeypotTriggered24hour: getEventsSince('chat', 'honeypotTriggered', 1440).length
  };
}

/**
 * Támadás statisztikák gyűjtése
 */
function getAttackStats() {
  return {
    sqlInjection24hour: getEventsSince('attacks', 'sqlInjection', 1440).length,
    xss24hour: getEventsSince('attacks', 'xss', 1440).length,
    botDetected24hour: getEventsSince('attacks', 'botDetected', 1440).length,
    suspiciousDomain24hour: getEventsSince('attacks', 'suspiciousDomain', 1440).length
  };
}

/**
 * File upload statisztikák gyűjtése
 */
function getFileUploadStats() {
  const uploaded = getEventsSince('fileUpload', 'uploaded', 1440).length;
  const failed = getEventsSince('fileUpload', 'validationFailed', 1440).length;
  const successRate = uploaded > 0 ? Math.round(((uploaded - failed) / uploaded) * 100) : 100;

  return {
    uploaded24hour: uploaded,
    uploaded1hour: getEventsSince('fileUpload', 'uploaded', 60).length,
    validationFailed24hour: failed,
    blacklisted24hour: getEventsSince('fileUpload', 'blacklisted', 1440).length,
    magicBytesFailed24hour: getEventsSince('fileUpload', 'magicBytesFailed', 1440).length,
    successRate
  };
}

/**
 * SecurityLog adatbázis statisztikák gyűjtése
 */
async function getSecurityLogStats(last24hours) {
  const stats = {
    total24hour: 0,
    critical24hour: 0,
    accountLocked24hour: 0,
    fileValidationFailed24hour: 0,
    recentCriticalEvents: []
  };

  try {
    stats.total24hour = await SecurityLog.count({
      where: { createdAt: { [Op.gte]: last24hours } }
    });

    stats.critical24hour = await SecurityLog.count({
      where: {
        createdAt: { [Op.gte]: last24hours },
        severity: 'high'
      }
    });

    stats.accountLocked24hour = await SecurityLog.count({
      where: {
        createdAt: { [Op.gte]: last24hours },
        eventType: 'account_locked'
      }
    });

    stats.fileValidationFailed24hour = await SecurityLog.count({
      where: {
        createdAt: { [Op.gte]: last24hours },
        eventType: 'rate_limit_exceeded'
      }
    });

    const recentCritical = await SecurityLog.findAll({
      where: { severity: 'high' },
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['eventType', 'createdAt', 'ipAddress', 'details']
    });

    stats.recentCriticalEvents = recentCritical.map((log) => ({
      type: log.eventType,
      timestamp: log.createdAt,
      ip: log.ipAddress,
      details: log.details
    }));
  } catch (error) {
    logger.error({ err: error, service: 'securityStats', operation: 'getSecurityStats' }, 'SecurityLog stats error');
  }

  return stats;
}

/**
 * User statisztikák gyűjtése
 */
async function getUserStats(last1hour, last24hours, last7days) {
  return {
    totalUsers: await User.count(),
    activeUsers: await User.count({ where: { isActive: true } }),
    verifiedUsers: await User.count({ where: { emailVerified: true } }),
    newUsersToday: await User.count({
      where: { createdAt: { [Op.gte]: last24hours } }
    }),
    newUsersThisWeek: await User.count({
      where: { createdAt: { [Op.gte]: last7days } }
    }),
    recentLogins1hour: await User.count({
      where: { lastLoginAt: { [Op.gte]: last1hour } }
    })
  };
}

/**
 * Fenyegetettség szint kalkulálása
 */
function calculateThreatLevel(totalBlocked15min, attackStats, chatStats) {
  let threatScore = 0;

  if (totalBlocked15min > 10) {
    threatScore += 3;
  } else if (totalBlocked15min > 5) {
    threatScore += 2;
  } else if (totalBlocked15min > 0) {
    threatScore += 1;
  }

  if (attackStats.sqlInjection24hour > 5) {threatScore += 3;}
  if (attackStats.xss24hour > 5) {threatScore += 3;}
  if (attackStats.botDetected24hour > 20) {threatScore += 2;}
  if (chatStats.honeypotTriggered24hour > 10) {threatScore += 2;}

  let threatLevel = 'LOW';
  if (threatScore >= 10) {
    threatLevel = 'CRITICAL';
  } else if (threatScore >= 6) {
    threatLevel = 'HIGH';
  } else if (threatScore >= 3) {
    threatLevel = 'MEDIUM';
  }

  return { threatLevel, threatScore };
}

/**
 * Biztonsági statisztikák generálása
 */
async function getSecurityStats() {
  const now = new Date();
  const last1hour = new Date(now.getTime() - (60 * 60 * 1000));
  const last24hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  const last7days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

  const authStats = getAuthStats();
  const chatStats = getChatStats();
  const attackStats = getAttackStats();
  const fileUploadStats = getFileUploadStats();
  const securityLogStats = await getSecurityLogStats(last24hours);
  const userStats = await getUserStats(last1hour, last24hours, last7days);

  const totalBlocked15min = getTotalBlockedSince(15);
  const totalBlocked1hour = getTotalBlockedSince(60);
  const totalBlocked24hour = getTotalBlockedSince(1440);

  const { threatLevel, threatScore } = calculateThreatLevel(
    totalBlocked15min,
    attackStats,
    chatStats
  );

  return {
    auth: authStats,
    chat: chatStats,
    attacks: attackStats,
    fileUpload: fileUploadStats,
    securityLog: securityLogStats,
    users: userStats,
    overall: {
      totalBlocked15min,
      totalBlocked1hour,
      totalBlocked24hour,
      threatLevel,
      threatScore,
      lastUpdated: now
    }
  };
}

/**
 * Top blokkolt IP-k az elmúlt 24 órában
 */
function getTopBlockedIPs(limit = 10) {
  const ipCounts = {};

  // Összes kategória és típus eseményeinek összegyűjtése
  Object.keys(securityEvents).forEach((category) => {
    Object.keys(securityEvents[category]).forEach((type) => {
      const events = getEventsSince(category, type, 1440); // 24 óra
      events.forEach((event) => {
        const { ip } = event;
        ipCounts[ip] = (ipCounts[ip] || 0) + 1;
      });
    });
  });

  // Rendezés és top N visszaadása
  return Object.entries(ipCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([ip, count]) => ({ ip, count }));
}

/**
 * Esemény típusok eloszlása az elmúlt 24 órában
 */
function getEventDistribution() {
  const distribution = {};

  Object.keys(securityEvents).forEach((category) => {
    Object.keys(securityEvents[category]).forEach((type) => {
      const count = getEventsSince(category, type, 1440).length;
      if (count > 0) {
        distribution[`${category}.${type}`] = count;
      }
    });
  });

  return distribution;
}

/**
 * Reset statisztikák (teszteléshez vagy admin funkcióhoz)
 */
function resetStats() {
  Object.keys(securityEvents).forEach((category) => {
    Object.keys(securityEvents[category]).forEach((type) => {
      securityEvents[category][type] = [];
    });
  });
}

module.exports = {
  logSecurityEvent,
  getSecurityStats,
  getTopBlockedIPs,
  getEventDistribution,
  resetStats,
  // Export for testing
  _events: securityEvents
};
