const express = require('express');
const { getSeoKeywordsSubset } = require('../middleware/navigation');
const router = express.Router();
const { Performer, Partner } = require('../models');
const {
  getActiveCategoriesWithCount,
  getActiveCategoriesWithMetadata,
  canShowPrices,
  enrichPerformersWithMetadata
} = require('./helpers/category-helpers');

/**
 * Helper: Get featured performers (6 random, unique names and categories)
 */
async function getFeaturedPerformers() {
  const allPerformers = await Performer.findAll({
    where: { isActive: true },
    order: [['id', 'ASC']]
  });

  const shuffledPerformers = allPerformers.sort(() => Math.random() - 0.5);

  const seenNames = new Set();
  const seenCategories = new Set();
  const featuredPerformers = [];

  for (const performer of shuffledPerformers) {
    if (!seenNames.has(performer.name)
        && !seenCategories.has(performer.category)
        && featuredPerformers.length < 6) {
      seenNames.add(performer.name);
      seenCategories.add(performer.category);
      featuredPerformers.push(performer);
    }
  }

  return featuredPerformers;
}

/**
 * Helper: Get homepage partners
 */
async function getHomepagePartners() {
  return await Partner.findAll({
    where: {
      showOnHomepage: true,
      status: 'active'
    },
    order: [['displayOrder', 'ASC']],
    limit: 6
  });
}

// Főoldal - Rendezvényszervezés
router.get('/', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');

    const featuredPerformers = await getFeaturedPerformers();
    const homepagePartners = await getHomepagePartners();

    const showPrice = canShowPrices(req);
    const featuredPerformersWithPrice = enrichPerformersWithMetadata(featuredPerformers, showPrice);

    // Get all unique styles from database
    const performers = await Performer.findAll({
      attributes: ['style'],
      where: {
        style: { [sequelize.Sequelize.Op.ne]: null },
        isActive: true
      },
      raw: true
    });

    // Extract and flatten all styles
    const stylesSet = new Set();
    performers.forEach((p) => {
      if (p.style && Array.isArray(p.style)) {
        p.style.forEach((style) => stylesSet.add(style));
      }
    });

    // Convert to array and sort
    const styles = Array.from(stylesSet).sort();

    // Map styles to emoji icons
    const styleIconMap = {
      Pop: '🎤',
      Rock: '🎸',
      Retro: '🕺',
      Mulatós: '🎺',
      'Party zenekar': '🎉',
      Influencer: '📱',
      Színház: '🎭',
      Dj: '🎧',
      Műsorvezető: '🎙️',
      Egyéb: '🌈',
      Acapella: '👥',
      Táncprodukció: '💃',
      Gyermekműsor: '🧸',
      Tribute: '🎶',
      'Musical - Operett': '🎵',
      'Folk - World - Country': '🪗',
      'Rap - Hip-Hop - Trap': '🎤',
      'Jazz - Blues - Swing': '🎷',
      'Stand-up - Humor': '😂'
    };

    // Create styles array with metadata
    const stylesWithMetadata = styles.map((style) => ({
      name: style,
      icon: styleIconMap[style] || '🎤',
      slug: style.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
      urlParam: encodeURIComponent(style)
    }));

    res.render('event-planning', {
      title: 'Rendezvényszervezés - Koncert24.hu',
      description: 'Komplett rendezvényszervezési szolgáltatás. '
        + 'Találd meg és foglald le a tökéletes előadót, zenekart vagy DJ-t rendezvényedre.',
      featuredPerformers: featuredPerformersWithPrice,
      homepagePartners,
      styles: stylesWithMetadata,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    req.log.error('Error loading event planning page:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni az oldalt',
      statusCode: 500
    });
  }
});

/**
 * GET /alternative2 - Modern booking homepage with wizard
 */
router.get('/alternative2', async (req, res) => {
  try {
    const { sequelize } = require('../config/database');

    // Get all unique styles from database
    const performers = await Performer.findAll({
      attributes: ['style'],
      where: {
        style: { [sequelize.Sequelize.Op.ne]: null },
        isActive: true
      },
      raw: true
    });

    // Extract and flatten all styles
    const stylesSet = new Set();
    performers.forEach((p) => {
      if (p.style && Array.isArray(p.style)) {
        p.style.forEach((style) => stylesSet.add(style));
      }
    });

    // Convert to array and sort
    const styles = Array.from(stylesSet).sort();

    // Map styles to emoji icons
    const styleIconMap = {
      Pop: '🎤',
      Rock: '🎸',
      Retro: '🕺',
      Mulatós: '🎺',
      'Party zenekar': '🎉',
      Influencer: '📱',
      Színház: '🎭',
      Dj: '🎧',
      Műsorvezető: '🎙️',
      Egyéb: '🌈',
      Acapella: '👥',
      Táncprodukció: '💃',
      Gyermekműsor: '🧸',
      Tribute: '🎶',
      'Musical - Operett': '🎵',
      'Folk - World - Country': '🪗',
      'Rap - Hip-Hop - Trap': '🎤',
      'Jazz - Blues - Swing': '🎷',
      'Stand-up - Humor': '😂'
    };

    // Create styles array with metadata
    const stylesWithMetadata = styles.map((style) => ({
      name: style,
      icon: styleIconMap[style] || '�',
      slug: style.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
      urlParam: encodeURIComponent(style)
    }));

    res.render('alternative2', {
      title: 'Találd meg és foglald le a tökéletes előadót - Koncert24.hu',
      description: 'Írd le az eseményed paramétereit, és 24 órán belül ajánlatot kapsz. '
        + '1200+ fellépés évente, átlátható árak, jogtiszta szerződés.',
      styles: stylesWithMetadata
    });
  } catch (error) {
    req.log.error('Error loading alternative2 page:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni az oldalt',
      statusCode: 500
    });
  }
});

module.exports = router;
