/**
 * Performer Route Helpers
 * Helper functions for performer routes to keep the main route file clean
 */

const { Performer } = require('../../models');
const { Op } = require('sequelize');
const {
  getCategoryDisplayName,
  getAllCategories,
  getCategorySlug,
  getSeoKeywordsSubset
} = require('../../middleware/navigation');
const {
  getStyleMetaDescription,
  getCategoryMetaDescription,
  generatePerformersListSchema
} = require('../../utils/seo-helpers');

/**
 * Get related performers by price range
 */
async function getRelatedPerformersByPrice(
  performer, minPriceMultiplier, maxPriceMultiplier, excludeIds = [], limit = null
) {
  const whereClause = {
    category: performer.category,
    id: { [Op.ne]: performer.id },
    isActive: true
  };

  if (excludeIds.length > 0) {
    whereClause.id = {
      [Op.and]: [
        { [Op.ne]: performer.id },
        { [Op.notIn]: excludeIds }
      ]
    };
  }

  if (performer.price && performer.price > 0) {
    const minPrice = performer.price * minPriceMultiplier;
    const maxPrice = performer.price * maxPriceMultiplier;

    whereClause.price = {
      [Op.and]: [
        { [Op.gte]: minPrice },
        { [Op.lte]: maxPrice }
      ]
    };
  }

  const query = {
    where: whereClause,
    order: [['name', 'ASC']]
  };

  if (limit) {
    query.limit = limit;
  }

  return await Performer.findAll(query);
}

/**
 * Get related performers with fallback tiers
 */
async function getRelatedPerformers(performer) {
  // First tier: -10% +20% price range
  const firstTier = await getRelatedPerformersByPrice(performer, 0.9, 1.2);

  if (firstTier.length >= 6) {
    return firstTier.slice(0, 6);
  }

  // Second tier: -20% +40% price range
  const secondTier = await getRelatedPerformersByPrice(
    performer,
    0.8,
    1.4,
    firstTier.map((p) => p.id),
    6 - firstTier.length
  );

  let combined = [...firstTier, ...secondTier];

  if (combined.length >= 6) {
    return combined.slice(0, 6);
  }

  // Third tier: any price from same category
  const thirdTier = await Performer.findAll({
    where: {
      category: performer.category,
      id: {
        [Op.and]: [
          { [Op.ne]: performer.id },
          { [Op.notIn]: combined.map((p) => p.id) }
        ]
      },
      isActive: true
    },
    order: [['name', 'ASC']],
    limit: 6 - combined.length
  });

  combined = [...combined, ...thirdTier];

  return combined.slice(0, 6);
}

/**
 * Check if prices can be shown to user
 */
function canShowPrices(req) {
  return req.session && req.session.userId;
}

/**
 * Handle template rendering
 */
function handleTemplateRendering(res, renderData) {
  res.render('performers/index', renderData);
}

/**
 * Extract category parameters from request
 */
function extractCategoryParams(req) {
  return {
    categorySlug: req.params.category,
    page: parseInt(req.query.page, 10) || 1,
    search: req.query.search || '',
    sort: req.query.sort || 'name',
    priceMin: req.query.priceMin ? parseFloat(req.query.priceMin) : null,
    priceMax: req.query.priceMax ? parseFloat(req.query.priceMax) : null,
    styleFilter: req.query.style || null
  };
}

/**
 * Find category by slug
 */
async function findCategoryBySlug(categorySlug) {
  const allCategories = await getAllCategories();
  return allCategories.find((cat) => getCategorySlug(cat) === categorySlug);
}

/**
 * Get performers by category with filters
 */
async function getPerformersByCategory(actualCategory, params) {
  const { buildPerformerQuery, calculatePaginationMeta } = require('./performer-query-builder');
  const sequelize = require('sequelize');

  const queryOptions = buildPerformerQuery({
    category: actualCategory,
    search: params.search,
    sort: params.sort,
    page: params.page,
    limit: params.limit || 12,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    styleFilter: params.styleFilter
  });

  const { count, rows: performers } = await Performer.findAndCountAll(queryOptions);
  const { totalPages } = calculatePaginationMeta(count, params.page, params.limit || 12);

  // Get min/max prices for slider range
  const priceRange = await Performer.findAll({
    where: { isActive: true, price: { [Op.not]: null } },
    attributes: [
      [sequelize.fn('MIN', sequelize.col('price')), 'minPrice'],
      [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
    ],
    raw: true
  });

  const minPrice = priceRange[0]?.minPrice || 0;
  const maxPrice = priceRange[0]?.maxPrice || 500000;

  return {
    performers,
    count,
    totalPages,
    minPrice,
    maxPrice,
    pagination: {
      currentPage: params.page,
      totalPages,
      totalCount: count,
      perPage: params.limit || 12
    }
  };
}

/**
 * Build available categories list
 */
async function buildAvailableCategoriesList() {
  const allCategories = await getAllCategories();
  return allCategories.map((cat) => ({
    name: getCategoryDisplayName(cat),
    slug: getCategorySlug(cat)
  }));
}

/**
 * Build category page render data
 */
function buildCategoryPageRenderData({
  params, actualCategory, performerData, availableCategories, availableStyles, req
}) {
  const categoryName = getCategoryDisplayName(actualCategory);
  const categorySlug = getCategorySlug(actualCategory);

  let pageDescription;
  if (params.styleFilter) {
    pageDescription = getStyleMetaDescription(params.styleFilter, performerData.count);
  } else {
    pageDescription = getCategoryMetaDescription(actualCategory, performerData.count);
  }

  // Transform performers to include category display name and status badges
  const performersWithDisplay = performerData.performers.map((performer) => {
    const displayName = getCategoryDisplayName(performer.category);
    return {
      id: performer.id,
      name: performer.name,
      slug: performer.slug,
      category: performer.category,
      categoryDisplayName: displayName,
      imageUrl: performer.imageUrl,
      price: performer.price,
      shortDescription: performer.shortDescription,
      style: performer.style,
      isFeatured: performer.isFeatured,
      isPopular: performer.isPopular,
      hasDiscount: performer.hasDiscount,
      showPrice: canShowPrices(req)
    };
  });

  return {
    title: `${categoryName} - Előadók`,
    pageTitle: categoryName,
    pageDescription,
    categoryName, // Add for routes usage
    performers: performersWithDisplay,
    pagination: performerData.pagination,
    totalCount: performerData.count,
    totalPages: performerData.totalPages,
    search: params.search,
    sort: params.sort,
    category: params.categorySlug,
    actualCategory,
    minPrice: performerData.minPrice,
    maxPrice: performerData.maxPrice,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    styleFilter: params.styleFilter,
    activeFilters: {
      category: categoryName,
      categorySlug,
      search: params.search,
      sort: params.sort,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      style: params.styleFilter
    },
    availableCategories,
    availableStyles: availableStyles || [],
    showPrices: canShowPrices(req),
    seoKeywords: getSeoKeywordsSubset(actualCategory),
    currentPage: 'eloadok'
  };
}

/**
 * Add structured data to category page
 */
function addStructuredDataToCategoryPage(renderData, req, res) {
  const listName = renderData.activeFilters.style
    ? `${renderData.activeFilters.style} előadók`
    : `${renderData.activeFilters.category} előadók`;

  const listSchema = generatePerformersListSchema(
    renderData.performers,
    res.locals.siteDomain,
    listName
  );

  renderData.structuredData = listSchema;
  return renderData;
}

module.exports = {
  getRelatedPerformersByPrice,
  getRelatedPerformers,
  canShowPrices,
  handleTemplateRendering,
  extractCategoryParams,
  findCategoryBySlug,
  getPerformersByCategory,
  buildAvailableCategoriesList,
  buildCategoryPageRenderData,
  addStructuredDataToCategoryPage
};
