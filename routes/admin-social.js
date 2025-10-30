const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');
const logger = require('../config/logger');

// GET /admin/social - Social Media Settings page
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

    res.render('admin/social-settings', {
      layout: 'layouts/admin',
      title: 'Social Media Beállítások',
      flatSettings
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminSocial', operation: 'loadPage' }, 'Social settings page error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Beállítások betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// POST /admin/social/save - Save social media links
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

    // Update each social media setting
    for (const [key, value] of Object.entries(normalizedSettings)) {
      if (key.startsWith('social.')) {
        await Setting.set(key, value, 'string', 'social', `Social media link: ${key}`);
        updatedCount += 1;
      }
    }

    res.json({
      success: true,
      message: `${updatedCount} közösségi média link sikeresen mentve`
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminSocial', operation: 'saveSettings' },
      'Social media settings update error'
    );
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
