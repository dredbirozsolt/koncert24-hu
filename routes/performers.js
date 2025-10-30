const express = require('express');
const router = express.Router();
const { Performer } = require('../models');
const { Op } = require('sequelize');
const { SyncService } = require('../services/syncService');
const logger = require('../config/logger');
const {
  getCategoryDisplayName,
  getAllCategories,
  getCategorySlug
} = require('../middleware/navigation');
const {
  buildPerformerQuery,
  calculatePaginationMeta
} = require('./helpers/performer-query-builder');
const {
  getRelatedPerformers,
  canShowPrices,
  extractCategoryParams,
  findCategoryBySlug,
  getPerformersByCategory,
  buildAvailableCategoriesList,
  buildCategoryPageRenderData,
  addStructuredDataToCategoryPage
} = require('./helpers/performer-helpers');
const {
  getMainPerformersMetaDescription,
  getPerformerMetaDescription,
  generatePerformerSchema,
  generatePerformersListSchema,
  generateBreadcrumbSchema
} = require('../utils/seo-helpers');

// Initialize sync service
const syncService = new SyncService();

// API endpoint to get available categories
router.get('/api/categories', async (req, res) => {
  try {
    const categories = await getAllCategories();
    const categoriesWithNames = categories.map((category) => ({
      key: category,
      name: getCategoryDisplayName(category)
    }));

    res.json({
      success: true,
      categories: categoriesWithNames
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load categories'
    });
  }
});

// API endpoint for performer search (autocomplete)
router.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || '';

    if (query.length < 2) {
      return res.json({
        success: true,
        performers: []
      });
    }

    const performers = await Performer.findAll({
      where: {
        isActive: true,
        name: { [Op.like]: `%${query}%` }
      },
      order: [['name', 'ASC']],
      limit: 10,
      attributes: ['id', 'name', 'slug', 'category', 'price', 'style']
    });

    const formattedPerformers = performers.map((performer) => ({
      id: performer.id,
      name: performer.name,
      slug: performer.slug,
      category: getCategoryDisplayName(performer.category),
      price: performer.price,
      style: performer.style
    }));

    res.json({
      success: true,
      performers: formattedPerformers
    });
  } catch (error) {
    logger.error('Error searching performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search performers'
    });
  }
});

// AJAX endpoint for infinite scroll
router.get('/api/load-more', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationPerformers || 12;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const sort = req.query.sort || 'name';
    const priceMin = req.query.priceMin ? parseInt(req.query.priceMin) : null;
    const priceMax = req.query.priceMax ? parseInt(req.query.priceMax) : null;
    const styleFilter = req.query.style || null;
    const performanceTypeFilter = req.query.performanceType || null;

    const queryOptions = buildPerformerQuery({
      category,
      search,
      sort,
      page,
      limit,
      priceMin,
      priceMax,
      styleFilter,
      performanceTypeFilter
    });
    const { count, rows: performers } = await Performer.findAndCountAll(queryOptions);
    const { totalPages, hasMore, currentPage } = calculatePaginationMeta(count, page, limit);

    res.json({
      success: true,
      performers: performers.map((performer) => ({
        id: performer.id,
        name: performer.name,
        slug: performer.slug,
        category: performer.category,
        categoryDisplayName: getCategoryDisplayName(performer.category),
        performanceType: performer.performanceType,
        imageUrl: performer.imageUrl,
        price: performer.price,
        shortDescription: performer.shortDescription,
        style: performer.style,
        status: performer.status,
        showPrice: canShowPrices(req)
      })),
      hasMore,
      currentPage,
      totalPages
    });
  } catch (error) {
    logger.error('Error loading more performers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load performers'
    });
  }
});

// Összes előadó
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationPerformers || 12;
    const search = req.query.search || '';
    const sort = req.query.sort || 'name';
    const priceMin = req.query.priceMin ? parseInt(req.query.priceMin) : null;
    const priceMax = req.query.priceMax ? parseInt(req.query.priceMax) : null;
    const styleFilter = req.query.style || null;
    const performanceTypeFilter = req.query.performanceType || null;

    const queryOptions = buildPerformerQuery({
      category: null,
      search,
      sort,
      page,
      limit,
      priceMin,
      priceMax,
      styleFilter,
      performanceTypeFilter
    });
    const { count, rows: performers } = await Performer.findAndCountAll(queryOptions);
    const { totalPages } = calculatePaginationMeta(count, page, limit);

    // Get available categories for navigation
    const categories = await getAllCategories();
    const availableCategories = categories.map((category) => ({
      key: category,
      slug: getCategorySlug(category),
      name: getCategoryDisplayName(category)
    }));

    // Get min/max prices for slider range
    const priceRange = await Performer.findAll({
      where: { isActive: true, price: { [Op.not]: null } },
      attributes: [
        [require('sequelize').fn('MIN', require('sequelize').col('price')), 'minPrice'],
        [require('sequelize').fn('MAX', require('sequelize').col('price')), 'maxPrice']
      ],
      raw: true
    });

    const minPrice = priceRange[0]?.minPrice || 0;
    const maxPrice = priceRange[0]?.maxPrice || 500000;

    // Get all available styles from performers
    const stylesResult = await Performer.findAll({
      where: { isActive: true, style: { [Op.not]: null } },
      attributes: ['style'],
      raw: true
    });

    const allStyles = new Set();
    stylesResult.forEach((performer) => {
      if (Array.isArray(performer.style)) {
        performer.style.forEach((style) => allStyles.add(style));
      }
    });
    const availableStyles = Array.from(allStyles).sort();

    // Get all available performance types from performers
    const performanceTypesResult = await Performer.findAll({
      where: { isActive: true, performanceType: { [Op.not]: null } },
      attributes: ['performanceType'],
      raw: true
    });

    const allPerformanceTypes = new Set();
    performanceTypesResult.forEach((performer) => {
      if (performer.performanceType) {
        allPerformanceTypes.add(performer.performanceType);
      }
    });
    const availablePerformanceTypes = Array.from(allPerformanceTypes).sort();

    // Transform performers to include category display name
    const performersWithDisplay = performers.map((performer) => ({
      id: performer.id,
      name: performer.name,
      slug: performer.slug,
      category: performer.category,
      categoryDisplayName: getCategoryDisplayName(performer.category),
      performanceType: performer.performanceType,
      imageUrl: performer.imageUrl,
      price: performer.price,
      shortDescription: performer.shortDescription,
      style: performer.style,
      status: performer.status,
      showPrice: Boolean(req.session.userId)
    }));

    // Generate structured data for listing
    const listSchema = generatePerformersListSchema(
      performersWithDisplay,
      res.locals.siteDomain,
      'Összes előadó'
    );

    res.render('performers/index', {
      title: `Összes előadó - ${res.locals.siteName}`,
      performers: performersWithDisplay,
      currentPage: page,
      totalPages,
      search: search || '',
      sort: sort || 'name',
      category: null,
      actualCategory: null,
      categoryName: 'Összes előadó',
      totalCount: count,
      availableCategories,
      availableStyles,
      availablePerformanceTypes,
      styleFilter,
      performanceTypeFilter,
      minPrice,
      maxPrice,
      priceMin,
      priceMax,
      pageDescription: getMainPerformersMetaDescription(count),
      structuredData: listSchema
    });
  } catch (error) {
    logger.error('Error loading performers:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni az előadókat',
      statusCode: 500
    });
  }
});

// Kategória szerint
router.get('/kategoria/:category', async (req, res) => {
  try {
    const params = extractCategoryParams(req);
    const actualCategory = await findCategoryBySlug(params.categorySlug);

    if (!actualCategory) {
      logger.warn({
        service: 'performers',
        operation: 'categoryPage',
        categorySlug: params.categorySlug
      }, 'Category not found for slug');
      return res.status(404).render('error', {
        title: 'Kategória nem található',
        message: 'A keresett kategória nem található',
        statusCode: 404
      });
    }

    const performerData = await getPerformersByCategory(actualCategory, params);
    const availableCategories = await buildAvailableCategoriesList();

    // Get available styles
    const stylesResult = await Performer.findAll({
      where: { isActive: true, style: { [Op.not]: null } },
      attributes: ['style'],
      raw: true
    });
    const allStyles = new Set();
    stylesResult.forEach((performer) => {
      if (Array.isArray(performer.style)) {
        performer.style.forEach((style) => allStyles.add(style));
      }
    });
    const availableStyles = Array.from(allStyles).sort();

    const renderData = buildCategoryPageRenderData({
      params,
      actualCategory,
      performerData,
      availableCategories,
      availableStyles,
      req
    });

    // Add dynamic site name to title
    renderData.title = `${renderData.categoryName} előadók - ${res.locals.siteName}`;

    // Add structured data
    addStructuredDataToCategoryPage(renderData, req, res);

    res.render('performers/index', renderData);
  } catch (error) {
    logger.error('Error loading performers by category:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni az előadókat',
      statusCode: 500
    });
  }
});

// Előladó részletei
router.get('/:slug', async (req, res) => {
  try {
    const performer = await Performer.findOne({
      where: {
        slug: req.params.slug,
        isActive: true
      }
    });

    if (!performer) {
      return res.status(404).render('error', {
        title: 'Előadó nem található',
        message: 'A keresett előadó nem található vagy nem elérhető',
        statusCode: 404
      });
    }

    const categoryDisplayName = getCategoryDisplayName(performer.category);
    const relatedPerformers = await getRelatedPerformers(performer);

    // Generate structured data
    const performerSchema = generatePerformerSchema(performer, res.locals.siteDomain);
    const breadcrumbs = generateBreadcrumbSchema([
      { name: 'Főoldal', url: res.locals.siteDomain },
      { name: 'Előadók', url: `${res.locals.siteDomain}/eloadok` },
      { name: performer.name, url: `${res.locals.siteDomain}/eloadok/${performer.slug}` }
    ]);

    res.render('performers/detail', {
      title: `${performer.name} - ${categoryDisplayName} - ${res.locals.siteName}`,
      pageTitle: `${performer.name} - Előadó - ${res.locals.siteName}`,
      pageDescription: getPerformerMetaDescription(performer),
      image: performer.imageUrl, // OG:image - előadó fotója
      structuredData: [performerSchema, breadcrumbs],
      performer,
      relatedPerformers,
      categoryDisplayName,
      currentPage: 'eloadok'
    });
  } catch (error) {
    logger.error('Performer detail error:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt az előadó betöltése során',
      statusCode: 500
    });
  }
});

// VTiger sync endpoint (admin only - később auth middleware-rel védeni kell)
// Manual VTiger sync endpoint (admin only - no requireAdmin middleware, protected by session check in route)
router.post('/sync-vtiger', async (req, res) => {
  try {
    logger.info({
      service: 'performers',
      operation: 'manualVtigerSync',
      userId: req.user?.id
    }, 'Manual vTiger sync initiated');

    // Use the new SyncService for manual sync
    const result = await syncService.syncPerformers(true);

    if (result.success) {
      res.json({
        success: true,
        message: 'vTiger szinkronizálás sikeresen befejezve',
        stats: result.stats,
        duration: result.duration,
        nextScheduledSync: syncService.getNextSyncTime()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'vTiger szinkronizálás sikertelen',
        error: result.error,
        stats: result.stats
      });
    }
  } catch (error) {
    logger.error('❌ Kézi vTiger szinkronizálás sikertelen:', error);
    res.status(500).json({
      success: false,
      message: 'vTiger szinkronizálás sikertelen',
      error: error.message
    });
  }
});

module.exports = router;
