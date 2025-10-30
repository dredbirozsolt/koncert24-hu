/**
 * Admin Security Log Viewer
 * Biztonsági események megtekintése és szűrése
 *
 * @route GET  /admin/security-log
 * @route POST /admin/security-log/clear-old
 */

const express = require('express');

const logger = require('../config/logger');
const router = express.Router();
const { SecurityLog } = require('../models');
const { Op } = require('sequelize');

// Event type labels (globális konstans)
/* eslint-disable camelcase */
const EVENT_TYPE_LABELS = {
  login_success: 'Sikeres bejelentkezés',
  login_failed: 'Sikertelen bejelentkezés',
  login_locked: 'Zárolt bejelentkezés',
  logout: 'Kijelentkezés',
  password_reset_request: 'Jelszó visszaállítás kérés',
  password_reset_success: 'Jelszó visszaállítás sikeres',
  password_changed: 'Jelszó megváltoztatva',
  email_changed: 'Email megváltoztatva',
  csrf_violation: 'CSRF védelem megsértése',
  xss_attempt: 'XSS támadási kísérlet',
  sql_injection_attempt: 'SQL injection kísérlet',
  rate_limit_exceeded: 'Túl sok kérés',
  account_locked: 'Fiók zárolva',
  account_unlocked: 'Fiók feloldva'
};
/* eslint-enable camelcase */

// Helper: Build where clause from filters
function buildWhereClause(filters) {
  const where = {};
  const { severity, eventType, searchIp, startDate, endDate } = filters;

  if (severity !== 'all') {
    where.severity = severity;
  }

  if (eventType !== 'all') {
    where.eventType = eventType;
  }

  if (searchIp) {
    where.ipAddress = {
      [Op.like]: `%${searchIp}%`
    };
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt[Op.gte] = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt[Op.lte] = end;
    }
  }

  return where;
}

// Helper: Calculate pagination details
function calculatePagination(page, limit, totalCount) {
  const totalPages = Math.ceil(totalCount / limit);
  const offset = (page - 1) * limit;

  return {
    totalPages,
    offset,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
}

// Helper: Gather statistics
async function gatherStatistics() {
  const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

  return {
    total: await SecurityLog.count(),
    critical: await SecurityLog.count({ where: { severity: 'critical' } }),
    high: await SecurityLog.count({ where: { severity: 'high' } }),
    medium: await SecurityLog.count({ where: { severity: 'medium' } }),
    low: await SecurityLog.count({ where: { severity: 'low' } }),
    last24h: await SecurityLog.count({
      where: {
        createdAt: {
          [Op.gte]: oneDayAgo
        }
      }
    }),
    // Event type specific stats
    accountLocked: await SecurityLog.count({ where: { eventType: 'account_locked' } }),
    sqlInjection: await SecurityLog.count({ where: { eventType: 'sql_injection_attempt' } }),
    xss: await SecurityLog.count({ where: { eventType: 'xss_attempt' } }),
    rateLimit: await SecurityLog.count({ where: { eventType: 'rate_limit_exceeded' } }),
    botDetected: await SecurityLog.count({ where: { eventType: 'suspicious_bot_detected' } })
  };
}

/**
 * Security Log Viewer Page
 * Táblázatos nézet szűrési lehetőségekkel
 */
router.get('/', async (req, res) => {
  try {
    // Query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const severity = req.query.severity || 'all';
    const eventType = req.query.eventType || 'all';
    const searchIp = req.query.searchIp || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    // Build where clause
    const where = buildWhereClause({ severity, eventType, searchIp, startDate, endDate });

    // Count total
    const totalCount = await SecurityLog.count({ where });

    // Calculate pagination
    const { totalPages, offset } = calculatePagination(page, limit, totalCount);

    // Fetch logs
    const logs = await SecurityLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'eventType', 'severity', 'ipAddress', 'userAgent', 'userId', 'details', 'createdAt']
    });

    // Get unique event types for filter
    const eventTypes = await SecurityLog.findAll({
      attributes: [[SecurityLog.sequelize.fn('DISTINCT', SecurityLog.sequelize.col('eventType')), 'eventType']],
      raw: true
    });

    // Statistics
    const stats = await gatherStatistics();

    logger.debug(
      {
        service: 'adminSecurityLog',
        logsCount: logs.length,
        totalPages,
        totalCount,
        filters: { severity, eventType, searchIp }
      },
      'Rendering security log page'
    );

    res.render('admin/security-log', {
      layout: 'layouts/admin',
      title: 'Biztonsági Logok',
      currentPath: req.path,
      messages: req.session.messages || {},
      basePath: res.locals.basePath || '/',
      isAdmin: req.user?.role === 'admin',
      logs,
      pagination: {
        page,
        limit,
        totalPages,
        total: totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        severity,
        eventType,
        searchIp,
        startDate,
        endDate
      },
      eventTypes: eventTypes.map((e) => e.eventType).sort(),
      eventTypeLabels: EVENT_TYPE_LABELS,
      stats
    });

    // Clear messages after rendering
    req.session.messages = {};
  } catch (error) {
    logger.error(
      {
        err: error,
        service: 'adminSecurityLog',
        operation: 'viewLogs',
        sql: error.sql
      },
      'SecurityLog viewer error'
    );

    // Admin error page (not using layout.ejs)
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="hu">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hiba - Biztonsági Logok</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                 margin: 0; padding: 20px; background: #f5f5f5; }
          .error-container { max-width: 600px; margin: 50px auto; background: white; padding: 40px;
                             border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #e74c3c; margin-top: 0; }
          .error-details { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;
                           font-family: monospace; font-size: 12px; overflow-x: auto; }
          .btn { display: inline-block; padding: 10px 20px; background: #3498db; color: white;
                 text-decoration: none; border-radius: 4px; margin-right: 10px; }
          .btn:hover { background: #2980b9; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>⚠️ Hiba történt</h1>
          <p>A biztonsági logok betöltése során hiba történt.</p>
          ${process.env.NODE_ENV === 'development' ? `
          <div class="error-details">
            <strong>Hiba típusa:</strong> ${error.name}<br>
            <strong>Üzenet:</strong> ${error.message}<br>
            ${error.sql ? `<strong>SQL:</strong> ${error.sql}<br>` : ''}
          </div>
          ` : ''}
          <a href="/admin" class="btn">← Vissza az admin felületre</a>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * Security Log Data API (AJAX)
 * Returns logs as JSON for dynamic filtering
 */
router.get('/data', async (req, res) => {
  try {
    // Query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const severity = req.query.severity || 'all';
    const eventType = req.query.eventType || 'all';
    const searchIp = req.query.searchIp || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    // Build where clause
    const where = buildWhereClause({ severity, eventType, searchIp, startDate, endDate });

    // Count total
    const totalCount = await SecurityLog.count({ where });

    // Calculate pagination
    const { totalPages, offset } = calculatePagination(page, limit, totalCount);

    // Fetch logs
    const logs = await SecurityLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      attributes: ['id', 'eventType', 'severity', 'ipAddress', 'userAgent', 'userId', 'details', 'createdAt']
    });

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        totalPages,
        total: totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminSecurityLog', operation: 'dataAPI' }, 'SecurityLog data API error');
    res.status(500).json({
      success: false,
      message: 'Hiba történt az adatok betöltése során'
    });
  }
});

/**
 * Delete Old Logs
 * Törli a régi biztonsági logokat
 */
router.post('/clear-old', async (req, res) => {
  try {
    // Check admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).send('Nincs jogosultságod ehhez a művelethez');
    }

    const days = parseInt(req.body.days) || 90;
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    // Delete old logs
    const deleted = await SecurityLog.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate
        },
        severity: {
          [Op.ne]: 'critical' // Ne töröljük a kritikus eseményeket
        }
      }
    });

    res.redirect(`/admin/security-log?deleted=${deleted}&days=${days}`);
  } catch (error) {
    logger.error(
      { err: error, service: 'adminSecurityLog', operation: 'clearOld', days: req.body.days },
      'SecurityLog clear error'
    );
    res.redirect('/admin/security-log?error=clear_failed');
  }
});

/**
 * Get Single Security Log Details
 * API endpoint a részletek modal betöltéséhez
 */
router.get('/:id', async (req, res) => {
  try {
    const log = await SecurityLog.findByPk(req.params.id);

    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    res.json({ success: true, log });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminSecurityLog', operation: 'getDetails', logId: req.params.id },
      'SecurityLog details error'
    );
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
