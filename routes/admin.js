/* eslint-disable max-lines */
// Admin routes - This file intentionally exceeds max-lines due to comprehensive admin functionality
// Including backup, sync, logs, and settings management in a single cohesive module

const express = require('express');
const router = express.Router();
const multer = require('multer');
const logger = require('../config/logger');
const adminCronRoutes = require('./admin-cron');
const adminBlogRoutes = require('./admin-blog');
const adminFaqRoutes = require('./admin-faq');
const adminExitPopupRoutes = require('./admin-exit-popup');
const adminBackupRoutes = require('./admin-backup');
const adminSeoRoutes = require('./admin-seo');
const adminEventsRoutes = require('./admin-events');
const adminPartnersRoutes = require('./admin-partners');
const adminSecurityLogRoutes = require('./admin-security-log');
const { requireAdmin } = require('../middleware/auth');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logService = require('../services/logService');
const dashboardStatsService = require('../services/dashboardStatsService');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const MSG_ADMIN_EMAIL_TEST = 'Admin email teszt';
const MSG_UNKNOWN_ERROR = 'Ismeretlen hiba';
const MSG_ACCESS_DENIED = 'Hozzáférés megtagadva';
const MSG_LOG_NOT_FOUND = 'Log fájl nem található';
const SETTING_KEY_COMPANY_LOGO = 'company.logo';
const DEFAULT_OG_IMAGE_PATH = '/images/og-image.jpg';
const SETTING_KEY_DEFAULT_OG_IMAGE = 'seo.default_og_image';

// Multer konfiguráció céglogó feltöltéshez
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'company');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Egyedi név generálás: company-logo-timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `company-logo-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Csak képfájlok engedélyezettek (JPEG, PNG, GIF, SVG, WebP)!'));
  }
});

// Multer konfiguráció OG Image feltöltéshez
const ogImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'images');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Egyedi név: og-image-timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `og-image-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const ogImageUpload = multer({
  storage: ogImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit (OG image lehet nagyobb)
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('OG Image: Csak JPEG, PNG, WebP formátumok engedélyezettek!'));
  }
});

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

router.use('/cron', requireAdmin, adminCronRoutes);
router.use('/blog', requireAdmin, adminBlogRoutes);
router.use('/faq', requireAdmin, adminFaqRoutes);
router.use('/exit-popup', requireAdmin, adminExitPopupRoutes);
router.use('/backup', requireAdmin, adminBackupRoutes);
router.use('/seo', requireAdmin, adminSeoRoutes);
router.use('/events', requireAdmin, adminEventsRoutes);
router.use('/partners/categories', requireAdmin, require('./admin-partner-categories'));
router.use('/partners', requireAdmin, adminPartnersRoutes);
router.use('/security-log', requireAdmin, adminSecurityLogRoutes);

// Helper: Read all backups from backup directory
async function readAllBackups() {
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
    // backup folder not accessible or empty
  }

  // Sort by creation date, newest first
  backups.sort((a, b) => (b.created || '').localeCompare(a.created || ''));

  return {
    count: backups.length,
    backups
  };
}

// Helper: Extract basic page data from request
function extractBasicPageData(req, res) {
  return {
    title: 'Admin Dashboard',
    basePath: res.locals.basePath || '/',
    siteDomain: res.locals.siteDomain || '',
    siteName: res.locals.siteName || '',
    currentPath: req.originalUrl || '/admin',
    pageDescription: 'Admin felület',
    pageTitle: 'Admin Dashboard',
    pageUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`
  };
}

// Helper: Extract company data from res.locals
function extractCompanyData(res) {
  return {
    companyName: res.locals.companyName || '',
    companyPhone: res.locals.companyPhone || '',
    companyEmail: res.locals.companyEmail || '',
    companyAddress: res.locals.companyAddress || '',
    companyTaxNumber: res.locals.companyTaxNumber || '',
    companyBankAccount: res.locals.companyBankAccount || '',
    companyWebsite: res.locals.companyWebsite || '',
    companyFacebook: res.locals.companyFacebook || '',
    companyInstagram: res.locals.companyInstagram || '',
    companyYoutube: res.locals.companyYoutube || '',
    companyLinkedin: res.locals.companyLinkedin || '',
    companyTwitter: res.locals.companyTwitter || ''
  };
}

// Helper: Extract SEO/meta data defaults
function extractSeoDefaults(res) {
  return {
    favicon: res.locals.favicon || '/favicon.ico',
    logo: res.locals.logo || '',
    pageImage: '',
    pageType: 'website',
    pageKeywords: '',
    pageAuthor: '',
    pageCopyright: '',
    pageRobots: 'noindex, nofollow',
    pageCanonical: '',
    pageLocale: 'hu_HU',
    pagePublished: '',
    pageModified: '',
    pageSection: '',
    pageTags: [],
    structuredData: null
  };
}

// Helper: Build view data for admin dashboard
function buildDashboardViewData(req, res, backupInfo) {
  const { server } = require('../config/environment');
  const user = req.session.user || req.user || null;
  const adminUser = user ? (user.email || user.name || user.username || '') : '';

  return {
    ...extractBasicPageData(req, res),
    ...extractCompanyData(res),
    ...extractSeoDefaults(res),
    layout: LAYOUT_ADMIN,
    user,
    adminUser,
    backupInfo,
    isLoggedIn: Boolean(user),
    nodeEnv: server.nodeEnv,
    isProduction: server.isProduction,
    isDevelopment: server.isDevelopment
  };
}

// Login oldal
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/admin');
  }
  res.render('admin/login', {
    title: 'Bejelentkezés',
    message: req.flash('error')
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error({
        err,
        userId: req.session?.userId
      }, 'Logout error');
    }
    res.redirect('/');
  });
});

// Admin dashboard főoldal (cleaned up, single definition)

// Backup készítés végpont
router.post('/backup', requireAdmin, (req, res) => {
  try {
    const scriptPath = path.join(process.cwd(), 'backup.sh');
    // Mindig teljes backup
    const cmd = `bash "${scriptPath}"`;
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logger.error({
          err: error,
          stderr,
          userId: req.session?.userId
        }, 'Backup hiba');
        return res.status(500).json({ success: false, error: error.message, stderr });
      }
      res.json({ success: true, message: 'Teljes backup sikeresen elkészült.' });
    });
  } catch (err) {
    logger.error({
      err,
      userId: req.session?.userId
    }, 'Backup végpont hiba');
    res.status(500).json({ success: false, error: err.message });
  }
});

router.use('/cron', adminCronRoutes);

// Admin logout - destroy session and redirect
router.post('/logout', (req, res) => {
  if (req.session.user) {
    logger.info({
      service: 'admin',
      operation: 'logout',
      email: req.session.user.email
    }, 'Admin user logged out');
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, 'Admin logout error');
    }
    res.redirect('/');
  });
});

// Admin dashboard főoldal (cleaned up, single definition)
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Gather dashboard statistics
    const stats = await dashboardStatsService.getDashboardStats();

    // Read backup information
    const backupInfo = await readAllBackups();

    // Build view data using helper
    const viewData = buildDashboardViewData(req, res, backupInfo);

    // Add stats to view data
    viewData.stats = stats;

    res.render('admin/dashboard', viewData, (err, html) => {
      if (err) {
        logger.error({
          err,
          userId: req.session?.userId,
          view: 'admin/dashboard'
        }, 'EJS renderelési hiba az admin dashboardnál');
        return res.status(500).send('Sablon renderelési hiba az admin dashboard betöltésekor.');
      }
      res.send(html);
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      path: req.path
    }, 'Admin dashboard error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Admin főoldal betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// Dashboard Chart Data API
router.get('/api/dashboard/chart-data', requireAdmin, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;

    const [bookingTrend, conversionRate] = await Promise.all([
      dashboardStatsService.getBookingTrendData(months),
      dashboardStatsService.getConversionRateData(months)
    ]);

    res.json({
      success: true,
      data: {
        bookingTrend,
        conversionRate
      }
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      months: req.query.months
    }, 'Chart data API error');
    res.status(500).json({
      success: false,
      error: 'Chart adatok betöltése sikertelen'
    });
  }
});

// vTiger performer szinkron
router.post('/sync/vtiger', requireAdmin, async (req, res) => {
  try {
    const { SyncService } = require('../services/syncService');
    const syncService = new SyncService();

    // Run the sync
    const result = await syncService.syncPerformers(true); // true = manual sync

    if (!result || !result.success) {
      throw new Error(result?.error || 'Sync szolgáltatás hibát jelzett');
    }

    // Extract stats from result
    const stats = result.stats || {};
    const statsForDisplay = {
      total: stats.total || 0,
      created: stats.created || 0,
      updated: stats.updated || 0,
      categoriesCount: stats.categoriesCount || 0
    };

    res.json({
      success: true,
      message: `vTiger szinkron befejezve - ${statsForDisplay.total} előadó feldolgozva`,
      result: {
        stats: statsForDisplay,
        duration: result.duration
      }
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      syncType: 'vtiger_performer'
    }, 'vTiger sync error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup inactive performers (no bookings, older than 1 year)
router.post('/cleanup/performers', requireAdmin, async (req, res) => {
  try {
    const { SyncService } = require('../services/syncService');
    const syncService = new SyncService();

    // Run the cleanup with retention days from request or default 365
    const retentionDays = parseInt(req.body.retentionDays, 10) || 365;
    const result = await syncService.cleanupInactivePerformers(retentionDays);

    if (!result || !result.success) {
      throw new Error(result?.error || 'Cleanup szolgáltatás hibát jelzett');
    }

    res.json({
      success: true,
      message: `Cleanup befejezve - ${result.deleted} előadó törölve (${result.retained} megtartva foglalások miatt)`,
      result: {
        checked: result.checked,
        deleted: result.deleted,
        retained: result.retained,
        duration: result.duration,
        deletedPerformers: result.deletedPerformers
      }
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      action: 'performer_cleanup'
    }, 'Performer cleanup error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Booking szinkron vTiger-be
router.post('/sync/bookings', requireAdmin, async (req, res) => {
  try {
    const { syncBookingsToVTiger } = require('../services/cronService');
    const { Booking } = require('../models');
    const { Op } = require('sequelize');

    // Get count of unsynced bookings before sync
    const unsyncedCount = await Booking.count({
      where: {
        isSyncedToVtiger: false,
        syncAttempts: { [Op.lt]: 3 }
      }
    });

    if (unsyncedCount === 0) {
      return res.json({
        success: true,
        message: 'Nincs szinkronizálandó foglalás',
        result: {
          stats: {
            total: 0,
            synced: 0,
            failed: 0
          }
        }
      });
    }

    // Run the sync
    await syncBookingsToVTiger();

    // Get count after sync to see what was synced
    const remainingUnsynced = await Booking.count({
      where: {
        isSyncedToVtiger: false,
        syncAttempts: { [Op.lt]: 3 }
      }
    });

    const synced = unsyncedCount - remainingUnsynced;

    res.json({
      success: true,
      message: `Foglalás szinkron befejezve - ${synced} foglalás szinkronizálva`,
      result: {
        stats: {
          total: unsyncedCount,
          synced,
          failed: remainingUnsynced
        }
      }
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      syncType: 'booking'
    }, 'Booking sync error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Napi karbantartás
router.post('/maintenance/daily', requireAdmin, async (req, res) => {
  try {
    const { performDailyMaintenance } = require('../services/cronService');
    const { Performer, Booking } = require('../models');

    // Run the maintenance
    await performDailyMaintenance();

    // Get current stats
    const performerCount = await Performer.count({ where: { isActive: true } });
    const bookingCount = await Booking.count();
    const pendingBookings = await Booking.count({ where: { status: 'pending' } });

    res.json({
      success: true,
      message: 'Napi karbantartás sikeresen befejezve',
      result: {
        stats: {
          performerCount,
          bookingCount,
          pendingBookings,
          sessionsCleanedUp: true
        }
      }
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      jobType: 'maintenance'
    }, 'Daily maintenance error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Napi backup
router.post('/backup/run', requireAdmin, (req, res) => {
  try {
    const scriptPath = path.join(process.cwd(), 'backup.sh');
    const cmd = `bash "${scriptPath}"`;

    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        logger.error({
          err: error,
          stderr,
          userId: req.session?.userId
        }, 'Backup hiba');
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      res.json({
        success: true,
        message: 'Teljes backup sikeresen elkészült',
        result: {
          stats: {
            completed: true
          }
        }
      });
    });
  } catch (err) {
    logger.error({
      err,
      userId: req.session?.userId
    }, 'Backup futtatás hiba');
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// GeoNames szinkron
router.post('/sync/geonames', requireAdmin, (req, res) => {
  const script = `
    const GeoNamesLocationSyncService = require('./services/geoNamesLocationSyncService.js');
    const logger = require('./config/logger.js');
    const geoNamesService = new GeoNamesLocationSyncService();
    geoNamesService.syncAllCountries()
      .then(result => {
        // Write result with markers to distinguish from log output
        process.stdout.write('###RESULT###' + JSON.stringify(result) + '###END###');
      })
      .catch(err => {
        logger.error({ err }, 'GeoNames sync failed in child process');
        process.exit(1);
      });
  `;

  exec(`node -e "${script}"`, (error, stdout, stderr) => {
    if (error) {
      logger.error({
        err: error,
        stderr,
        userId: req.session?.userId,
        syncType: 'geonames'
      }, 'GeoNames sync error');
      return res.status(500).json({
        success: false,
        error: error.message,
        stderr
      });
    }

    try {
      // Look for JSON result between markers
      const resultMatch = stdout.match(/###RESULT###(.+?)###END###/);
      if (!resultMatch) {
        throw new Error('No result found in output');
      }

      const result = JSON.parse(resultMatch[1]);

      // Create summary statistics
      const stats = {
        total: result.totalLocations || 0,
        countries: Object.keys(result.countries || {}).length,
        created: result.totalLocations || 0, // Show total as "created"
        updated: 0  // GeoNames doesn't differentiate new vs updated
      };

      // If we have country data, calculate some stats
      if (result.countries) {
        // Count successful countries
        const successfulCountries = Object.values(result.countries)
          .filter((country) => country.success).length;
        stats.countries = successfulCountries;
      }

      res.json({
        success: result.success,
        message: result.success
          ? `GeoNames szinkron befejezve - ${result.totalLocations} helység feldolgozva`
          : `GeoNames szinkron hibákkal befejezve - ${result.errors?.length || 0} ország sikertelen`,
        result: {
          ...result,
          stats
        }
      });
    } catch (parseError) {
      logger.error({
        err: parseError,
        stdout: stdout.substring(0, 500),
        userId: req.session?.userId,
        syncType: 'geonames'
      }, 'GeoNames sync result parse error');
      res.json({
        success: true,
        message: 'GeoNames szinkron befejezve',
        result: {
          stats: {
            total: 0,
            countries: 0,
            created: 0,
            updated: 0
          }
        },
        output: stdout
      });
    }
  });
});

// Logs page - main view
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Load only retention days setting (rotation & size are in .env)
    const retentionDays = await Setting.get('logs.retention.days', 14);

    res.render('admin/logs', {
      layout: LAYOUT_ADMIN,
      title: 'Logs',
      currentPath: req.path,
      csrfToken: res.locals.csrfToken || req.session.csrfToken || '',
      messages: req.session.messages || {},
      settings: {
        retentionDays
      }
    });

    // Clear messages after rendering
    delete req.session.messages;
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      path: req.path
    }, 'Logs page error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Logs oldal betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// Log fájlok listázása API endpoint
router.get('/logs/files', requireAdmin, async (req, res) => {
  try {
    const logFiles = await logService.getLogFiles();
    res.json({ success: true, files: logFiles });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId
    }, 'Log files API error');
    res.status(500).json({ success: false, error: 'Log fájlok betöltése sikertelen' });
  }
});

// Log fájl tartalmának lekérése API endpoint
router.get('/logs/content/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const { level, search } = req.query;
    const logPath = path.join(process.cwd(), 'logs', filename);

    // Biztonsági ellenőrzés - csak a logs mappából
    const normalizedPath = path.normalize(logPath);
    const logsDir = path.join(process.cwd(), 'logs');

    if (!normalizedPath.startsWith(logsDir)) {
      return res.status(403).json({ success: false, error: MSG_ACCESS_DENIED });
    }

    const content = await fs.readFile(logPath, 'utf8');

    // JSON log parsing and filtering
    if (filename.endsWith('.log')) {
      const lines = content.split('\n').filter((line) => line.trim());
      const processedEntries = logService.filterLogLines(lines, level, search);

      // Return as structured data for better frontend rendering
      return res.json({ success: true, entries: processedEntries, isStructured: true });
    }

    // For non-.log files, return as plain text
    res.json({ success: true, content, isStructured: false });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      filename: req.params.filename
    }, 'Log content API error');
    res.status(404).json({ success: false, error: MSG_LOG_NOT_FOUND });
  }
});

// Konkrét log fájl tartalmának lekérése (legacy endpoint)
router.get('/logs/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const logPath = path.join(process.cwd(), 'logs', filename);

    // Biztonsági ellenőrzés - csak a logs mappából
    const normalizedPath = path.normalize(logPath);
    const logsDir = path.join(process.cwd(), 'logs');

    if (!normalizedPath.startsWith(logsDir)) {
      return res.status(403).json({ error: MSG_ACCESS_DENIED });
    }

    const content = await fs.readFile(logPath, 'utf8');
    res.json({ content });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      filename: req.params.filename
    }, 'Log file read error');
    res.status(404).json({ error: MSG_LOG_NOT_FOUND });
  }
});

// Manual log cleanup endpoint
router.post('/logs/cleanup', requireAdmin, async (req, res) => {
  try {
    const { cleanupOldLogs } = require('../services/cronService');

    await cleanupOldLogs();

    res.json({
      success: true,
      message: 'Régi log fájlok sikeresen törölve!'
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId
    }, 'Log cleanup error');
    res.status(500).json({
      success: false,
      error: `Log fájlok törlése sikertelen: ${error.message}`
    });
  }
});

// Delete individual log file endpoint
router.delete('/logs/delete/:filename', requireAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const logPath = path.join(process.cwd(), 'logs', filename);

    // Biztonsági ellenőrzés - csak a logs mappából
    const normalizedPath = path.normalize(logPath);
    const logsDir = path.join(process.cwd(), 'logs');

    if (!normalizedPath.startsWith(logsDir)) {
      return res.status(403).json({
        success: false,
        error: MSG_ACCESS_DENIED
      });
    }

    // Ellenőrizzük, hogy létezik-e a fájl
    try {
      await fs.access(logPath);
    } catch {
      return res.status(404).json({
        success: false,
        error: MSG_LOG_NOT_FOUND
      });
    }

    // Fájl törlése
    await fs.unlink(logPath);

    res.json({
      success: true,
      message: `Log fájl (${filename}) sikeresen törölve!`
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      filename: req.params.filename
    }, 'Log file delete error');
    res.status(500).json({
      success: false,
      error: `Log fájl törlése sikertelen: ${error.message}`
    });
  }
});

// Update log settings endpoint
router.post('/logs/settings', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const { retentionDays } = req.body;

    // Validáció - csak retentionDays módosítható UI-ról
    if (!retentionDays || isNaN(retentionDays) || retentionDays < 1) {
      return res.status(400).json({
        success: false,
        error: 'A megőrzési idő legalább 1 nap kell legyen'
      });
    }

    if (retentionDays > 365) {
      return res.status(400).json({
        success: false,
        error: 'A megőrzési idő maximum 365 nap lehet'
      });
    }

    // Csak a megőrzési idő mentése
    // A rotáció és méret beállítások a .env fájlból jönnek (industry standard)
    await Setting.set('logs.retention.days', retentionDays, 'number', 'logs');

    res.json({
      success: true,
      message: 'Megőrzési idő sikeresen frissítve!'
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      settings: req.body
    }, 'Log settings update error');
    res.status(500).json({
      success: false,
      error: `Beállítások mentése sikertelen: ${error.message}`
    });
  }
});

// Settings management
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Get all settings organized by category
    const allSettings = await Setting.findAll({
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    // Group settings by category
    const settingsByCategory = {};
    const flatSettings = {};

    allSettings.forEach((setting) => {
      // For grouped display
      if (!settingsByCategory[setting.category]) {
        settingsByCategory[setting.category] = [];
      }
      settingsByCategory[setting.category].push({
        key: setting.key,
        value: setting.value, // Always show actual value (no masking)
        actualValue: setting.value,
        type: setting.type,
        description: setting.description,
        id: setting.id
      });

      // For flat access in template
      flatSettings[setting.key] = setting.value;
    });

    res.render('admin/settings', {
      layout: LAYOUT_ADMIN,
      title: 'Admin Settings',
      settingsByCategory,
      flatSettings,
      categories: Object.keys(settingsByCategory),
      csrfToken: res.locals.csrfToken || req.session.csrfToken || ''
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      path: req.path
    }, 'Settings page error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Beállítások betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// Update settings
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const result = await updateSettings(req.body);
    res.json(result);
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      settingsKeys: Object.keys(req.body)
    }, 'Settings update error');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload company logo
router.post('/settings/upload-logo', requireAdmin, logoUpload.single('companyLogo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nincs feltöltött fájl'
      });
    }

    const { Setting } = require('../models');
    const logoPath = `/uploads/company/${req.file.filename}`;

    // Mentjük a settings-be
    await Setting.set(SETTING_KEY_COMPANY_LOGO, logoPath, 'string', 'general', 'Company logo path');

    // Töröljük a régi logót (ha van)
    const oldLogoSetting = await Setting.findOne({ where: { key: SETTING_KEY_COMPANY_LOGO } });
    if (oldLogoSetting && oldLogoSetting.value && oldLogoSetting.value !== logoPath) {
      const oldLogoFilePath = path.join(process.cwd(), 'public', oldLogoSetting.value);
      try {
        await fs.unlink(oldLogoFilePath);
      } catch (unlinkError) {
        // Régi fájl törlése nem kritikus
        logger.warn({
          err: unlinkError,
          oldFilePath: oldLogoFilePath
        }, 'Old logo file deletion failed');
      }
    }

    res.json({
      success: true,
      message: 'Céglogó sikeresen feltöltve',
      logoPath
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      filename: req.file?.filename
    }, 'Logo upload error');

    // Töröljük a feltöltött fájlt hiba esetén
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error({
          err: unlinkError,
          filePath: req.file.path
        }, 'Failed to delete uploaded file');
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Logo feltöltése sikertelen'
    });
  }
});

// Delete company logo
router.delete('/settings/delete-logo', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const logoSetting = await Setting.findOne({ where: { key: SETTING_KEY_COMPANY_LOGO } });

    if (!logoSetting || !logoSetting.value) {
      return res.json({
        success: true,
        message: 'Nincs törölhető logó'
      });
    }

    const logoFilePath = path.join(process.cwd(), 'public', logoSetting.value);

    // Töröljük a fájlt
    try {
      await fs.unlink(logoFilePath);
    } catch (unlinkError) {
      logger.warn({
        err: unlinkError,
        filePath: logoFilePath
      }, 'Logo file deletion failed');
    }

    // Töröljük a beállítást
    await logoSetting.update({ value: '' });

    res.json({
      success: true,
      message: 'Céglogó sikeresen törölve'
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId
    }, 'Logo delete error');
    res.status(500).json({
      success: false,
      message: 'Logo törlése sikertelen'
    });
  }
});

// Upload OG Image (Phase 2)
router.post('/settings/upload-og-image', requireAdmin, ogImageUpload.single('ogImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nincs feltöltött fájl'
      });
    }

    const { Setting } = require('../models');
    const ogImagePath = `/images/${req.file.filename}`;

    // Töröljük a régi OG Image-t (ha van és nem default)
    const oldOgImageSetting = await Setting.findOne({ where: { key: SETTING_KEY_DEFAULT_OG_IMAGE } });
    if (oldOgImageSetting && oldOgImageSetting.value && oldOgImageSetting.value !== DEFAULT_OG_IMAGE_PATH) {
      const oldFilePath = path.join(process.cwd(), 'public', oldOgImageSetting.value);
      try {
        await fs.unlink(oldFilePath);
        logger.info({ oldFilePath }, 'Old OG Image deleted');
      } catch (unlinkError) {
        logger.warn({
          err: unlinkError,
          oldFilePath
        }, 'Old OG Image deletion failed');
      }
    }

    // Mentjük az új OG Image path-t
    await Setting.set(SETTING_KEY_DEFAULT_OG_IMAGE, ogImagePath, 'string', 'seo', 'Default Open Graph Image path');

    res.json({
      success: true,
      message: 'OG Image sikeresen feltöltve',
      ogImagePath
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      filename: req.file?.filename
    }, 'OG Image upload error');

    // Töröljük a feltöltött fájlt hiba esetén
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error({
          err: unlinkError,
          filePath: req.file.path
        }, 'Failed to delete uploaded OG Image');
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'OG Image feltöltése sikertelen'
    });
  }
});

// Delete OG Image (Phase 2)
router.delete('/settings/delete-og-image', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const ogImageSetting = await Setting.findOne({ where: { key: SETTING_KEY_DEFAULT_OG_IMAGE } });

    if (!ogImageSetting || !ogImageSetting.value || ogImageSetting.value === DEFAULT_OG_IMAGE_PATH) {
      return res.json({
        success: true,
        message: 'Nincs törölhető OG Image (default megtartva)'
      });
    }

    const ogImageFilePath = path.join(process.cwd(), 'public', ogImageSetting.value);

    // Töröljük a fájlt
    try {
      await fs.unlink(ogImageFilePath);
      logger.info({ ogImageFilePath }, 'OG Image deleted');
    } catch (unlinkError) {
      logger.warn({
        err: unlinkError,
        filePath: ogImageFilePath
      }, 'OG Image file deletion failed');
    }

    // Visszaállítjuk a default értékre
    await ogImageSetting.update({ value: DEFAULT_OG_IMAGE_PATH });

    res.json({
      success: true,
      message: 'OG Image sikeresen törölve (default visszaállítva)'
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId
    }, 'OG Image delete error');
    res.status(500).json({
      success: false,
      message: 'OG Image törlése sikertelen'
    });
  }
});

// Helper: Check if value should be skipped (masked password)
function shouldSkipValue(setting, value) {
  return setting && setting.type === 'encrypted' && value === '••••••••';
}

// Helper: Get category from key
function getCategoryFromKey(key) {
  return key.includes('.') ? key.split('.')[0] : 'general';
}

// Helper: Update or create single setting
async function updateOrCreateSetting(key, value) {
  const { Setting } = require('../models');

  const setting = await Setting.findOne({ where: { key } });

  if (setting) {
    if (shouldSkipValue(setting, value)) {
      return false; // Skip, don't count as updated
    }
    await setting.update({ value });
    return true;
  }

  // Create new setting
  const category = getCategoryFromKey(key);
  await Setting.set(key, value, 'string', category, `${key} beállítás`);
  return true;
}

// Helper function for updating settings
async function updateSettings(body) {
  const { settings } = body;

  if (!settings || typeof settings !== 'object') {
    throw new Error('Érvénytelen beállítások formátum');
  }

  // mongoSanitize middleware replaces dots with underscores
  // Normalize keys back to dot notation (category.key format)
  const normalizedSettings = normalizeSettingsKeys(settings);

  let updatedCount = 0;
  const errors = [];

  for (const [key, value] of Object.entries(normalizedSettings)) {
    try {
      const wasUpdated = await updateOrCreateSetting(key, value);
      if (wasUpdated) {
        updatedCount += 1;
      }
    } catch (settingError) {
      errors.push(`${key}: ${settingError.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Néhány beállítás frissítése sikertelen: ${errors.join(', ')}`);
  }

  return {
    success: true,
    message: `${updatedCount} beállítás sikeresen frissítve`
  };
}

// Update settings by section
router.post('/settings/section/:section', requireAdmin, async (req, res) => {
  try {
    const result = await updateSettings(req.body);
    res.json(result);
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      section: req.params.section,
      settingsKeys: Object.keys(req.body)
    }, 'Settings section update error');
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Test configuration endpoints
router.post('/settings/test/vtiger', requireAdmin, async (req, res) => {
  try {
    const { VTigerService } = require('../services/vtigerService');
    const vtigerService = new VTigerService();

    const isAuthenticated = await vtigerService.authenticate();

    res.json({
      success: isAuthenticated,
      message: isAuthenticated ? 'vTiger kapcsolat sikeres' : 'vTiger kapcsolat sikertelen'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/settings/test/geonames', requireAdmin, async (req, res) => {
  try {
    const GeoNamesLocationSyncService = require('../services/geoNamesLocationSyncService');
    const geoNamesService = new GeoNamesLocationSyncService();

    const testResult = await geoNamesService.testConnection();

    res.json({
      success: testResult.success,
      message: testResult.message || 'GeoNames teszt befejezve'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test email configuration
router.post('/settings/test-email', requireAdmin, async (req, res) => {
  try {
    const adminEmailService = require('../services/adminEmailService');
    const { Setting } = require('../models');

    // Get the from email from settings
    const fromEmailSetting = await Setting.findOne({ where: { key: 'email.from_email' } });
    const fromEmail = fromEmailSetting?.value || 'noreply@koncert24.hu';

    // Send test email to the logged-in admin
    const testResult = await adminEmailService.sendAdminTestEmail(
      req.user.email,
      {
        fromEmail,
        subject: 'Email Konfiguráció Teszt',
        message: 'Ez egy teszt email. Ha látod ezt az üzenetet, az email konfiguráció működik!'
      }
    );

    res.json({
      success: testResult.success || testResult.sent,
      message: testResult.success || testResult.sent
        ? `✅ Teszt email elküldve a következő címre: ${req.user.email}`
        : `❌ Email küldési hiba: ${testResult.error || 'Ismeretlen hiba'}`
    });
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      recipientEmail: req.user?.email
    }, 'Test email error');
    res.status(500).json({
      success: false,
      message: `❌ Hiba: ${error.message}`
    });
  }
});

// Helper function for email tests
async function sendEmailTests(adminEmail, bookingEmail, Setting) {
  const results = [];
  const adminEmailService = require('../services/adminEmailService');

  // Send test email to admin email if configured
  if (adminEmail) {
    try {
      const result = await adminEmailService.sendAdminTestEmail(
        adminEmail,
        await Setting.get('general.site_name'),
        await Setting.get('company.name')
      );

      if (result.success) {
        results.push(`✅ ${MSG_ADMIN_EMAIL_TEST} sikeres: ${adminEmail}`);
      } else {
        results.push(`❌ ${MSG_ADMIN_EMAIL_TEST} hiba (${adminEmail}): ${result.error || MSG_UNKNOWN_ERROR}`);
      }
    } catch (error) {
      results.push(`❌ ${MSG_ADMIN_EMAIL_TEST} hiba (${adminEmail}): ${error.message}`);
    }
  }

  return await processBookingEmailTest(bookingEmail, adminEmail, Setting, results);
}

// Helper function for booking email test
async function processBookingEmailTest(bookingEmail, adminEmail, Setting, results) {
  const bookingEmailService = require('../services/bookingEmailService');

  // Send test email to booking email if configured and different from admin
  if (bookingEmail && bookingEmail !== adminEmail) {
    try {
      const result = await bookingEmailService.sendBookingTestEmail(
        bookingEmail,
        await Setting.get('general.site_name'),
        await Setting.get('company.name')
      );

      if (result.success) {
        results.push(`✅ Booking email teszt sikeres: ${bookingEmail}`);
      } else {
        results.push(`❌ Booking email teszt hiba (${bookingEmail}): ${result.error || MSG_UNKNOWN_ERROR}`);
      }
    } catch (error) {
      results.push(`❌ Booking email teszt hiba (${bookingEmail}): ${error.message}`);
    }
  }

  return results;
}

router.post('/settings/test/email', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Get both admin and booking emails for test
    const adminEmail = await Setting.get('email.admin');
    const bookingEmail = await Setting.get('email.booking');

    if (!adminEmail && !bookingEmail) {
      throw new Error('Sem admin email, sem booking email nincs beállítva. Állítsd be legalább az egyiket!');
    }

    const results = await sendEmailTests(adminEmail, bookingEmail, Setting);

    logger.info(
      { service: 'admin', operation: 'testEmail', testsRun: results.length },
      'Email tests completed'
    );

    res.json({
      success: true,
      message: results.join('<br>')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/settings/test/elastic_email', requireAdmin, async (req, res) => {
  try {
    // Test Elastic Email API key with real API call
    const { Setting } = require('../models');
    const apiKey = await Setting.get('elastic_email.api_key');

    if (!apiKey) {
      throw new Error('Elastic Email API kulcs nincs beállítva');
    }

    if (apiKey.length < 10) {
      throw new Error('Érvénytelen API kulcs formátum (túl rövid)');
    }

    // Test with real API call to Elastic Email - use account info endpoint
    const https = require('https');

    const options = {
      hostname: 'api.elasticemail.com',
      port: 443,
      path: `/v2/account/load?apikey=${encodeURIComponent(apiKey)}`,
      method: 'GET'
    };

    const testResult = await new Promise((resolve, reject) => {
      const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => {
          data += chunk;
        });
        apiRes.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (parseError) {
            reject(new Error(`API válasz parse hiba: ${parseError.message}`));
          }
        });
      });

      apiReq.on('error', (error) => {
        reject(new Error(`API kérés hiba: ${error.message}`));
      });

      apiReq.end();
    });

    // Check if the API key is valid
    if (testResult.success === false) {
      throw new Error(`Érvénytelen API kulcs: ${testResult.error || MSG_UNKNOWN_ERROR}`);
    }

    res.json({
      success: true,
      message: 'Elastic Email API kulcs érvényes és működik'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


module.exports = router;
