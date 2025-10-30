/**
 * Category Helpers
 * Common functions for category-related operations
 */

const { Performer } = require('../../models');

/**
 * Get active categories with metadata
 * @returns {Promise<Array>} Array of categories with metadata
 */
async function getActiveCategoriesWithMetadata() {
  // Get active categories
  const activeCategories = await Performer.findAll({
    where: { isActive: true },
    attributes: ['category'],
    group: ['category'],
    order: [['category', 'ASC']]
  });

  // Enrich with metadata
  return activeCategories.map((item) => {
    const performer = new Performer({ category: item.category });

    return {
      key: item.category,
      slug: performer.getCategorySlug(),
      name: performer.getCategoryDisplayName(),
      ...Performer.getCategoryMetadata(performer.getCategorySlug())
    };
  });
}

/**
 * Get active categories with performer counts
 * @returns {Promise<Array>} Array of categories with metadata and counts
 */
async function getActiveCategoriesWithCount() {
  const enrichedCategories = await getActiveCategoriesWithMetadata();

  // Add performer counts
  return await Promise.all(
    enrichedCategories.map(async (category) => {
      const count = await Performer.count({
        where: {
          isActive: true,
          category: category.key
        }
      });
      return {
        ...category,
        count
      };
    })
  );
}

/**
 * Check if user can see prices
 * @param {Object} req - Express request object
 * @returns {boolean} True if user is logged in and email verified
 */
function canShowPrices(req) {
  return Boolean(req.session.userId && req.session.user && req.session.user.emailVerified);
}

/**
 * Add price visibility and category display name to performers
 * @param {Array} performers - Array of performer instances
 * @param {boolean} showPrice - Whether to show prices
 * @returns {Array} Transformed performers with additional fields
 */
function enrichPerformersWithMetadata(performers, showPrice = false) {
  return performers.map((performer) => ({
    ...performer.toJSON(),
    showPrice,
    categoryDisplayName: performer.getCategoryDisplayName(),
    performanceType: performer.performanceType
  }));
}

module.exports = {
  getActiveCategoriesWithMetadata,
  getActiveCategoriesWithCount,
  canShowPrices,
  enrichPerformersWithMetadata
};
