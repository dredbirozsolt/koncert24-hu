/**
 * Chat API Routes
 * RESTful API endpoints for chat functionality
 */

const express = require('express');

const logger = require('../config/logger');
const router = express.Router();
const chatService = require('../services/chatService');
const availabilityService = require('../services/availabilityService');
const { body, validationResult } = require('express-validator');
const {
  handleChatError,
  getValidationErrors,
  validateMessage,
  validateSessionCreation
} = require('./helpers/chat-helpers');

// Import chat protection middleware
const {
  sessionLimiter,
  messageLimiter,
  offlineLimiter,
  honeypotChecker,
  patternDetector,
  userAgentValidator,
  ipBlacklistChecker
} = require('../middleware/chatProtection');

// Error messages
const ERROR_SESSION_NOT_FOUND = 'Session not found';

/**
 * POST /api/chat/session/create
 * Initialize a new chat session
 * Protected: Rate limit, honeypot, user agent validation, IP blacklist
 */
router.post('/session/create',
  ipBlacklistChecker,
  userAgentValidator,
  sessionLimiter,
  honeypotChecker,
  [
    body('name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().normalizeEmail(),
    body('phone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 20 }),
    body('currentPage').optional({ nullable: true, checkFalsy: true }).trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(getValidationErrors(errors));
      }

      const validated = validateSessionCreation(req.body);
      const userId = req.session?.user?.id || null;

      const result = await chatService.initializeChat({
        userId,
        name: validated.userName,
        email: validated.userEmail,
        phone: validated.userPhone,
        currentPage: validated.currentPage
      });

      logger.info({ service: 'apiChat', sessionId: result.session.id, mode: result.mode }, 'Chat session created');

      return res.json({
        success: true,
        sessionToken: result.session.sessionToken,
        mode: result.mode,
        aiAvailable: result.aiAvailable,
        adminAvailable: result.adminAvailable,
        sessionId: result.session.id
      });
    } catch (error) {
      logger.error({ err: error, service: 'apiChat', operation: 'createSession' }, 'Create session error');
      return handleChatError(res, error, 500, 'Failed to create chat session');
    }
  }
);

/**
 * POST /api/chat/message/send
 * Send a user message
 * Protected: Rate limit, pattern detection, user agent validation
 */
router.post('/message/send',
  ipBlacklistChecker,
  userAgentValidator,
  messageLimiter,
  patternDetector,
  [
    body('sessionToken').notEmpty().trim(),
    body('message').notEmpty().trim().isLength({ min: 1, max: 2000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(getValidationErrors(errors));
      }

      const { sessionToken } = req.body;
      const message = validateMessage(req.body.message);

      const result = await chatService.handleUserMessage(sessionToken, message);

      const response = {
        success: true,
        userMessage: {
          id: result.userMessage.id,
          content: result.userMessage.content,
          role: 'user',
          createdAt: result.userMessage.createdAt
        },
        sessionStatus: result.session.status
      };

      // Only include aiMessage if it exists (null when admin is in conversation)
      if (result.aiMessage) {
        response.aiMessage = {
          id: result.aiMessage.id,
          content: result.aiMessage.content,
          role: result.aiMessage.role,
          createdAt: result.aiMessage.createdAt
        };

        // Include showOfflineForm flag if present
        if (result.aiMessage.showOfflineForm) {
          response.aiMessage.showOfflineForm = true;
        }
      }

      return res.json(response);
    } catch (error) {
      logger.error({ err: error, service: 'apiChat', operation: 'sendMessage' }, 'Send message error');
      return handleChatError(res, error, 500, 'Failed to send message');
    }
  }
);

/**
 * POST /api/chat/escalate
 * Manually escalate to admin
 */
router.post('/escalate',
  [
    body('sessionToken').notEmpty().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(getValidationErrors(errors));
      }

      const { sessionToken } = req.body;

      const session = await chatService.getSession(sessionToken);
      if (!session) {
        return handleChatError(res, new Error(ERROR_SESSION_NOT_FOUND), 404, ERROR_SESSION_NOT_FOUND);
      }

      await chatService.escalateToSales(session.id, 'user_request');

      return res.json({
        success: true,
        message: 'Chat escalated to admin',
        sessionStatus: 'escalated'
      });
    } catch (error) {
      // Handle no admin available error
      if (error.code === 'NO_ADMIN_AVAILABLE' || error.message === 'NO_ADMIN_AVAILABLE') {
        logger.warn({ service: 'apiChat', operation: 'escalate' }, 'No admin available for escalation');
        return res.status(503).json({
          success: false,
          message: 'No admin available',
          error: 'NO_ADMIN_AVAILABLE'
        });
      }

      logger.error({ err: error, service: 'apiChat', operation: 'escalate' }, 'Escalate error');
      return handleChatError(res, error, 500, 'Failed to escalate chat');
    }
  }
);

/**
 * POST /api/chat/offline-message
 * Submit offline message
 */
router.post('/offline-message',
  ipBlacklistChecker,
  userAgentValidator,
  offlineLimiter,
  honeypotChecker,
  [
    body('name').notEmpty().trim().isLength({ max: 100 }),
    body('email').notEmpty().isEmail(),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('message').notEmpty().trim().isLength({ min: 10, max: 2000 }),
    body('sessionToken').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(getValidationErrors(errors));
      }

      const { sessionToken, name, email, phone, message } = req.body;

      let sessionId = null;
      if (sessionToken) {
        const session = await chatService.getSession(sessionToken);
        sessionId = session ? session.id : null;
      }

      const offlineMessage = await chatService.submitOfflineMessage({
        sessionId,
        name,
        email,
        phone,
        message
      });

      return res.json({
        success: true,
        message: 'Offline message submitted successfully',
        messageId: offlineMessage.id
      });
    } catch (error) {
      logger.error({ err: error, service: 'apiChat', operation: 'offlineMessage' }, 'Offline message error');
      return handleChatError(res, error, 500, 'Failed to submit offline message');
    }
  }
);

/**
 * POST /api/chat/admin/heartbeat
 * Update admin heartbeat (Chrome extension)
 */
router.post('/admin/heartbeat', async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const adminId = req.user.id;
    await availabilityService.updateAdminHeartbeat(adminId);

    return res.json({
      success: true,
      message: 'Heartbeat updated',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiChat', operation: 'adminHeartbeat' }, 'Heartbeat error');
    return handleChatError(res, error, 500, 'Failed to update heartbeat');
  }
});

/**
 * POST /api/chat/admin/offline
 * Set admin offline
 */
router.post('/admin/offline', async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Admin authentication required'
      });
    }

    const adminId = req.user.id;
    await availabilityService.setAdminOffline(adminId);

    return res.json({
      success: true,
      message: 'Admin set to offline'
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiChat', operation: 'setOffline' }, 'Set offline error');
    return handleChatError(res, error, 500, 'Failed to set offline');
  }
});

/**
 * GET /api/chat/status
 * Get overall chat system status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await availabilityService.checkSystemStatus();

    return res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error({ err: error, service: 'apiChat', operation: 'statusCheck' }, 'Status check error');
    return handleChatError(res, error, 500, 'Failed to check system status');
  }
});

/**
 * GET /api/chat/session/:token
 * Get session with messages
 */
router.get('/session/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const session = await chatService.getSession(token);

    if (!session) {
      return handleChatError(res, new Error(ERROR_SESSION_NOT_FOUND), 404, ERROR_SESSION_NOT_FOUND);
    }

    return res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        messages: session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
          isRead: msg.isRead
        }))
      }
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'apiChat', operation: 'getSession', token: req.params.token },
      'Get session error'
    );
    return handleChatError(res, error, 500, 'Failed to retrieve session');
  }
});

/**
 * POST /api/chat/session/:token/close
 * Close a chat session
 */
router.post('/session/:token/close', async (req, res) => {
  try {
    const { token } = req.params;

    const session = await chatService.closeSession(token);

    return res.json({
      success: true,
      message: 'Session closed',
      sessionId: session.id
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'apiChat', operation: 'closeSession', token: req.params.token },
      'Close session error'
    );
    return handleChatError(res, error, 500, 'Failed to close session');
  }
});

module.exports = router;
