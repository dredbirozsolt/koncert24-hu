/**
 * Cron Service Helpers
 * Backup and log cleanup operations for cronService
 */

const logger = require('../config/logger');
const { Setting } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const emailService = require('./emailService');

/**
 * Clean up old security logs from database
 * @returns {Promise<void>}
 */
async function cleanupOldSecurityLogs() {
  try {
    const { SecurityLog: SecurityLogModel } = require('../models');
    const retentionDays = await Setting.get('security.logs.retention.days', 90);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await SecurityLogModel.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate
        }
      }
    });

    if (result > 0) {
      logger.info({
        service: 'cron',
        operation: 'cleanupSecurityLogs',
        deletedCount: result,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      }, 'Security log cleanup completed');
    }
  } catch (error) {
    logger.error('Security log cleanup error:', error.message);
  }
}

/**
 * Helper: Check if log file should be deleted
 */
async function shouldDeleteLogFile(file, filePath, retentionDays) {
  if (file === 'app.log' || (!file.endsWith('.log') && !file.endsWith('.gz'))) {
    return { shouldDelete: false };
  }

  const stats = await fs.stat(filePath);
  const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

  return {
    shouldDelete: ageInDays > retentionDays,
    stats,
    ageInDays
  };
}

/**
 * Helper: Delete old log file and log result
 */
async function deleteOldLogFile(file, filePath, stats, ageInDays) {
  await fs.unlink(filePath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  const ageInDaysFloor = Math.floor(ageInDays);
  logger.info({
    service: 'cron',
    operation: 'deleteLogFile',
    file,
    sizeMB: fileSizeMB,
    ageInDays: ageInDaysFloor
  }, 'Deleted old log file');
  return stats.size;
}

/**
 * Cleanup old log files (runs daily at 2:00 AM)
 */
async function cleanupOldLogs() {
  try {
    const retentionDays = await Setting.get('logs.retention.days', 30);
    const logsDir = path.join(process.cwd(), 'logs');

    const files = await fs.readdir(logsDir);
    let deletedCount = 0;
    let deletedSize = 0;

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const result = await shouldDeleteLogFile(file, filePath, retentionDays);

      if (!result.shouldDelete) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const size = await deleteOldLogFile(file, filePath, result.stats, result.ageInDays);
      deletedCount += 1;
      deletedSize += size;
    }

    if (deletedCount > 0) {
      const freedMB = (deletedSize / 1024 / 1024).toFixed(2);
      logger.info({
        service: 'cron',
        operation: 'cleanupLogs',
        deletedCount,
        freedMB,
        retentionDays
      }, 'Log cleanup completed');
    }
  } catch (error) {
    logger.error('Log cleanup error:', error.message);
  }
}

/**
 * Helper: Check if backup script is accessible
 */
async function checkBackupScript(backupScript) {
  try {
    await fs.access(backupScript, fs.constants.R_OK);
    const stats = await fs.stat(backupScript);
    if (!stats.isFile()) {
      logger.warn({
        service: 'cron',
        operation: 'checkBackupScript',
        path: backupScript,
        reason: 'not_a_file'
      }, 'backup.sh is not a file, skipping backup');
      return false;
    }
    return true;
  } catch {
    logger.warn({
      service: 'cron',
      operation: 'checkBackupScript',
      path: backupScript,
      reason: 'not_found_or_not_readable'
    }, 'Backup script not found or not readable');
    return false;
  }
}

/**
 * Helper: Execute backup script
 */
async function executeBackupScript(backupScript) {
  const { stderr } = await execPromise(`bash "${backupScript}"`, {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
    timeout: 600000 // 10 minute timeout
  });

  if (stderr) {
    const errors = stderr.substring(0, 1000);
    logger.warn({
      service: 'cron',
      operation: 'dailyBackup',
      errorLength: stderr.length,
      preview: errors.substring(0, 200)
    }, 'Backup stderr output');
  }
}

/**
 * Helper: Handle backup execution error
 */
function handleBackupError(execError) {
  logger.error('Backup script execution failed:', {
    message: execError.message,
    code: execError.code,
    signal: execError.signal,
    stdout: execError.stdout ? execError.stdout.substring(0, 500) : 'N/A',
    stderr: execError.stderr ? execError.stderr.substring(0, 500) : 'N/A'
  });

  throw new Error(`Backup script failed: ${execError.message}`);
}

/**
 * Helper: Send backup error notification
 */
async function sendBackupErrorNotification(error) {
  try {
    await emailService.sendCriticalErrorNotification(
      error,
      'Daily Backup',
      {
        cronJob: true,
        scheduledTime: '2:00 AM',
        errorDetails: error.stack || error.message
      }
    );
  } catch (emailError) {
    logger.error('Failed to send backup error email:', emailError.message);
  }
}

/**
 * Run daily backup using backup.sh script
 * @returns {Promise<void>}
 */
async function runDailyBackup() {
  try {
    const backupScript = path.join(process.cwd(), 'backup.sh');

    const isAccessible = await checkBackupScript(backupScript);
    if (!isAccessible) {
      return;
    }

    try {
      await executeBackupScript(backupScript);
      logger.info({
        service: 'cron',
        operation: 'dailyBackup',
        backupScript: 'backup.sh'
      }, 'Daily backup completed');
    } catch (execError) {
      handleBackupError(execError);
    }
  } catch (error) {
    logger.error('Daily backup failed:', error.message);
    await sendBackupErrorNotification(error);
    throw error;
  }
}

module.exports = {
  cleanupOldSecurityLogs,
  cleanupOldLogs,
  runDailyBackup
};
