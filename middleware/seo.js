/**
 * SEO Middleware - Automatikus SEO optima  const segments = path.split('/').filter(s => s);
  const breadcrumbs = [
    { name: 'Főoldal', url: baseDomain }
  ];

  let currentPath = '';
  segments.forEach((segment) => { minden oldalhoz
 */

const seoService = require('../services/seoService');
const logger = require('../config/logger');

/**
 * SEO meta adatok hozzáadása minden válaszhoz
 */
function injectSEODefaults(req, res, next) {
  // Ha még nincs metaTags, add hozzá az alapértelmezetteket
  const originalRender = res.render;

  res.render = async function (view, options = {}, callback) {
    // SEO alapbeállítások
    if (!options.metaTags) {
      options.metaTags = await seoService.generateMetaTags({
        title: options.title || res.locals.siteName || '',
        description: options.pageDescription,
        image: options.image, // Custom OG:image (pl. előadó fotója)
        url: `${res.locals.siteDomain}${req.path}`,
        canonical: options.canonical
      });
    }

    // Structured data alapértelmezés
    if (!options.structuredData) {
      options.structuredData = seoService.generateWebSiteSchema();
    }

    // Breadcrumb automatikus generálás
    if (!options.breadcrumbs && req.path !== '/') {
      options.breadcrumbs = generateBreadcrumbs(req.path, res.locals.siteDomain);
    }

    // Eredeti render meghívása
    originalRender.call(this, view, options, callback);
  };

  next();
}

/**
 * Breadcrumb automatikus generálás URL alapján
 */
function generateBreadcrumbs(path, baseDomain) {
  const segments = path.split('/').filter((s) => s);
  const breadcrumbs = [
    { name: 'Főoldal', url: baseDomain }
  ];

  let currentPath = '';
  segments.forEach((segment) => {
    currentPath += `/${segment}`;

    // Magyar nevek mapping
    const nameMap = {
      eloadok: 'Előadók',
      blog: 'Blog',
      info: 'Információ',
      rolunk: 'Rólunk',
      eloadoknak: 'Előadóknak',
      megrendeloknek: 'Megrendelőknek',
      adatkezeles: 'Adatkezelés',
      kategoria: 'Kategória',
      tag: 'Címke'
    };

    breadcrumbs.push({
      name: nameMap[segment] || segment,
      url: `${baseDomain}${currentPath}`
    });
  });

  return seoService.generateBreadcrumbSchema(breadcrumbs);
}

/**
 * Képek automatikus alt szöveg hozzáadása
 */
function processImagesInContent(content, context = {}) {
  if (!content) {return content;}

  // Regex: <img> tagek keresése alt nélkül
  const imgRegex = /<img\s+([^>]*?)(?:alt\s*=\s*["'][^"']*["'][^>]*?)?>/gi;

  return content.replace(imgRegex, (match, attrs) => {
    // Ha már van alt, ne módosítsd
    if (/alt\s*=\s*["']/i.test(match)) {
      return match;
    }

    // Src kinyerése
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) {return match;}

    const src = srcMatch[1];
    const fileName = src.split('/').pop();

    // Alt generálás
    const altText = seoService.generateImageAlt(fileName, context);

    // Alt hozzáadása
    return match.replace('<img', `<img alt="${altText}"`);
  });
}

/**
 * Content post-processing middleware
 */
function processContentSEO(req, res, next) {
  const originalRender = res.render;

  res.render = function (view, options = {}, callback) {
    // Ha van content mező, dolgozd fel
    if (options.post && options.post.content) {
      options.post.content = processImagesInContent(options.post.content, {
        performerName: options.post.title,
        category: options.post.category ? options.post.category.name : ''
      });
    }

    // Performer képek feldolgozása
    if (options.performer && options.performer.description) {
      options.performer.description = processImagesInContent(
        options.performer.description,
        {
          performerName: options.performer.name,
          category: options.performer.category
        }
      );
    }

    originalRender.call(this, view, options, callback);
  };

  next();
}

/**
 * Performance hints hozzáadása
 */
function addPerformanceHeaders(req, res, next) {
  // Preconnect hints kritikus forrásokhoz
  res.setHeader('Link', [
    '<https://fonts.googleapis.com>; rel=preconnect',
    '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
    '<https://cdnjs.cloudflare.com>; rel=preconnect'
  ].join(', '));

  // Cache control statikus tartalmakhoz
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  next();
}

/**
 * Schema.org JSON-LD automatikus beszúrás
 */
function injectOrganizationSchema(req, res, next) {
  const originalRender = res.render;

  res.render = function (view, options = {}, callback) {
    // Organization schema minden oldalon
    const orgSchema = seoService.generateOrganizationSchema({
      name: res.locals.companyName,
      phone: res.locals.companyPhone,
      email: res.locals.companyEmail,
      logo: res.locals.companyLogo,
      street: res.locals.companyAddressStreet,
      city: res.locals.companyAddressCity,
      zip: res.locals.companyAddressZip,
      country: res.locals.companyAddressCountry || 'HU',
      keywords: res.locals.seoKeywords,
      socialMedia: [
        res.locals.socialFacebook,
        res.locals.socialInstagram,
        res.locals.socialYoutube,
        res.locals.socialLinkedin,
        res.locals.socialTiktok
      ].filter((url) => url)
    });

    // Ha már van structuredData, kombináld
    if (options.structuredData) {
      if (Array.isArray(options.structuredData)) {
        options.structuredData.push(orgSchema);
      } else {
        options.structuredData = [options.structuredData, orgSchema];
      }
    } else {
      options.structuredData = orgSchema;
    }

    originalRender.call(this, view, options, callback);
  };

  next();
}

/**
 * URL normalizálás és canonical kezelés
 */
function normalizeURLs(req, res, next) {
  // Trailing slash eltávolítás (kivéve root)
  if (req.path !== '/' && req.path.endsWith('/')) {
    const query = req.url.slice(req.path.length);
    const newPath = req.path.slice(0, -1) + query;
    return res.redirect(301, newPath);
  }

  // Kisbetűs URL kényszerítés (SEO best practice)
  if (req.path !== req.path.toLowerCase()) {
    return res.redirect(301, req.path.toLowerCase() + (req.url.slice(req.path.length)));
  }

  next();
}

/**
 * SEO Analytics logging
 */
function logSEOMetrics(req, res, next) {
  // Response time mérés
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Lassú oldalak logolása (Core Web Vitals)
    if (duration > 2500) {
      logger.warn('Slow page load detected:', {
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode
      });
    }

    // SEO metrikák logolása
    if (req.path.match(/^\/blog\//)) {
      logger.info('Blog page view:', {
        path: req.path,
        userAgent: req.get('user-agent'),
        referer: req.get('referer'),
        duration: `${duration}ms`
      });
    }
  });

  next();
}

module.exports = {
  injectSEODefaults,
  processContentSEO,
  addPerformanceHeaders,
  injectOrganizationSchema,
  normalizeURLs,
  logSEOMetrics
};
