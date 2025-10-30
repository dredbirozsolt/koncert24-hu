/**
 * Robots.txt Service - Dinamikus robots.txt generálás
 *
 * Funkciók:
 * - Dinamikus robots.txt generálás beállítások alapján
 * - Sitemap URL automatikus beillesztés
 * - Crawl delay és egyéb direktívák
 */

const logger = require('../config/logger');
const { Setting } = require('../models');

// Konstansok
const DISALLOW_ADMIN = 'Disallow: /admin/\n';
const DISALLOW_AUTH = 'Disallow: /auth/\n';
const DISALLOW_API = 'Disallow: /api/\n';
const DEFAULT_SITE_NAME = 'Koncert24.hu';
const SETTING_TYPE_STRING = 'string';
const USER_AGENT_ALL = 'User-agent: *\n';

class RobotsTxtService {
  /**
   * Beállítások betöltése
   */
  async loadSettings() {
    return {
      robotsTxtEnabled: await Setting.get('seo.robots_txt_enabled', true, 'boolean'),
      sitemapEnabled: await Setting.get('seo.sitemap.enabled', true, 'boolean'),
      crawlDelay: await Setting.get('seo.robots_crawl_delay', 1, 'number'),
      customRules: await Setting.get('seo.robots_custom_rules', '', SETTING_TYPE_STRING),
      siteName: await Setting.get('site.name', DEFAULT_SITE_NAME, SETTING_TYPE_STRING),
      siteDomain: await Setting.get('site.domain', process.env.SITE_DOMAIN, SETTING_TYPE_STRING)
    };
  }

  /**
   * Header generálása
   */
  generateHeader(siteName) {
    const timestamp = new Date().toISOString();
    let content = '';
    content += `# ${siteName} Robots.txt\n`;
    content += `# Generálva: ${timestamp}\n`;
    content += '# Automatikusan generált fájl\n\n';
    return content;
  }

  /**
   * Fő szabályok generálása
   */
  generateMainRules() {
    let content = USER_AGENT_ALL;
    content += 'Allow: /\n\n';
    return content;
  }

  /**
   * Sitemap hivatkozás generálása
   */
  generateSitemapSection(siteDomain) {
    let content = '# Sitemap\n';
    content += `Sitemap: ${siteDomain}/sitemap.xml\n\n`;
    return content;
  }

  /**
   * Tiltott területek generálása
   */
  generateDisallowedAreas() {
    let content = '# Tiltott területek\n';
    content += DISALLOW_ADMIN;
    content += DISALLOW_AUTH;
    content += DISALLOW_API;
    content += 'Disallow: /install/\n';
    content += 'Disallow: /*.json$\n';
    content += 'Disallow: /logs/\n';
    content += 'Disallow: /backup/\n';
    content += 'Disallow: /config/\n';
    content += 'Disallow: /node_modules/\n\n';
    return content;
  }

  /**
   * Egyedi szabályok generálása
   */
  generateCustomRules(customRules) {
    if (!customRules || !customRules.trim()) {
      return '';
    }
    let content = '# Egyedi szabályok\n';
    content += `${customRules.trim()}\n\n`;
    return content;
  }

  /**
   * Crawl delay generálása
   */
  generateCrawlDelay(crawlDelay) {
    if (crawlDelay <= 0) {
      return '';
    }
    let content = '# Crawl delay (másodpercekben)\n';
    content += `Crawl-delay: ${crawlDelay}\n\n`;
    return content;
  }

  /**
   * Dinamikus robots.txt generálás
   * @returns {Promise<string>} Robots.txt tartalom
   */
  async generateDynamicRobotsTxt(_req, _res, _siteDomain) {
    try {
      const settings = await this.loadSettings();

      if (!settings.robotsTxtEnabled) {
        return this.generateRestrictiveRobots(settings.siteName, settings.siteDomain);
      }

      let content = '';
      content += this.generateHeader(settings.siteName);
      content += this.generateMainRules();

      if (settings.sitemapEnabled) {
        content += this.generateSitemapSection(settings.siteDomain);
      }

      content += this.generateDisallowedAreas();
      content += this.generateCustomRules(settings.customRules);
      content += this.generateCrawlDelay(settings.crawlDelay);
      content += this.generateBotSpecificRules();

      logger.info({
        service: 'robotsTxt',
        operation: 'generate',
        hasCustomRules: Boolean(settings.customRules),
        hasCrawlDelay: Boolean(settings.crawlDelay)
      }, 'Robots.txt successfully generated');
      return content;
    } catch (_error) {
      logger.error('Robots.txt error:', _error.message);
      return this.generateFallbackRobots();
    }
  }

  /**
   * Korlátozó robots.txt (minden tiltva)
   */
  async generateRestrictiveRobots(siteName = null, _siteDomain = null) {
    const name = siteName || await Setting.get('site.name', DEFAULT_SITE_NAME, SETTING_TYPE_STRING);
    const timestamp = new Date().toISOString();
    let content = '';
    content += `# ${name} Robots.txt\n`;
    content += `# Generálva: ${timestamp}\n`;
    content += '# Indexelés kikapcsolva\n\n';
    content += USER_AGENT_ALL;
    content += 'Disallow: /\n';
    return content;
  }

  /**
   * Fallback robots.txt hiba esetén
   */
  async generateFallbackRobots() {
    try {
      const siteName = await Setting.get('site.name', DEFAULT_SITE_NAME, SETTING_TYPE_STRING);
      const siteDomain = await Setting.get('site.domain', process.env.SITE_DOMAIN, SETTING_TYPE_STRING);
      const timestamp = new Date().toISOString();

      let content = '';
      content += `# ${siteName} Robots.txt\n`;
      content += `# Generálva: ${timestamp}\n`;
      content += '# Fallback konfiguráció\n\n';
      content += USER_AGENT_ALL;
      content += 'Allow: /\n\n';
      content += `Sitemap: ${siteDomain}/sitemap.xml\n\n`;
      content += DISALLOW_ADMIN;
      content += DISALLOW_AUTH;
      content += DISALLOW_API;
      return content;
    } catch {
      // Ultimate fallback
      const timestamp = new Date().toISOString();
      return `# Koncert24.hu Robots.txt\n# Generálva: ${timestamp}\n# Emergency Fallback\n\n`
        + 'User-agent: *\nAllow: /\nDisallow: /admin/\n';
    }
  }

  /**
   * Bot-specifikus szabályok
   */
  generateBotSpecificRules() {
    let rules = '';

    // Google bot
    rules += '# Google Bot\n';
    rules += 'User-agent: Googlebot\n';
    rules += 'Allow: /\n';
    rules += DISALLOW_ADMIN;
    rules += DISALLOW_AUTH;
    rules += '\n';

    // Bing bot
    rules += '# Bing Bot\n';
    rules += 'User-agent: Bingbot\n';
    rules += 'Allow: /\n';
    rules += DISALLOW_ADMIN;
    rules += '\n';

    // Bad bots blokkolása
    rules += '# Rossz botok blokkolása\n';
    rules += 'User-agent: SemrushBot\n';
    rules += 'User-agent: AhrefsBot\n';
    rules += 'User-agent: MJ12bot\n';
    rules += 'User-agent: DotBot\n';
    rules += 'Disallow: /\n\n';

    return rules;
  }

  /**
   * Robots.txt validálás
   */
  validateRobotsTxt(content) {
    const lines = content.split('\n');
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines
      if (!line.startsWith('#') && line !== '') {
        // Check for valid directives
        const validDirectives = [
          'User-agent:', 'Disallow:', 'Allow:', 'Sitemap:',
          'Crawl-delay:', 'Request-rate:', 'Visit-time:',
          'Host:', 'Clean-param:'
        ];

        const hasValidDirective = validDirectives.some((directive) =>
          line.startsWith(directive)
        );

        if (!hasValidDirective) {
          errors.push({
            line: i + 1,
            content: line,
            error: 'Invalid directive'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Robots.txt statisztika
   */
  async getRobotsTxtStats() {
    try {
      const content = await this.generateDynamicRobotsTxt();
      const lines = content.split('\n');

      return {
        totalLines: lines.length,
        commentLines: lines.filter((l) => l.trim().startsWith('#')).length,
        directiveLines: lines.filter((l) => {
          const trimmed = l.trim();
          return trimmed && !trimmed.startsWith('#');
        }).length,
        emptyLines: lines.filter((l) => l.trim() === '').length,
        userAgents: (content.match(/User-agent:/g) || []).length,
        disallowRules: (content.match(/Disallow:/g) || []).length,
        allowRules: (content.match(/Allow:/g) || []).length,
        sitemaps: (content.match(/Sitemap:/g) || []).length,
        size: Buffer.byteLength(content, 'utf8')
      };
    } catch (error) {
      logger.error('Error getting robots.txt stats:', error);
      return null;
    }
  }
}

module.exports = new RobotsTxtService();
