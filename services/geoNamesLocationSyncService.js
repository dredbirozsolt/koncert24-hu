const axios = require('axios');
const { Location } = require('../models');
const logger = require('../config/logger');
const { geonames } = require('../config/environment');

/**
 * GeoNames-based Location Sync Service
 * Uses GeoNames API for comprehensive settlement data
 */
class GeoNamesLocationSyncService {
  /**
   * Constructor for GeoNames Location Sync Service
   */
  constructor() {
    this.countries = [
      { code: 'HU', name: 'Magyarország', geonamesId: 719819 },
      { code: 'SK', name: 'Szlovákia', geonamesId: 3057568 },
      { code: 'RO', name: 'Románia', geonamesId: 798549 },
      { code: 'RS', name: 'Szerbia', geonamesId: 6290252 },
      { code: 'UA', name: 'Ukrajna', geonamesId: 690791 }
    ];

    this.username = geonames.username;
    this.baseUrl = 'http://api.geonames.org';
  }

  /**
   * Sync all countries using GeoNames API
   */
  async syncAllCountries() {
    logger.info({
      service: 'geoNamesSync',
      operation: 'syncAllCountries',
      countries: this.countries.length
    }, 'Starting GeoNames location sync');

    const results = {
      success: true,
      countries: {},
      totalLocations: 0,
      errors: []
    };

    for (const country of this.countries) {
      try {
        await this.syncCountry(country);

        const count = await Location.count({
          where: { countryCode: country.code }
        });

        results.countries[country.code] = {
          name: country.name,
          count,
          success: true
        };

        results.totalLocations += count;

        // Rate limiting - GeoNames allows 1000 requests per hour for free accounts
        // 4 seconds between countries
        await new Promise((resolve) => setTimeout(resolve, 4000));
      } catch (error) {
        logger.error({
          err: error,
          service: 'geoNamesSync',
          countryCode: country.code,
          countryName: country.name
        }, 'Failed to sync country');
        results.countries[country.code] = {
          name: country.name,
          count: 0,
          success: false,
          error: error.message
        };
        results.errors.push(`${country.name}: ${error.message}`);
      }
    }

    if (results.errors.length > 0) {
      results.success = false;
    }

    logger.info({
      service: 'geoNamesSync',
      operation: 'syncAllCountries',
      totalLocations: results.totalLocations,
      errors: results.errors.length
    }, 'GeoNames sync completed');

    return results;
  }

  /**
   * Sync a single country using GeoNames API
   */
  async syncCountry(country) {
    // Removed verbose log - covered by parent function

    const locations = [];

    // Use filtered approach for all countries - only real settlements
    const adminFeatureCodes = ['PPLC', 'PPLA', 'PPLA2', 'PPLA3'];

    // First, get all administrative centers (capitals, county seats, etc.)
    for (const featureCode of adminFeatureCodes) {
      try {
        const adminLocations = await this.fetchAdminLocations(country, featureCode);

        locations.push(...adminLocations);
      } catch (error) {
        logger.error({
          service: 'geoNamesSync',
          operation: 'fetchLocations',
          country: country.name,
          featureCode,
          error: error.message
        }, 'GeoNames API error');

        if (error.response && error.response.data) {
          logger.error('Response data:', error.response.data);
        }
      }
    }

    // Add filtered PPL settlements (population > 500 or administrative importance) for all countries
    const filteredCities = await this.fetchFilteredCities(country);

    locations.push(...filteredCities);

    // Remove duplicates based on geonameId
    const uniqueLocations = this.removeDuplicates(locations);

    if (uniqueLocations.length > 0) {
      await this.saveLocations(uniqueLocations, country.code);
    } else {
      logger.warn({ service: 'geoNamesSync', countryCode: country.code }, 'No locations found');
    }
  }

  /**
   * Fetch administrative locations for a country and feature code
   */
  async fetchAdminLocations(country, featureCode) {
    const locations = [];
    let startRow = 0;
    const maxRows = 1000;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await axios.get(`${this.baseUrl}/searchJSON`, {
        params: {
          country: country.code,
          featureCode,
          maxRows,
          startRow,
          username: this.username,
          style: 'full'
        },
        timeout: 30000
      });

      if (response.data && response.data.geonames) {
        const parsed = this.parseGeoNamesResponse(response.data.geonames, country, featureCode);

        locations.push(...parsed);

        // Removed verbose batch logging

        hasMoreData = response.data.geonames.length >= maxRows;
        if (hasMoreData) {
          startRow += maxRows;
        }
      } else {
        hasMoreData = false;
      }

      // Rate limiting - important for pagination
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    return locations;
  }

  /**
   * Determine place type based on feature code and population
   */
  determinePlaceType(featureCode, population) {
    // Capital cities
    if (featureCode === 'PPLC') {
      return 'city';
    }

    // Major administrative divisions
    if (['PPLA', 'PPLA2'].includes(featureCode)) {
      return 'city';
    }

    // Minor administrative divisions
    if (['PPLA3', 'PPLA4'].includes(featureCode)) {
      return 'town';
    }

    // General populated places - classify by population
    if (featureCode === 'PPL') {
      const pop = parseInt(population) || 0;

      if (pop > 100000) {
        return 'city';
      }
      if (pop > 10000) {
        return 'town';
      }
      return 'village';
    }

    // Default fallback
    return 'city';
  }

  /**
   * Parse GeoNames API response
   */
  parseGeoNamesResponse(geonamesData, country, featureCode) {
    const locations = [];

    for (const item of geonamesData) {
      const placeType = this.determinePlaceType(featureCode, item.population);

      const location = {
        name: item.name,
        nameEn: item.name,
        countryCode: country.code,
        countryName: country.name,
        placeType,
        population: item.population ? parseInt(item.population) : null,
        latitude: item.lat ? parseFloat(item.lat) : null,
        longitude: item.lng ? parseFloat(item.lng) : null,
        osmId: null,
        adminLevel: this.getAdminLevel(featureCode),
        geonameId: item.geonameId
      };

      locations.push(location);
    }

    return locations;
  }

  /**
   * Get admin level based on GeoNames feature code
   */
  getAdminLevel(featureCode) {
    const adminLevelMap = {
      PPLC: 2,
      PPLA: 4,
      PPLA2: 6,
      PPLA3: 7,
      PPLA4: 8,
      PPL: 8
    };

    return adminLevelMap[featureCode] || 8;
  }

  /**
   * Remove duplicate locations based on geonameId
   */
  removeDuplicates(locations) {
    const seen = new Set();
    const unique = [];

    for (const location of locations) {
      if (location.geonameId && !seen.has(location.geonameId)) {
        seen.add(location.geonameId);
        unique.push(location);
      } else if (!location.geonameId) {
        // Keep locations without geonameId (shouldn't happen with GeoNames)
        unique.push(location);
      }
    }

    return unique;
  }

  /**
   * Save locations to database
   */
  async saveLocations(locations, countryCode) {
    if (locations.length === 0) {
      return;
    }

    try {
      // Delete existing locations for this country
      await Location.destroy({
        where: { countryCode }
      });

      // Add geonameId field to Location model if it doesn't exist
      // This should be added to the model and migration
      const locationsData = locations.map((loc) => {
        const { geonameId: _geonameId, ...locationData } = loc;

        return locationData;
      });

      // Bulk insert new locations
      await Location.bulkCreate(locationsData, {
        ignoreDuplicates: true,
        validate: true
      });
      // Successfully saved - no verbose log needed
    } catch (error) {
      logger.error({
        service: 'geoNamesSync',
        operation: 'saveLocations',
        countryCode,
        locationCount: locations.length,
        error: error.message
      }, 'Error saving locations');
      throw error;
    }
  }

  /**
   * Get location statistics
   */
  async getLocationStats() {
    try {
      return await Location.findAll({
        attributes: [
          'countryCode',
          'countryName',
          'placeType',
          [Location.sequelize.fn('COUNT', Location.sequelize.col('id')), 'count']
        ],
        group: ['countryCode', 'countryName', 'placeType'],
        order: [['countryCode', 'ASC'], ['placeType', 'ASC']]
      });
    } catch (error) {
      logger.error('Error getting location stats:', error.message);

      return [];
    }
  }

  /**
   * Fetch filtered cities with population filter for any country
   * Only settlements with population > 500 or administrative importance
   */
  async fetchFilteredCities(country) {
    const locations = [];

    try {
      const batchLocations = await this.fetchCitiesBatch(country);

      locations.push(...batchLocations);
    } catch (error) {
      logger.error({
        service: 'geoNamesSync',
        operation: 'fetchFilteredCities',
        country: country.name,
        error: error.message
      }, 'Error fetching filtered cities');
    }

    return locations;
  }

  /**
   * Fetch cities in batches with pagination
   */
  async fetchCitiesBatch(country) {
    const locations = [];
    let startRow = 0;
    const maxRows = 1000;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await this.fetchCitiesPage(country, startRow, maxRows);

      if (response.success && response.data.length > 0) {
        const filteredSettlements = this.filterSettlementsByCountry(response.data, country);
        const parsed = this.parseGeoNamesResponse(filteredSettlements, country, 'PPL');

        locations.push(...parsed);

        hasMoreData = response.data.length >= maxRows;
        if (hasMoreData) {
          startRow += maxRows;
        }
      } else {
        hasMoreData = false;
      }

      await new Promise((resolve) => setTimeout(resolve, 1100));
    }

    return locations;
  }

  /**
   * Fetch a single page of cities from GeoNames API
   */
  async fetchCitiesPage(country, startRow, maxRows) {
    try {
      const response = await axios.get(`${this.baseUrl}/searchJSON`, {
        params: {
          country: country.code,
          featureCode: 'PPL',
          maxRows,
          startRow,
          username: this.username,
          style: 'full'
        },
        timeout: 30000
      });

      return {
        success: true,
        data: response.data && response.data.geonames ? response.data.geonames : []
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Filter settlements based on country-specific criteria
   */
  filterSettlementsByCountry(settlements, country) {
    return settlements.filter((place) => {
      const population = parseInt(place.population) || 0;
      const isAdminCenter = place.fcode && place.fcode.startsWith('PPLA');
      const minPopulation = this.getMinPopulationForCountry(country.code);

      return population >= minPopulation || isAdminCenter || population === 0;
    });
  }

  /**
   * Get minimum population threshold for a country
   */
  getMinPopulationForCountry(countryCode) {
    // All countries currently use the same threshold: include all populated places
    const thresholds = {
      HU: 1,
      SK: 1,
      RO: 1,
      RS: 1,
      UA: 1
    };

    return thresholds[countryCode] || 1;
  }

  /**
   * Test GeoNames API connectivity
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/searchJSON`, {
        params: {
          q: 'Budapest', // eslint-disable-line id-length
          maxRows: 1,
          username: this.username
        },
        timeout: 10000
      });

      if (response.data && response.data.geonames && response.data.geonames.length > 0) {
        // Connection successful
        return { success: true, message: 'GeoNames API is accessible' };
      }
      logger.error({
        service: 'geoNamesSync',
        operation: 'testConnection',
        reason: 'no_results'
      }, 'GeoNames API returned no results');

      return { success: false, message: 'No results from GeoNames API' };
    } catch (error) {
      logger.error('GeoNames API connection failed:', error.message);

      return { success: false, message: error.message };
    }
  }
}

module.exports = GeoNamesLocationSyncService;
