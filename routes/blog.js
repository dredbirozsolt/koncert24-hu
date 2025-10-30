/**
 * Blog Routes - SEO-optimalizált blog rendszer
 */

const express = require('express');
const router = express.Router();
const { BlogPost, BlogCategory, BlogTag, User } = require('../models');
const seoService = require('../services/seoService');
const settingsService = require('../services/settingsService');
const logger = require('../config/logger');
const { Op } = require('sequelize');

// Konstansok
const ERROR_POST_NOT_FOUND = 'A keresett cikk nem található';
const ERROR_CATEGORY_NOT_FOUND = 'A keresett kategória nem található';
const ERROR_INTERNAL = 'Hiba történt a cikkek betöltése során';
const LOG_STACK_TRACE = 'Stack trace:';

// Helper function
const getBasePath = (res) => res.locals.basePath || '/';

/**
 * GET /blog - Blog főoldal (listázás)
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const { filter } = req.query; // popular, latest, vagy undefined (összes)
    const limit = res.locals.paginationBlogPosts || 12;
    const offset = (page - 1) * limit;

    // Order meghatározása filter alapján
    let order;
    if (filter === 'popular') {
      order = [['viewCount', 'DESC'], ['publishedAt', 'DESC']];
    } else if (filter === 'latest') {
      order = [['publishedAt', 'DESC']];
    } else {
      order = [['publishedAt', 'DESC']]; // Default: legújabb
    }

    // Cikkek lekérdezése
    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where: { status: 'published' },
      limit,
      offset,
      order,
      distinct: true, // Fix: Distinct count to avoid duplicates from JOIN
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] },
        {
          model: BlogTag,
          as: 'tags',
          attributes: ['name', 'slug'],
          through: { attributes: [] }
        }
      ]
    });

    const totalPages = Math.ceil(count / limit);

    // Featured post (csak első oldalon)
    let featuredPost = null;
    if (page === 1) {
      featuredPost = await BlogPost.findOne({
        where: { status: 'published', featured: true },
        order: [['publishedAt', 'DESC']],
        include: [
          { model: User, as: 'author', attributes: ['name'] },
          { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] }
        ]
      });
    }

    // Népszerű cikkek (sidebar)
    const popularPosts = await BlogPost.getPopularPosts(5);

    // Népszerű tagek
    const popularTags = await BlogTag.getPopularTags(20);

    // Kategóriák
    const categories = await BlogCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    // Archívum adatok (év/hónap bontásban)
    const archive = await BlogPost.getArchive();

    // Szerző info (blog owner - lehet konfigurálható)
    let author = null;
    try {
      const blogAuthorId = await settingsService.get('blog.default_author_id') || 1;
      author = await User.findByPk(blogAuthorId, {
        attributes: ['id', 'name', 'email', 'role', 'avatar', 'bio']
      });

      // Social media linkek hozzáadása (ha van)
      if (author) {
        author.social = {
          facebook: await settingsService.get('social.facebook'),
          twitter: await settingsService.get('social.twitter'),
          linkedin: await settingsService.get('social.linkedin')
        };
      }
    } catch (err) {
      logger.warn({ err }, 'Could not load blog author');
    }

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: 'Blog',
      description: 'Szakmai cikkek, tippek és hírek a koncertszervezés világából. '
        + 'Tudj meg többet rendezvények szervezéséről, előadók foglalásáról.',
      keywords: ['blog', 'koncert', 'rendezvény', 'szervezés', 'tippek', 'hírek'],
      url: `${res.locals.siteDomain}/blog`,
      canonical: `${res.locals.siteDomain}/blog`
    });

    // Structured data
    const structuredData = seoService.generateWebSiteSchema();

    const companyName = await settingsService.get('general.site_name');

    res.render('blog/index', {
      title: `Blog - ${companyName}`,
      pageDescription: metaTags.description,
      metaTags,
      structuredData,
      posts,
      featuredPost,
      popularPosts,
      popularTags,
      categories,
      archive: archive || [],
      author,
      filter,
      totalPosts: count,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error({ err: error, service: 'blog', operation: 'index' }, 'Error loading blog index');
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

/**
 * GET /blog/kereses - Blog keresés
 */
router.get('/kereses', async (req, res) => {
  try {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationBlogPosts || 12;
    const offset = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return res.redirect(`${getBasePath(res)}blog`);
    }

    // Keresés a címben, excerpt-ben és tartalomban
    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where: {
        status: 'published',
        [Op.or]: [
          { title: { [Op.like]: `%${query}%` } },
          { excerpt: { [Op.like]: `%${query}%` } },
          { content: { [Op.like]: `%${query}%` } },
          { metaDescription: { [Op.like]: `%${query}%` } }
        ]
      },
      limit,
      offset,
      order: [['publishedAt', 'DESC']],
      distinct: true, // Fix: Distinct count to avoid duplicates from JOIN
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] },
        {
          model: BlogTag,
          as: 'tags',
          attributes: ['name', 'slug'],
          through: { attributes: [] }
        }
      ]
    });

    const totalPages = Math.ceil(count / limit);

    // Népszerű cikkek (sidebar)
    const popularPosts = await BlogPost.getPopularPosts(5);

    // Népszerű tagek
    const popularTags = await BlogTag.getPopularTags(20);

    // Kategóriák
    const categories = await BlogCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: `Keresés: "${query}" - Blog`,
      description: `${count} találat a következőre: ${query}`,
      keywords: ['blog', 'keresés', query],
      url: `${res.locals.siteDomain}/blog/kereses?q=${encodeURIComponent(query)}`,
      canonical: `${res.locals.siteDomain}/blog/kereses?q=${encodeURIComponent(query)}`,
      noindex: true // Keresési eredmények ne indexelődjenek
    });

    const companyName = await settingsService.get('general.site_name');

    // Archive és author nem kell a kereséshez
    res.render('blog/index', {
      title: `Keresés: "${query}" - ${companyName}`,
      pageDescription: metaTags.description,
      metaTags,
      structuredData: [],
      query,
      posts,
      featuredPost: null, // Nincs featured post a keresési eredményekben
      popularPosts,
      popularTags,
      categories,
      archive: [],
      author: null,
      filter: null,
      totalPosts: count,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error({ err: error, service: 'blog', operation: 'search' }, 'Error searching blog');
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

/**
 * GET /blog/rss - RSS Feed
 */
router.get('/rss', async (req, res) => {
  try {
    const posts = await BlogPost.findAll({
      where: { status: 'published' },
      limit: 20,
      order: [['publishedAt', 'DESC']],
      include: [
        { model: User, as: 'author', attributes: ['name', 'email'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] }
      ]
    });

    const siteDomain = res.locals.siteDomain || 'https://koncert24.hu';
    const basePath = getBasePath(res);
    const buildDate = new Date().toUTCString();
    const currentYear = new Date().getFullYear();

    // Settings lekérése
    const siteName = res.locals.siteName || 'Koncert24.hu';
    const companyEmail = res.locals.companyEmail || 'info@koncert24.hu';
    const companyName = res.locals.companyName || 'Koncert24';
    const companyLogo = res.locals.flatSettings?.['company.logo'] || '/images/logo.png';

    // RSS XML generálása
    let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${siteName} Blog</title>
    <link>${siteDomain}${basePath}blog</link>
    <description>Szakmai cikkek, tippek és hírek a koncertszervezés világából</description>
    <language>hu</language>
    <copyright>© ${currentYear} ${siteName}</copyright>
    <webMaster>${companyEmail} (${companyName})</webMaster>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${siteDomain}${basePath}blog/rss" rel="self" type="application/rss+xml" />
    <image>
      <url>${siteDomain}${companyLogo}</url>
      <title>${siteName}</title>
      <link>${siteDomain}${basePath}blog</link>
    </image>
`;

    posts.forEach((post) => {
      const postUrl = `${siteDomain}${basePath}blog/${post.slug}`;
      const pubDate = new Date(post.publishedAt).toUTCString();
      const description = post.excerpt || post.metaDescription || '';
      const category = post.category ? post.category.name : '';
      const author = post.author ? post.author.email || post.author.name : '';

      rss += `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${description}]]></description>`;

      if (category) {
        rss += `
      <category><![CDATA[${category}]]></category>`;
      }

      if (author) {
        rss += `
      <author>${author}</author>
      <dc:creator><![CDATA[${post.author ? post.author.name : author}]]></dc:creator>`;
      }

      rss += `
    </item>`;
    });

    rss += `
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.send(rss);
  } catch (error) {
    logger.error('Error generating RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

/**
 * GET /blog/:slug - Cikk megjelenítés
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const post = await BlogPost.findOne({
      where: { slug, status: 'published' },
      include: [
        { model: User, as: 'author', attributes: ['name', 'email'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] },
        { model: BlogTag, as: 'tags', attributes: ['name', 'slug'], through: { attributes: [] } }
      ]
    });

    if (!post) {
      return res.status(404).render('error', {
        title: '404',
        message: ERROR_POST_NOT_FOUND,
        statusCode: 404,
        basePath: getBasePath(res)
      });
    }

    // Megtekintés növelés
    await post.incrementViews();

    // Kapcsolódó cikkek
    const relatedPosts = await BlogPost.getRelatedPosts(post.id, post.categoryId, 3);

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      keywords: post.metaKeywords ? post.metaKeywords.split(',') : [],
      url: `${res.locals.siteDomain}/blog/${post.slug}`,
      canonical: post.canonicalUrl || `${res.locals.siteDomain}/blog/${post.slug}`,
      type: 'article',
      author: post.author.name,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      section: post.category ? post.category.name : '',
      tags: post.tags.map((tag) => tag.name),
      noindex: post.noindex,
      nofollow: post.nofollow,
      image: post.featuredImage
    });

    // Structured data
    const structuredData = post.generateStructuredData();

    // Breadcrumb structured data
    const breadcrumbSchema = seoService.generateBreadcrumbSchema([
      { name: 'Főoldal', url: res.locals.siteDomain },
      { name: 'Blog', url: `${res.locals.siteDomain}/blog` },
      { name: post.title, url: `${res.locals.siteDomain}/blog/${post.slug}` }
    ]);

    // Kombináld a structured data-kat
    const combinedStructuredData = [structuredData, breadcrumbSchema];

    res.render('blog/post', {
      title: metaTags.title,
      pageDescription: metaTags.description,
      metaTags,
      structuredData: combinedStructuredData,
      post,
      relatedPosts,
      siteDomain: res.locals.siteDomain,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error('Error loading blog post:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

/**
 * GET /blog/kategoria/:slug - Kategória cikkek
 */
router.get('/kategoria/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationBlogPosts || 12;
    const offset = (page - 1) * limit;

    const category = await BlogCategory.findOne({
      where: { slug }
    });

    if (!category) {
      return res.status(404).render('error', {
        title: '404',
        message: ERROR_CATEGORY_NOT_FOUND,
        statusCode: 404
      });
    }

    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where: {
        categoryId: category.id,
        status: 'published'
      },
      limit,
      offset,
      order: [['publishedAt', 'DESC']],
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] }
      ]
    });

    const totalPages = Math.ceil(count / limit);

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: category.metaTitle || category.name,
      description: category.metaDescription || category.description,
      url: `${res.locals.siteDomain}/blog/kategoria/${category.slug}`,
      canonical: `${res.locals.siteDomain}/blog/kategoria/${category.slug}`
    });

    res.render('blog/category', {
      title: metaTags.title,
      pageDescription: metaTags.description,
      metaTags,
      category,
      posts,
      totalPosts: count,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error('Error loading blog category:', error.message);
    logger.error(LOG_STACK_TRACE, error.stack);
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

/**
 * GET /blog/tag/:slug - Tag szerinti cikkek
 */
router.get('/tag/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationBlogPosts || 12;
    const offset = (page - 1) * limit;

    const tag = await BlogTag.findOne({
      where: { slug }
    });

    if (!tag) {
      return res.status(404).render('error', {
        title: '404',
        message: 'A keresett tag nem található',
        statusCode: 404,
        basePath: getBasePath(res)
      });
    }

    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where: { status: 'published' },
      limit,
      offset,
      order: [['publishedAt', 'DESC']],
      distinct: true, // Fix: Distinct count to avoid duplicates from JOIN
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] },
        {
          model: BlogTag,
          as: 'tags',
          where: { id: tag.id },
          through: { attributes: [] }
        }
      ]
    });

    const totalPages = Math.ceil(count / limit);

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: `${tag.name} cikkek`,
      description: `Minden cikk a "${tag.name}" témakörben`,
      url: `${res.locals.siteDomain}/blog/tag/${tag.slug}`
    });

    res.render('blog/tag', {
      title: metaTags.title,
      pageDescription: metaTags.description,
      metaTags,
      tag,
      posts,
      totalPosts: count,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error('Error loading blog tag:', error.message);
    logger.error(LOG_STACK_TRACE, error.stack);
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

/**
 * GET /blog/search - Keresés a blogban
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 3) {
      return res.redirect('/blog');
    }

    const searchTerm = `%${q}%`;

    const posts = await BlogPost.findAll({
      where: {
        status: 'published',
        [Op.or]: [
          { title: { [Op.like]: searchTerm } },
          { content: { [Op.like]: searchTerm } },
          { excerpt: { [Op.like]: searchTerm } }
        ]
      },
      limit: 50,
      order: [['publishedAt', 'DESC']],
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name', 'slug'] }
      ]
    });

    // SEO meta adatok
    const metaTags = seoService.generateMetaTags({
      title: `Keresés: ${q}`,
      description: `Keresési eredmények a(z) "${q}" kifejezésre`,
      noindex: true // Ne indexelje a keresési oldalakat
    });

    res.render('blog/search', {
      title: metaTags.title,
      pageDescription: metaTags.description,
      metaTags,
      searchTerm: q,
      posts,
      basePath: getBasePath(res)
    });
  } catch (error) {
    logger.error('Error searching blog:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: ERROR_INTERNAL,
      basePath: getBasePath(res)
    });
  }
});

module.exports = router;
