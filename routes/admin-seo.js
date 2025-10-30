/**
 * Admin SEO Routes - Sitemap és SEO eszközök kezelés
 */

const express = require('express');

const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const sitemapService = require('../services/sitemapService');
const robotsTxtService = require('../services/robotsTxtService');
const logger = require('../config/logger');
const { Setting } = require('../models');

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const SETTING_SEO_SITEMAP_ENABLED = 'seo.sitemap.enabled';
const SETTING_SEO_AUTO_GENERATE = 'seo.sitemap.auto_generate';
const SETTING_SEO_PING_ENABLED = 'seo.sitemap.ping_enabled';
const SETTING_SEO_ROBOTS_TXT = 'seo.robots_txt_enabled';

// Setting descriptions as constants
const DESC_SITEMAP_ENABLED = 'Sitemap generálás engedélyezése';
const DESC_AUTO_GENERATE = 'Automatikus sitemap generálás';
const DESC_PING_ENABLED = 'Keresőmotorok automatikus értesítése';
const DESC_ROBOTS_TXT = 'Robots.txt engedélyezése';
const DESC_GOOGLE_ANALYTICS = 'Google Analytics azonosító';
const DESC_SEARCH_CONSOLE = 'Google Search Console kód';
const DESC_TAG_MANAGER = 'Google Tag Manager azonosító';

/**
 * Helper: Update SEO boolean settings
 */
async function updateBooleanSeoSettings(sitemapEnabled, autoGenerate, pingEnabled, robotsTxtEnabled) {
  if (sitemapEnabled !== undefined) {
    await Setting.set(SETTING_SEO_SITEMAP_ENABLED, sitemapEnabled === 'true', 'boolean', 'seo', DESC_SITEMAP_ENABLED);
  }
  if (autoGenerate !== undefined) {
    await Setting.set(SETTING_SEO_AUTO_GENERATE, autoGenerate === 'true', 'boolean', 'seo', DESC_AUTO_GENERATE);
  }
  if (pingEnabled !== undefined) {
    await Setting.set(SETTING_SEO_PING_ENABLED, pingEnabled === 'true', 'boolean', 'seo', DESC_PING_ENABLED);
  }
  if (robotsTxtEnabled !== undefined) {
    await Setting.set(SETTING_SEO_ROBOTS_TXT, robotsTxtEnabled === 'true', 'boolean', 'seo', DESC_ROBOTS_TXT);
  }
}

/**
 * Helper: Update Google service settings
 */
async function updateGoogleServiceSettings(
  googleAnalyticsId,
  googleSearchConsole,
  googleTagManagerId,
  defaultKeywords
) {
  if (googleAnalyticsId !== undefined) {
    await Setting.set('seo.google_analytics_id', googleAnalyticsId || '', 'string', 'seo', DESC_GOOGLE_ANALYTICS);
  }
  if (googleSearchConsole !== undefined) {
    await Setting.set('seo.google_search_console', googleSearchConsole || '', 'string', 'seo', DESC_SEARCH_CONSOLE);
  }
  if (googleTagManagerId !== undefined) {
    await Setting.set('seo.google_tag_manager_id', googleTagManagerId || '', 'string', 'seo', DESC_TAG_MANAGER);
  }
  if (defaultKeywords !== undefined) {
    await Setting.set(
      'seo.default_keywords',
      defaultKeywords || '',
      'string',
      'seo',
      'Alapértelmezett SEO kulcsszavak'
    );
  }
}

/**
 * GET /admin/seo - SEO admin oldal megjelenítés
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Get all settings and flatten them
    const settings = await Setting.findAll();
    const flatSettings = {};
    settings.forEach((setting) => {
      flatSettings[setting.key] = setting.value;
    });

    // SEO beállítások betöltése
    const seoSettings = {
      sitemapEnabled: await Setting.get(SETTING_SEO_SITEMAP_ENABLED, true, 'boolean'),
      autoGenerate: await Setting.get(SETTING_SEO_AUTO_GENERATE, true, 'boolean'),
      pingEnabled: await Setting.get(SETTING_SEO_PING_ENABLED, true, 'boolean'),
      googleAnalyticsId: await Setting.get('seo.google_analytics_id', '', 'string'),
      googleSearchConsole: await Setting.get('seo.google_search_console', '', 'string'),
      googleTagManagerId: await Setting.get('seo.google_tag_manager_id', '', 'string'),
      robotsTxtEnabled: await Setting.get(SETTING_SEO_ROBOTS_TXT, true, 'boolean'),
      defaultKeywords: await Setting.get(
        'seo.default_keywords',
        'koncert, rendezvény, előadó, fellépő, zenész, esküvő, céges rendezvény',
        'string'
      )
    };

    res.render('admin/seo-settings', {
      layout: LAYOUT_ADMIN,
      title: 'SEO Settings',
      currentPath: req.path,
      flatSettings,
      settings: seoSettings,
      messages: req.session.messages || {}
    });

    // Clear messages after rendering
    req.session.messages = {};
  } catch (error) {
    logger.error('Error loading SEO admin page:', error);
    res.status(500).render('error', {
      message: 'Hiba az oldal betöltésekor',
      error: { status: 500 }
    });
  }
});

/**
 * POST /admin/seo/toggle/:setting - Egyedi beállítás toggle
 */
router.post('/toggle/:setting', requireAdmin, async (req, res) => {
  try {
    const { setting } = req.params;

    // Map URL-friendly names to setting keys
    const settingMap = {
      'sitemap-enabled': { key: SETTING_SEO_SITEMAP_ENABLED, desc: DESC_SITEMAP_ENABLED },
      'auto-generate': { key: SETTING_SEO_AUTO_GENERATE, desc: DESC_AUTO_GENERATE },
      'ping-enabled': { key: SETTING_SEO_PING_ENABLED, desc: DESC_PING_ENABLED },
      'robots-enabled': { key: SETTING_SEO_ROBOTS_TXT, desc: DESC_ROBOTS_TXT }
    };

    const config = settingMap[setting];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Érvénytelen beállítás'
      });
    }

    // Get current value and toggle it
    const currentValue = await Setting.get(config.key, false, 'boolean');
    const newValue = !currentValue;

    // Save the new value
    await Setting.set(config.key, newValue, 'boolean', 'seo', config.desc);

    logger.info({
      service: 'adminSeo',
      operation: 'toggleSetting',
      key: config.key,
      value: newValue
    }, 'SEO setting toggled');

    res.json({
      success: true,
      message: `${config.desc}: ${newValue ? 'Bekapcsolva' : 'Kikapcsolva'}`,
      value: newValue
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminSeo', operation: 'toggleSetting' }, 'Error toggling setting');
    res.status(500).json({
      success: false,
      message: 'Hiba a beállítás módosítása során'
    });
  }
});

/**
 * POST /admin/seo/settings - SEO beállítások mentése
 */
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const {
      sitemapEnabled,
      autoGenerate,
      pingEnabled,
      googleAnalyticsId,
      googleSearchConsole,
      googleTagManagerId,
      robotsTxtEnabled,
      defaultKeywords
    } = req.body;

    // Update boolean SEO settings
    await updateBooleanSeoSettings(sitemapEnabled, autoGenerate, pingEnabled, robotsTxtEnabled);

    // Update Google service settings
    await updateGoogleServiceSettings(googleAnalyticsId, googleSearchConsole, googleTagManagerId, defaultKeywords);

    logger.info({
      service: 'adminSeo',
      operation: 'updateSettings',
      userId: req.user?.id
    }, 'SEO settings updated');

    res.json({ success: true, message: 'Beállítások sikeresen mentve!' });
  } catch (error) {
    logger.error('Error saving SEO settings:', error);
    res.status(500).json({ success: false, message: 'Hiba a beállítások mentése során' });
  }
});

/**
 * POST /admin/seo/generate-sitemap - Sitemap manuális generálás
 */
router.post('/generate-sitemap', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminSeo',
      operation: 'generateSitemap',
      userId: req.user?.id
    }, 'Manual sitemap generation requested');

    const result = await sitemapService.generateSitemap();

    if (result.success) {
      res.json({
        success: true,
        message: `Sitemap sikeresen generálva! (${result.urlCount} URL)`,
        urlCount: result.urlCount
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Hiba: ${result.error}`
      });
    }
  } catch (error) {
    logger.error('Error generating sitemap:', error);
    res.status(500).json({ success: false, message: 'Hiba a sitemap generálása során' });
  }
});

/**
 * POST /admin/seo/ping-search-engines - Keresőmotorok értesítése
 */
router.post('/ping-search-engines', requireAdmin, async (req, res) => {
  try {
    logger.info({
      service: 'adminSeo',
      operation: 'pingSearchEngines',
      userId: req.user?.id
    }, 'Manual search engine ping requested');

    const result = await sitemapService.pingSearchEngines();

    if (result.success) {
      res.json({
        success: true,
        message: 'Keresőmotorok sikeresen értesítve!'
      });
    } else {
      res.status(500).json({
        success: false,
        message: `Hiba: ${result.error}`
      });
    }
  } catch (error) {
    logger.error('Error pinging search engines:', error);
    res.status(500).json({ success: false, message: 'Hiba a keresőmotorok értesítése során' });
  }
});

/**
 * GET /admin/seo/sitemap-info - Sitemap és Robots.txt információk lekérése
 */
router.get('/sitemap-info', requireAdmin, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');

    let sitemapInfo = null;
    let robotsInfo = null;

    // Sitemap info
    try {
      const stats = await fs.stat(sitemapPath);
      const content = await fs.readFile(sitemapPath, 'utf8');
      const urlCount = (content.match(/<url>/g) || []).length;

      sitemapInfo = {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        urlCount
      };
    } catch {
      sitemapInfo = { exists: false };
    }

    // Robots.txt info (dinamikus generálás)
    try {
      const robotsStats = await robotsTxtService.getRobotsTxtStats();
      const robotsContent = await robotsTxtService.generateDynamicRobotsTxt();

      robotsInfo = {
        exists: true,
        dynamic: true,
        size: robotsStats?.size || 0,
        stats: robotsStats,
        preview: robotsContent.substring(0, 500)
      };
    } catch {
      robotsInfo = { exists: false, dynamic: true };
    }

    res.json({
      success: true,
      sitemap: sitemapInfo,
      robots: robotsInfo
    });
  } catch (error) {
    logger.error('Error fetching sitemap info:', error);
    res.status(500).json({ success: false, message: 'Hiba az információk lekérésekor' });
  }
});

/**
 * GET /admin/seo/robots-preview - Robots.txt előnézet
 */
router.get('/robots-preview', requireAdmin, async (req, res) => {
  try {
    const robotsTxt = await robotsTxtService.generateDynamicRobotsTxt();
    const stats = await robotsTxtService.getRobotsTxtStats();

    res.json({
      success: true,
      content: robotsTxt,
      stats
    });
  } catch (error) {
    logger.error('Error generating robots.txt preview:', error);
    res.status(500).json({ success: false, message: 'Hiba a robots.txt előnézet generálása során' });
  }
});

module.exports = router;
