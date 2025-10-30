/**
 * Booking Helpers
 * Common functions for booking-related operations
 */

const { Performer } = require('../../models');

/**
 * Find active performer by ID
 * @param {number} performerId - Performer ID
 * @returns {Promise<Object|null>} Performer instance or null
 */
async function findActivePerformer(performerId) {
  if (!performerId) {
    return null;
  }

  return await Performer.findOne({
    where: {
      id: performerId,
      isActive: true
    }
  });
}

/**
 * Handle performer not found error
 * @param {Object} res - Express response object
 * @returns {Object} Rendered error page
 */
function handlePerformerNotFound(res) {
  return res.status(404).render('error', {
    title: 'Előadó nem található',
    message: 'A kiválasztott előadó nem található vagy nem elérhető',
    statusCode: 404
  });
}

module.exports = {
  findActivePerformer,
  handlePerformerNotFound
};
