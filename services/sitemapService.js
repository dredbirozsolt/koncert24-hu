/**
 * Sitemap Service - XML Sitemap automatikus generálás
 *
 * Funkciók:
 * - Dinamikus sitemap.xml generálás
 * - Többszintű sitemap támogatás (sitemap index)
 * - Automatikus frissítés új tartalom esetén
 * - Prioritás és frissítési gyakoriság kezelés
 */

const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');

class SitemapService {
  constructor() {
    this.sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    this.sitemapIndexPath = path.join(__dirname, '../public/sitemap-index.xml');
    this.baseDomain = null;
  }

  /**
   * XML header generálás
   */
  getXMLHeader() {
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
           + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
           + '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n'
           + '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';
  }

  /**
   * XML footer generálás
   */
  getXMLFooter() {
    return '</urlset>';
  }

  /**
   * URL entry generálás
   */
  generateURLEntry(url, options = {}) {
    const {
      lastmod = null,
      changefreq = 'weekly',
      priority = 0.5,
      images = [],
      name = null
    } = options;

    let entry = '  <url>\n';

    // Név komment hozzáadása (emberbarát)
    if (name) {
      entry += `    <!-- ${this.escapeXML(name)} -->\n`;
    }

    entry += `    <loc>${this.escapeXML(url)}</loc>\n`;

    if (lastmod) {
      const date = new Date(lastmod).toISOString().split('T')[0];
      entry += `    <lastmod>${date}</lastmod>\n`;
    }

    entry += `    <changefreq>${changefreq}</changefreq>\n`;
    entry += `    <priority>${priority.toFixed(1)}</priority>\n`;

    // Képek hozzáadása (SEO optimalizálás)
    if (images && images.length > 0) {
      images.forEach((image) => {
        entry += '    <image:image>\n';
        entry += `      <image:loc>${this.escapeXML(image.url)}</image:loc>\n`;
        if (image.title) {
          entry += `      <image:title>${this.escapeXML(image.title)}</image:title>\n`;
        }
        if (image.caption) {
          entry += `      <image:caption>${this.escapeXML(image.caption)}</image:caption>\n`;
        }
        entry += '    </image:image>\n';
      });
    }

    entry += '  </url>\n';
    return entry;
  }

  /**
   * XML escape
   */
  escapeXML(str) {
    if (!str) {return '';}
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Statikus oldalak sitemap generálás
   */
  generateStaticPages() {
    return [
      {
        url: this.baseDomain,
        changefreq: 'daily',
        priority: 1.0,
        lastmod: new Date()
      },
      {
        url: `${this.baseDomain}/eloadok`,
        changefreq: 'daily',
        priority: 0.9,
        lastmod: new Date()
      },
      {
        url: `${this.baseDomain}/info/rolunk`,
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: `${this.baseDomain}/info/eloadoknak`,
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: `${this.baseDomain}/info/megrendeloknek`,
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        url: `${this.baseDomain}/info/adatkezeles`,
        changefreq: 'yearly',
        priority: 0.5
      }
    ];
  }

  /**
   * Előadók sitemap generálás
   */
  async generatePerformerPages() {
    try {
      const { Performer } = require('../models');

      const performers = await Performer.findAll({
        attributes: ['id', 'slug', 'name', 'updatedAt'],
        order: [['updatedAt', 'DESC']]
      });

      return performers.map((performer) => ({
        url: `${this.baseDomain}/eloadok/${performer.slug || performer.id}`,
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: performer.updatedAt,
        name: performer.name // Előadó neve (kommenthez)
      }));
    } catch (error) {
      logger.error('Error generating performer sitemap:', error);
      return [];
    }
  }

  /**
   * Blog cikkek sitemap generálás
   */
  async generateBlogPages() {
    try {
      const { BlogPost } = require('../models');

      const posts = await BlogPost.findAll({
        where: { status: 'published' },
        attributes: ['slug', 'title', 'featuredImage', 'updatedAt', 'publishedAt'],
        order: [['publishedAt', 'DESC']]
      });

      return posts.map((post) => {
        const images = [];
        if (post.featuredImage) {
          images.push({
            url: `${this.baseDomain}${post.featuredImage}`,
            title: post.title
          });
        }

        return {
          url: `${this.baseDomain}/blog/${post.slug}`,
          changefreq: 'monthly',
          priority: 0.6,
          lastmod: post.updatedAt || post.publishedAt,
          images
        };
      });
    } catch (error) {
      logger.error('Error generating blog sitemap:', error);
      return [];
    }
  }

  /**
   * Blog kategóriák sitemap generálás
   */
  async generateBlogCategoryPages() {
    try {
      const { BlogCategory } = require('../models');

      const categories = await BlogCategory.findAll({
        attributes: ['slug', 'updatedAt']
      });

      return categories.map((category) => ({
        url: `${this.baseDomain}/blog/kategoria/${category.slug}`,
        changefreq: 'weekly',
        priority: 0.5,
        lastmod: category.updatedAt
      }));
    } catch (error) {
      logger.error('Error generating blog category sitemap:', error);
      return [];
    }
  }

  /**
   * Teljes sitemap generálás
   */
  async generateSitemap() {
    try {
      // Dinamikus domain betöltése
      const settingsService = require('./settingsService');
      this.baseDomain = await settingsService.get('general.domain');

      // Összes URL gyűjtése
      const staticPages = await this.generateStaticPages();
      const performerPages = await this.generatePerformerPages();
      const blogPages = await this.generateBlogPages();
      const categoryPages = await this.generateBlogCategoryPages();

      const allPages = [
        ...staticPages,
        ...performerPages,
        ...blogPages,
        ...categoryPages
      ];

      // XML generálás
      let xml = this.getXMLHeader();

      allPages.forEach((page) => {
        xml += this.generateURLEntry(page.url, {
          lastmod: page.lastmod,
          changefreq: page.changefreq,
          priority: page.priority,
          images: page.images,
          name: page.name
        });
      });

      xml += this.getXMLFooter();

      // Fájl írás
      await fs.writeFile(this.sitemapPath, xml, 'utf8');

      logger.info({
        service: 'sitemap',
        operation: 'generate',
        urlCount: allPages.length
      }, 'Sitemap generated');

      // Robots.txt frissítés
      await this.updateRobotsTxt();

      return {
        success: true,
        urlCount: allPages.length,
        path: this.sitemapPath
      };
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Sitemap index generálás (nagy oldalak esetén)
   */
  async generateSitemapIndex() {
    try {
      const sitemaps = [
        {
          loc: `${this.baseDomain}/sitemap-static.xml`,
          lastmod: new Date()
        },
        {
          loc: `${this.baseDomain}/sitemap-performers.xml`,
          lastmod: new Date()
        },
        {
          loc: `${this.baseDomain}/sitemap-blog.xml`,
          lastmod: new Date()
        }
      ];

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      sitemaps.forEach((sitemap) => {
        xml += '  <sitemap>\n';
        xml += `    <loc>${this.escapeXML(sitemap.loc)}</loc>\n`;
        xml += `    <lastmod>${new Date(sitemap.lastmod).toISOString().split('T')[0]}</lastmod>\n`;
        xml += '  </sitemap>\n';
      });

      xml += '</sitemapindex>';

      await fs.writeFile(this.sitemapIndexPath, xml, 'utf8');

      logger.info({
        service: 'sitemap',
        operation: 'generateIndex',
        sitemapCount: sitemaps.length
      }, 'Sitemap index generated successfully');

      return { success: true };
    } catch (error) {
      logger.error('Error generating sitemap index:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Robots.txt frissítés sitemap referenciával
   */
  async updateRobotsTxt() {
    try {
      const robotsTxtService = require('./robotsTxtService');
      const robotsPath = path.join(__dirname, '../public/robots.txt');

      // Dinamikus robots.txt generálás a robotsTxtService-szel
      const robotsTxt = await robotsTxtService.generateDynamicRobotsTxt();

      await fs.writeFile(robotsPath, robotsTxt, 'utf8');
      logger.info({
        service: 'sitemap',
        operation: 'updateRobotsTxt',
        path: 'public/robots.txt'
      }, 'Robots.txt updated successfully');
    } catch (error) {
      logger.error('Error updating robots.txt:', error);
    }
  }

  /**
   * Sitemap ping Google-höz és Bing-hez
   */
  async pingSearchEngines() {
    try {
      const axios = require('axios');
      const sitemapUrl = encodeURIComponent(`${this.baseDomain}/sitemap.xml`);

      const pingUrls = [
        `https://www.google.com/ping?sitemap=${sitemapUrl}`,
        `https://www.bing.com/ping?sitemap=${sitemapUrl}`
      ];

      const results = await Promise.allSettled(
        pingUrls.map((url) => axios.get(url))
      );

      logger.info({
        service: 'sitemap',
        operation: 'pingSearchEngines',
        successCount: results.filter((r) => r.status === 'fulfilled').length,
        totalPings: results.length
      }, 'Search engines pinged');

      return { success: true, results };
    } catch (error) {
      logger.error('Error pinging search engines:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Automatikus sitemap frissítés ütemezés
   */
  scheduleSitemapGeneration() {
    // Napi frissítés 02:00-kor
    const cron = require('node-cron');

    cron.schedule('0 2 * * *', async () => {
      logger.info({
        service: 'sitemap',
        operation: 'scheduledGeneration',
        schedule: '02:00 daily'
      }, 'Running scheduled sitemap generation');
      await this.generateSitemap();
      await this.pingSearchEngines();
    });

    logger.info({
      service: 'sitemap',
      operation: 'scheduleCron',
      schedule: '0 2 * * *'
    }, 'Sitemap generation scheduled for daily 02:00');
  }
}

const sitemapService = new SitemapService();

module.exports = sitemapService;
