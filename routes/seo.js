/**
 * SEO Routes - Sitemap, Robots.txt és SEO eszközök
 */

const express = require('express');
const router = express.Router();
const sitemapService = require('../services/sitemapService');
const robotsTxtService = require('../services/robotsTxtService');
const logger = require('../config/logger');
const path = require('path');

/**
 * GET /sitemap.xml - Dinamikus sitemap szolgáltatás
 */
router.get('/sitemap.xml', (req, res) => {
  try {
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    res.type('application/xml');
    res.sendFile(sitemapPath);
  } catch (error) {
    logger.error('Error serving sitemap:', error);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap not available</error>');
  }
});

/**
 * GET /robots.txt - Dinamikus robots.txt szolgáltatás
 */
router.get('/robots.txt', async (req, res) => {
  try {
    const robotsTxt = await robotsTxtService.generateDynamicRobotsTxt();
    res.type('text/plain');
    res.send(robotsTxt);
  } catch (error) {
    logger.error('Error serving robots.txt:', error);
    res.type('text/plain');
    res.status(500).send('User-agent: *\nDisallow: /');
  }
});

/**
 * POST /api/sitemap/generate - Sitemap manuális generálás (admin)
 */
router.post('/api/sitemap/generate', async (req, res) => {
  try {
    // Admin jogosultság ellenőrzés
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Nincs jogosultságod ehhez a művelethez'
      });
    }

    const result = await sitemapService.generateSitemap();

    res.json(result);
  } catch (error) {
    logger.error('Error in sitemap generation API:', error);
    res.status(500).json({
      success: false,
      message: 'Hiba a sitemap generálása során'
    });
  }
});

/**
 * POST /api/sitemap/ping - Keresőmotorok értesítése (admin)
 */
router.post('/api/sitemap/ping', async (req, res) => {
  try {
    // Admin jogosultság ellenőrzés
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Nincs jogosultságod ehhez a művelethez'
      });
    }

    const result = await sitemapService.pingSearchEngines();

    res.json(result);
  } catch (error) {
    logger.error('Error pinging search engines:', error);
    res.status(500).json({
      success: false,
      message: 'Hiba a keresőmotorok értesítése során'
    });
  }
});

module.exports = router;
