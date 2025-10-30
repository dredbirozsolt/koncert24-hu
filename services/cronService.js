const cron = require('node-cron');
const logger = require('../config/logger');
const { SyncService } = require('./syncService');
const { VTigerService } = require('./vtigerService');
const GeoNamesLocationCronService = require('./geoNamesLocationCronService');
const eventCronService = require('./eventCronService');
const emailService = require('./emailService');
const availabilityService = require('./availabilityService');
const securityAlertService = require('./securityAlertService');
const chatSessionCleanupService = require('./chatSessionCleanupService');
const infrastructureAlertService = require('./infrastructureAlertService');
const { cleanupOldSecurityLogs, cleanupOldLogs, runDailyBackup } = require('./cronService-helpers');
const { Performer, Booking, CronJob } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Initialize services
const syncService = new SyncService();
const vtigerService = new VTigerService();

// Store active cron tasks
const activeCronTasks = new Map();

/**
 * Job handlers mapped by job ID
 */
const jobHandlers = {
  'performer-sync': async () => {
    const result = await syncService.syncPerformers(false);
    if (!result.success) {
      logger.error({ error: result.error, service: 'cron', job: 'performer-sync' }, 'Performer sync failed');
      throw new Error(result.error);
    }
  },

  'performer-cleanup': async () => {
    const result = await syncService.cleanupInactivePerformers(365);
    if (!result.success) {
      logger.error({ error: result.error, service: 'cron', job: 'performer-cleanup' }, 'Performer cleanup failed');
      throw new Error(result.error);
    }
    logger.info({
      service: 'cron',
      job: 'performer-cleanup',
      deleted: result.deleted,
      retained: result.retained
    }, 'Performer cleanup completed');
  },

  'booking-sync': async () => {
    await syncBookingsToVTiger();
  },

  'daily-maintenance': async () => {
    await performDailyMaintenance();
  },

  'admin-heartbeat-cleanup': async () => {
    await availabilityService.cleanupStaleAdmins();
  },

  'security-alert-check': async () => {
    await securityAlertService.checkAndAlert();
  },

  'security-log-cleanup': async () => {
    await cleanupOldSecurityLogs();
  },

  'geonames-sync': async () => {
    await GeoNamesLocationCronService.performMonthlySync();
  },

  'geonames-stats': async () => {
    await GeoNamesLocationCronService.generateMonthlyStats();
  },

  'event-sync': async () => {
    const result = await eventCronService.runEventSync();
    if (!result.success) {
      logger.error({ service: 'cron', job: 'event-sync' }, 'Event sync failed');
    }
  },

  'daily-backup': async () => {
    await runDailyBackup();
  },

  'chat-session-cleanup': async () => {
    const result = await chatSessionCleanupService.cleanupOldSessions({
      inactivityDays: 30,
      emptySessionDays: 90,
      dryRun: false
    });
    logger.info({
      service: 'cron',
      job: 'chat-session-cleanup',
      softDeleted: result.softDeleted
    }, 'Chat cleanup completed');
  },

  'blog-scheduled-publish': async () => {
    const { BlogPost } = require('../models');
    const published = await BlogPost.publishScheduledPosts();

    if (published.length > 0) {
      logger.info({
        service: 'cron',
        job: 'blog-scheduled-publish',
        count: published.length,
        titles: published.map((p) => p.title)
      }, 'Scheduled blog posts published');
    }
  },

  'infrastructure-health-check': async () => {
    await infrastructureAlertService.runHealthChecks();
  },

  'offline-message-email-retry': async () => {
    const { OfflineMessage } = require('../models');
    const chatService = require('./chatService');

    // Get unsent messages
    const unsentMessages = await OfflineMessage.getUnsentMessages();

    if (unsentMessages.length === 0) {
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
          service: 'cron',
          job: 'offline-message-email-retry',
          messageId: message.id
        }, 'Failed to retry offline message email');
      }
    }

    logger.info({
      service: 'cron',
      job: 'offline-message-email-retry',
      total: unsentMessages.length,
      success: successCount,
      failed: failCount
    }, 'Offline message email retry completed');
  }
};

/**
 * Start a single cron job
 * @param {Object} job - CronJob database record
 */
function startCronJob(job) {
  try {
    // Skip if no handler defined
    if (!jobHandlers[job.id]) {
      logger.warn({ service: 'cron', jobId: job.id }, 'No handler defined for cron job');
      return;
    }

    // Stop existing task if running
    if (activeCronTasks.has(job.id)) {
      const existingTask = activeCronTasks.get(job.id);
      existingTask.stop();
      existingTask.destroy();
      activeCronTasks.delete(job.id);
    }

    // Only start if active
    if (!job.isActive) {
      return;
    }

    // Create and start new task
    const task = cron.schedule(job.schedule, async () => {
      const startTime = new Date();
      try {
        // Log start of execution
        await CronJob.update(
          { lastStatus: 'running', lastRunAt: startTime },
          { where: { id: job.id } }
        );

        // Execute the job
        await jobHandlers[job.id]();

        // Log successful completion
        await CronJob.update(
          { lastStatus: 'success', lastError: null },
          { where: { id: job.id } }
        );

        logger.info({
          service: 'cron',
          jobId: job.id,
          jobName: job.name
        }, 'Cron job completed');
      } catch (error) {
        logger.error({
          err: error,
          service: 'cron',
          jobId: job.id,
          jobName: job.name
        }, 'Cron job failed');

        // Log error
        await CronJob.update(
          { lastStatus: 'error', lastError: error.message },
          { where: { id: job.id } }
        );

        // Send error notification email for ALL failed cron jobs
        try {
          const result = await emailService.sendCronErrorNotification(
            error,
            job.name,
            {
              jobId: job.id,
              schedule: job.schedule,
              description: job.description,
              lastRunAt: startTime,
              failedAt: new Date()
            }
          );
          // Only log if actual error (not just missing config)
          if (!result.success && result.error !== 'Admin email not configured') {
            logger.error({ error: result.error, service: 'cron' }, 'Failed to send cron error email');
          }
        } catch (emailError) {
          logger.error({ err: emailError, service: 'cron' }, 'Failed to send cron error email');
        }
      }
    }, {
      scheduled: true,
      timezone: 'Europe/Budapest'
    });

    activeCronTasks.set(job.id, task);
    logger.info({
      service: 'cron',
      jobId: job.id,
      jobName: job.name,
      schedule: job.schedule
    }, 'Cron job started');
  } catch (error) {
    logger.error({
      err: error,
      service: 'cron',
      jobId: job.id
    }, 'Failed to start cron job');
  }
}

/**
 * Load and start all cron jobs from database
 */
async function startCronJobs() {
  try {
    const jobs = await CronJob.findAll({
      where: { isActive: true }
    });

    logger.info({ service: 'cron', count: jobs.length }, 'Loading cron jobs');

    for (const job of jobs) {
      startCronJob(job);
    }
  } catch (error) {
    logger.error({ err: error, service: 'cron' }, 'Failed to start cron jobs');
    throw error;
  }
}

/**
 * Reload cron jobs from database (for hot reload after admin changes)
 */
async function reloadCronJobs() {
  try {
    // Stop all existing tasks
    for (const [jobId, task] of activeCronTasks.entries()) {
      try {
        if (task && typeof task.stop === 'function') {
          task.stop();
        }
        if (task && typeof task.destroy === 'function') {
          task.destroy();
        }
      } catch (stopError) {
        logger.warn({
          err: stopError,
          service: 'cron',
          jobId
        }, 'Error stopping cron job');
      }
    }
    activeCronTasks.clear();

    // Reload from database
    await startCronJobs();

    return { success: true, message: 'Cron jobs reloaded' };
  } catch (error) {
    logger.error({ err: error, service: 'cron' }, 'Failed to reload cron jobs');
    return { success: false, message: error?.message || String(error) };
  }
}

/**
 * Stop a specific cron job
 * @param {string} jobId - Job ID
 */
function stopCronJob(jobId) {
  if (activeCronTasks.has(jobId)) {
    const task = activeCronTasks.get(jobId);
    task.stop();
    task.destroy();
    activeCronTasks.delete(jobId);
    return true;
  }
  return false;
}

/**
 * Get status of all active cron tasks
 */
function getActiveCronTasks() {
  return Array.from(activeCronTasks.keys());
}

/**
 * Sync bookings to vTiger CRM
 * @returns {Promise<void>}
 */
async function syncBookingsToVTiger() {
  try {
    const unsyncedBookings = await Booking.findAll({
      where: {
        isSyncedToVtiger: false,
        syncAttempts: { [Op.lt]: 3 }
      },
      include: [{
        model: Performer,
        as: 'performer'
      }],
      limit: 10
    });

    for (const booking of unsyncedBookings) {
      try {
        const leadId = await vtigerService.createLead({
          clientName: booking.clientName,
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone,
          clientCompany: booking.clientCompany,
          eventDate: booking.eventDate,
          eventLocation: booking.eventLocation,
          eventType: booking.eventType,
          expectedGuests: booking.expectedGuests,
          message: booking.message,
          budget: booking.budget,
          performer: booking.performer
        });

        await booking.update({
          vtigerLeadId: leadId,
          isSyncedToVtiger: true,
          syncAttempts: booking.syncAttempts + 1,
          lastSyncAttempt: new Date(),
          syncError: null
        });

        logger.info({
          service: 'cron',
          operation: 'bookingSync',
          bookingId: booking.id,
          leadId
        }, 'Booking synced to vTiger');
      } catch (error) {
        await booking.update({
          syncAttempts: booking.syncAttempts + 1,
          lastSyncAttempt: new Date(),
          syncError: error.message
        });

        logger.error({
          err: error,
          service: 'cron',
          operation: 'bookingSync',
          bookingId: booking.id
        }, 'Failed to sync booking');
      }
    }
  } catch (error) {
    logger.error({ err: error, service: 'cron', operation: 'bookingSync' }, 'Failed to sync bookings to vTiger');
    throw error;
  }
}

/**
 * Perform daily maintenance tasks
 * @returns {Promise<void>}
 */
async function performDailyMaintenance() {
  try {
    // Clean up old session data (older than 7 days)
    await sequelize.query(`
      DELETE FROM Sessions 
      WHERE expires < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    // Clean up old log files
    await cleanupOldLogs();

    // Log statistics
    const performerCount = await Performer.count({ where: { isActive: true } });
    const bookingCount = await Booking.count();
    const pendingBookings = await Booking.count({ where: { status: 'pending' } });

    logger.info({
      service: 'cron',
      operation: 'dailyMaintenance',
      performers: performerCount,
      bookings: bookingCount,
      pending: pendingBookings
    }, 'Daily maintenance completed');
  } catch (error) {
    logger.error({ err: error, service: 'cron', operation: 'dailyMaintenance' }, 'Daily maintenance error');
    throw error;
  }
}

module.exports = {
  startCronJobs,
  reloadCronJobs,
  stopCronJob,
  startCronJob,
  getActiveCronTasks,
  syncBookingsToVTiger,
  performDailyMaintenance,
  cleanupOldLogs,
  cleanupOldSecurityLogs
};
