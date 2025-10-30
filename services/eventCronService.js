const eventSyncService = require('./eventSyncService');
const { Setting } = require('../models');
const logger = require('../config/logger');

class EventCronService {
  /**
   * Események szinkronizálása cron job-ból
   */
  async runEventSync() {
    try {
      logger.info({
        service: 'eventCron',
        operation: 'eventSync',
        action: 'start'
      }, 'Starting event cron synchronization');

      // Beállítások lekérése
      const syncMonthsBefore = await Setting.get('events.sync_months_before', 1);
      const syncMonthsAfter = await Setting.get('events.sync_months_after', 1);

      const today = new Date();

      // Kezdő dátum: X hónappal ezelőtt
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - parseInt(syncMonthsBefore));
      const startDateStr = startDate.toISOString().split('T')[0];

      // Vég dátum: Y hónappal előre
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + parseInt(syncMonthsAfter));
      const endDateStr = endDate.toISOString().split('T')[0];

      // Szinkronizálás futtatása
      const result = await eventSyncService.syncEvents({
        startDate: startDateStr,
        endDate: endDateStr
      });

      logger.info({
        service: 'eventCron',
        operation: 'cronSyncComplete',
        startDate: startDateStr,
        endDate: endDateStr,
        created: result.created,
        updated: result.updated,
        errors: result.errors
      }, 'Event cron sync completed');

      return result;
    } catch (error) {
      logger.error({
        service: 'eventCron',
        operation: 'runEventSync',
        error: error.message
      }, 'Event cron sync failed');
      throw error;
    }
  }
}

module.exports = new EventCronService();
