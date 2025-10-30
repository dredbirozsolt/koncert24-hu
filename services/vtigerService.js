const axios = require('axios');
const crypto = require('crypto');
const logger = require('../config/logger');
const { URLSearchParams } = require('url');
const { Setting } = require('../models');

/**
 * VTiger CRM webservice integration class
 */
class VTigerService {
  /**
   * Initialize VTiger service with configuration
   */
  constructor() {
    this.baseUrl = null;
    this.username = null;
    this.accessKey = null;
    this.sessionId = null;
    this.challengeToken = null;
    this.configLoaded = false;
  }

  /**
   * Load configuration from database
   * @returns {Promise<void>}
   */
  async loadConfig() {
    if (this.configLoaded) {
      return;
    }

    try {
      this.baseUrl = await Setting.get('vtiger.url');
      this.username = await Setting.get('vtiger.username');
      this.accessKey = await Setting.get('vtiger.access_key');
      this.configLoaded = true;

      if (!this.baseUrl || !this.username || !this.accessKey) {
        logger.warn({
          service: 'vtiger',
          operation: 'loadConfig',
          hasBaseUrl: Boolean(this.baseUrl),
          hasUsername: Boolean(this.username),
          hasAccessKey: Boolean(this.accessKey)
        }, 'vTiger configuration incomplete');
      }
    } catch (error) {
      logger.error('Failed to load vTiger configuration from database:', error);
      throw new Error('vTiger configuration could not be loaded');
    }
  }

  /**
   * Authenticate with vTiger webservice using challenge-response mechanism
   * @returns {Promise<boolean>} Authentication success status
   */
  async authenticate() {
    try {
      await this.loadConfig();
      this.validateCredentials();
      this.logConnectionInfo();

      const challengeToken = await this.getChallengeToken();
      const accessKeyHash = this.generateAccessKeyHash(challengeToken);
      const sessionId = await this.performLogin(accessKeyHash);

      this.sessionId = sessionId;
      logger.info({
        service: 'vtiger',
        operation: 'authenticate',
        sessionId: sessionId.substring(0, 8)
      }, 'Authentication successful');

      return true;
    } catch (error) {
      this.logAuthenticationError(error);

      return false;
    }
  }

  /**
   * Validate that all required credentials are configured
   * @throws {Error} If credentials are missing
   */
  validateCredentials() {
    if (!this.baseUrl || !this.username || !this.accessKey) {
      throw new Error('vTiger credentials not configured');
    }
  }

  /**
   * Log connection information
   */
  logConnectionInfo() {
    // Removed verbose logging - use only for debugging
  }

  /**
   * Get challenge token from vTiger
   * @returns {Promise<string>} Challenge token
   */
  async getChallengeToken() {
    const challengeResponse = await axios.get(`${this.baseUrl}/webservice.php`, {
      params: {
        operation: 'getchallenge',
        username: this.username
      }
    });

    if (!challengeResponse.data.success) {
      throw new Error(`Challenge failed: ${challengeResponse.data.error.message}`);
    }

    const { token } = challengeResponse.data.result;
    return token;
  }

  /**
   * Generate access key hash from challenge token
   * @param {string} challengeToken - Challenge token from vTiger
   * @returns {string} MD5 hash of token + access key
   */
  generateAccessKeyHash(challengeToken) {
    return crypto
      .createHash('md5')
      .update(challengeToken + this.accessKey)
      .digest('hex');
  }

  /**
   * Perform login with access key hash
   * @param {string} accessKeyHash - Hashed access key
   * @returns {Promise<string>} Session ID
   */
  async performLogin(accessKeyHash) {
    const loginParams = new URLSearchParams({
      operation: 'login',
      username: this.username,
      accessKey: accessKeyHash
    });

    const loginResponse = await axios.post(`${this.baseUrl}/webservice.php`, loginParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!loginResponse.data.success) {
      throw new Error(`Login failed: ${loginResponse.data.error.message}`);
    }

    return loginResponse.data.result.sessionName;
  }

  /**
   * Log authentication error details
   * @param {Error} error - The authentication error
   */
  logAuthenticationError(error) {
    logger.error('vTiger authentication failed:', error.message);
    if (error.response) {
      logger.error('Response status:', error.response.status);
      logger.error('Response data:', error.response.data);
    }
  }

  /**
   * Make authenticated request to vTiger webservice
   * @param {string} operation - The webservice operation to call
   * @param {Object} params - Additional parameters for the request
   * @returns {Promise<Object>} API response data
   */
  async makeRequest(operation, params = {}) {
    try {
      if (!this.sessionId) {
        const authenticated = await this.authenticate();

        if (!authenticated) {
          throw new Error('Failed to authenticate with vTiger');
        }
      }

      const requestParams = {
        operation,
        sessionName: this.sessionId,
        ...params
      };

      const response = await axios.get(`${this.baseUrl}/webservice.php`, {
        params: requestParams
      });

      if (!response.data.success) {
        return await this.handleApiError(response.data.error, requestParams);
      }

      return response.data.result;
    } catch (error) {
      logger.error('vTiger API request failed:', error.message);
      throw error;
    }
  }

  /**
   * Handle API errors and retry if session expired
   * @param {Object} error - API error object
   * @param {Object} requestParams - Request parameters for retry
   * @returns {Promise<Object>} API result or throws error
   */
  async handleApiError(error, requestParams) {
    // If session expired, try to re-authenticate once
    if (error.code === 'INVALID_SESSIONID') {
      logger.info({
        service: 'vtiger',
        operation: 'sessionExpired',
        action: 'reauthenticating'
      }, 'Session expired, re-authenticating');
      this.sessionId = null;
      const authenticated = await this.authenticate();

      if (authenticated) {
        requestParams.sessionName = this.sessionId;
        const retryResponse = await axios.get(`${this.baseUrl}/webservice.php`, {
          params: requestParams
        });

        if (retryResponse.data.success) {
          return retryResponse.data.result;
        }
      }
    }
    throw new Error(`vTiger API error: ${error.message}`);
  }

  /**
   * Execute a SQL-like query on vTiger
   * @param {string} queryString - SQL-like query string
   * @returns {Promise<Array>} Query results
   */
  async query(queryString) {
    return await this.makeRequest('query', { query: queryString });
  }

  /**
   * Retrieve a single record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Record data
   */
  async retrieve(id) {
    return await this.makeRequest('retrieve', { id });
  }

  /**
   * Get related records for a parent record
   * @param {string} id - Parent record ID
   * @param {string} relatedModule - Related module name (e.g., 'LineItem')
   * @returns {Promise<Array>} Related records
   */
  async getRelatedRecords(id, relatedModule) {
    try {
      const result = await this.makeRequest('query', {
        query: `SELECT * FROM ${relatedModule} WHERE ${relatedModule.toLowerCase()}id='${id}';`
      });
      return Array.isArray(result) ? result : [];
    } catch (error) {
      logger.warn({
        service: 'vtiger',
        operation: 'getRelatedRecords',
        id,
        relatedModule,
        error: error.message
      }, 'Failed to get related records');
      return [];
    }
  }

  /**
   * Get all products for testing purposes without filtering
   * @returns {Promise<Object>} Product statistics and data
   */
  async getAllProductsForTesting() {
    try {
      await this.loadConfig();
      await this.authenticate();

      const allProducts = await this.fetchAllProductsWithPagination();
      const stats = this.calculateProductStatistics(allProducts);

      this.logProductStatistics(stats);

      return stats;
    } catch (error) {
      logger.error('Hiba az összes termék lekérdezésekor:', error);
      throw error;
    }
  }

  /**
   * Fetch all products with pagination
   * @returns {Promise<Array>} All products
   */
  async fetchAllProductsWithPagination() {
    const allProducts = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const query = `SELECT id, productname, discontinued, cf_1125 FROM Products LIMIT ${offset}, ${limit};`;

      const result = await this.makeRequest('query', { query });
      const batchResult = this.processProductBatch(result, allProducts, offset, limit);

      if (batchResult.hasMore) {
        offset = batchResult.newOffset;
      } else {
        hasMore = false;
      }
    }

    return allProducts;
  }

  /**
   * Calculate product statistics by status
   * @param {Array} allProducts - All products
   * @returns {Object} Product statistics
   */
  calculateProductStatistics(allProducts) {
    const activeProducts = allProducts.filter((product) => product.discontinued === '0');
    const inactiveProducts = allProducts.filter((product) => product.discontinued === '1');
    const unknownProducts = allProducts.filter((product) =>
      product.discontinued !== '0' && product.discontinued !== '1'
    );

    return {
      total: allProducts.length,
      active: activeProducts.length,
      inactive: inactiveProducts.length,
      unknown: unknownProducts.length,
      unknownStatuses: [...new Set(unknownProducts.map((product) => product.discontinued))]
    };
  }

  /**
   * Log product statistics
   * @param {Object} stats - Product statistics
   */
  logProductStatistics(stats) {
    logger.info({
      service: 'vtiger',
      operation: 'productStats',
      total: stats.total,
      active: stats.active,
      inactive: stats.inactive,
      unknown: stats.unknown
    }, 'Product statistics loaded');
  }

  /**
   * Process a batch of products from vTiger query
   * @param {Array} result - Query result from vTiger
   * @param {Array} allProducts - Array to accumulate all products
   * @param {number} offset - Current offset for pagination
   * @param {number} limit - Page size limit
   * @returns {Object} Processing result with updated pagination info
   */
  processProductBatch(result, allProducts, offset, limit) {
    if (!result || !Array.isArray(result)) {
      return { hasMore: false, newOffset: offset };
    }

    if (result.length === 0) {
      return { hasMore: false, newOffset: offset };
    }

    allProducts.push(...result);
    const newOffset = offset + limit;
    const hasMore = result.length >= limit;

    return { hasMore, newOffset };
  }

  /**
   * Process a batch of performers from vTiger
   * @param {Array} performers - Array of basic performer data
   * @param {Array} allPerformers - Array to accumulate all performers
   * @returns {Promise<void>}
   */
  async processPerformerBatch(performers, allPerformers) {
    // Retrieve full data for each performer using retrieve method
    for (const basicProduct of performers) {
      try {
        const fullProduct = await this.makeRequest('retrieve', { id: basicProduct.id });

        if (fullProduct) {
          allPerformers.push(fullProduct);
        }
      } catch (error) {
        logger.error({
          service: 'vtiger',
          operation: 'processPerformerBatch',
          productId: basicProduct.id,
          error: error.message
        }, 'Error retrieving full product data');
      }
    }
  }

  /**
   * Process performer query result and update pagination
   * @param {*} result - Query result from vTiger
   * @param {Array} allPerformers - Array to accumulate all performers
   * @param {number} offset - Current offset
   * @param {number} limit - Page size
   * @returns {Object} Processing result with updated pagination
   */
  async processPerformerQueryResult(result, allPerformers, offset, limit) {
    if (!result || !Array.isArray(result)) {
      logger.warn({
        service: 'vtiger',
        operation: 'processPerformerQuery',
        offset,
        limit,
        resultType: typeof result
      }, 'No performer data at offset');

      return { hasMore: false, newOffset: offset };
    }

    // Removed verbose batch log - covered by final summary

    if (result.length === 0) {
      return { hasMore: false, newOffset: offset };
    }

    await this.processPerformerBatch(result, allPerformers);
    const newOffset = offset + limit;
    const hasMore = result.length >= limit;

    return { hasMore, newOffset };
  }

  /**
   * Get all active performers from vTiger
   * @returns {Promise<Array>} Array of performer objects
   */
  async getPerformers() {
    try {
      await this.loadConfig();
      await this.authenticate();

      const allPerformers = await this.fetchAllPerformersWithPagination();
      const performers = this.transformProductsToPerformers(allPerformers);

      logger.info({
        service: 'vtiger',
        operation: 'getActivePerformers',
        count: performers.length
      }, 'Performers loaded from vTiger');

      return performers;
    } catch (error) {
      logger.error('Hiba az előadók lekérésében:', error);
      throw error;
    }
  }

  /**
   * Fetch all performers with pagination
   * @returns {Promise<Array>} All performer products
   */
  async fetchAllPerformersWithPagination() {
    const allPerformers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      // NOTE: discontinued = '1' means ACTIVE, discontinued = '0' means INACTIVE in vTiger
      const query = `SELECT id FROM Products WHERE discontinued = '1' LIMIT ${offset}, ${limit};`;

      // Removed verbose query log - unnecessary

      const result = await this.makeRequest('query', { query });
      const queryResult = await this.processPerformerQueryResult(result, allPerformers, offset, limit);

      if (queryResult.hasMore) {
        offset = queryResult.newOffset;
      } else {
        hasMore = false;
      }
    }

    // Removed duplicate log - covered by getActivePerformers

    return allPerformers;
  }

  /**
   * Transform vTiger products to performer objects
   * @param {Array} allPerformers - Raw product data from vTiger
   * @returns {Array} Transformed performer objects
   */
  transformProductsToPerformers(allPerformers) {
    logger.info({
      service: 'vtiger',
      operation: 'transformProducts',
      count: allPerformers.length,
      imageField: 'imagename'
    }, 'Transforming products to performers');

    return allPerformers.map((product) => this.buildPerformerObject(product));
  }

  /**
   * Build a single performer object from product data
   * @param {Object} product - Product data from vTiger
   * @returns {Object} Performer object
   */
  buildPerformerObject(product) {
    const category = this.mapCategory(product.productcategory);
    const netPrice = parseFloat(product.unit_price) || 0;
    const imageUrl = this.processPerformerImageUrl(product);
    const style = this.parseMultiSelectField(product.cf_1123);
    const status = product.cf_1125 || '';

    return {
      vtigerId: product.id,
      name: product.productname || 'Névtelen előadó',
      category,
      isActive: product.discontinued === '1',
      priceListRestriction: Boolean(product.cf_1079) || false,
      price: netPrice,
      duration: this.parseDuration(product.cf_785) || parseInt(product.cf_1074) || 0,
      performanceType: product.cf_809 || product.cf_1075 || 'élő',
      travelCost: parseFloat(product.cf_787) || parseFloat(product.cf_1077) || 0,
      travelCostCalculation: product.cf_877 || null,
      technicalRequirements: product.cf_811 || null,
      style,
      status, // Raw status from VTiger (Kiemelt, Népszerű, Kedvezményes, Akciós)
      imageUrl,
      description: product.description || ''
    };
  }

  /**
   * Process performer image URL from product data
   * @param {Object} product - Product data from vTiger
   * @returns {string|null} Image URL or null
   */
  processPerformerImageUrl(product) {
    logger.debug({
      service: 'vtiger',
      operation: 'processPerformerImage',
      productName: product.productname,
      imagename: product.imagename,
      imageattachmentids: product.imageattachmentids
    }, 'Processing performer image');

    if (product.imagename && product.imagename.trim() !== '') {
      // Removed verbose image URL log - debug logs sufficient
      return this.generateImageUrl(product.imagename, product.imageattachmentids);
    }

    logger.debug({
      service: 'vtiger',
      operation: 'processPerformerImage',
      productName: product.productname,
      reason: 'no_imagename'
    }, 'No image URL generated');

    return null;
  }

  /**
   * Create a lead in vTiger from booking data
   * @param {Object} bookingData - Booking information
   * @returns {Promise<Object>} Created lead data
   */
  async createLead(bookingData) {
    try {
      // Note: vTiger CRM API requires snake_case for field names and custom fields (cf_*)
      // All cf_* fields below use eslint-disable-next-line camelcase due to external API requirements
      const leadData = {
        lastname: bookingData.clientName,
        email: bookingData.clientEmail,
        phone: bookingData.clientPhone,
        company: bookingData.clientCompany || 'Magánszemély',
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_event_date: bookingData.eventDate,
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_event_location: bookingData.eventLocation,
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_event_type: bookingData.eventType,
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_expected_guests: bookingData.expectedGuests,
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_performer_id: bookingData.performer?.vtigerId,
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_performer_name: bookingData.performer?.name,
        description: bookingData.message || '',
        // eslint-disable-next-line camelcase -- vTiger custom field
        cf_budget: bookingData.budget,
        leadsource: 'Website',
        leadstatus: 'Not Contacted'
      };

      const result = await this.makeRequest('create', {
        elementType: 'Leads',
        element: JSON.stringify(leadData)
      });

      logger.info({
        service: 'vtiger',
        operation: 'createLead',
        leadId: result.id,
        email: bookingData.email
      }, 'Lead created in vTiger');

      return result.id;
    } catch (error) {
      logger.error('Failed to create lead in vTiger:', error.message);
      throw error;
    }
  }

  /**
   * Parse duration from text format (e.g., "40 perc", "90 min")
   * @param {string} durationText - Duration text from vTiger
   * @returns {number} Duration in minutes
   */
  parseDuration(durationText) {
    if (!durationText || typeof durationText !== 'string') {
      return 0;
    }

    // Extract number from text like "40 perc", "90 min", "120"
    const match = durationText.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Parse multi-select field from vTiger (values separated by |##|)
   * @param {string} fieldValue - Multi-select field value from vTiger
   * @returns {Array|null} Array of values or null
   */
  parseMultiSelectField(fieldValue) {
    if (!fieldValue || typeof fieldValue !== 'string') {
      return null;
    }

    // vTiger multi-select uses |##| as separator
    const values = fieldValue.split(' |##| ').map((val) => val.trim()).filter((val) => val.length > 0);

    return values.length > 0 ? values : null;
  }

  /**
   * Map vTiger product category to application category
   * @param {string} productCategory - Product category from vTiger
   * @returns {string} Mapped category name
   */
  mapCategory(productCategory) {
    if (!productCategory) {
      return 'Egyéb';
    }

    // Visszaadjuk az eredeti kategória nevet, nem alakítjuk át
    // Az URL-barát formátum generálása a frontend/routing feladata lesz
    return productCategory;
  }

  /**
   * Generate public image URL for vTiger v8.x
   * @param {string} imagename - Image filename
   * @param {string} imageattachmentids - Image attachment IDs
   * @returns {string|null} Generated image URL or null
   */
  generateImageUrl(imagename, imageattachmentids) {
    if (!imagename || !imageattachmentids) {
      return null;
    }

    try {
      // V8.x-ben az imageattachmentids közvetlenül használható fid-ként
      // Eltávolítjuk a "14x" prefixet ha van
      const fid = imageattachmentids.replace(/^14x/, '');

      // Key = MD5 hash a fájlnévből
      const key = crypto.createHash('md5').update(imagename).digest('hex');

      // VTiger publikus URL generálása - eltávolítjuk a /webservice.php részt ha van
      const baseUrlClean = this.baseUrl.replace(/\/webservice\.php$/, '');

      // Removed verbose image URL log - not valuable
      return `${baseUrlClean}/public.php?fid=${fid}&key=${key}`;
    } catch (error) {
      logger.error({
        service: 'vtiger',
        operation: 'generateImageUrl',
        imagename,
        imageattachmentids,
        error: error.message
      }, 'Error generating image URL');

      return null;
    }
  }
}

module.exports = { VTigerService };
