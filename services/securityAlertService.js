const logger = require('../config/logger');

/**
 * Security Alert Email Service
 * Kritikus biztonsági események automatikus email értesítései admin-oknak
 *
 * Features:
 * - Em<p><strong>Ákció szükséges:</strong> Ellenőrizd a user aktivitását és szükség esetén oldás fel manuálisan</p>
<hr>
<p>SecurityLog ID: #${event.id}</p>
<p><a href="${baseUrl}/admin/users">User Kezelés</a></p>
      `
    },

    file_validation_failed: {sítés krit<p><strong>Ákció:</strong> Fájl automatikusan elutasítva és törölve ✅</p>
<hr>
<p>SecurityLog ID: #${event.id}</p>
<p><a href="${baseUrl}/admin/security-log">Biztonsági Logok Megtekintése</a></p>
      `
    },

    bot_detection: {ményekről
 * - Rate limiting (max 10 email/óra spam védelem)
 * - Esemény típus alapú különböző template-ek
 * - Admin email címek Setting táblából
 */

const emailService = require('./emailService');
const emailTemplateService = require('./emailTemplateService');
const { Setting, SecurityLog } = require('../models');
const { Op } = require('sequelize');

// In-memory rate limiter
const emailSentTimestamps = [];
const MAX_EMAILS_PER_HOUR = 10;

/**
 * Ellenőrzi, hogy küldhetünk-e még emailt (rate limit)
 */
function canSendEmail() {
  const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));

  // Töröljük az 1 óránál régebbi timestamp-eket
  const recentEmails = emailSentTimestamps.filter((ts) => ts > oneHourAgo);
  emailSentTimestamps.length = 0;
  emailSentTimestamps.push(...recentEmails);

  return emailSentTimestamps.length < MAX_EMAILS_PER_HOUR;
}

/**
 * Email küldés rögzítése
 */
function recordEmailSent() {
  emailSentTimestamps.push(new Date());
}

/**
 * Admin email címek lekérése Setting táblából
 */
async function getAdminEmails() {
  try {
    const setting = await Setting.findOne({
      where: { key: 'admin_security_email' }
    });

    if (setting && setting.value) {
      // Több email cím vesszővel elválasztva
      return setting.value.split(',').map((email) => email.trim()).filter((e) => e);
    }

    // Fallback: próbáljuk meg az email.admin-t
    const fallback = await Setting.findOne({
      where: { key: 'email.admin' }
    });

    if (fallback && fallback.value) {
      return [fallback.value.trim()];
    }

    return [];
  } catch (error) {
    logger.error({ err: error, service: 'securityAlert', operation: 'getAdminEmails' }, 'Failed to get admin emails');
    return [];
  }
}

/**
 * Base URL lekérése Setting táblából
 */
async function getBaseUrl() {
  try {
    const setting = await Setting.findOne({
      where: { key: 'general.domain' }
    });
    return setting && setting.value ? setting.value : 'https://koncert24.hu';
  } catch {
    return 'https://koncert24.hu';
  }
}

/**
 * SQL Injection template generálás
 */
function generateSqlInjectionTemplate(event, baseUrl) {
  return {
    subject: '🚨 [CRITICAL] SQL Injection Kísérlet Észlelve',
    priority: 'critical',
    body: `
<h2>Kedves Adminisztrátor!</h2>
<p>Kritikus biztonsági fenyegetés észlelve! SQL injection kísérlet automatikusan blokkolva lett.</p>

<div class="alert-critical">
  <h3 style="margin-top: 0; color: #721c24;">🚨 SQL Injection Támadás</h3>
  <p style="margin-bottom: 0;"><strong>Státusz:</strong> Automatikusan blokkolva ✅</p>
</div>

<div class="info-box">
  <h3>📋 Támadás Részletei</h3>
  <ul>
    <li><strong>Időpont:</strong> ${new Date(event.timestamp || event.createdAt).toLocaleString('hu-HU')}</li>
    <li><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</li>
    <li><strong>User Agent:</strong> ${event.userAgent || 'Ismeretlen'}</li>
    <li><strong>Súlyosság:</strong> CRITICAL</li>
  </ul>
</div>

<div class="info-box">
  <h3>🔍 Technikai Információk</h3>
  <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">
${JSON.stringify(event.details, null, 2)}
  </pre>
</div>

<div class="alert-high">
  <strong>⚠️ Ajánlott Teendők:</strong>
  <ul style="margin: 10px 0 0 0;">
    <li>Ellenőrizd a SecurityLog részleteit</li>
    <li>Azonosítsd a támadó IP forrását</li>
    <li>Fontold meg IP szintű blokkolást</li>
  </ul>
</div>

<p style="text-align: center; margin-top: 20px;">
  <a href="${baseUrl}/admin/security-log" class="btn">📊 Biztonsági Logok Megtekintése</a>
</p>

<p>✅ <strong>A támadás sikeresen elhárítva, a rendszer biztonságban van.</strong></p>
    `
  };
}

/**
 * Template lookup objektum
 */
function getTemplateGenerators() {
  /* eslint-disable camelcase */
  return {
    sql_injection: generateSqlInjectionTemplate,
    xss_attack: generateXssAttackTemplate,
    auth_account_locked: generateAuthLockedTemplate,
    file_validation_failed: generateFileValidationTemplate,
    bot_detection: generateBotDetectionTemplate,
    multiple_attacks: generateMultipleAttacksTemplate
  };
  /* eslint-enable camelcase */
}

/**
 * Email template generálás esemény típus alapján
 */
async function generateEmailContent(event) {
  const baseUrl = await getBaseUrl();
  const generators = getTemplateGenerators();
  const generator = generators[event.eventType];

  if (generator) {
    return generator(event, baseUrl);
  }

  return generateDefaultTemplate(event);
}

/**
 * Default template generálás
 */
function generateDefaultTemplate(event) {
  return {
    subject: `⚠️ Biztonsági Esemény: ${event.eventType}`,
    priority: event.severity || 'medium',
    body: `
<h2>⚠️ Biztonsági Esemény</h2>
<p><strong>Típus:</strong> ${event.eventType}</p>
<p><strong>Súlyosság:</strong> ${event.severity}</p>
<p><strong>Időpont:</strong> ${new Date(event.timestamp).toLocaleString('hu-HU')}</p>
<p><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</p>
<p><strong>Részletek:</strong></p>
<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(event.details, null, 2)}</pre>
<hr>
<p>SecurityLog ID: #${event.id}</p>
<p><a href="${process.env.BASE_URL}/admin/security-log">Biztonsági Logok Megtekintése</a></p>
    `
  };
}

/**
 * XSS Attack template generálás
 */
function generateXssAttackTemplate(event, baseUrl) {
  return {
    subject: '🚨 [CRITICAL] XSS Támadás Észlelve',
    priority: 'critical',
    body: `
<h2>Kedves Adminisztrátor!</h2>
<p>Kritikus biztonsági fenyegetés észlelve! XSS (Cross-Site Scripting) kísérlet automatikusan blokkolva lett.</p>
<div class="alert-critical">
  <h3 style="margin-top: 0; color: #721c24;">🚨 XSS Támadás</h3>
  <p style="margin-bottom: 0;"><strong>Státusz:</strong> Automatikusan blokkolva ✅</p>
</div>
<div class="info-box">
  <h3>📋 Támadás Részletei</h3>
  <ul>
    <li><strong>Időpont:</strong> ${new Date(event.timestamp || event.createdAt).toLocaleString('hu-HU')}</li>
    <li><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</li>
    <li><strong>User Agent:</strong> ${event.userAgent || 'Ismeretlen'}</li>
    <li><strong>Súlyosság:</strong> CRITICAL</li>
  </ul>
</div>
<div class="info-box">
  <h3>🔍 Technikai Információk</h3>
  <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">
${JSON.stringify(event.details, null, 2)}
  </pre>
</div>
<div class="alert-high">
  <strong>⚠️ Ajánlott Teendők:</strong>
  <ul style="margin: 10px 0 0 0;">
    <li>Ellenőrizd a SecurityLog részleteit</li>
    <li>Nézd át az XSS védelmeket</li>
    <li>Ellenőrizd a CSP (Content Security Policy) beállításokat</li>
  </ul>
</div>
<p style="text-align: center; margin-top: 20px;">
  <a href="${baseUrl}/admin/security-log" class="btn">📊 Biztonsági Logok Megtekintése</a>
</p>
<p>✅ <strong>A támadás sikeresen elhárítva, a rendszer biztonságban van.</strong></p>
    `
  };
}

/**
 * Auth Account Locked template generálás
 */
function generateAuthLockedTemplate(event, baseUrl) {
  return {
    subject: '⚠️ [HIGH] Felhasználói Fiók Zárolva',
    priority: 'high',
    body: `
<h2>Kedves Adminisztrátor!</h2>
<p>Egy felhasználói fiók automatikusan zárolva lett túl sok sikertelen bejelentkezési kísérlet miatt.</p>

<div class="alert-high">
  <h3 style="margin-top: 0; color: #856404;">⚠️ Fiók Automatikus Zárolás</h3>
  <p style="margin-bottom: 0;"><strong>Ok:</strong> Túl sok sikertelen bejelentkezési kísérlet</p>
</div>

<div class="info-box">
  <h3>📋 Esemény Részletei</h3>
  <ul>
    <li><strong>Időpont:</strong> ${new Date(event.timestamp || event.createdAt).toLocaleString('hu-HU')}</li>
    <li><strong>User ID:</strong> ${event.userId || event.details?.userId || 'Ismeretlen'}</li>
    <li><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</li>
    <li><strong>Súlyosság:</strong> HIGH</li>
  </ul>
</div>

<div class="info-box">
  <h3>🔍 Technikai Információk</h3>
  <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">
${JSON.stringify(event.details, null, 2)}
  </pre>
</div>

<div class="alert-medium">
  <strong>🔧 Szükséges Akciók:</strong>
  <ul style="margin: 10px 0 0 0;">
    <li>Ellenőrizd a user aktivitási előzményeit</li>
    <li>Értékeld, legitim felhasználó-e vagy támadó</li>
    <li>Szükség esetén old fel manuálisan a zárolást</li>
  </ul>
</div>

<p style="text-align: center; margin-top: 20px;">
  <a href="${baseUrl}/admin/users" class="btn">👥 User Kezelés Megnyitása</a>
</p>

<p>✅ <strong>A fiók biztonságosan zárolva, addig amíg nem ellenőrzöd.</strong></p>
    `
  };
}

/**
 * File Validation template generálás
 */
function generateFileValidationTemplate(event) {
  return {
    subject: '⚠️ [MEDIUM] Gyanús Fájl Feltöltési Kísérlet',
    priority: 'medium',
    body: `
<h2 style="color: #fdcb6e;">⚠️ Veszélyes Fájl Feltöltési Kísérlet</h2>
<p><strong>Időpont:</strong> ${new Date(event.timestamp).toLocaleString('hu-HU')}</p>
<p><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</p>
<p><strong>User ID:</strong> ${event.userId || 'Vendég'}</p>
<p><strong>Hiba:</strong> Magic bytes vagy blacklist védelem</p>
<p><strong>Részletek:</strong></p>
<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(event.details, null, 2)}</pre>
<p><strong>Érintett funkció:</strong> ${event.action}</p>
<hr>
<p>SecurityLog ID: #${event.id}</p>
<p><a href="${process.env.BASE_URL}/admin/security-log">Biztonsági Logok Megtekintése</a></p>
    `
  };
}

/**
 * Bot Detection template generálás
 */
function generateBotDetectionTemplate(event) {
  return {
    subject: 'ℹ️ [INFO] Bot Aktivitás Észlelve',
    priority: 'low',
    body: `
<h2 style="color: #3498db;">ℹ️ Automatizált Bot Észlelve</h2>
<p><strong>Időpont:</strong> ${new Date(event.timestamp).toLocaleString('hu-HU')}</p>
<p><strong>IP Cím:</strong> ${event.ipAddress || 'Ismeretlen'}</p>
<p><strong>User Agent:</strong> ${event.userAgent || 'Ismeretlen'}</p>
<p><strong>Részletek:</strong></p>
<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(event.details, null, 2)}</pre>
<p><strong>Akció:</strong> Blokkolva ✅</p>
<hr>
<p>SecurityLog ID: #${event.id}</p>
    `
  };
}

/**
 * Multiple Attacks template generálás
 */
function generateMultipleAttacksTemplate(event, baseUrl) {
  return {
    subject: '🔴 [CRITICAL] Koordinált Támadás Észlelve',
    priority: 'critical',
    body: `
<h2 style="color: #ff6b6b;">🔴 KOORDINÁLT TÁMADÁS</h2>
<p><strong>Időpont:</strong> ${new Date().toLocaleString('hu-HU')}</p>
<p><strong>Figyelmeztetés:</strong> Több kritikus biztonsági esemény rövid időn belül!</p>
<p><strong>Részletek:</strong></p>
<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(event.details, null, 2)}</pre>
<p><strong>Ajánlott akció:</strong></p>
<ul>
  <li>Ellenőrizd a SecurityLog-ot részletesen</li>
  <li>Fontold meg IP ban-t</li>
  <li>Ellenőrizd a szerver erőforrásokat</li>
</ul>
<hr>
<p><a href="${baseUrl}/admin/security-log">Biztonsági Logok Megtekintése</a></p>
    `
  };
}

/**
 * Email küldése adminoknak biztonsági eseményről
 */
async function sendSecurityAlert(event) {
  try {
    // Rate limit ellenőrzés
    if (!canSendEmail()) {
      logger.debug(
        { service: 'securityAlert', eventType: event.eventType },
        'Security alert email skipped (rate limit)'
      );
      return false;
    }

    // Admin email címek lekérése
    const adminEmails = await getAdminEmails();

    if (adminEmails.length === 0) {
      logger.warn({ service: 'securityAlert' }, 'No admin emails configured for security alerts');
      return false;
    }

    // Email tartalom generálása
    const emailContent = await generateEmailContent(event);

    // Generate email using Design System template
    const { subject, html, text } = emailTemplateService.generateSecurityAlertEmail({
      event,
      priority: emailContent.priority,
      subject: emailContent.subject,
      body: emailContent.body,
      threats: []
    });

    // Email küldése minden admin-nak
    const promises = adminEmails.map((email) =>
      emailService.sendEmail({
        to: email,
        subject,
        html,
        text
      })
    );

    await Promise.all(promises);

    // Rögzítjük, hogy küldtünk emailt
    recordEmailSent();

    logger.info(
      { service: 'securityAlert', eventType: event.eventType, adminCount: adminEmails.length },
      'Security alert email sent'
    );
    return true;
  } catch (error) {
    logger.error(
      { err: error, service: 'securityAlert', eventType: event.eventType },
      'Failed to send security alert email'
    );
    return false;
  }
}

/**
 * Automatikus figyelés: Ellenőrzi a SecurityLog-ot és küld emailt ha szükséges
 * Ezt periodikusan kell hívni (pl. cron job vagy middleware)
 */
async function checkAndAlert() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000));

    // 1. SQL Injection kísérletek (3+ 15 percen belül)
    const sqlCount = await SecurityLog.count({
      where: {
        eventType: 'sql_injection',
        createdAt: { [Op.gte]: fifteenMinutesAgo }
      }
    });

    if (sqlCount >= 3) {
      const recentSql = await SecurityLog.findOne({
        where: {
          eventType: 'sql_injection',
          createdAt: { [Op.gte]: fifteenMinutesAgo }
        },
        order: [['createdAt', 'DESC']]
      });

      await sendSecurityAlert({
        ...recentSql.toJSON(),
        eventType: 'multiple_attacks',
        details: {
          type: 'sql_injection',
          count: sqlCount,
          period: '15 minutes'
        }
      });
    }

    // 2. XSS kísérletek (3+ 15 percen belül)
    const xssCount = await SecurityLog.count({
      where: {
        eventType: 'xss_attack',
        createdAt: { [Op.gte]: fifteenMinutesAgo }
      }
    });

    if (xssCount >= 3) {
      const recentXss = await SecurityLog.findOne({
        where: {
          eventType: 'xss_attack',
          createdAt: { [Op.gte]: fifteenMinutesAgo }
        },
        order: [['createdAt', 'DESC']]
      });

      await sendSecurityAlert({
        ...recentXss.toJSON(),
        eventType: 'multiple_attacks',
        details: {
          type: 'xss_attack',
          count: xssCount,
          period: '15 minutes'
        }
      });
    }

    // 3. File validation failed (5+ 1 órán belül)
    const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
    const fileCount = await SecurityLog.count({
      where: {
        eventType: 'file_validation_failed',
        createdAt: { [Op.gte]: oneHourAgo }
      }
    });

    if (fileCount >= 5) {
      const recentFile = await SecurityLog.findOne({
        where: {
          eventType: 'file_validation_failed',
          createdAt: { [Op.gte]: oneHourAgo }
        },
        order: [['createdAt', 'DESC']]
      });

      await sendSecurityAlert({
        ...recentFile.toJSON(),
        eventType: 'multiple_attacks',
        details: {
          type: 'file_validation_failed',
          count: fileCount,
          period: '1 hour'
        }
      });
    }

    // 4. Account locked események (azonnal alert)
    const recentLock = await SecurityLog.findOne({
      where: {
        eventType: 'auth_account_locked',
        createdAt: { [Op.gte]: fifteenMinutesAgo }
      },
      order: [['createdAt', 'DESC']]
    });

    if (recentLock) {
      await sendSecurityAlert(recentLock.toJSON());
    }
  } catch (error) {
    logger.error({ err: error, service: 'securityAlert', operation: 'checkAndAlert' }, 'Security alert check failed');
  }
}

/**
 * Egyszeri email küldése egy SecurityLog eseményről
 * Használható middleware-ből vagy manuálisan
 */
async function alertSingleEvent(eventId) {
  try {
    const event = await SecurityLog.findByPk(eventId);

    if (!event) {
      logger.warn({ service: 'securityAlert', eventId }, 'SecurityLog event not found');
      return false;
    }

    // Csak high severity eseményeket küldjünk azonnal
    if (event.severity !== 'high') {
      return false;
    }

    return await sendSecurityAlert(event.toJSON());
  } catch (error) {
    logger.error({ err: error, service: 'securityAlert', eventId }, 'Failed to alert single event');
    return false;
  }
}

module.exports = {
  sendSecurityAlert,
  checkAndAlert,
  alertSingleEvent,
  getAdminEmails,
  // For testing
  _canSendEmail: canSendEmail,
  _recordEmailSent: recordEmailSent
};
