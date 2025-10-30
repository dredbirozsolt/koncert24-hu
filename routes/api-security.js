const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const securityStats = require('../services/securityStatsService');
const logger = require('../config/logger');

/**
 * GET /api/security/stats
 * Biztonsági statisztikák lekérdezése (csak adminoknak)
 */
router.get('/stats', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const stats = await securityStats.getSecurityStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiSecurity', operation: 'getStats' }, 'Security stats error');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security statistics'
    });
  }
});

/**
 * GET /api/security/top-ips
 * Top blokkolt IP-k (csak adminoknak)
 */
router.get('/top-ips', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topIPs = securityStats.getTopBlockedIPs(limit);
    res.json({
      success: true,
      data: topIPs
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiSecurity', operation: 'getTopIPs' }, 'Top IPs error');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top IPs'
    });
  }
});

/**
 * GET /api/security/distribution
 * Esemény típusok eloszlása (csak adminoknak)
 */
router.get('/distribution', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const distribution = securityStats.getEventDistribution();
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiSecurity', operation: 'getDistribution' }, 'Distribution error');
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event distribution'
    });
  }
});

/**
 * POST /api/security/reset
 * Statisztikák resetelése (csak adminoknak, fejlesztési célra)
 */
router.post('/reset', requireAuth, requireRole('admin'), (req, res) => {
  try {
    securityStats.resetStats();
    res.json({
      success: true,
      message: 'Security statistics reset successfully'
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiSecurity', operation: 'resetStats' }, 'Reset stats error');
    res.status(500).json({
      success: false,
      error: 'Failed to reset statistics'
    });
  }
});

module.exports = router;
