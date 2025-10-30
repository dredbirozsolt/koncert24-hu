const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { CookieConsent } = require('../models');
const logger = require('../config/logger');

/**
 * POST /api/cookie-consent
 * Save user's cookie consent preferences
 */
router.post('/cookie-consent', async (req, res) => {
  try {
    const { consentId, statistics, marketing, consentMethod } = req.body;

    // Validate input
    if (!consentId || !consentMethod) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!['accept_all', 'accept_selected', 'essential_only'].includes(consentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid consent method'
      });
    }

    // Get IP address and hash it for privacy
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ipAddress).digest('hex');

    // Get user agent
    const userAgent = req.get('user-agent') || 'unknown';

    // Get userId from session if available
    const userId = req.session?.userId || null;

    // Get or create session ID for anonymous users
    const sessionId = req.sessionID || crypto.randomUUID();

    // Set expiration to 12 months from now
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    // Create consent record
    const consent = await CookieConsent.create({
      userId,
      sessionId,
      consentId,
      essential: true, // Always true
      statistics: Boolean(statistics),
      marketing: Boolean(marketing),
      ipHash,
      userAgent,
      consentMethod,
      expiresAt
    });

    logger.info('Cookie consent saved', {
      consentId: consent.consentId,
      userId: userId || 'anonymous',
      sessionId,
      statistics: consent.statistics,
      marketing: consent.marketing,
      method: consentMethod
    });

    res.json({
      success: true,
      consentId: consent.consentId,
      expiresAt: consent.expiresAt
    });
  } catch (error) {
    logger.error('Error saving cookie consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save consent'
    });
  }
});

/**
 * GET /api/cookie-consent/:consentId
 * Retrieve consent record (for verification)
 */
router.get('/cookie-consent/:consentId', async (req, res) => {
  try {
    const { consentId } = req.params;

    const consent = await CookieConsent.findOne({
      where: { consentId },
      attributes: ['consentId', 'essential', 'statistics', 'marketing', 'consentMethod', 'createdAt', 'expiresAt']
    });

    if (!consent) {
      return res.status(404).json({
        success: false,
        error: 'Consent not found'
      });
    }

    res.json({
      success: true,
      consent
    });
  } catch (error) {
    logger.error('Error retrieving cookie consent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve consent'
    });
  }
});

module.exports = router;
