/**
 * Admin Cron Jobs Routes - Manual job execution endpoints
 * Sub-router for cron job manual triggers (/sync/* and /run/*)
 */

/* eslint-disable sonarjs/no-duplicate-string */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const cronService = require('../services/cronService');
const logger = require('../config/logger');

// ============================================
// MANUÁLIS FUTTATÁSI ENDPOINTOK
// ============================================

/**
 * POST /admin/cron/sync/performers
 * Manuális előadó szinkronizálás vTiger-ből
 */
router.post('/sync/performers', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualSync',
      type: 'performers',
      userId: req.session?.userId
    }, 'Manual performer sync triggered');

    const { SyncService } = require('../services/syncService');
    const syncService = new SyncService();
    const result = await syncService.syncPerformers(false);

    const stats = result.stats || {};
    const msg = 'Előadó szinkronizálás sikeres! '
      + `${stats.created || 0} új, ${stats.updated || 0} frissített előadó.`;

    res.json({
      success: true,
      message: msg
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in manual performer sync');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/sync/geonames
 * Manuális földrajzi adatok szinkronizálása
 */
router.post('/sync/geonames', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualSync',
      type: 'geonames',
      userId: req.session?.userId
    }, 'Manual geonames sync triggered');

    const GeoNamesLocationCronService = require('../services/geoNamesLocationCronService');
    await GeoNamesLocationCronService.performMonthlySync();

    res.json({
      success: true,
      message: 'Földrajzi adatok szinkronizálása sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in manual geonames sync');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/sync/bookings
 * Manuális foglalások szinkronizálása
 */
router.post('/sync/bookings', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualSync',
      type: 'bookings',
      userId: req.session?.userId
    }, 'Manual booking sync triggered');

    await cronService.syncBookingsToVTiger();

    res.json({
      success: true,
      message: 'Foglalások szinkronizálása sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in manual booking sync');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/sync/events
 * Manuális események szinkronizálása vTiger-ből
 */
router.post('/sync/events', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualSync',
      type: 'events',
      userId: req.session?.userId
    }, 'Manual event sync triggered');

    const eventCronService = require('../services/eventCronService');
    const result = await eventCronService.runEventSync();

    const msg = 'Események szinkronizálása sikeres! '
      + `${result.created || 0} új, ${result.updated || 0} frissített esemény.`;

    res.json({
      success: true,
      message: msg
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in manual event sync');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/maintenance
 * Manuális karbantartási feladatok futtatása
 */
router.post('/run/maintenance', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'maintenance',
      userId: req.session?.userId
    }, 'Manual maintenance task triggered');

    const { performDailyMaintenance } = cronService;
    await performDailyMaintenance();

    res.json({
      success: true,
      message: 'Karbantartási feladatok sikeresen lefutottak!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error running maintenance tasks');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/backup
 * Manuális biztonsági mentés készítése
 */
router.post('/run/backup', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'backup',
      userId: req.session?.userId
    }, 'Manual backup triggered');

    const { runDailyBackup } = require('../services/cronService-helpers');
    await runDailyBackup();

    res.json({
      success: true,
      message: 'Biztonsági mentés sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error creating backup');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/chat-cleanup
 * Manuális chat session cleanup
 */
router.post('/run/chat-cleanup', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'chatCleanup',
      userId: req.session?.userId
    }, 'Manual chat cleanup triggered');

    const chatSessionCleanupService = require('../services/chatSessionCleanupService');
    const result = await chatSessionCleanupService.cleanupOldSessions({
      inactivityDays: 30,
      emptySessionDays: 90,
      dryRun: false
    });

    res.json({
      success: true,
      message: `Chat session cleanup sikeres! ${result.softDeleted || 0} lejárt session törölve.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Error cleaning up chat sessions');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/blog-publish
 * Manuális időzített blog bejegyzések publikálása
 */
router.post('/run/blog-publish', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'blogPublish',
      userId: req.session?.userId
    }, 'Manual blog publish triggered');

    const { BlogPost } = require('../models');
    const { Op } = require('sequelize');

    const published = await BlogPost.update(
      { status: 'published' },
      {
        where: {
          status: 'scheduled',
          publishedAt: { [Op.lte]: new Date() }
        }
      }
    );

    res.json({
      success: true,
      message: `Blog publikálás sikeres! ${published[0] || 0} bejegyzés publikálva.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Error publishing scheduled blog posts');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/admin-heartbeat
 * Manuális admin heartbeat ellenőrzés
 */
router.post('/run/admin-heartbeat', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'adminHeartbeat',
      userId: req.session?.userId
    }, 'Manual admin heartbeat triggered');

    const adminAlertService = require('../services/adminAlertService');
    await adminAlertService.checkAdminAvailability();

    res.json({
      success: true,
      message: 'Admin heartbeat ellenőrzés sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error checking admin heartbeat');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/admin-heartbeat-cleanup
 * Manuális admin heartbeat cleanup futtatás
 */
router.post('/run/admin-heartbeat-cleanup', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'adminHeartbeatCleanup',
      userId: req.session?.userId
    }, 'Manual admin heartbeat cleanup triggered');

    const availabilityService = require('../services/availabilityService');
    const cleanedCount = await availabilityService.cleanupStaleAdmins();

    res.json({
      success: true,
      message: `Admin heartbeat cleanup sikeres! ${cleanedCount} elavult admin törölve.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Error in admin heartbeat cleanup');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/security-alert-check
 * Manuális biztonsági riasztások ellenőrzése
 */
router.post('/run/security-alert-check', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'securityAlertCheck',
      userId: req.session?.userId
    }, 'Manual security alert check triggered');

    const securityAlertService = require('../services/securityAlertService');
    await securityAlertService.checkAndAlert();

    res.json({
      success: true,
      message: 'Biztonsági riasztások ellenőrzése sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error checking security alerts');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/security-log-cleanup
 * Manuális biztonsági naplók tisztítása
 */
router.post('/run/security-log-cleanup', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'securityLogCleanup',
      userId: req.session?.userId
    }, 'Manual security log cleanup triggered');

    const { SecurityLog } = require('../models');
    const { Op } = require('sequelize');

    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const deleted = await SecurityLog.destroy({
      where: {
        createdAt: { [Op.lt]: thirtyDaysAgo }
      }
    });

    res.json({
      success: true,
      message: `Biztonsági naplók tisztítása sikeres! ${deleted || 0} régi bejegyzés törölve.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Error cleaning up security logs');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/geonames-stats
 * Manuális Geonames statisztikák frissítése
 */
router.post('/run/geonames-stats', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'geonamesStats',
      userId: req.session?.userId
    }, 'Manual geonames stats update triggered');

    const GeoNamesLocationCronService = require('../services/geoNamesLocationCronService');
    await GeoNamesLocationCronService.generateMonthlyStats();

    res.json({
      success: true,
      message: 'Geonames statisztikák frissítése sikeres!'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error updating geonames stats');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/infrastructure-health
 * Manuális infrastruktúra health check
 */
router.post('/run/infrastructure-health', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'infrastructureHealth',
      userId: req.session?.userId
    }, 'Manual infrastructure health check triggered');

    const infrastructureAlertService = require('../services/infrastructureAlertService');
    await infrastructureAlertService.runHealthChecks();

    res.json({
      success: true,
      message: 'Infrastruktúra health check sikeres! Minden rendben.'
    });
  } catch (error) {
    logger.error({ err: error }, 'Error checking infrastructure health');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

/**
 * POST /admin/cron/run/offline-email-retry
 * Manuális offline message email újraküldés
 */
router.post('/run/offline-email-retry', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminCron',
      operation: 'manualRun',
      type: 'offlineEmailRetry',
      userId: req.session?.userId
    }, 'Manual offline email retry triggered');

    const { OfflineMessage } = require('../models');
    const chatService = require('../services/chatService');

    // Get unsent messages
    const unsentMessages = await OfflineMessage.getUnsentMessages();

    if (unsentMessages.length === 0) {
      res.json({
        success: true,
        message: 'Nincs újraküldésre váró offline email.'
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const message of unsentMessages) {
      try {
        await chatService.sendOfflineMessageEmail(message);
        await message.markEmailSent();
        successCount += 1;
      } catch (error) {
        failCount += 1;
        logger.error({
          err: error,
          messageId: message.id
        }, 'Failed to retry offline message email');
      }
    }

    res.json({
      success: true,
      message: `Offline email újraküldés sikeres! ${successCount} email elküldve, ${failCount} sikertelen.`
    });
  } catch (error) {
    logger.error({ err: error }, 'Error retrying offline emails');
    res.json({
      success: false,
      message: `Hiba történt: ${error.message}`
    });
  }
});

module.exports = router;
