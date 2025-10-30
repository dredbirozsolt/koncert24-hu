/**
 * Admin Chat - Offline Messages Routes
 * Separate router for offline message management
 */

const express = require('express');

const logger = require('../config/logger');
const router = express.Router();
const { requireAdminOrSales } = require('../middleware/auth');
const chatService = require('../services/chatService');
const { OfflineMessage, Setting } = require('../models');

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const SETTING_KEY_RETENTION_DAYS = 'offline_messages.retention_days';
const ROUTE_OFFLINE_ERROR = '/admin/chat/offline-messages?error=notfound';

/**
 * Helper: Get success message from query
 */
function getSuccessMessage(query) {
  if (query.success === 'replied') {
    return 'Üzenet sikeresen lezárva!';
  }
  if (query.success === 'archived') {
    return 'Üzenet sikeresen elvetve!';
  }
  if (query.success === 'email_resent') {
    return 'Email értesítés sikeresen újraküldve!';
  }
  return null;
}

/**
 * Helper: Get error message from query
 */
function getErrorMessage(query) {
  if (query.error === 'notfound') {
    return 'Üzenet nem található!';
  }
  if (query.error === 'reply') {
    return 'Hiba történt a lezárás során!';
  }
  if (query.error === 'archive') {
    return 'Hiba történt az elvetés során!';
  }
  if (query.error === 'email_resend') {
    return 'Hiba történt az email újraküldése során!';
  }
  if (query.error === 'already_sent') {
    return 'Ez az email már el lett küldve!';
  }
  return null;
}

/**
 * GET /admin/chat/offline-messages
 * View offline messages
 */
router.get('/offline-messages', requireAdminOrSales, async (req, res) => {
  try {
    // Read retention days from settings (default: 14)
    const retentionDays = await Setting.get(SETTING_KEY_RETENTION_DAYS, 14);
    const messages = await OfflineMessage.getPendingMessages(retentionDays);

    res.render('admin/chat/offline-messages', {
      layout: LAYOUT_ADMIN,
      title: 'Offline Üzenetek',
      currentPath: req.path,
      messages,
      retentionDays,
      success: getSuccessMessage(req.query),
      error: getErrorMessage(req.query)
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminChat', operation: 'offlineMessages' }, 'Offline messages error');
    res.status(500).render('admin/chat/offline-messages', {
      layout: LAYOUT_ADMIN,
      title: 'Offline Üzenetek',
      currentPath: req.path,
      messages: [],
      success: null,
      error: 'Hiba történt az üzenetek betöltése során'
    });
  }
});

/**
 * POST /admin/chat/offline-messages/:id/reply
 * Mark offline message as replied
 */
router.post('/offline-messages/:id/reply', requireAdminOrSales, async (req, res) => {
  try {
    const { id } = req.params;
    const message = await OfflineMessage.findByPk(id);

    if (!message) {
      return res.redirect(ROUTE_OFFLINE_ERROR);
    }

    await message.markReplied(req.session.user.id);

    return res.redirect('/admin/chat/offline-messages?success=replied');
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'replyOfflineMessage', messageId: req.params.id },
      'Reply offline message error'
    );
    return res.redirect('/admin/chat/offline-messages?error=reply');
  }
});

/**
 * POST /admin/chat/offline-messages/:id/archive
 * Archive offline message
 */
router.post('/offline-messages/:id/archive', requireAdminOrSales, async (req, res) => {
  try {
    const { id } = req.params;
    const message = await OfflineMessage.findByPk(id);

    if (!message) {
      return res.redirect(ROUTE_OFFLINE_ERROR);
    }

    await message.archive();

    return res.redirect('/admin/chat/offline-messages?success=archived');
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'archiveOfflineMessage', messageId: req.params.id },
      'Archive offline message error'
    );
    return res.redirect('/admin/chat/offline-messages?error=archive');
  }
});

/**
 * POST /admin/chat/offline-messages/:id/resend-email
 * Resend email notification for offline message
 */
router.post('/offline-messages/:id/resend-email', requireAdminOrSales, async (req, res) => {
  try {
    const { id } = req.params;
    const message = await OfflineMessage.findByPk(id);

    if (!message) {
      return res.redirect(ROUTE_OFFLINE_ERROR);
    }

    if (message.status !== 'pending') {
      return res.redirect('/admin/chat/offline-messages?error=already_sent');
    }

    // Retry sending email
    await chatService.sendOfflineMessageEmail(message);
    await message.markEmailSent();

    return res.redirect('/admin/chat/offline-messages?success=email_resent');
  } catch (error) {
    logger.error(
      { err: error, service: 'adminChat', operation: 'resendOfflineEmail', messageId: req.params.id },
      'Resend offline message email error'
    );
    return res.redirect('/admin/chat/offline-messages?error=email_resend');
  }
});

module.exports = router;
