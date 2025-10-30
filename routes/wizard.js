const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { findActivePerformer, handlePerformerNotFound } = require('./helpers/booking-helpers');

// Wizard for specific performer
router.get('/:performerId', async (req, res) => {
  try {
    const performer = await findActivePerformer(req.params.performerId);

    if (!performer) {
      return handlePerformerNotFound(res);
    }

    res.render('wizard/performer-booking', {
      title: `Ajánlatkérés - ${performer.name} - ${res.locals.siteName}`,
      performer,
      pageDescription: `Kérjen ajánlatot ${performer.name} előadótól rendezvényére. Lépésenkénti foglalási folyamat.`,
      currentPage: 'booking'
    });
  } catch (error) {
    logger.error('Error loading performer wizard:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni az ajánlatkérő oldalt',
      statusCode: 500
    });
  }
});

module.exports = router;
