/**
 * SEO Service - Központi SEO kezelés és optimalizálás
 *
 * Funkciók:
 * - Dinamikus meta tag generálás
 * - Structured Data (Schema.org JSON-LD) kezelés
 * - Képek automatikus alt szöveg generálás
 * - Kulcsszó optimalizálás
 * - Open Graph és Twitter Card generálás
 */

const { Setting } = require('../models');

const SCHEMA_CONTEXT = 'https://schema.org';
const DEFAULT_DESCRIPTION = 'Professzionális koncert- és rendezvényszervezés. '
  + 'Böngésszen előadóink között és foglaljon egyszerűen!';

/**
 * SEO szolgáltatás osztály
 */
class SEOService {
  /**
   * Alapértelmezett SEO beállítások
   */
  constructor() {
    this.defaultSettings = {
      siteName: 'Koncert24.hu',
      siteDomain: 'https://koncert24.hu',
      defaultDescription: DEFAULT_DESCRIPTION,
      defaultKeywords: ['koncert', 'rendezvény', 'előadó', 'fellépő', 'zenész', 'esküvő', 'céges rendezvény'],
      twitterHandle: '@koncert24',
      fbAppId: '',
      defaultImage: '/images/og-image.jpg',
      ogImageWidth: 1200,
      ogImageHeight: 630,
      locale: 'hu_HU',
      timezone: 'Europe/Budapest',
      type: 'website'
    };
  }

  /**
   * Dinamikus beállítások betöltése a Settings táblából
   * @returns {Promise<Object>} Frissített beállítások
   */
  async loadDynamicSettings() {
    try {
      const keywordsStr = await Setting.get('seo.default_keywords');
      const keywords = keywordsStr
        ? keywordsStr.split(',').map((k) => k.trim())
        : this.defaultSettings.defaultKeywords;

      // Phase 2: OG Image és Facebook App ID
      const ogImage = await Setting.get('seo.default_og_image') || this.defaultSettings.defaultImage;
      const ogWidth = parseInt(await Setting.get('seo.og_image_width'), 10) || this.defaultSettings.ogImageWidth;
      const ogHeight = parseInt(await Setting.get('seo.og_image_height'), 10) || this.defaultSettings.ogImageHeight;
      const fbAppId = await Setting.get('social.facebook_app_id') || this.defaultSettings.fbAppId;

      return {
        ...this.defaultSettings,
        defaultKeywords: keywords,
        locale: await Setting.get('general.locale') || this.defaultSettings.locale,
        timezone: await Setting.get('general.timezone') || this.defaultSettings.timezone,
        defaultImage: ogImage,
        ogImageWidth: ogWidth,
        ogImageHeight: ogHeight,
        fbAppId
      };
    } catch {
      return this.defaultSettings;
    }
  }

  /**
   * Meta tagek generálása egy oldalhoz
   *
   * @param {Object} options - Oldal specifikus beállítások
   * @returns {Promise<Object>} Meta adatok objektum
   */
  async generateMetaTags(options = {}) {
    const settings = await this.loadDynamicSettings();

    const {
      title,
      description,
      keywords = [],
      image,
      url,
      type = 'website',
      author,
      publishedTime,
      modifiedTime,
      section,
      tags = [],
      noindex = false,
      nofollow = false,
      canonical
    } = options;

    const metaTags = {
      // Alap meta tagek
      title: this.generateTitle(title),
      description: description || settings.defaultDescription,
      keywords: [...settings.defaultKeywords, ...keywords].join(', '),

      // Robots meta
      robots: this.generateRobotsTag(noindex, nofollow),

      // Canonical URL
      canonical: canonical || url || settings.siteDomain,

      // Open Graph tagek
      og: {
        title: this.generateTitle(title),
        description: description || settings.defaultDescription,
        type,
        url: url || settings.siteDomain,
        image: image || settings.defaultImage,
        imageWidth: settings.ogImageWidth,
        imageHeight: settings.ogImageHeight,
        siteName: settings.siteName,
        locale: settings.locale
      },

      // Twitter Card tagek
      twitter: {
        card: 'summary_large_image',
        site: settings.twitterHandle,
        title: this.generateTitle(title),
        description: description || settings.defaultDescription,
        image: image || settings.defaultImage
      },

      // Facebook App ID (ha van)
      fbAppId: settings.fbAppId
    };

    // Opcionális Open Graph mezők
    if (author) {metaTags.og.author = author;}
    if (publishedTime) {metaTags.og.publishedTime = publishedTime;}
    if (modifiedTime) {metaTags.og.modifiedTime = modifiedTime;}
    if (section) {metaTags.og.section = section;}
    if (tags.length > 0) {metaTags.og.tags = tags;}

    return metaTags;
  }

  /**
   * Cím generálás site name-mel
   *
   * @param {string} pageTitle - Oldal címe
   * @returns {string} Teljes cím
   */
  generateTitle(pageTitle) {
    if (!pageTitle) {
      return this.defaultSettings.siteName;
    }
    return `${pageTitle} | ${this.defaultSettings.siteName}`;
  }

  /**
   * Robots meta tag generálás
   *
   * @param {boolean} noindex - Index tiltás
   * @param {boolean} nofollow - Follow tiltás
   * @returns {string} Robots direktíva
   */
  generateRobotsTag(noindex = false, nofollow = false) {
    const directives = [];

    if (noindex) {directives.push('noindex');} else {directives.push('index');}

    if (nofollow) {directives.push('nofollow');} else {directives.push('follow');}

    return directives.join(', ');
  }

  /**
   * Schema.org Organization strukturált adat
   *
   * @param {Object} companyData - Cég adatai
   * @returns {Object} JSON-LD strukturált adat
   */
  generateOrganizationSchema(companyData = {}) {
    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'Organization',
      name: companyData.name,
      url: this.defaultSettings.siteDomain,
      logo: companyData.logo || `${this.defaultSettings.siteDomain}/images/dmf_logo.png`,
      description: 'Professzionális koncert- és rendezvényszervezés, előadó menedzsment',
      about: companyData.keywords || 'koncert, rendezvény, előadó, fellépő',
      telephone: companyData.phone,
      email: companyData.email,
      address: {
        '@type': 'PostalAddress',
        addressCountry: companyData.country || 'HU',
        addressLocality: companyData.city,
        streetAddress: companyData.street,
        postalCode: companyData.zip
      },
      sameAs: companyData.socialMedia || []
    };
  }

  /**
   * Schema.org WebSite strukturált adat
   *
   * @returns {Object} JSON-LD strukturált adat
   */
  generateWebSiteSchema() {
    const searchUrl = `${this.defaultSettings.siteDomain}/eloadok?search={search_term_string}`;

    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'WebSite',
      name: this.defaultSettings.siteName,
      url: this.defaultSettings.siteDomain,
      potentialAction: {
        '@type': 'SearchAction',
        target: searchUrl,
        'query-input': 'required name=search_term_string'
      }
    };
  }

  /**
   * Schema.org Person strukturált adat előadókhoz
   *
   * @param {Object} performer - Előadó adatai
   * @returns {Object} JSON-LD strukturált adat
   */
  generatePerformerSchema(performer) {
    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'Person',
      name: performer.name,
      description: performer.description,
      image: performer.image,
      url: `${this.defaultSettings.siteDomain}/eloadok/${performer.id}`,
      jobTitle: 'Előadó',
      performerIn: {
        '@type': 'Event',
        name: 'Rendezvények',
        eventAttendanceMode: `${SCHEMA_CONTEXT}/OfflineEventAttendanceMode`
      }
    };
  }

  /**
   * Schema.org Event strukturált adat
   *
   * @param {Object} event - Esemény adatai
   * @returns {Object} JSON-LD strukturált adat
   */
  generateEventSchema(event) {
    const schema = {
      '@context': SCHEMA_CONTEXT,
      '@type': 'Event',
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      eventStatus: `${SCHEMA_CONTEXT}/EventScheduled`,
      eventAttendanceMode: `${SCHEMA_CONTEXT}/OfflineEventAttendanceMode`
    };

    if (event.location) {
      schema.location = {
        '@type': 'Place',
        name: event.location.name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: event.location.city,
          addressCountry: 'HU'
        }
      };
    }

    if (event.performer) {
      schema.performer = {
        '@type': 'Person',
        name: event.performer.name
      };
    }

    return schema;
  }

  /**
   * Schema.org Service strukturált adat szolgáltatásokhoz
   *
   * @param {Object} service - Szolgáltatás adatai
   * @returns {Object} JSON-LD strukturált adat
   */
  generateServiceSchema(service) {
    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'Service',
      name: service.name,
      description: service.description,
      provider: {
        '@type': 'Organization',
        name: 'DMF Art Média Kft.',
        url: this.defaultSettings.siteDomain
      },
      areaServed: {
        '@type': 'Country',
        name: 'Hungary'
      },
      serviceType: service.type || 'Rendezvényszervezés'
    };
  }

  /**
   * Schema.org FAQPage strukturált adat
   *
   * @param {Array} faqs - FAQ kérdések és válaszok tömbje
   * @returns {Object} JSON-LD strukturált adat
   */
  generateFAQSchema(faqs) {
    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };
  }

  /**
   * Schema.org BreadcrumbList strukturált adat
   *
   * @param {Array} breadcrumbs - Breadcrumb elemek tömbje
   * @returns {Object} JSON-LD strukturált adat
   */
  generateBreadcrumbSchema(breadcrumbs) {
    return {
      '@context': SCHEMA_CONTEXT,
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url
      }))
    };
  }

  /**
   * Alt szöveg generálás képekhez AI-alapon
   *
   * @param {string} imageName - Kép fájlneve
   * @param {Object} context - Kontextus információk
   * @returns {string} Generált alt szöveg
   */
  generateImageAlt(imageName, context = {}) {
    // Fájlnév tisztítása és feldolgozása
    const cleanName = imageName
      .replace(/\.[^/.]+$/, '') // Kiterjesztés eltávolítása
      .replace(/[-_]/g, ' ') // Kötőjelek és alulvonások cseréje
      .replace(/\d+/g, '') // Számok eltávolítása
      .trim();

    // Kontextus alapú kiegészítés
    let altText = cleanName;

    if (context.performerName) {
      altText = `${context.performerName} - ${cleanName}`;
    }

    if (context.eventType) {
      altText += ` - ${context.eventType}`;
    }

    // Kulcsszavak hozzáadása SEO célból
    if (context.category) {
      altText += ` | ${context.category}`;
    }

    // Első betű nagybetűssé
    altText = altText.charAt(0).toUpperCase() + altText.slice(1);

    return altText || 'Kép';
  }

  /**
   * Kulcsszó sűrűség ellenőrzés és optimalizálás
   *
   * @param {string} content - Tartalom szöveg
   * @param {string} keyword - Célt kulcsszó
   * @returns {Object} Kulcsszó analízis
   */
  analyzeKeywordDensity(content, keyword) {
    const words = content.toLowerCase().split(/\s+/);
    const keywordLower = keyword.toLowerCase();
    const keywordCount = words.filter((word) => word.includes(keywordLower)).length;
    const totalWords = words.length;
    const density = (keywordCount / totalWords) * 100;

    return {
      keyword,
      count: keywordCount,
      totalWords,
      density: density.toFixed(2),
      optimal: density >= 1 && density <= 3,
      recommendation: this.getKeywordRecommendation(density)
    };
  }

  /**
   * Kulcsszó ajánlás generálás
   *
   * @param {number} density - Kulcsszó sűrűség százalékban
   * @returns {string} Ajánlás szöveg
   */
  getKeywordRecommendation(density) {
    if (density < 1) {
      return 'A kulcsszó ritkán szerepel. Javasolt növelni a gyakoriságot.';
    } else if (density > 3) {
      return 'Túl gyakori kulcsszó használat (keyword stuffing). Javasolt csökkenteni.';
    }
    return 'Optimális kulcsszó sűrűség.';
  }

  /**
   * Slug generálás URL-ekhez
   *
   * @param {string} text - Szöveg
   * @returns {string} URL-barát slug
   */
  generateSlug(text) {
    const hungarianMap = {
      á: 'a', é: 'e', í: 'i', ó: 'o', ö: 'o', ő: 'o',
      ú: 'u', ü: 'u', ű: 'u',
      Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ö: 'O', Ő: 'O',
      Ú: 'U', Ü: 'U', Ű: 'U'
    };

    return text
      .split('')
      .map((char) => hungarianMap[char] || char)
      .join('')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Meta description optimalizálás
   *
   * @param {string} description - Eredeti leírás
   * @param {number} maxLength - Maximum hossz (alapértelmezett: 155)
   * @returns {string} Optimalizált leírás
   */
  optimizeMetaDescription(description, maxLength = 155) {
    if (!description) {return this.defaultSettings.defaultDescription;}

    // Trim és HTML tagek eltávolítása
    let clean = description.replace(/<[^>]*>/g, '').trim();

    // Hossz ellenőrzés
    if (clean.length <= maxLength) {return clean;}

    // Vágás az utolsó teljes mondatnál vagy szónál
    clean = clean.substring(0, maxLength);
    const lastSpace = clean.lastIndexOf(' ');
    if (lastSpace > 0) {
      clean = clean.substring(0, lastSpace);
    }

    return `${clean}...`;
  }

  /**
   * URL validálás és normalizálás
   *
   * @param {string} url - URL cím
   * @returns {string} Normalizált URL
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url, this.defaultSettings.siteDomain);
      return urlObj.toString();
    } catch {
      const cleanUrl = url.startsWith('/') ? url : `/${url}`;
      return `${this.defaultSettings.siteDomain}${cleanUrl}`;
    }
  }

  /**
   * Core Web Vitals optimalizálási javaslatok
   *
   * @returns {Object} Optimalizálási tippek
   */
  getCoreWebVitalsTips() {
    return {
      LCP: {
        name: 'Largest Contentful Paint',
        target: '< 2.5s',
        tips: [
          'Képek optimalizálása és lazy loading használata',
          'Server-side rendering alkalmazása',
          'CDN használata statikus tartalmakhoz',
          'Kritikus CSS inline betöltése'
        ]
      },
      FID: {
        name: 'First Input Delay',
        target: '< 100ms',
        tips: [
          'JavaScript kód optimalizálása és code splitting',
          'Web workers használata nehéz számításokhoz',
          'Third-party scriptek lazy loadingja',
          'Long tasks felosztása kisebb taskokra'
        ]
      },
      CLS: {
        name: 'Cumulative Layout Shift',
        target: '< 0.1',
        tips: [
          'Width és height attribútumok használata képeknél',
          'Font-display: swap használata webfontoknál',
          'Dinamikus tartalmak helyfoglalásának biztosítása',
          'Animációk transform és opacity használata'
        ]
      }
    };
  }
}

// Singleton példány
const seoService = new SEOService();

module.exports = seoService;
