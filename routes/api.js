const express = require('express');
const emailService = require('../services/emailService');
const { SyncService } = require('../services/syncService');
const { VTigerService } = require('../services/vtigerService');
const { vtiger } = require('../config/environment');
const logger = require('../config/logger');

const router = express.Router();

// Constants
const ERROR_INTERNAL_SERVER = 'Internal server error';

// Initialize sync service
const syncService = new SyncService();

/**
 * Test email endpoint
 * GET /api/email/test?to=email@example.com
 */
router.get('/test', async (req, res) => {
  try {
    const { to } = req.query;

    if (!to) {
      return res.status(400).json({
        success: false,
        message: 'Email address required (to parameter)'
      });
    }

    // Verify connection first
    const connectionOk = await emailService.verifyConnection();

    if (!connectionOk) {
      return res.status(500).json({
        success: false,
        message: 'Email server connection failed'
      });
    }

    // Send test email
    const result = await emailService.sendTestEmail(to);

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${to}`,
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Email test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: ERROR_INTERNAL_SERVER,
      error: error.message
    });
  }
});

/**
 * Verify email configuration
 * GET /api/email/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const connectionOk = await emailService.verifyConnection();

    res.json({
      success: connectionOk,
      message: connectionOk ? 'Email configuration is valid' : 'Email configuration failed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Email verify endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email configuration',
      error: error.message
    });
  }
});

/**
 * Test critical error notification
 * GET /api/email/test-critical-error
 */
router.get('/test-critical-error', async (req, res) => {
  try {
    const testError = new Error('Ez egy teszt kritikus hiba');

    testError.stack = `Error: Ez egy teszt kritikus hiba
    at testFunction (/path/to/file.js:123:45)
    at anotherFunction (/path/to/another.js:67:89)`;

    const result = await emailService.sendCriticalErrorNotification(
      testError,
      'Email teszt endpoint',
      {
        userId: 'test_user',
        requestUrl: req.originalUrl,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      }
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Critical error notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send critical error notification',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Critical error test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: ERROR_INTERNAL_SERVER,
      error: error.message
    });
  }
});

/**
 * Test system alert notification
 * GET /api/email/test-system-alert
 */
router.get('/test-system-alert', async (req, res) => {
  try {
    const result = await emailService.sendSystemAlert(
      'DATABASE_CONNECTION_WARNING',
      'Az adatbázis kapcsolat lassan válaszol. Átlagos válaszidő: 2.5 másodperc.',
      {
        averageResponseTime: '2.5s',
        activeConnections: 8,
        maxConnections: 10,
        serverLoad: '78%'
      }
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'System alert notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send system alert notification',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('System alert test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: ERROR_INTERNAL_SERVER,
      error: error.message
    });
  }
});

/**
 * Sync performers from vTiger
 * POST /api/email/sync-performers
 */
router.post('/sync-performers', async (req, res) => {
  try {
    logger.info({
      service: 'api',
      operation: 'manualPerformerSync',
      userId: req.user?.id
    }, 'Manual performer sync initiated');

    const result = await syncService.syncPerformers();

    res.json({
      success: true,
      message: 'Performer sync completed successfully',
      stats: {
        total: result.total,
        created: result.created,
        updated: result.updated,
        errors: result.errors
      }
    });
  } catch (error) {
    logger.error('Performer sync endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Performer sync failed',
      error: error.message
    });
  }
});

/**
 * Get sync statistics
 * GET /api/email/sync-stats
 */
router.get('/sync-stats', async (req, res) => {
  try {
    const stats = await syncService.getSyncStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Sync stats endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync statistics',
      error: error.message
    });
  }
});

/**
 * Test vTiger connection
 * GET /api/email/test-vtiger
 */
router.get('/test-vtiger', async (req, res) => {
  try {
    const vtigerService = new VTigerService();

    // Test connection
    let challengeToken;
    try {
      challengeToken = await vtigerService.getChallengeToken();
    } catch (challengeError) {
      logger.error('Challenge token error:', challengeError.message);
      throw new Error(`Challenge token failed: ${challengeError.message}`);
    }

    const isConnected = await vtigerService.authenticate();

    res.json({
      success: isConnected,
      message: isConnected ? 'vTiger connection successful' : 'vTiger connection failed',
      challengeToken: challengeToken ? 'received' : 'failed',
      config: {
        url: vtiger.baseUrl,
        username: vtiger.username,
        hasAccessKey: Boolean(vtiger.accessKey)
      }
    });
  } catch (error) {
    logger.error('vTiger test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'vTiger connection test failed',
      error: error.message,
      stack: error.stack,
      config: {
        url: vtiger.baseUrl,
        username: vtiger.username,
        hasAccessKey: Boolean(vtiger.accessKey)
      }
    });
  }
});

/**
 * Session extend endpoint
 * POST /api/session/extend
 */
router.post('/session/extend', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  // Touch the session to extend it
  req.session.touch();

  res.json({
    success: true,
    message: 'Session extended',
    expiresIn: req.session.cookie.maxAge
  });
});

module.exports = router;
