const express = require('express');
const { Location } = require('../models');
const { Op } = require('sequelize');
const GeoNamesLocationSyncService = require('../services/geoNamesLocationSyncService');
const logger = require('../config/logger');

const router = express.Router();

// Constants
const ERROR_INTERNAL_SERVER = 'Internal server error';

/**
 * Search locations by name
 * GET /api/locations/search?q=budapest&countries=hu,sk,ro
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, countries = 'hu,sk,ro,rs,ua', limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const countryList = countries.toLowerCase().split(',').map((country) => country.trim());
    const searchLimit = Math.min(parseInt(limit), 50);

    const locations = await Location.findAll({
      where: {
        countryCode: {
          [Op.in]: countryList.map((country) => country.toUpperCase())
        },
        [Op.or]: [
          {
            name: {
              [Op.like]: `${query}%`
            }
          },
          {
            nameEn: {
              [Op.like]: `${query}%`
            }
          },
          {
            name: {
              [Op.like]: `%${query}%`
            }
          }
        ]
      },
      attributes: ['name', 'nameEn', 'countryCode', 'countryName', 'placeType', 'population'],
      order: [
        // Exact matches first - simplified ordering
        ['name', 'ASC']
      ],
      limit: searchLimit
    });

    const results = locations.map((location) => ({
      name: location.name,
      nameEn: location.nameEn,
      country: location.countryName,
      countryCode: location.countryCode,
      type: location.placeType,
      population: location.population,
      displayName: `${location.name}, ${location.countryName}`
    }));

    res.json(results);
  } catch (error) {
    logger.error(
      { err: error, service: 'locations', operation: 'search', query: req.query.q },
      'Location search error'
    );
    res.status(500).json({ error: ERROR_INTERNAL_SERVER, details: error.message });
  }
});

/**
 * Get location statistics
 * GET /api/locations/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Location.findAll({
      attributes: [
        'countryCode',
        'countryName',
        'placeType',
        [Location.sequelize.fn('COUNT', Location.sequelize.col('id')), 'count']
      ],
      group: ['countryCode', 'countryName', 'placeType'],
      order: [['countryCode', 'ASC'], ['placeType', 'ASC']]
    });

    const totalCount = await Location.count();

    res.json({
      total: totalCount,
      byCountry: stats
    });
  } catch (error) {
    logger.error({ err: error, service: 'locations', operation: 'stats' }, 'Location stats error');
    res.status(500).json({ error: ERROR_INTERNAL_SERVER });
  }
});

/**
 * Test GeoNames API connection
 * GET /api/locations/test-geonames
 */
router.get('/test-geonames', async (req, res) => {
  try {
    const service = new GeoNamesLocationSyncService();
    const result = await service.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: 'GeoNames API is working!',
        ready: true,
        nextStep: 'You can now run POST /api/locations/sync'
      });
    } else {
      res.json({
        success: false,
        message: result.message,
        ready: false,
        instructions: [
          '1. Register at http://www.geonames.org/login',
          '2. Enable web services at http://www.geonames.org/manageaccount',
          '3. Update GEONAMES_USERNAME in .env file',
          '4. Restart the server'
        ]
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Trigger location sync (admin endpoint)
 * POST /api/locations/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const locationSyncService = new GeoNamesLocationSyncService();

    // Test connection first
    const connectionTest = await locationSyncService.testConnection();

    if (!connectionTest.success) {
      return res.status(500).json({
        error: 'GeoNames API connection failed',
        details: connectionTest.message
      });
    }

    // Run sync in background
    locationSyncService.syncAllCountries()
      .then((result) => {
        logger.info({ service: 'locations', syncResult: result }, 'Background sync completed');
      })
      .catch((error) => {
        logger.error({ err: error, service: 'locations' }, 'Background sync error');
      });

    res.json({
      message: 'GeoNames location sync started in background',
      api: 'GeoNames',
      note: 'This may take several minutes to complete'
    });
  } catch (error) {
    logger.error({ err: error, service: 'locations', operation: 'syncTrigger' }, 'Sync trigger error');
    res.status(500).json({ error: ERROR_INTERNAL_SERVER });
  }
});

/**
 * Test GeoNames monthly sync (admin endpoint)
 * POST /api/locations/test-monthly-sync
 */
// Test route to manually trigger monthly GeoNames sync (fire-and-forget, responds immediately)
router.post('/test-monthly-sync', (req, res) => {
  try {
    // eslint-disable-next-line global-require -- Test route loads service dynamically to avoid circular dependencies
    const GeoNamesLocationCronService = require('../services/geoNamesLocationCronService');

    // Fire-and-forget: sync runs in background, route responds immediately
    GeoNamesLocationCronService.performMonthlySync()
      .then(() => {
        logger.info({
          service: 'locations',
          operation: 'testMonthlySync',
          status: 'completed'
        }, 'Test monthly sync completed successfully');
      })
      .catch((error) => {
        logger.error('Test monthly sync failed:', error.message);
      });

    res.json({
      success: true,
      message: 'GeoNames monthly sync test started in background',
      note: 'Check server logs and email for results',
      scheduledTime: 'Normally runs: First Sunday of each month at 3:00 AM'
    });
  } catch (error) {
    logger.error('Test monthly sync trigger error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to start test sync',
      message: error.message
    });
  }
});

module.exports = router;
