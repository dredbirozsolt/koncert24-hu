/**
 * Admin Integrations Routes
 * Handles 3rd party integrations (Vtiger, Geonames, etc.)
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');
const logger = require('../config/logger');

/**
 * GET /admin/integrations
 * Display integrations management page
 */
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

    res.render('admin/integrations/index', {
      title: 'Integrációk',
      flatSettings,
      layout: 'layouts/admin'
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminIntegrations', operation: 'loadPage' }, 'Integrations page error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Integrációk betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

/**
 * POST /admin/integrations/vtiger
 * Update Vtiger CRM settings
 */
router.post('/vtiger', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Normalize keys (convert underscores back to dots)
    const normalized = normalizeSettingsKeys(req.body);
    const { 'vtiger.url': url, 'vtiger.username': username, 'vtiger.access_key': accessKey } = normalized;

    // Update settings
    await Setting.set('vtiger.url', url, 'string', 'vtiger', 'Vtiger CRM URL');
    await Setting.set('vtiger.username', username, 'string', 'vtiger', 'Vtiger username');
    await Setting.set('vtiger.access_key', accessKey, 'string', 'vtiger', 'Vtiger access key');

    res.json({
      success: true,
      message: 'Vtiger CRM beállítások sikeresen mentve'
    });
  } catch (error) {
    const logContext = { err: error, service: 'adminIntegrations', operation: 'saveVtigerSettings' };
    logger.error(logContext, 'Vtiger settings update error');
    res.status(500).json({
      success: false,
      message: error.message || 'Vtiger beállítások mentése sikertelen'
    });
  }
});

/**
 * POST /admin/integrations/vtiger/test
 * Test Vtiger CRM connection
 */
router.post('/vtiger/test', requireAdmin, async (req, res) => {
  try {
    const { VTigerService } = require('../services/vtigerService');
    const vtigerService = new VTigerService();

    // Test connection by trying to authenticate
    const authenticated = await vtigerService.authenticate();

    if (authenticated) {
      res.json({
        success: true,
        message: 'Vtiger kapcsolat sikeres! Authentikáció rendben.'
      });
    } else {
      res.json({
        success: false,
        message: 'Vtiger kapcsolat sikertelen: Authentikáció nem sikerült'
      });
    }
  } catch (error) {
    logger.error({ err: error, service: 'adminIntegrations', operation: 'testVtiger' }, 'Vtiger test error');
    res.status(500).json({
      success: false,
      message: error.message || 'Vtiger teszt sikertelen'
    });
  }
});

/**
 * POST /admin/integrations/geonames
 * Update Geonames API settings
 */
router.post('/geonames', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Normalize keys (convert underscores back to dots)
    const normalized = normalizeSettingsKeys(req.body);
    const { 'geonames.username': username } = normalized;

    // Update setting
    await Setting.set('geonames.username', username, 'string', 'geonames', 'Geonames API username');

    res.json({
      success: true,
      message: 'Geonames API beállítások sikeresen mentve'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminIntegrations', operation: 'saveGeonamesSettings' },
      'Geonames settings update error'
    );
    res.status(500).json({
      success: false,
      message: error.message || 'Geonames beállítások mentése sikertelen'
    });
  }
});

/**
 * POST /admin/integrations/geonames/test
 * Test Geonames API connection
 */
router.post('/geonames/test', requireAdmin, async (req, res) => {
  try {
    const axios = require('axios');
    const { Setting } = require('../models');

    // Get username from settings
    const usernameSetting = await Setting.findOne({ where: { key: 'geonames.username' } });
    const username = usernameSetting ? usernameSetting.value : null;

    if (!username) {
      return res.json({
        success: false,
        message: 'Geonames username nincs beállítva'
      });
    }

    // Test API call (search for Budapest)
    const response = await axios.get('http://api.geonames.org/searchJSON', {
      params: {
        q: 'Budapest',
        maxRows: 1,
        username
      },
      timeout: 5000
    });

    if (response.data && response.data.geonames && response.data.geonames.length > 0) {
      res.json({
        success: true,
        message: 'Geonames API kapcsolat sikeres!',
        data: {
          totalResultsCount: response.data.totalResultsCount,
          example: response.data.geonames[0].name
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Geonames API válasz üres vagy hibás'
      });
    }
  } catch (error) {
    logger.error({ err: error, service: 'adminIntegrations', operation: 'testGeonames' }, 'Geonames test error');
    res.status(500).json({
      success: false,
      message: error.response?.data?.status?.message || error.message || 'Geonames teszt sikertelen'
    });
  }
});

/**
 * POST /admin/integrations/openai
 * Update OpenAI settings
 */
router.post('/openai', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const normalized = normalizeSettingsKeys(req.body);
    const OPENAI_KEY = 'chat.openai_api_key';
    const apiKey = normalized[OPENAI_KEY];

    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'OpenAI API key mező kötelező'
      });
    }

    await Setting.upsert({
      key: OPENAI_KEY,
      value: apiKey.trim(),
      category: 'chat',
      description: 'OpenAI API Key for Chat AI Assistant',
      type: 'string'
    });

    res.json({
      success: true,
      message: 'OpenAI beállítások sikeresen mentve!'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminIntegrations', operation: 'saveOpenAISettings' },
      'OpenAI settings update error'
    );
    res.status(500).json({
      success: false,
      message: `OpenAI beállítások mentése sikertelen: ${error.message}`
    });
  }
});

/**
 * POST /admin/integrations/openai/test
 * Test OpenAI API connection
 */
router.post('/openai/test', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const OPENAI_KEY = 'chat.openai_api_key';

    // Get API key from settings
    const apiKeySetting = await Setting.findOne({ where: { key: OPENAI_KEY } });
    const apiKey = apiKeySetting ? apiKeySetting.value : null;

    if (!apiKey) {
      return res.json({
        success: false,
        message: 'OpenAI API key nincs beállítva'
      });
    }

    // Test API call with a simple completion
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "API connection successful!" in Hungarian.' }
      ],
      max_tokens: 50 // eslint-disable-line camelcase
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      res.json({
        success: true,
        message: `OpenAI API kapcsolat sikeres! Válasz: ${completion.choices[0].message.content}`,
        data: {
          model: completion.model,
          usage: completion.usage
        }
      });
    } else {
      res.json({
        success: false,
        message: 'OpenAI API válasz üres vagy hibás'
      });
    }
  } catch (error) {
    logger.error({ err: error, service: 'adminIntegrations', operation: 'testOpenAI' }, 'OpenAI test error');
    res.status(500).json({
      success: false,
      message: error.message || 'OpenAI teszt sikertelen'
    });
  }
});

module.exports = router;
