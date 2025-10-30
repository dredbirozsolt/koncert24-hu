/**
 * Performer Query Builder Helpers
 * Common functions for building Sequelize queries for performers
 */

const { Op } = require('sequelize');

/**
 * Build sort order clause for performers
 * @param {string} sort - Sort parameter ('name', 'name-desc', 'price', 'price-desc')
 * @returns {Array} Sequelize order clause
 */
function buildSortOrder(sort) {
  switch (sort) {
    case 'name-desc':
      return [['name', 'DESC']];
    case 'price':
      return [['price', 'ASC'], ['name', 'ASC']];
    case 'price-desc':
      return [['price', 'DESC'], ['name', 'ASC']];
    case 'name':
    default:
      return [['name', 'ASC']];
  }
}

/**
 * Build where clause for performer queries
 * @param {Object} options - Query options
 * @param {string} options.category - Category filter (optional)
 * @param {string} options.search - Search term (optional)
 * @param {number} options.priceMin - Minimum price filter (optional)
 * @param {number} options.priceMax - Maximum price filter (optional)
 * @param {string} options.styleFilter - Style filter (optional)
 * @param {string} options.performanceTypeFilter - Performance type filter (optional)
 * @param {boolean} options.isActive - Active status filter (default: true)
 * @returns {Object} Sequelize where clause
 */
function buildWhereClause({
  category = null,
  search = '',
  priceMin = null,
  priceMax = null,
  styleFilter = null,
  performanceTypeFilter = null,
  isActive = true
}) {
  const whereClause = {
    isActive
  };

  if (category) {
    whereClause.category = category;
  }

  if (search) {
    whereClause.name = { [Op.like]: `%${search}%` };
  }

  // Add price range filter
  if (priceMin !== null || priceMax !== null) {
    whereClause.price = {};

    if (priceMin !== null) {
      whereClause.price[Op.gte] = priceMin;
    }

    if (priceMax !== null) {
      whereClause.price[Op.lte] = priceMax;
    }
  }

  // Add style filter using JSON_CONTAINS
  if (styleFilter) {
    whereClause.style = { [Op.ne]: null };
    // Use Sequelize.literal for JSON_CONTAINS
    const { Sequelize } = require('sequelize');
    whereClause[Op.and] = Sequelize.literal(`JSON_CONTAINS(style, '"${styleFilter}"')`);
  }

  // Add performance type filter
  if (performanceTypeFilter) {
    whereClause.performanceType = performanceTypeFilter;
  }

  return whereClause;
}

/**
 * Build pagination parameters
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} Pagination parameters { limit, offset }
 */
function buildPagination(page = 1, limit = 12) {
  const offset = (page - 1) * limit;
  return { limit, offset };
}

/**
 * Calculate pagination metadata
 * @param {number} count - Total item count
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata { totalPages, hasMore, currentPage }
 */
function calculatePaginationMeta(count, page, limit) {
  const totalPages = Math.ceil(count / limit);
  const hasMore = page < totalPages;

  return {
    totalPages,
    hasMore,
    currentPage: page
  };
}

/**
 * Build complete query options for performers
 * @param {Object} params - Query parameters
 * @param {string} params.category - Category filter
 * @param {string} params.search - Search term
 * @param {string} params.sort - Sort order
 * @param {number} params.priceMin - Minimum price filter
 * @param {number} params.priceMax - Maximum price filter
 * @param {string} params.styleFilter - Style filter
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @returns {Object} Complete Sequelize query options
 */
function buildPerformerQuery({
  category,
  search,
  sort,
  priceMin,
  priceMax,
  styleFilter,
  performanceTypeFilter,
  page,
  limit
}) {
  const whereClause = buildWhereClause({
    category,
    search,
    priceMin,
    priceMax,
    styleFilter,
    performanceTypeFilter
  });
  const orderClause = buildSortOrder(sort);
  const { limit: queryLimit, offset } = buildPagination(page, limit);

  return {
    where: whereClause,
    order: orderClause,
    limit: queryLimit,
    offset
  };
}

module.exports = {
  buildSortOrder,
  buildWhereClause,
  buildPagination,
  calculatePaginationMeta,
  buildPerformerQuery
};
