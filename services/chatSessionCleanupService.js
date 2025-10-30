/**
 * Chat Session Cleanup Service
 * Soft Delete + Anonymization pattern (Industry Best Practice)
 *
 * Strategy:
 * - Phase 1 (30 days): Soft delete + Anonymize personal data
 * - Phase 2 (90 days): Hard delete (optional - currently disabled)
 *
 * GDPR Compliant: Personal data (name, email, phone) anonymized after 30 days
 * Rollback Support: Soft deleted sessions can be restored (if not anonymized)
 * Analytics Friendly: Session counts remain accurate
 */

const { ChatSession, ChatMessage } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

/**
 * Helper: Log cleanup info
 */
function logCleanupInfo(inactivityDays, emptySessionDays, inactivityDate, emptySessionDate) {
  logger.info({
    service: 'chatCleanup',
    inactivityDays,
    emptySessionDays,
    inactivityDate: inactivityDate.toISOString(),
    emptySessionDate: emptySessionDate.toISOString()
  }, 'Starting chat session cleanup');
}

/**
 * Helper: Find sessions to cleanup
 * Uses unscoped() to find sessions that are NOT already soft deleted
 */
async function findSessionsToCleanup(inactivityDate, emptySessionDate) {
  return await ChatSession.unscoped().findAll({
    where: {
      deletedAt: null, // Only find active sessions
      [Op.or]: [
        {
          updatedAt: { [Op.lt]: inactivityDate }
        },
        {
          createdAt: { [Op.lt]: emptySessionDate },
          '$messages.id$': null
        }
      ]
    },
    include: [
      {
        model: ChatMessage,
        as: 'messages',
        required: false,
        attributes: ['id']
      }
    ],
    attributes: ['id', 'sessionToken', 'createdAt', 'updatedAt', 'deletedAt']
  });
}

/**
 * Helper: Log dry run results
 */
function logDryRunResults(sessionsToCleanup, now) {
  logger.info({ service: 'chatCleanup', count: sessionsToCleanup.length, dryRun: true }, 'Would delete sessions');
  sessionsToCleanup.forEach((session) => {
    const daysSinceUpdate = Math.floor((now - new Date(session.updatedAt)) / (24 * 60 * 60 * 1000));
    logger.debug({ sessionToken: session.sessionToken, daysSinceUpdate }, 'Session to delete');
  });
}

/**
 * Helper: Soft delete + anonymize sessions
 * BEST PRACTICE: Soft delete preserves data for analytics/audit
 */
async function softDeleteSessions(sessionsToCleanup) {
  const sessionIds = sessionsToCleanup.map((s) => s.id);

  // Soft delete + anonymize in one query
  const result = await ChatSession.unscoped().update({
    deletedAt: new Date(),
    deletionReason: 'auto_cleanup',
    anonymized: true,
    anonymizedAt: new Date(),
    userName: null,
    userEmail: null,
    userPhone: null
  }, {
    where: {
      id: { [Op.in]: sessionIds },
      deletedAt: null // Only soft delete active sessions
    }
  });

  return result[0]; // Number of updated rows
}

/**
 * Helper: Hard delete sessions (PHASE 2 - optional, currently disabled)
 * Only use this after sessions have been soft deleted for a long time (e.g., 180 days)
 */
async function hardDeleteOldSessions(daysAfterSoftDelete = 180) {
  const cutoffDate = new Date(Date.now() - (daysAfterSoftDelete * 24 * 60 * 60 * 1000));

  const count = await ChatSession.unscoped().destroy({
    where: {
      deletedAt: { [Op.lt]: cutoffDate },
      anonymized: true
    }
  });

  logger.info({ service: 'chatCleanup', type: 'hardDelete', count, daysAfterSoftDelete }, 'Hard deleted old sessions');
  return count;
}

/**
 * Soft Delete + Anonymize old chat sessions (PHASE 1)
 * Sessions are considered old if:
 * - No activity (last message) in 30 days
 * - Created more than 90 days ago with no messages
 *
 * This is a SOFT DELETE - sessions are marked as deleted and anonymized,
 * but records remain in the database for audit/analytics purposes.
 *
 * @param {Object} options - Cleanup options
 * @param {number} options.inactivityDays - Days of inactivity before cleanup (default: 30)
 * @param {number} options.emptySessionDays - Days before cleaning empty sessions (default: 90)
 * @param {boolean} options.dryRun - If true, don't actually delete, just log
 * @returns {Promise<Object>} - Cleanup statistics
 */
async function cleanupOldSessions(options = {}) {
  const {
    inactivityDays = 30,
    emptySessionDays = 90,
    dryRun = false
  } = options;

  try {
    const now = new Date();
    const inactivityDate = new Date(now - (inactivityDays * 24 * 60 * 60 * 1000));
    const emptySessionDate = new Date(now - (emptySessionDays * 24 * 60 * 60 * 1000));

    logCleanupInfo(inactivityDays, emptySessionDays, inactivityDate, emptySessionDate);

    // Find sessions to cleanup (using unscoped to include already deleted)
    const sessionsToCleanup = await findSessionsToCleanup(inactivityDate, emptySessionDate);
    const sessionCount = sessionsToCleanup.length;

    if (sessionCount === 0) {
      logger.info({ service: 'chatCleanup', count: 0 }, 'No sessions to cleanup');
      return {
        success: true,
        softDeleted: 0,
        dryRun
      };
    }

    logger.info({ service: 'chatCleanup', count: sessionCount, dryRun }, 'Found sessions to cleanup');

    if (dryRun) {
      logDryRunResults(sessionsToCleanup, now);
      return {
        success: true,
        softDeleted: 0,
        wouldDelete: sessionCount,
        dryRun: true
      };
    }

    // Soft delete + anonymize
    const deletedCount = await softDeleteSessions(sessionsToCleanup);
    logger.info({ service: 'chatCleanup', count: deletedCount }, 'Soft deleted and anonymized sessions');

    return {
      success: true,
      softDeleted: deletedCount,
      anonymized: deletedCount,
      dryRun: false
    };
  } catch (error) {
    logger.error({ err: error, service: 'chatCleanup' }, 'Error during cleanup');
    throw error;
  }
}

/**
 * Cleanup sessions with no messages (abandoned sessions)
 * @param {number} maxAgeHours - Maximum age in hours (default: 24)
 * @returns {Promise<Object>} - Cleanup statistics
 */
async function cleanupAbandonedSessions(maxAgeHours = 24) {
  try {
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

    logger.info({
      service: 'chatCleanup',
      operation: 'cleanupAbandoned',
      maxAgeHours,
      cutoffDate: cutoffDate.toISOString()
    }, 'Cleaning abandoned chat sessions');

    // Find sessions with no messages
    const abandonedSessions = await ChatSession.findAll({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate
        }
      },
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          required: false,
          attributes: ['id']
        }
      ]
    });

    // Filter to only sessions with no messages
    const sessionsToDelete = abandonedSessions.filter((s) =>
      !s.messages || s.messages.length === 0
    );

    if (sessionsToDelete.length === 0) {
      logger.info({ service: 'chatCleanup', type: 'abandoned', count: 0 }, 'No abandoned sessions to cleanup');
      return { success: true, deleted: 0 };
    }

    const sessionIds = sessionsToDelete.map((s) => s.id);

    const deletedCount = await ChatSession.destroy({
      where: {
        id: {
          [Op.in]: sessionIds
        }
      }
    });

    logger.info({ service: 'chatCleanup', type: 'abandoned', count: deletedCount }, 'Deleted abandoned sessions');

    return {
      success: true,
      deleted: deletedCount
    };
  } catch (error) {
    logger.error('[Chat Cleanup] Error cleaning abandoned sessions:', error);
    throw error;
  }
}

/**
 * Get cleanup statistics (what would be cleaned)
 * Includes both active and soft-deleted sessions
 * @returns {Promise<Object>} - Statistics
 */
async function getCleanupStats() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = new Date(now - (90 * 24 * 60 * 60 * 1000));

    return {
      // Active sessions (deletedAt = null)
      totalActiveSessions: await ChatSession.count(),
      inactiveActiveSessions: await ChatSession.count({
        where: {
          updatedAt: { [Op.lt]: thirtyDaysAgo }
        }
      }),
      emptyOldActiveSessions: await ChatSession.count({
        where: {
          createdAt: { [Op.lt]: ninetyDaysAgo },
          '$messages.id$': null
        },
        include: [
          {
            model: ChatMessage,
            as: 'messages',
            required: false,
            attributes: ['id']
          }
        ]
      }),
      recentActiveSessions: await ChatSession.count({
        where: {
          updatedAt: { [Op.gte]: thirtyDaysAgo }
        }
      }),

      // Soft deleted sessions (deletedAt != null)
      totalSoftDeleted: await ChatSession.unscoped().count({
        where: { deletedAt: { [Op.ne]: null } }
      }),
      totalAnonymized: await ChatSession.unscoped().count({
        where: { anonymized: true }
      }),
      softDeletedNotAnonymized: await ChatSession.unscoped().count({
        where: {
          deletedAt: { [Op.ne]: null },
          anonymized: false
        }
      })
    };
  } catch (error) {
    logger.error('[Chat Cleanup] Error getting stats:', error);
    throw error;
  }
}

module.exports = {
  cleanupOldSessions,
  cleanupAbandonedSessions,
  getCleanupStats,
  hardDeleteOldSessions // Export for optional Phase 2 cleanup (180+ days)
};
