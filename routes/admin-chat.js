/**
 * Admin Chat Routes
 * Admin interface for managing chat sessions
 */

const express = require('express');

const logger = require('../config/logger');
const router = express.Router();

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const SETTING_KEY_CHAT_ENABLED = 'chat.enabled';
const SETTING_KEY_AUTO_OFFLINE = 'chat.auto_offline_minutes';
const SETTING_KEY_RETENTION_DAYS = 'offline_messages.retention_days';
const SETTING_KEY_PROACTIVE_ENABLED = 'chat.proactive_enabled';
const SETTING_KEY_PROACTIVE_DELAY = 'chat.proactive_delay';
const chatService = require('../services/chatService');
const availabilityService = require('../services/availabilityService');
const { ChatSession, ChatMessage } = require('../models');
const { body, validationResult } = require('express-validator');
const { requireAdminOrSales } = require('../middleware/auth');
const {
  handleChatRenderError,
  handleChatError,
  getValidationErrors,
  validateMessage
} = require('./helpers/chat-helpers');

// All routes require admin or sales role

/**
 * GET /admin/chat
 * Chat dashboard - active sessions
 */
router.get('/', requireAdminOrSales, async (req, res) => {
  try {
    const adminId = req.session.user.id;

    // Get admin's active sessions
    const adminSessions = await chatService.getAdminSessions(adminId);

    // Get all active sessions (for admin overview)
    const allActiveSessions = await ChatSession.getActiveSessions();

    // Get admin availability
    const adminAvailability = await availabilityService.getAdminAvailability(adminId);

    // Get system status
    const systemStatus = await availabilityService.checkSystemStatus();

    res.render('admin/chat/dashboard', {
      layout: LAYOUT_ADMIN,
      title: 'Chat Dashboard',
      currentPath: req.path,
      csrfToken: req.session.csrfToken,
      adminSessions,
      allActiveSessions,
      adminAvailability,
      systemStatus
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminChat', operation: 'dashboard' }, 'Chat dashboard error');
    return handleChatRenderError(res, error, 'error', 'Hiba', 'Hiba történt a chat dashboard betöltése során');
  }
});

/**
 * GET /admin/chat/settings
 * Chat settings page
 */
router.get('/settings', requireAdminOrSales, async (req, res) => {
  try {
    const settingsService = require('../services/settingsService');
    const { SystemStatus } = require('../models');

    // Get current settings
    const chatEnabled = await settingsService.get(SETTING_KEY_CHAT_ENABLED, true);

    // Read AI and Admin Chat status from system_status table, NOT from settings table
    // (These values are blocked by NoSQL injection security middleware when saving to settings)
    const aiStatus = await SystemStatus.findOne({ where: { serviceName: 'ai' } });
    const adminChatStatus = await SystemStatus.findOne({ where: { serviceName: 'admin_chat' } });

    const aiEnabled = aiStatus ? aiStatus.isAvailable : true;
    const adminChatEnabled = adminChatStatus ? adminChatStatus.isAvailable : true;

    const autoOfflineMinutes = await settingsService.get(SETTING_KEY_AUTO_OFFLINE, 15);
    const offlineMessagesRetentionDays = await settingsService.get(SETTING_KEY_RETENTION_DAYS, 14);

    // Proactive engagement settings
    const proactiveEnabled = await settingsService.get(SETTING_KEY_PROACTIVE_ENABLED, true);
    const proactiveDelay = await settingsService.get(SETTING_KEY_PROACTIVE_DELAY, 30);

    logger.debug(
      {
        service: 'adminChat',
        chatEnabled,
        aiEnabled,
        adminChatEnabled,
        proactiveEnabled
      },
      'Chat settings GET'
    );

    // Get admin's working hours
    const adminId = req.session.user.id;
    const adminAvailability = await availabilityService.getAdminAvailability(adminId);

    res.render('admin/chat/settings', {
      layout: LAYOUT_ADMIN,
      title: 'Chat Beállítások',
      currentPath: req.path,
      chatEnabled,
      aiEnabled,
      adminChatEnabled,
      autoOfflineMinutes,
      offlineMessagesRetentionDays,
      proactiveEnabled,
      proactiveDelay,
      adminAvailability,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminChat', operation: 'getSettings' }, 'Chat settings error');
    return handleChatRenderError(res, error, 'error', 'Hiba', 'Hiba történt a beállítások betöltése során');
  }
});

/**
 * Helper: Update basic chat settings
 */
async function updateBasicChatSettings(settingsService, chatEnabled) {
  if (chatEnabled !== undefined) {
    await settingsService.set(
      SETTING_KEY_CHAT_ENABLED,
      chatEnabled === 'true',
      'boolean',
      'chat',
      'Chat rendszer engedélyezése'
    );
  }
}

/**
 * Helper: Update AI settings
 */
async function updateAISettings(settingsService, aiEnabled) {
  if (aiEnabled !== undefined) {
    const enabled = aiEnabled === 'true';
    await settingsService.set(
      'chat.ai_enabled',
      enabled,
      'boolean',
      'chat',
      'AI asszisztens engedélyezése'
    );
    await availabilityService.toggleAI(enabled);
  }
}

/**
 * Helper: Update admin chat settings
 */
async function updateAdminChatSettings(settingsService, adminChatEnabled) {
  if (adminChatEnabled !== undefined) {
    const enabled = adminChatEnabled === 'true';
    await settingsService.set(
      'chat.admin_chat_enabled',
      enabled,
      'boolean',
      'chat',
      'Admin chat engedélyezése'
    );
    await availabilityService.toggleAdminChat(enabled);
  }
}

/**
 * Helper: Update auto-offline settings
 */
async function updateAutoOfflineSettings(settingsService, userId, autoOfflineMinutes) {
  if (autoOfflineMinutes) {
    const minutes = parseInt(autoOfflineMinutes, 10);
    await settingsService.set(
      SETTING_KEY_AUTO_OFFLINE,
      minutes,
      'number',
      'chat',
      'Auto-offline idő (perc)'
    );
    await availabilityService.updateAutoAwayMinutes(userId, minutes);
  }
}

/**
 * Helper: Update proactive settings
 */
async function updateProactiveSettings(settingsService, proactiveEnabled, proactiveDelay) {
  if (proactiveEnabled !== undefined) {
    await settingsService.set(
      SETTING_KEY_PROACTIVE_ENABLED,
      proactiveEnabled === 'true',
      'boolean',
      'chat',
      'Proaktív chat engagement engedélyezése'
    );
  }

  if (proactiveDelay) {
    const delay = parseInt(proactiveDelay, 10);
    if (delay >= 10 && delay <= 120) {
      await settingsService.set(
        SETTING_KEY_PROACTIVE_DELAY,
        delay,
        'number',
        'chat',
        'Proaktív chat késleltetés (másodperc)'
      );
    }
  }
}

/**
 * Helper: Update offline messages retention settings
 */
async function updateRetentionSettings(settingsService, retentionDays) {
  if (retentionDays) {
    const days = parseInt(retentionDays, 10);
    if (days >= 1 && days <= 365) {
      await settingsService.set(
        SETTING_KEY_RETENTION_DAYS,
        days,
        'number',
        'chat',
        'Hány napig jelenítse meg a lezárt offline üzeneteket az admin felületen'
      );
    }
  }
}

/**
 * Validate chat settings input
 */
function validateChatSettings(autoOfflineMinutes, proactiveDelay, retentionDays) {
  if (autoOfflineMinutes) {
    const minutes = parseInt(autoOfflineMinutes, 10);
    if (minutes < 5 || minutes > 60) {
      return { valid: false, message: 'Auto-offline idő 5 és 60 perc között kell legyen' };
    }
  }

  if (proactiveDelay) {
    const delay = parseInt(proactiveDelay, 10);
    if (delay < 10 || delay > 120) {
      return { valid: false, message: 'Proaktív késleltetés 10 és 120 másodperc között kell legyen' };
    }
  }

  if (retentionDays) {
    const days = parseInt(retentionDays, 10);
    if (days < 1 || days > 365) {
      return { valid: false, message: 'Megőrzési idő 1 és 365 nap között kell legyen' };
    }
  }

  return { valid: true };
}

/**
 * Extract chat settings from normalized request body
 */
function extractChatSettings(normalized) {
  return {
    chatEnabled: normalized[SETTING_KEY_CHAT_ENABLED],
    aiEnabled: normalized['chat.ai_enabled'],
    adminChatEnabled: normalized['chat.admin_chat_enabled'],
    autoOfflineMinutes: normalized[SETTING_KEY_AUTO_OFFLINE],
    offlineMessagesRetentionDays: normalized[SETTING_KEY_RETENTION_DAYS],
    proactiveEnabled: normalized[SETTING_KEY_PROACTIVE_ENABLED],
    proactiveDelay: normalized[SETTING_KEY_PROACTIVE_DELAY]
  };
}

/**
 * POST /admin/chat/settings
 * Update chat settings
 */
router.post('/settings', requireAdminOrSales, async (req, res) => {
  try {
    const settingsService = require('../services/settingsService');
    const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');

    // Normalize keys (mongoSanitize converts dots to underscores)
    const normalized = normalizeSettingsKeys(req.body);

    // DEBUG: Log what we receive
    logger.info({
      rawBody: req.body,
      normalized,
      service: 'adminChat'
    }, 'POST /settings received data');

    // Extract settings from normalized body
    const {
      chatEnabled,
      aiEnabled,
      adminChatEnabled,
      autoOfflineMinutes,
      offlineMessagesRetentionDays,
      proactiveEnabled,
      proactiveDelay
    } = extractChatSettings(normalized);

    // Validate input
    const validation = validateChatSettings(autoOfflineMinutes, proactiveDelay, offlineMessagesRetentionDays);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    // Update settings
    await updateBasicChatSettings(settingsService, chatEnabled);
    await updateAISettings(settingsService, aiEnabled);
    await updateAdminChatSettings(settingsService, adminChatEnabled);
    await updateAutoOfflineSettings(settingsService, req.session.user.id, autoOfflineMinutes);
    await updateRetentionSettings(settingsService, offlineMessagesRetentionDays);
    await updateProactiveSettings(settingsService, proactiveEnabled, proactiveDelay);

    res.json({
      success: true,
      message: 'Chat beállítások sikeresen mentve!'
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminChat', operation: 'saveSettings' }, 'Save settings error');
    res.status(500).json({
      success: false,
      message: error.message || 'Chat beállítások mentése sikertelen'
    });
  }
});

/**
 * POST /admin/chat/message/send
 * Send admin message (AJAX)
 */
router.post('/message/send', requireAdminOrSales,
  [
    body('sessionId').notEmpty().isInt(),
    body('message').notEmpty().trim().isLength({ min: 1, max: 2000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(getValidationErrors(errors));
      }

      const { sessionId } = req.body;
      const message = validateMessage(req.body.message);
      const adminId = req.session.user.id;

      const adminMessage = await chatService.handleAdminMessage(
        parseInt(sessionId, 10),
        adminId,
        message
      );

      return res.json({
        success: true,
        message: {
          id: adminMessage.id,
          content: adminMessage.content,
          role: 'admin',
          createdAt: adminMessage.createdAt,
          adminName: req.session.user.name || 'Admin'
        }
      });
    } catch (error) {
      logger.error(
        { err: error, service: 'adminChat', operation: 'sendAdminMessage', sessionId: req.body.sessionId },
        'Send admin message error'
      );
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to send message'
      });
    }
  }
);

/**
 * GET /admin/chat/session/:id
 * Get session details with messages (AJAX)
 */
router.get('/session/:id', requireAdminOrSales, async (req, res) => {
  try {
    const { id } = req.params;

    const session = await ChatSession.findByPk(id, {
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          order: [['created_at', 'ASC']]
        }
      ]
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    return res.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        userName: session.userName,
        userEmail: session.userEmail,
        userPhone: session.userPhone,
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
      { err: error, service: 'adminChat', operation: 'getSession', sessionId: req.params.id },
      'Get session error'
    );
    return handleChatError(res, error, 500, 'Failed to retrieve session');
  }
});

/**
 * POST /admin/chat/heartbeat
 * Update admin heartbeat to keep them online (AJAX)
 */
router.post('/heartbeat', requireAdminOrSales, async (req, res) => {
  try {
    const adminId = req.session.user.id;

    // Update admin availability heartbeat
    const availability = await availabilityService.updateHeartbeat(adminId);

    return res.json({
      success: true,
      isOnline: availability.is_online,
      lastHeartbeat: availability.last_heartbeat
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'heartbeat', adminId: req.session.user.id },
      'Heartbeat error'
    );
    return handleChatError(res, error, 500, 'Failed to update heartbeat');
  }
});

/**
 * POST /admin/chat/toggle-online
 * Manually toggle admin online/offline status
 */
router.post('/toggle-online', requireAdminOrSales, async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const { goOnline } = req.body;

    if (goOnline) {
      await availabilityService.setAdminOnline(adminId);
    } else {
      await availabilityService.setAdminOffline(adminId);
    }

    return res.json({
      success: true,
      isOnline: goOnline
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'toggleOnline', adminId: req.session.user.id },
      'Toggle online error'
    );
    return handleChatError(res, error, 500, 'Failed to toggle online status');
  }
});

/**
 * POST /admin/chat/session/:id/close
 * Close a chat session
 */
router.post('/session/:id/close', requireAdminOrSales, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    const adminId = req.session.user.id;

    // Get session
    const session = await ChatSession.findByPk(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if admin is authorized (session admin or has admin role)
    const isAdmin = req.session.user.role === 'admin';
    const isSessionAdmin = session.adminId === adminId;

    if (!isAdmin && !isSessionAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to close this session'
      });
    }

    // Update session status to closed
    await session.update({
      status: 'closed',
      closedAt: new Date()
    });

    // Send a system message to the session
    await ChatMessage.create({
      sessionId: session.id,
      role: 'system',
      content: `A beszélgetés lezárva ${req.session.user.name || 'admin'} által.`
    });

    return res.json({
      success: true,
      message: 'Session closed successfully'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'closeSession', sessionId: req.params.id },
      'Close session error'
    );
    return handleChatError(res, error, 500, 'Failed to close session');
  }
});

module.exports = router;
