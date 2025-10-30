const express = require('express');
const router = express.Router();
const { Setting } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');
const logger = require('../config/logger');

/**
 * Convert boolean string to 'true' or 'false'
 * @param {string} value - Value to convert
 * @returns {string} 'true' or 'false'
 */
function toBooleanString(value) {
  return value === 'true' ? 'true' : 'false';
}

/**
 * Build exit popup updates array
 * @param {Object} data - Form data
 * @returns {Array} Array of setting updates
 */
function buildExitPopupUpdates(data) {
  return [
    { key: 'exit_popup.enabled', value: toBooleanString(data.enabled) },
    { key: 'exit_popup.title', value: data.title || 'Ne menj el még!' },
    { key: 'exit_popup.message', value: data.message || '' },
    { key: 'exit_popup.cta_text', value: data.ctaText || 'Regisztrálok most' },
    { key: 'exit_popup.cta_link', value: data.ctaLink || '/auth/register' },
    { key: 'exit_popup.trigger_exit_intent', value: toBooleanString(data.triggerExitIntent) },
    { key: 'exit_popup.trigger_mobile_exit', value: toBooleanString(data.triggerMobileExit) },
    { key: 'exit_popup.trigger_timed', value: toBooleanString(data.triggerTimed) },
    { key: 'exit_popup.delay', value: data.delay || '10' },
    { key: 'exit_popup.excluded_paths', value: data.excludedPaths || '' }
  ];
}

/**
const settingsService = require('../services/settingsService');

/**
 * GET /admin/exit-popup
 * Exit Popup beállítások oldal
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Load all settings from database
    const settings = await Setting.findAll();

    // Convert to flat object for easier access in template
    const flatSettings = {};
    settings.forEach((setting) => {
      flatSettings[setting.key] = setting.value;
    });

    res.render('admin/exit-popup', {
      layout: 'layouts/admin',
      title: 'Exit Popup Beállítások',
      currentPath: req.path,
      flatSettings,
      messages: {
        success: req.query.success,
        error: req.query.error
      }
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminExitPopup', operation: 'loadPage' }, 'Error loading exit popup settings');
    res.status(500).render('error', {
      message: 'Hiba az Exit Popup beállítások betöltése során',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * Helper: Handle single field update (from auto-save switch)
 */
async function handleSingleFieldUpdate(normalizedBody) {
  const [[key, value]] = Object.entries(normalizedBody);
  await Setting.upsert({ key, value });
}

/**
 * Helper: Handle full form submit
 */
async function handleFullFormUpdate(normalizedBody) {
  const updates = buildExitPopupUpdates({
    enabled: normalizedBody['exit_popup.enabled'],
    title: normalizedBody['exit_popup.title'],
    message: normalizedBody['exit_popup.message'],
    ctaText: normalizedBody['exit_popup.cta_text'],
    ctaLink: normalizedBody['exit_popup.cta_link'],
    triggerExitIntent: normalizedBody['exit_popup.trigger_exit_intent'],
    triggerMobileExit: normalizedBody['exit_popup.trigger_mobile_exit'],
    triggerTimed: normalizedBody['exit_popup.trigger_timed'],
    delay: normalizedBody['exit_popup.delay'],
    excludedPaths: normalizedBody['exit_popup.excluded_paths']
  });

  for (const update of updates) {
    await Setting.upsert(update);
  }
}

/**
 * POST /admin/exit-popup
 * Exit Popup beállítások mentése
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const normalizedBody = normalizeSettingsKeys(req.body);

    // Check if single field update (switch) or full form submit
    const isSingleFieldUpdate = Object.keys(normalizedBody).length === 1;

    if (isSingleFieldUpdate) {
      await handleSingleFieldUpdate(normalizedBody);
    } else {
      await handleFullFormUpdate(normalizedBody);
    }

    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.json({ success: true, message: 'Beállítások sikeresen mentve' });
    }

    res.redirect('/admin/exit-popup?success=Exit+Popup+beállítások+sikeresen+mentve');
  } catch (error) {
    logger.error(
      { err: error, service: 'adminExitPopup', operation: 'saveSettings' },
      'Error saving exit popup settings'
    );

    // Check if this is an AJAX request
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ success: false, message: 'Hiba a beállítások mentése során' });
    }

    res.redirect('/admin/exit-popup?error=Hiba+a+beállítások+mentése+során');
  }
});

module.exports = router;
