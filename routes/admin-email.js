const express = require('express');

const logger = require('../config/logger');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');

// Constants
const SETTING_KEY_SITE_NAME = 'general.site_name';

// GET /admin/email - Email Configuration page
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Get all settings
    const allSettings = await Setting.findAll({
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    // Create flat settings object
    const flatSettings = {};
    allSettings.forEach((setting) => {
      flatSettings[setting.key] = setting.value;
    });

    res.render('admin/email-settings', {
      layout: 'layouts/admin',
      title: 'Email Konfiguráció',
      flatSettings
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminEmail', operation: 'getEmailSettings' }, 'Email settings page error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Beállítások betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// POST /admin/email/save - Save email settings
router.post('/save', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Érvénytelen beállítások formátum'
      });
    }

    // Normalize keys (convert underscores back to dots)
    const normalizedSettings = normalizeSettingsKeys(settings);

    let updatedCount = 0;

    // Update each setting (email.*, email.oauth2_*, general.site_name)
    for (const [key, value] of Object.entries(normalizedSettings)) {
      // Only save non-empty values
      if (value && value.toString().trim() !== '') {
        if (key.startsWith('email.')) {
          // All email.* keys including email.oauth2_* go to 'email' category
          await Setting.set(key, value, 'string', 'email', `Email setting: ${key}`);
          updatedCount += 1;
        } else if (key === SETTING_KEY_SITE_NAME) {
          await Setting.set(SETTING_KEY_SITE_NAME, value, 'string', 'general', 'Site name');
          updatedCount += 1;
        }
      }
    }

    res.json({
      success: true,
      message: `${updatedCount} beállítás sikeresen mentve`
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminEmail', operation: 'saveEmailSettings' }, 'Email settings update error');
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function for sending test emails
async function sendTestEmails(adminEmail, bookingEmail, siteName, companyName) {
  const adminEmailService = require('../services/adminEmailService');
  const bookingEmailService = require('../services/bookingEmailService');
  const results = [];
  let allSuccess = true;

  // Send test to admin email
  if (adminEmail) {
    const adminResult = await adminEmailService.sendAdminTestEmail(
      adminEmail,
      siteName,
      companyName
    );
    results.push({ to: adminEmail, type: 'admin', success: adminResult.success || adminResult.sent });
    if (!adminResult.success && !adminResult.sent) {
      allSuccess = false;
    }
  }

  // Send test to booking email
  if (bookingEmail && bookingEmail !== adminEmail) {
    const bookingResult = await bookingEmailService.sendBookingTestEmail(
      bookingEmail,
      siteName,
      companyName
    );
    results.push({ to: bookingEmail, type: 'booking', success: bookingResult.success || bookingResult.sent });
    if (!bookingResult.success && !bookingResult.sent) {
      allSuccess = false;
    }
  }

  return { allSuccess, count: results.length };
}

// POST /admin/email/test - Test email functionality
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Check if user is authenticated
    if (!req.session || !req.session.user || !req.session.user.email) {
      return res.status(401).json({
        success: false,
        message: 'Felhasználó nincs bejelentkezve vagy nincs email címe'
      });
    }

    // Get email and site settings
    const [adminEmailSetting, bookingEmailSetting, siteNameSetting, companyNameSetting] = await Promise.all([
      Setting.findOne({ where: { key: 'email.admin' } }),
      Setting.findOne({ where: { key: 'email.booking' } }),
      Setting.findOne({ where: { key: SETTING_KEY_SITE_NAME } }),
      Setting.findOne({ where: { key: 'company.name' } })
    ]);

    const adminEmail = adminEmailSetting?.value;
    const bookingEmail = bookingEmailSetting?.value;
    const siteName = siteNameSetting?.value || 'Koncert24.hu';
    const companyName = companyNameSetting?.value || 'DMF Hungary Kft.';

    const result = await sendTestEmails(adminEmail, bookingEmail, siteName, companyName);

    res.json({
      success: result.allSuccess,
      message: result.allSuccess
        ? `Teszt emailek sikeresen elküldve (${result.count} db)!`
        : 'Néhány teszt email küldése sikertelen'
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminEmail', operation: 'testEmail' }, 'Test email error');
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
