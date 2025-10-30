/**
 * Admin AI Behavior Routes - AI viselkedési szabályok kezelése
 * Design system: standard admin route pattern (admin-faq.js mintájára)
 */

const express = require('express');
const router = express.Router();
const { AIBehaviorSetting } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/advancedSecurity');
const logger = require('../config/logger');

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const ERROR_GENERAL = '/admin/ai-behavior?error=Hiba+történt';
const SUCCESS_UPDATED = '/admin/ai-behavior?success=Beállítások+frissítve';

/**
 * GET /admin/ai-behavior - AI viselkedési szabályok kezelő
 */
router.get('/', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const settingsByCategory = await AIBehaviorSetting.getAllByCategory();

    res.render('admin/ai-behavior/index', {
      layout: LAYOUT_ADMIN,
      title: 'AI Viselkedési Szabályok',
      currentPath: req.path,
      settingsByCategory,
      success: req.query.success,
      error: req.query.error,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Error loading AI behavior settings:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt az AI beállítások betöltése során',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * POST /admin/ai-behavior/update - Beállítások frissítése
 */
router.post('/update', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const updates = req.body;
    const errors = [];

    // Process each setting update
    const updatePromises = Object.entries(updates)
      .filter(([key]) => key !== '_csrf') // Skip CSRF token
      .filter(([key]) => {
        const [category, settingKey] = key.split('__');
        return category && settingKey; // Skip invalid keys
      })
      .map(async ([key, value]) => {
        const [category, settingKey] = key.split('__');

        try {
          await AIBehaviorSetting.updateSetting(category, settingKey, value);
        } catch (error) {
          errors.push({ category, settingKey, error: error.message });
          logger.warn({
            service: 'adminAIBehavior',
            operation: 'updateSetting',
            category,
            settingKey,
            value,
            error: error.message
          }, 'Failed to update setting');
        }
      });

    await Promise.all(updatePromises);

    logger.info({
      service: 'adminAIBehavior',
      operation: 'updateSettings',
      count: Object.keys(updates).length - 1,
      errors: errors.length
    }, 'AI behavior settings updated');

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      if (errors.length > 0) {
        return res.json({
          success: true,
          message: `Beállítások mentve, de ${errors.length} hiba történt`,
          errors
        });
      }
      return res.json({ success: true, message: 'Beállítások sikeresen frissítve!' });
    }

    res.redirect(SUCCESS_UPDATED);
  } catch (error) {
    logger.error('Error updating AI behavior settings:', error);

    // AJAX request - return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect(ERROR_GENERAL);
  }
});

/**
 * GET /admin/ai-behavior/test - Test AI prompt with current settings
 */
router.get('/test', requireAdmin, async (req, res) => {
  try {
    const { formatBehaviorRulesForAI } = require('../services/chatBehaviorRules');
    const { getEnhancedKnowledgeBase } = require('../services/chatKnowledgeBase');

    const behaviorRules = await formatBehaviorRulesForAI();
    const knowledgeBase = await getEnhancedKnowledgeBase();

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        behaviorRules,
        knowledgeBase,
        combinedLength: behaviorRules.length + knowledgeBase.length
      });
    }

    res.json({
      behaviorRules,
      knowledgeBase
    });
  } catch (error) {
    logger.error({
      service: 'adminAIBehavior',
      operation: 'testPrompt',
      error: error.message,
      stack: error.stack
    }, 'Error testing AI prompt');
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
