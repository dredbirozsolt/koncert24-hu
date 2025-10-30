const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { requireAdmin } = require('../middleware/auth');
const { Setting } = require('../models');
const logger = require('../config/logger');

// Méret átváltó (pl. "262K" -> byte)
function parseSize(sizeStr) {
  if (!sizeStr) {
    return 0;
  }
  if (typeof sizeStr === 'number') {
    return sizeStr;
  }
  const match = sizeStr.match(/^([\d.]+)\s*([KMG]?)/i);
  if (!match) {
    return 0;
  }
  let size = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'K') {
    size *= 1024;
  }
  if (unit === 'M') {
    size *= 1024 * 1024;
  }
  if (unit === 'G') {
    size *= 1024 * 1024 * 1024;
  }
  return Math.round(size);
}

// Helper function to read backup info
async function readBackupInfo(dirent, backupDir) {
  if (!dirent.isDirectory() || !dirent.name.startsWith('backup_')) {
    return null;
  }

  const infoPath = path.join(backupDir, dirent.name, 'backup_info.json');
  try {
    const infoRaw = await fs.readFile(infoPath, 'utf8');
    const info = JSON.parse(infoRaw);

    return {
      name: dirent.name,
      created: info.backup_date || null,
      size: (info.size && info.size.project_files) ? parseSize(info.size.project_files) : 0
    };
  } catch {
    // Ha nincs info vagy hibás, átugorjuk
    return null;
  }
}

// Backup management page
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Backupok beolvasása
    const backupDir = path.join(process.cwd(), 'backup');
    const backups = [];

    try {
      const dirs = await fs.readdir(backupDir, { withFileTypes: true });
      for (const dirent of dirs) {
        const backupInfoData = await readBackupInfo(dirent, backupDir);
        if (backupInfoData) {
          backups.push(backupInfoData);
        }
      }
    } catch {
      // backup mappa nem elérhető vagy üres
    }

    // Legújabb backupok előre
    backups.sort((a, b) => (b.created || '').localeCompare(a.created || ''));

    // Backup beállítások betöltése
    const maxCount = await Setting.get('backup.retention.max_count', 30);
    const maxAgeDays = await Setting.get('backup.retention.max_age_days', 30);

    const backupInfo = {
      count: backups.length,
      backups
    };

    res.render('admin/backup', {
      layout: 'layouts/admin',
      title: 'Backup Kezelés',
      currentPath: req.path,
      backupInfo,
      settings: {
        maxCount,
        maxAgeDays
      },
      messages: req.session.messages || {}
    });

    // Clear messages after rendering
    req.session.messages = {};
  } catch (error) {
    logger.error(
      { err: error, service: 'adminBackup', operation: 'loadPage' },
      'Backup page error'
    );
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Backup oldal betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// Update backup settings
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const { maxCount, maxAgeDays } = req.body;

    // Validáció
    if (!maxCount || isNaN(maxCount) || maxCount < 1) {
      logger.debug(
        { service: 'adminBackup', maxCount },
        'Validation failed: maxCount invalid'
      );
      return res.status(400).json({
        success: false,
        error: 'A backup darabszám legalább 1 kell legyen'
      });
    }

    if (!maxAgeDays || isNaN(maxAgeDays) || maxAgeDays < 1) {
      logger.debug(
        { service: 'adminBackup', maxAgeDays },
        'Validation failed: maxAgeDays invalid'
      );
      return res.status(400).json({
        success: false,
        error: 'A megőrzési idő legalább 1 nap kell legyen'
      });
    }

    // Beállítások mentése
    await Setting.set('backup.retention.max_count', maxCount, 'number', 'backup');
    await Setting.set('backup.retention.max_age_days', maxAgeDays, 'number', 'backup');

    logger.info(
      { service: 'adminBackup', maxCount, maxAgeDays },
      'Backup settings updated'
    );
    res.json({
      success: true,
      message: 'Backup beállítások sikeresen frissítve!'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminBackup', operation: 'updateSettings' },
      'Backup settings update error'
    );
    res.status(500).json({
      success: false,
      error: `Beállítások mentése sikertelen: ${error.message}`
    });
  }
});

// Run backup manually
router.post('/run', requireAdmin, async (req, res) => {
  try {
    logger.info(
      { service: 'adminBackup', userId: req.session?.userId },
      'Manual backup triggered'
    );

    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const backupScript = path.join(process.cwd(), 'backup.sh');

    // Check if backup script exists
    try {
      await fs.access(backupScript, fs.constants.R_OK);
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Backup script nem található vagy nem olvasható'
      });
    }

    // Run backup script
    const { stdout, stderr } = await execPromise(`bash "${backupScript}"`, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024,
      timeout: 600000 // 10 minute timeout
    });

    logger.info(
      { service: 'adminBackup', stdoutLength: stdout.length, hasStderr: Boolean(stderr) },
      'Backup completed'
    );

    res.json({
      success: true,
      message: 'Backup sikeresen elkészült!',
      output: stdout.substring(0, 1000) // Return first 1000 chars
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminBackup', operation: 'runBackup' },
      'Backup execution error'
    );
    res.status(500).json({
      success: false,
      error: `Backup hiba: ${error.message}`
    });
  }
});

// Download backup
router.get('/download/:backupName', requireAdmin, async (req, res) => {
  try {
    const { backupName } = req.params;

    // Security check: csak backup_YYYYMMDD_HHMMSS formátumú mappák
    if (!backupName.match(/^backup_\d{8}_\d{6}$/)) {
      logger.warn(
        { service: 'adminBackup', backupName, ip: req.ip },
        'Invalid backup name format'
      );
      return res.status(400).send('Érvénytelen backup név');
    }

    const backupDir = path.join(process.cwd(), 'backup', backupName);

    // Check if backup directory exists
    try {
      await fs.access(backupDir);
    } catch {
      logger.warn(
        { service: 'adminBackup', backupDir, backupName },
        'Backup directory not found'
      );
      return res.status(404).send('Backup nem található');
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}.tar.gz"`);

    // Create tar.gz on the fly using spawn
    const { spawn } = require('child_process');
    const tar = spawn('tar', ['-czf', '-', '-C', path.join(process.cwd(), 'backup'), backupName]);

    // Pipe tar output to response
    tar.stdout.pipe(res);

    // Handle errors
    tar.stderr.on('data', (data) => {
      logger.error(
        { service: 'adminBackup', operation: 'download', backupName, error: data.toString() },
        'Tar error'
      );
    });

    tar.on('close', (code) => {
      if (code === 0) {
        logger.info(
          { service: 'adminBackup', backupName, userId: req.session?.userId },
          'Backup downloaded'
        );
      } else {
        logger.error(
          { service: 'adminBackup', backupName, exitCode: code },
          'Tar process failed'
        );
      }
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminBackup', operation: 'downloadBackup' },
      'Backup download error'
    );
    if (!res.headersSent) {
      res.status(500).send('Letöltési hiba');
    }
  }
});

module.exports = router;
