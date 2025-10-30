const logger = require('../config/logger');
const emailService = require('./emailService');
const nodemailer = require('nodemailer');
const { sequelize } = require('../models');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execPromise = promisify(exec);

// CRITICAL: Fallback SMTP config from environment variables
// Used ONLY when database is down and normal emailService cannot load config
const CRITICAL_SMTP_CONFIG = {
  host: process.env.EMAIL_HOST || 'smtp.elasticemail.com',
  port: parseInt(process.env.EMAIL_PORT) || 2525,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
};

/**
 * Infrastructure Alert Service
 * Monitors critical infrastructure: Database, Disk Space, Critical Errors
 *
 * Features:
 * - Database connection monitoring (every 5 minutes)
 * - Disk space monitoring (daily + on-demand)
 * - Uncaught exception / critical error alerts
 * - Rate limiting: Max 5 alerts/hour (spam protection)
 */

// Rate limiting
const alertHistory = [];
const MAX_ALERTS_PER_HOUR = 5;

/**
 * Check if we can send alert (rate limit)
 */
function canSendAlert() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const recentAlerts = alertHistory.filter((ts) => ts > oneHourAgo);
  alertHistory.length = 0;
  alertHistory.push(...recentAlerts);

  return alertHistory.length < MAX_ALERTS_PER_HOUR;
}

/**
 * Record alert sent
 */
function recordAlert() {
  alertHistory.push(Date.now());
}

/**
 * Send critical alert email using direct SMTP (bypasses emailService)
 * Used ONLY when database is down and emailService.loadConfig() would fail
 * @param {string[]} recipients - Array of email addresses
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 * @param {string} text - Plain text email body
 * @returns {Promise<void>}
 */
async function sendCriticalEmail(recipients, subject, html, text) {
  if (!CRITICAL_SMTP_CONFIG.auth.user || !CRITICAL_SMTP_CONFIG.auth.pass) {
    logger.error({
      service: 'infrastructureAlert',
      operation: 'sendCriticalEmail'
    }, 'CRITICAL: SMTP credentials missing in .env - cannot send critical alerts!');
    return;
  }

  try {
    const transporter = nodemailer.createTransport(CRITICAL_SMTP_CONFIG);

    const mailOptions = {
      from: `"koncert24.hu Alert" <${CRITICAL_SMTP_CONFIG.auth.user}>`,
      to: recipients.join(', '),
      subject,
      html,
      text
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info({
      service: 'infrastructureAlert',
      operation: 'sendCriticalEmail',
      messageId: info.messageId,
      recipients: recipients.length
    }, 'Critical alert email sent via direct SMTP');
  } catch (error) {
    logger.error({
      err: error,
      service: 'infrastructureAlert',
      operation: 'sendCriticalEmail'
    }, 'Failed to send critical alert email');
    throw error;
  }
}

/**
 * Get admin emails from Settings
 */
async function getAdminEmails() {
  try {
    const { Setting } = require('../models');
    const setting = await Setting.findOne({
      where: { key: 'admin_security_email' }
    });

    if (setting && setting.value) {
      return setting.value.split(',').map((e) => e.trim()).filter((e) => e);
    }

    // Fallback: try email.admin
    const fallback = await Setting.findOne({
      where: { key: 'email.admin' }
    });

    if (fallback && fallback.value) {
      return [fallback.value.trim()];
    }

    // Last resort: env variable
    if (process.env.ADMIN_EMAIL) {
      return [process.env.ADMIN_EMAIL];
    }

    return [];
  } catch (error) {
    const logContext = { err: error, service: 'infrastructureAlert', operation: 'getAdminEmails' };
    logger.error(logContext, 'Failed to get admin emails');

    // CRITICAL: If database is down, fall back to environment variable
    // This ensures we can still send alerts even when DB is unavailable
    if (process.env.ADMIN_EMAIL) {
      logger.warn({ service: 'infrastructureAlert' }, 'Using ADMIN_EMAIL from environment (DB unavailable)');
      return [process.env.ADMIN_EMAIL];
    }

    return [];
  }
}

/**
 * 1. DATABASE HEALTH CHECK
 */
async function checkDatabaseHealth() {
  try {
    await sequelize.authenticate();
    logger.debug({ service: 'infrastructureAlert' }, 'Database health check passed');
    return { healthy: true, timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error({ err: error, service: 'infrastructureAlert' }, 'Database health check FAILED');

    // Send alert
    if (canSendAlert()) {
      await alertDatabaseDown(error);
      recordAlert();
    }

    return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
  }
}

async function alertDatabaseDown(error) {
  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn({ service: 'infrastructureAlert' }, 'No admin emails configured for infrastructure alerts');
    return;
  }

  const subject = '🔴 [CRITICAL] Database Connection Lost!';
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #d32f2f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">🔴 KRITIKUS HIBA</h1>
    <p style="margin: 10px 0 0 0; font-size: 18px;">Database Kapcsolat Megszakadt</p>
  </div>
  
  <div style="background: #f5f5f5; padding: 20px;">
    <div style="background: #ffebee; padding: 20px; border-left: 4px solid #d32f2f; margin-bottom: 20px;">
      <h2 style="margin: 0 0 10px 0; color: #d32f2f; font-size: 18px;">
        ⚠️ AZONNALI BEAVATKOZÁS SZÜKSÉGES!
      </h2>
      <p style="margin: 0; color: #721c24;">
        Az alkalmazás jelenleg működésképtelen. Minden kérés 500 hibát fog dobni.
      </p>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #333; font-size: 16px;">📋 Hiba Részletei</h3>
      <ul style="color: #666; line-height: 1.6;">
        <li><strong>Időpont:</strong> ${new Date().toLocaleString('hu-HU')}</li>
        <li><strong>Szerver:</strong> ${os.hostname()}</li>
        <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
        <li><strong>Hiba:</strong> ${error.message}</li>
      </ul>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #856404; font-size: 16px;">🔍 Lehetséges Okok</h3>
      <ul style="margin: 0; color: #856404; line-height: 1.6;">
        <li>Database szerver leállt vagy elérhetetlen</li>
        <li>Network/firewall probléma</li>
        <li>Túl sok connection (pool exhausted)</li>
        <li>Authentication hiba (jelszó változott?)</li>
        <li>Max connections limit elérve</li>
      </ul>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #333; font-size: 16px;">🔧 Teendők (Prioritás szerint)</h3>
      <ol style="color: #666; line-height: 1.8;">
        <li>
          <strong>Ellenőrizd a database szerver státuszát</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            systemctl status postgresql
          </code> (vagy Docker)
        </li>
        <li><strong>Check logs:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">tail -f logs/app-*.log</code>
        </li>
        <li>
          <strong>Teszteld a connection-t:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            psql -h localhost -U koncert24_user -d koncert24_db
          </code>
        </li>
        <li><strong>Restart app (ha szükséges):</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">pm2 restart koncert24</code>
        </li>
      </ol>
    </div>
    
    <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0; color: #1565c0; font-size: 14px;">
        ℹ️ <strong>Info:</strong> Ez az alert automatikusan kiküldésre került
        az infrastruktúra monitoring rendszer által.
        További hibák esetén max. 5 email/óra kerül küldésre (spam védelem).
      </p>
    </div>
  </div>
  
  <div style="background: #263238; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; font-size: 12px;">
      🏥 Infrastructure Alert System | Koncert24.hu
    </p>
  </div>
</div>
  `;

  const text = `
CRITICAL: Database Connection Lost!

Időpont: ${new Date().toISOString()}
Szerver: ${os.hostname()}
Environment: ${process.env.NODE_ENV || 'development'}
Hiba: ${error.message}

AZONNALI BEAVATKOZÁS SZÜKSÉGES!
Az alkalmazás jelenleg működésképtelen.

Teendők:
1. Check database szerver: systemctl status postgresql
2. Check logs: tail -f logs/app-*.log
3. Test connection: psql -h localhost -U koncert24_user
4. Restart app: pm2 restart koncert24
  `;

  try {
    // CRITICAL: Use direct SMTP instead of emailService
    // emailService.loadConfig() would fail because it needs database access!
    await sendCriticalEmail(adminEmails, subject, html, text);
    logger.info(
      { service: 'infrastructureAlert', adminCount: adminEmails.length },
      'Database down alert sent via direct SMTP (emailService bypassed)'
    );
  } catch (err) {
    logger.error({ err, service: 'infrastructureAlert' }, 'Failed to send database alert');
  }
}

/**
 * 2. DISK SPACE CHECK
 */
async function checkDiskSpace() {
  try {
    // Run df -h command to get disk usage
    const { stdout } = await execPromise("df -h / | tail -1 | awk '{print $5}'");
    const usageStr = stdout.trim().replace('%', '');
    const usage = parseInt(usageStr, 10);

    logger.debug({ service: 'infrastructureAlert', usage }, 'Disk space check completed');

    if (usage >= 90) {
      logger.warn({ service: 'infrastructureAlert', usage }, 'Disk space CRITICAL');

      if (canSendAlert()) {
        await alertDiskSpaceCritical(usage);
        recordAlert();
      }

      return { healthy: false, usage, timestamp: new Date().toISOString() };
    }

    return { healthy: true, usage, timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error({ err: error, service: 'infrastructureAlert' }, 'Disk space check failed');
    return { healthy: false, error: error.message, timestamp: new Date().toISOString() };
  }
}

async function alertDiskSpaceCritical(usage) {
  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    logger.warn({ service: 'infrastructureAlert' }, 'No admin emails for disk space alert');
    return;
  }

  const subject = `🟠 [HIGH] Disk Space Critical (${usage}%)`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #f57c00; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">⚠️ DISK SPACE FIGYELMEZTETÉS</h1>
    <p style="margin: 10px 0 0 0; font-size: 18px;">Kevés a szabad hely!</p>
  </div>
  
  <div style="background: #f5f5f5; padding: 20px;">
    <div style="background: white; padding: 20px; border-radius: 4px; margin: 15px 0; text-align: center;">
      <h2 style="margin: 0 0 20px 0; color: #f57c00; font-size: 18px;">📊 Disk Használat</h2>
      <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe0b2 100%); padding: 30px; border-radius: 8px;">
        <div style="font-size: 64px; font-weight: bold; color: #f57c00; line-height: 1;">${usage}%</div>
        <div style="font-size: 16px; color: #666; margin-top: 15px; font-weight: 500;">
          Threshold: 90% | Limit: 95%
        </div>
        <div style="width: 100%; background: #e0e0e0; height: 20px; border-radius: 10px;
          margin-top: 20px; overflow: hidden;">
          <div style="width: ${usage}%; background: ${usage >= 95 ? '#d32f2f' : '#f57c00'};
            height: 100%; transition: width 0.3s;"></div>
        </div>
      </div>
    </div>
    
    <div style="background: #ffebee; padding: 15px; border-left: 4px solid #d32f2f; margin: 15px 0;">
      <p style="margin: 0; color: #c62828; font-weight: bold;">
        ⚠️ Ha 95% felett → App crash és data loss veszély!
      </p>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #333; font-size: 16px;">🔧 Azonnali Teendők</h3>
      <ol style="color: #666; line-height: 1.8;">
        <li><strong>Futtasd a log cleanup-ot:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">npm run cleanup:logs</code>
        </li>
        <li><strong>Check backup files méretét:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            du -sh backups/* | sort -hr
          </code>
        </li>
        <li><strong>Régi session files törlése:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            find sessions/ -mtime +7 -delete
          </code>
        </li>
        <li><strong>Legnagyobb könyvtárak:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            du -sh /* 2>/dev/null | sort -hr | head -10
          </code>
        </li>
        <li><strong>Node modules cache:</strong>
          <br><code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">npm cache clean --force</code>
        </li>
      </ol>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #856404; font-size: 16px;">💡 Hosszú Távú Megoldások</h3>
      <ul style="margin: 0; color: #856404; line-height: 1.6;">
        <li>Backup-ok áthelyezése külső storage-ra (S3, FTP)</li>
        <li>Log rotation policy optimalizálása (7 nap → 3 nap?)</li>
        <li>Disk space növelése (cloud resize, vagy új volume)</li>
        <li>Automated cleanup cron job gyakoriságának növelése</li>
      </ul>
    </div>
    
    <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0; color: #1565c0; font-size: 14px;">
        ℹ️ <strong>Info:</strong> Ez az alert automatikusan kiküldésre került
        amikor a disk használat elérte a ${usage}%-ot.
        További ellenőrzés 5 perc múlva.
      </p>
    </div>
  </div>
  
  <div style="background: #263238; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; font-size: 12px;">
      🏥 Infrastructure Alert System | Koncert24.hu
    </p>
  </div>
</div>
  `;

  const text = `
HIGH PRIORITY: Disk Space Critical!

Disk használat: ${usage}%
Threshold: 90%
Critical: 95%

Időpont: ${new Date().toISOString()}
Szerver: ${os.hostname()}

TEENDŐK:
1. Futtasd a log cleanup-ot: npm run cleanup:logs
2. Check backup files: du -sh backups/*
3. Régi session files: find sessions/ -mtime +7 -delete
4. Legnagyobb könyvtárak: du -sh /* | sort -hr | head -10

FIGYELEM: Ha 95% felett → App crash és data loss veszély!
  `;

  try {
    // Use emailService (database should be available for disk space alerts)
    const promises = adminEmails.map((email) =>
      emailService.sendEmail({ to: email, subject, html, text })
    );
    await Promise.all(promises);
    logger.info(
      { service: 'infrastructureAlert', usage },
      'Disk space critical alert sent'
    );
  } catch (err) {
    logger.error({ err, service: 'infrastructureAlert' }, 'Failed to send disk space alert');
  }
}

/**
 * 3. CRITICAL ERROR ALERT (Uncaught Exception, Unhandled Rejection, etc.)
 */
async function alertCriticalError(error, type = 'UNKNOWN_ERROR') {
  // Rate limit check
  if (!canSendAlert()) {
    logger.debug({ service: 'infrastructureAlert', type }, 'Critical error alert skipped (rate limit)');
    return;
  }

  const adminEmails = await getAdminEmails();
  if (adminEmails.length === 0) {
    logger.warn({ service: 'infrastructureAlert' }, 'No admin emails for critical error alert');
    return;
  }

  const errorStack = error.stack || error.toString();
  const shortStack = errorStack.split('\n').slice(0, 20).join('\n');

  const subject = `🔴 [CRITICAL] ${type} - App Unstable!`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #d32f2f; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">💥 KRITIKUS HIBA</h1>
    <p style="margin: 10px 0 0 0; font-size: 18px;">${type}</p>
  </div>
  
  <div style="background: #f5f5f5; padding: 20px;">
    <div style="background: #ffebee; padding: 20px; border-left: 4px solid #d32f2f; margin-bottom: 20px;">
      <p style="margin: 0; color: #c62828; font-weight: bold; font-size: 16px;">
        ⚠️ Az app automatikusan újraindult (PM2), de az oka ismeretlen!
      </p>
      <p style="margin: 10px 0 0 0; color: #721c24;">
        Check logs ASAP és vizsgáld meg a root cause-t!
      </p>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #d32f2f; font-size: 16px;">❌ Hiba Üzenet</h3>
      <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto;
        font-family: 'Courier New', monospace; font-size: 13px; color: #d32f2f; margin: 0;">
${error.message || 'Unknown error'}</pre>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #333; font-size: 16px;">📍 Stack Trace (első 20 sor)</h3>
      <pre style="background: #263238; color: #aed581; padding: 15px; border-radius: 4px;
        overflow-x: auto; font-family: 'Courier New', monospace; font-size: 11px;
        line-height: 1.4; margin: 0;">${shortStack}</pre>
    </div>
    
    <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #333; font-size: 16px;">📋 Környezeti Információk</h3>
      <ul style="color: #666; line-height: 1.6;">
        <li><strong>Időpont:</strong> ${new Date().toLocaleString('hu-HU')}</li>
        <li><strong>Szerver:</strong> ${os.hostname()}</li>
        <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</li>
        <li><strong>Node verzió:</strong> ${process.version}</li>
        <li><strong>Platform:</strong> ${os.platform()} ${os.arch()}</li>
        <li><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</li>
        <li>
          <strong>Memory:</strong>
          ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB /
          ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB
        </li>
      </ul>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
      <h3 style="margin-top: 0; color: #856404; font-size: 16px;">🔧 Teendők</h3>
      <ol style="margin: 0; color: #856404; line-height: 1.8;">
        <li>
          Nézd át a teljes log fájlt:
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            tail -f logs/app-*.log
          </code>
        </li>
        <li>
          Check PM2 logs:
          <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
            pm2 logs koncert24
          </code>
        </li>
        <li>Ellenőrizd a recent code changes-t (git log)</li>
        <li>Check database connection és external services</li>
        <li>Ha ismétlődik → Rollback to previous stable version</li>
      </ol>
    </div>
    
    <div style="background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 15px 0;">
      <p style="margin: 0; color: #1565c0; font-size: 14px;">
        ℹ️ <strong>Auto-Recovery:</strong> PM2 automatikusan újraindította az alkalmazást.
        Az app jelenleg FUT, de a probléma még nem oldódott meg!
      </p>
    </div>
  </div>
  
  <div style="background: #263238; color: white; padding: 15px; text-align: center; border-radius: 0 0 8px 8px;">
    <p style="margin: 0; font-size: 12px;">
      🏥 Infrastructure Alert System | Koncert24.hu
    </p>
  </div>
</div>
  `;

  const text = `
CRITICAL: ${type}

Az app összeomlott és automatikusan újraindult!

Error: ${error.message || 'Unknown error'}

Stack Trace:
${shortStack}

Időpont: ${new Date().toISOString()}
Szerver: ${os.hostname()}
Environment: ${process.env.NODE_ENV || 'development'}
Node: ${process.version}

TEENDŐK:
1. Check logs: tail -f logs/app-*.log
2. PM2 logs: pm2 logs koncert24
3. Recent code changes review
4. Database és external services check
5. Ha ismétlődik → Rollback

AUTO-RECOVERY: PM2 újraindította az app-ot, jelenleg FUT.
  `;

  try {
    // Use emailService (database likely available for critical errors)
    // If database is also down, the error will be logged but not sent
    const promises = adminEmails.map((email) =>
      emailService.sendEmail({ to: email, subject, html, text })
    );
    await Promise.all(promises);
    recordAlert();
    logger.info(
      { service: 'infrastructureAlert', type, adminCount: adminEmails.length },
      'Critical error alert sent'
    );
  } catch (err) {
    logger.error({ err, service: 'infrastructureAlert' }, 'Failed to send critical error alert');
  }
}

/**
 * HEALTH CHECK RUNNER (Called by cron job)
 * Runs all health checks and returns results
 */
async function runHealthChecks() {
  logger.info({ service: 'infrastructureAlert' }, 'Running infrastructure health checks...');

  const results = {
    database: await checkDatabaseHealth(),
    diskSpace: await checkDiskSpace(),
    timestamp: new Date().toISOString()
  };

  const allHealthy = results.database.healthy && results.diskSpace.healthy;

  logger.info(
    {
      service: 'infrastructureAlert',
      allHealthy,
      database: results.database.healthy,
      diskSpace: results.diskSpace.healthy,
      diskUsage: results.diskSpace.usage
    },
    'Infrastructure health check completed'
  );

  return results;
}

module.exports = {
  checkDatabaseHealth,
  checkDiskSpace,
  alertCriticalError,
  runHealthChecks,
  // For testing
  _canSendAlert: canSendAlert,
  _recordAlert: recordAlert,
  _getAdminEmails: getAdminEmails
};
