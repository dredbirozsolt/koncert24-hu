const logger = require('../config/logger');
const { Performer, Setting } = require('../models');
const { Op } = require('sequelize');

/**
 * Get display name for category
 * @param {string} category - Category name to format
 * @returns {string} Formatted category display name
 */
function getCategoryDisplayName(category) {
  // Ha már szép formátumú kategória (ékezetes karakterekkel), akkor azt adjuk vissza
  if (category && /[áéíóöőúüű\s/]/.test(category)) {
    return category;
  }

  // Régi URL-barát formátumok átváltása (backward compatibility)
  const displayMap = {
    pop: 'Pop',
    mulatos: 'Mulatós',
    'elo-koncertek': 'Élő koncertek',
    musical: 'Musical-Operett',
    'musical-operett': 'Musical-Operett',
    humorista: 'Humorista',
    gyermek: 'Gyermekműsor',
    gyermekmusor: 'Gyermekműsor',
    kiegeszito: 'Kiegészítő'
  };


  return displayMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Convert category to URL-friendly slug
 * @param {string} category - Category name to convert
 * @returns {string} URL-friendly slug
 */
function getCategorySlug(category) {
  if (!category) {
    return 'egyeb';
  }

  return category
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íî]/g, 'i')
    .replace(/[óöő]/g, 'o')
    .replace(/[úüű]/g, 'u')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get all unique categories from database
 * @returns {Promise<Array<string>>} Array of category names
 */
async function getAllCategories() {
  try {
    const categories = await Performer.findAll({
      attributes: ['category'],
      where: {
        category: {
          [Op.not]: null,
          [Op.ne]: ''
        },
        isActive: true
      },
      group: ['category'],
      order: [['category', 'ASC']],
      raw: true
    });

    return categories.map((cat) => cat.category).filter(Boolean);
  } catch (error) {
    logger.error('Error getting categories from database:', error);

    return [];
  }
}

/**
 * Load company data into res.locals
 * @param {Object} res - Express response object
 */
async function loadCompanyData(res) {
  res.locals.companyLogo = await Setting.get('company.logo') || null;
  res.locals.companyName = await Setting.get('company.name') || '';
  res.locals.companyAddressStreet = await Setting.get('company.address_street') || '';
  res.locals.companyAddressCity = await Setting.get('company.address_city') || '';
  res.locals.companyAddressZip = await Setting.get('company.address_zip') || '';
  res.locals.companyAddressCountry = await Setting.get('company.address_country') || 'Magyarország';
}

/**
 * Load SEO and locale settings into res.locals
 * @param {Object} res - Express response object
 */
async function loadSeoSettings(res) {
  res.locals.locale = await Setting.get('general.locale') || 'hu_HU';
  res.locals.timezone = await Setting.get('general.timezone') || 'Europe/Budapest';

  const defaultKeywords = 'koncert, rendezvény, előadó, fellépő, zenész, esküvő, céges rendezvény';
  const keywordsStr = await Setting.get('seo.default_keywords') || defaultKeywords;
  res.locals.seoKeywords = keywordsStr;
  res.locals.seoKeywordsArray = keywordsStr.split(',').map((k) => k.trim()).filter((k) => k);
}

/**
 * Load social media links into res.locals
 * @param {Object} res - Express response object
 */
async function loadSocialMedia(res) {
  res.locals.socialFacebook = await Setting.get('social.facebook') || '';
  res.locals.socialInstagram = await Setting.get('social.instagram') || '';
  res.locals.socialYoutube = await Setting.get('social.youtube') || '';
  res.locals.socialLinkedin = await Setting.get('social.linkedin') || '';
  res.locals.socialTiktok = await Setting.get('social.tiktok') || '';
}

/**
 * Load pagination settings into res.locals
 * @param {Object} res - Express response object
 */
async function loadPaginationSettings(res) {
  res.locals.paginationBlogPosts = parseInt(await Setting.get('pagination.blog_posts'), 10) || 12;
  res.locals.paginationPerformers = parseInt(await Setting.get('pagination.performers'), 10) || 12;
  res.locals.paginationAdminItems = parseInt(await Setting.get('pagination.admin_items'), 10) || 20;
}

/**
 * Middleware to inject navigation data into response locals
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
async function injectNavigation(req, res, next) {
  try {
    const categories = await getAllCategories();
    const navigationCategories = categories.map((category) => ({
      key: getCategorySlug(category),
      name: getCategoryDisplayName(category),
      url: `${req.basePath || ''}eloadok/kategoria/${getCategorySlug(category)}`
    }));

    res.locals.navigationCategories = navigationCategories;

    // Load all settings groups using helper functions
    await loadCompanyData(res);
    await loadSeoSettings(res);
    await loadSocialMedia(res);
    await loadPaginationSettings(res);

    return next();
  } catch (error) {
    logger.error('Error injecting navigation:', error);
    res.locals.navigationCategories = [];
    res.locals.companyLogo = null;
    res.locals.companyName = '';

    return next();
  }
}

/**
 * SEO helper: Kiválaszt N kulcsszót a dinamikus keywords tömbből
 * @param {Array} keywordsArray - SEO keywords tömb
 * @param {number} count - Hány kulcsszót adjunk vissza
 * @returns {string} Vesszővel elválasztott kulcsszavak
 */
function getSeoKeywordsSubset(keywordsArray = [], count = 3) {
  if (!Array.isArray(keywordsArray) || keywordsArray.length === 0) {
    return '';
  }
  return keywordsArray.slice(0, count).join(', ');
}

module.exports = {
  getCategoryDisplayName,
  getCategorySlug,
  getAllCategories,
  injectNavigation,
  getSeoKeywordsSubset
};
