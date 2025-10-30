const { Performer, Booking } = require('../models');
const { VTigerService } = require('./vtigerService');
const emailService = require('./emailService');
const logger = require('../config/logger');
const { Op } = require('sequelize');

// VTiger service instance létrehozása
const vtigerService = new VTigerService();

/**
 * Service for synchronizing data between vTiger and local database
 */
class SyncService {
  /**
     * Get next scheduled sync time
     * @returns {string} Next sync time formatted string
     */
  getNextSyncTime() {
    const now = new Date();
    const tomorrow = new Date(now);

    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);

    // If it's before 6 AM today, next sync is today at 6 AM
    if (now.getHours() < 6) {
      const today = new Date(now);

      today.setHours(6, 0, 0, 0);

      return today.toLocaleString('hu-HU');
    }

    return tomorrow.toLocaleString('hu-HU');
  }

  /**
   * Szinkronizálja a vTiger előadókat a helyi adatbázisba
   * @param {boolean} isManual - Whether this is a manual sync or scheduled
   * @returns {Promise<Object>} Sync result with stats
   */
  async syncPerformers(isManual = false) {
    const startTime = Date.now();
    const stats = this.initializeSyncStats();

    try {
      const syncType = isManual ? 'Manual' : 'Automatic';
      logger.info({ service: 'sync', type: syncType }, 'vTiger performer sync started');

      const vtigerPerformers = await vtigerService.getPerformers();
      stats.total = vtigerPerformers.length;

      // Delete performers that are no longer in vTiger
      await this.deleteRemovedPerformers(vtigerPerformers, stats);

      // Process (create/update) performers from vTiger
      await this.processPerformers(vtigerPerformers, stats);

      return await this.completeSyncProcess(stats, startTime, isManual);
    } catch (error) {
      return await this.handleSyncError(error, stats, startTime);
    }
  }

  /**
   * Initialize sync statistics object
   * @returns {Object} Empty stats object
   */
  initializeSyncStats() {
    return {
      total: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      categories: new Set()
    };
  }

  /**
   * Soft delete performers that are no longer in vTiger
   * Sets isActive = false instead of physical deletion to preserve booking history
   * @param {Array} vtigerPerformers - Array of performers from vTiger
   * @param {Object} stats - Statistics object to update
   * @returns {Promise<void>}
   */
  async deleteRemovedPerformers(vtigerPerformers, stats) {
    try {
      // Extract all vTiger IDs from the current sync data
      const vtigerIds = vtigerPerformers.map((p) => p.vtigerId);

      // Find all active performers whose vtigerId is not in the current vTiger data
      const performersToDeactivate = await Performer.findAll({
        where: {
          vtigerId: {
            [Op.notIn]: vtigerIds
          },
          isActive: true // Only deactivate currently active performers
        }
      });

      // Soft delete: set isActive = false instead of destroying
      for (const performer of performersToDeactivate) {
        await performer.update({
          isActive: false,
          updatedAt: new Date()
        });
        stats.deleted += 1;
        logger.info(
          { service: 'sync', performerId: performer.id, vtigerId: performer.vtigerId, name: performer.name },
          'Performer deactivated (not in vTiger)'
        );
      }

      if (stats.deleted > 0) {
        logger.info(
          { service: 'sync', deactivatedCount: stats.deleted },
          'Deactivated performers no longer in vTiger'
        );
      }
    } catch (error) {
      logger.error(
        { err: error, service: 'sync' },
        'Error deactivating removed performers'
      );
      // Don't throw - continue with sync even if deactivation fails
    }
  }

  /**
   * Process all performers from vTiger
   * @param {Array} vtigerPerformers - Array of performers from vTiger
   * @param {Object} stats - Statistics object to update
   * @returns {Promise<void>}
   */
  async processPerformers(vtigerPerformers, stats) {
    for (const vtigerPerformer of vtigerPerformers) {
      try {
        await this.syncSinglePerformer(vtigerPerformer, stats);
      } catch (error) {
        stats.errors += 1;
        logger.error(
          { err: error, service: 'sync', performer: vtigerPerformer.name },
          'Error syncing performer'
        );
      }
    }
  }

  /**
   * Sync a single performer
   * Creates new performer or updates existing one (reactivating if necessary)
   * @param {Object} vtigerPerformer - Performer data from vTiger
   * @param {Object} stats - Statistics object to update
   * @returns {Promise<void>}
   */
  async syncSinglePerformer(vtigerPerformer, stats) {
    if (vtigerPerformer.category) {
      stats.categories.add(vtigerPerformer.category);
    }

    const performer = await Performer.findOne({ where: { vtigerId: vtigerPerformer.vtigerId } });
    const performerData = this.buildPerformerData(vtigerPerformer);

    if (performer) {
      // Update existing performer and reactivate if it was deactivated
      await performer.update({
        ...performerData,
        isActive: true // Reactivate if performer is back in vTiger
      });
      stats.updated += 1;

      // Log reactivation if performer was inactive
      if (!performer.isActive) {
        logger.info(
          { service: 'sync', performerId: performer.id, vtigerId: performer.vtigerId, name: performer.name },
          'Performer reactivated (back in vTiger)'
        );
      }
    } else {
      performerData.slug = await this.generateUniqueSlug(vtigerPerformer.name);
      performerData.isActive = true; // New performers are active by default
      await Performer.create(performerData);
      stats.created += 1;
    }
  }

  /**
   * Build performer data object from vTiger data
   * @param {Object} vtigerPerformer - Performer data from vTiger
   * @returns {Object} Formatted performer data
   */
  buildPerformerData(vtigerPerformer) {
    return {
      vtigerId: vtigerPerformer.vtigerId,
      name: vtigerPerformer.name,
      category: vtigerPerformer.category,
      description: vtigerPerformer.description || '',
      shortDescription: vtigerPerformer.shortDescription || '',
      imageUrl: vtigerPerformer.imageUrl,
      videoUrl: vtigerPerformer.videoUrl,
      price: vtigerPerformer.price,
      duration: vtigerPerformer.duration,
      phone: vtigerPerformer.phone,
      email: vtigerPerformer.email,
      website: vtigerPerformer.website,
      isActive: vtigerPerformer.isActive !== false,
      performanceType: vtigerPerformer.performanceType,
      travelCost: vtigerPerformer.travelCost,
      travelCostCalculation: vtigerPerformer.travelCostCalculation,
      technicalRequirements: vtigerPerformer.technicalRequirements,
      style: vtigerPerformer.style,
      status: vtigerPerformer.status || null,
      vatRate: vtigerPerformer.vatRate,
      contactFirstName: vtigerPerformer.contactFirstName,
      contactLastName: vtigerPerformer.contactLastName,
      lastSyncAt: new Date()
    };
  }

  /**
   * Complete sync process with logging and notifications
   * @param {Object} stats - Statistics object
   * @param {number} startTime - Start time of sync
   * @param {boolean} isManual - Whether this is a manual sync
   * @returns {Promise<Object>} Success result
   */
  async completeSyncProcess(stats, startTime, _isManual) {
    const duration = Date.now() - startTime;

    stats.categoriesCount = stats.categories.size;
    stats.categories = Array.from(stats.categories).sort();

    logger.info({
      service: 'sync',
      duration,
      created: stats.created,
      updated: stats.updated,
      deleted: stats.deleted,
      errors: stats.errors,
      categoriesCount: stats.categoriesCount,
      categories: stats.categories.join(', ')
    }, 'Performer sync completed');

    if (stats.errors > 0) {
      await this.sendSyncErrorNotification(stats, duration, false);
    }

    return {
      success: true,
      stats,
      duration
    };
  }

  /**
   * Handle sync error with logging and notification
   * @param {Error} error - The error that occurred
   * @param {Object} stats - Statistics object
   * @param {number} startTime - Start time of sync
   * @returns {Promise<Object>} Error result
   */
  async handleSyncError(error, stats, startTime) {
    logger.error('❌ Performer sync failed:', error);

    await this.sendSyncErrorNotification(stats, Date.now() - startTime, true, error);

    return {
      success: false,
      error: error.message,
      stats
    };
  }

  /**
       * Generates a unique URL-safe slug from name
       * @param {string} name - The name to convert
       * @param {string} vtigerId - The vTiger ID for uniqueness
       * @returns {string} URL-safe unique slug
       */
  generateSlug(name, vtigerId = '') {
    if (!name) {
      return `performer-${vtigerId || Date.now()}`;
    }

    let baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      // Remove diacritics
      .replace(/[\u0300-\u036f]/g, '')
      // Remove special chars
      .replace(/[^a-z0-9\s-]/g, '')
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Replace multiple hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-|-$/g, '');

    // Ensure slug is not empty and add vTiger ID for uniqueness
    if (!baseSlug) {
      baseSlug = 'performer';
    }

    // Add vTiger ID to ensure uniqueness
    return vtigerId ? `${baseSlug}-${vtigerId}` : baseSlug;
  }

  /**
       * Generates a unique slug that doesn't exist in database
       * @param {string} name - The name to convert
       * @returns {Promise<string>} Unique URL-safe slug
       */
  async generateUniqueSlug(name) {
    const baseSlug = this.generateSlug(name, '');
    let counter = 1;
    let slug = baseSlug;

    // Check if slug exists
    while (await Performer.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return slug;
  }

  /**
       * Gets sync statistics without performing sync
       * @returns {Promise<Object>} Current database stats
       */
  async getSyncStats() {
    try {
      const totalPerformers = await Performer.count();
      const activePerformers = await Performer.count({ where: { isActive: true } });
      const inactivePerformers = totalPerformers - activePerformers;

      // Get unique categories
      const categories = await Performer.findAll({
        attributes: ['category'],
        group: ['category'],
        where: { isActive: true },
        raw: true
      });

      const lastSync = await Performer.findOne({
        attributes: ['lastSyncAt'],
        where: { lastSyncAt: { [Op.not]: null } },
        order: [['lastSyncAt', 'DESC']],
        raw: true
      });

      return {
        totalPerformers,
        activePerformers,
        inactivePerformers,
        categories: categories.map((category) => category.category).filter(Boolean).sort(),
        categoriesCount: categories.length,
        lastSync: lastSync ? lastSync.lastSyncAt : null
      };
    } catch (error) {
      logger.error('Error getting sync stats:', error);
      throw error;
    }
  }

  /**
     * Send email notification about VTiger sync errors
     * @param {Object} stats - Sync statistics
     * @param {number} duration - Sync duration in ms
     * @param {boolean} isCritical - Whether this is a critical failure
     * @param {Error} error - The error that occurred (for critical failures)
     */
  async sendSyncErrorNotification(stats, duration, isCritical = false, error = null) {
    try {
      if (isCritical) {
        // Critical failure - entire sync failed
        await emailService.sendCriticalErrorNotification(
          error,
          'VTiger Performer Szinkronizáció Kritikus Hiba',
          {
            syncType: 'VTiger Performer Sync',
            duration: `${duration}ms`,
            stats: {
              total: stats.total,
              processed: stats.created + stats.updated,
              created: stats.created,
              updated: stats.updated,
              deleted: stats.deleted,
              errors: stats.errors
            }
          }
        );
      } else {
        // Partial errors during sync
        const subject = `⚠️ VTiger Szinkronizáció Hibák - ${stats.errors} hiba történt`;
        const timestamp = new Date().toLocaleString('hu-HU');

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #fd7e14; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
              <h1 style="margin: 0;">⚠️ SZINKRONIZÁCIÓ HIBÁK</h1>
              <p style="margin: 10px 0 0 0;">VTiger Performer Szinkronizáció</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <h3>📊 Szinkronizáció Összefoglaló</h3>
                <p><strong>Időpont:</strong> ${timestamp}</p>
                <p><strong>Időtartam:</strong> ${duration}ms</p>
                <p><strong>Összes előadó:</strong> ${stats.total}</p>
                <p><strong>Létrehozott:</strong> ${stats.created}</p>
                <p><strong>Frissített:</strong> ${stats.updated}</p>
                <p><strong>Törölve:</strong> ${stats.deleted}</p>
                <p><strong>Hibák:</strong> ${stats.errors}</p>
                <p><strong>Kategóriák:</strong> ${stats.categoriesCount}</p>
              </div>
              
              <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p><strong>🔍 Ajánlott műveletek:</strong></p>
                <ul>
                  <li>Ellenőrizd a VTiger kapcsolatot</li>
                  <li>Nézd át a log fájlokat részletekért</li>
                  <li>Futtasd újra a szinkronizációt manuálisan</li>
                  <li>Ha a hibák folytatódnak, vedd fel a kapcsolatot a fejlesztővel</li>
                </ul>
              </div>
            </div>
          </div>
        `;

        const textContent = `
⚠️ VTiger Szinkronizáció Hibák

Időpont: ${timestamp}
Időtartam: ${duration}ms
Összes előadó: ${stats.total}
Létrehozott: ${stats.created}
Frissített: ${stats.updated}
Törölve: ${stats.deleted}
Hibák: ${stats.errors}
Kategóriák: ${stats.categoriesCount}

Ajánlott műveletek:
- Ellenőrizd a VTiger kapcsolatot
- Nézd át a log fájlokat részletekért
- Futtasd újra a szinkronizációt manuálisan
        `;

        await emailService.sendEmail({
          to: emailService.config.adminAddress,
          subject,
          text: textContent,
          html: htmlContent
        });
      }
    } catch (emailError) {
      logger.error('Failed to send sync error notification:', emailError);
    }
  }

  /**
   * Clean up old inactive performers that have no bookings
   * This should be run periodically (e.g., monthly) to prevent database bloat
   * Deletes performers that:
   * - Have been inactive (isActive = false) for more than retentionDays
   * - Have no associated bookings
   * @param {number} retentionDays - Days to keep inactive performers (default: 365)
   * @returns {Promise<Object>} Cleanup result with count
   */
  async cleanupInactivePerformers(retentionDays = 365) {
    const startTime = Date.now();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      logger.info({
        service: 'sync',
        action: 'cleanup',
        retentionDays,
        cutoffDate
      }, 'Starting inactive performer cleanup');

      // Find inactive performers older than cutoff date
      const inactivePerformers = await Performer.findAll({
        where: {
          isActive: false,
          updatedAt: {
            [Op.lt]: cutoffDate
          }
        },
        include: [{
          model: Booking,
          as: 'bookings',
          required: false,
          attributes: ['id']
        }]
      });

      let deletedCount = 0;
      const deletedPerformers = [];

      // Delete only performers without any bookings
      for (const performer of inactivePerformers) {
        if (!performer.bookings || performer.bookings.length === 0) {
          deletedPerformers.push({
            id: performer.id,
            vtigerId: performer.vtigerId,
            name: performer.name,
            deactivatedAt: performer.updatedAt
          });

          await performer.destroy();
          deletedCount += 1;

          logger.info({
            service: 'sync',
            action: 'cleanup',
            performerId: performer.id,
            vtigerId: performer.vtigerId,
            name: performer.name
          }, 'Inactive performer permanently deleted (no bookings)');
        }
      }

      const duration = Date.now() - startTime;

      logger.info({
        service: 'sync',
        action: 'cleanup',
        duration,
        checked: inactivePerformers.length,
        deleted: deletedCount,
        retained: inactivePerformers.length - deletedCount
      }, 'Inactive performer cleanup completed');

      return {
        success: true,
        duration,
        checked: inactivePerformers.length,
        deleted: deletedCount,
        retained: inactivePerformers.length - deletedCount,
        deletedPerformers
      };
    } catch (error) {
      logger.error({
        err: error,
        service: 'sync',
        action: 'cleanup'
      }, 'Error during inactive performer cleanup');

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
}

module.exports = { SyncService };
