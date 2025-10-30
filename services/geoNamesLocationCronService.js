const cron = require('node-cron');
const GeoNamesLocationSyncService = require('./geoNamesLocationSyncService');
const logger = require('../config/logger');

// Constants
const TIMEZONE_BUDAPEST = 'Europe/Budapest';

/**
 * Schedule GeoNames location sync tasks
 */
class GeoNamesLocationCronService {
  /**
     * Initialize GeoNames location sync cron jobs
     */
  static init() {
    // Monthly full sync - first Sunday of each month at 3 AM
    cron.schedule('0 3 * * 0#1', async () => {
      await GeoNamesLocationCronService.performMonthlySync();
    }, {
      scheduled: true,
      timezone: TIMEZONE_BUDAPEST
    });

    // Monthly stats logging - second day of month at 1 AM
    cron.schedule('0 1 2 * *', async () => {
      await GeoNamesLocationCronService.generateMonthlyStats();
    }, {
      scheduled: true,
      timezone: TIMEZONE_BUDAPEST
    });

    logger.info({
      service: 'geoNamesCron',
      operation: 'initialize',
      schedule: 'Monthly sync on first Sunday at 3 AM'
    }, 'GeoNames location cron jobs initialized');
  }

  /**
     * Perform monthly GeoNames location sync
     * @returns {Promise<void>}
     */
  static async performMonthlySync() {
    logger.info({
      service: 'geoNamesCron',
      operation: 'monthlySync',
      action: 'start'
    }, 'Starting monthly GeoNames location sync job');

    try {
      const geoNamesService = new GeoNamesLocationSyncService();

      // Test connection first
      const connectionTest = await geoNamesService.testConnection();

      if (!connectionTest.success) {
        throw new Error(`GeoNames API connection failed: ${connectionTest.message}`);
      }

      // Perform full sync
      const result = await geoNamesService.syncAllCountries();

      if (result.success) {
        logger.info({
          service: 'geoNamesCron',
          operation: 'monthlySyncComplete',
          totalLocations: result.totalLocations,
          countries: Object.keys(result.countries).length
        }, 'Monthly GeoNames sync completed');
        // Success notification disabled - only send email on errors
        // await GeoNamesLocationCronService.sendSuccessNotification(result);
      } else {
        throw new Error(`Sync completed with errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      logger.error('Monthly GeoNames location sync failed:', error.message);
      await GeoNamesLocationCronService.sendErrorNotification(error, 'GeoNames Location Sync');
    }
  }

  /**
   * Send error notification email using unified cron error template
   * @param {Error} error - Error object
   * @param {string} jobName - Name of the job
   * @param {Object} additionalData - Additional context data
   * @returns {Promise<void>}
   */
  static async sendErrorNotification(error, jobName, additionalData = {}) {
    try {
      // eslint-disable-next-line global-require -- Avoid circular dependency with emailService
      const emailService = require('./emailService');

      await emailService.sendCronErrorNotification(
        error,
        jobName,
        {
          service: 'geoNamesLocationCronService',
          timestamp: new Date().toLocaleString('hu-HU', { timeZone: TIMEZONE_BUDAPEST }),
          ...additionalData
        }
      );
    } catch (emailError) {
      logger.error('Failed to send GeoNames error notification:', emailError.message);
    }
  }

  /**
   * Generate and send monthly statistics
   * @returns {Promise<void>}
   */
  static async generateMonthlyStats() {
    logger.info({
      service: 'geoNamesCron',
      operation: 'generateStats',
      action: 'start'
    }, 'Generating monthly GeoNames location statistics');

    try {
      const geoNamesService = new GeoNamesLocationSyncService();
      const stats = await geoNamesService.getLocationStats();

      logger.info({
        service: 'geoNamesCron',
        operation: 'generateStats',
        stats
      }, 'GeoNames location statistics generated');

      // Stats generation successful - no email needed (only errors)
    } catch (error) {
      logger.error('Failed to generate GeoNames location stats:', error.message);

      // Send error notification for stats failure
      await GeoNamesLocationCronService.sendErrorNotification(
        error,
        'GeoNames Location Statistics',
        {
          scheduledTime: '2nd day 1:00 AM',
          frequency: 'Monthly'
        }
      );
    }
  }
}

module.exports = GeoNamesLocationCronService;
