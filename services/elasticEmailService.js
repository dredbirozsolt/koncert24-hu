const https = require('https');
const querystring = require('querystring');
const logger = require('../config/logger');
const settingsService = require('./settingsService');

class ElasticEmailService {
  constructor() {
    this.apiKey = null; // Will be loaded dynamically
    this.publicAccountID = '4f082f00-87be-46e1-901d-d5009863b9ad';
    this.baseUrl = 'api.elasticemail.com';

    // Use Public List IDs (UUIDs) for reliable API calls
    this.publicListIds = {
      client: '1006ff1c-54c2-4bb6-b952-c6d5e9364080',      // Koncert24.hu - Megrendelő, szervező
      performer: '9adb5804-5b35-45a0-b558-a7314be8b098'    // Koncert24.hu - Előadó, manager
    };
  }

  /**
   * Get dynamic list names based on site settings
   * @returns {Promise<Object>} Object with list names
   */
  async getListNames() {
    const siteName = await settingsService.get('general.site_name');
    return {
      client: `${siteName} - Megrendelő, szervező`,
      performer: `${siteName} - Előadó, manager`
    };
  }

  /**
   * Generate consent data for Elastic Email API
   * @returns {string} Formatted consent date
   */
  generateConsentDate() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  }

  /**
   * Load API key from settings service
   */
  async loadApiKey() {
    if (!this.apiKey) {
      this.apiKey = await settingsService.get('elastic_email.api_key');

      if (!this.apiKey) {
        throw new Error('Elastic Email API key not configured in database settings');
      }
    }
  }

  /**
   * Create or get list ID by name
   * @param {string} listType - 'client' or 'performer'
   * @returns {Promise<string>} List ID
   */
  async getOrCreateListId(listType) {
    await this.loadApiKey();
    const listNames = await this.getListNames();
    const listName = listNames[listType];

    if (!listName) {
      throw new Error(`Invalid list type: ${listType}`);
    }

    // Use the predefined UUID if available, otherwise create/find list
    if (this.publicListIds[listType]) {
      return this.publicListIds[listType];
    }

    // This would be for creating new lists dynamically
    // For now, we'll use the predefined UUIDs
    throw new Error(`List ID not found for type: ${listType}`);
  }

  /**
   * Build request data for adding contact
   * @param {string} email - Contact email address
   * @param {string} name - Contact name
   * @param {string} publicListId - Public list ID
   * @returns {Object} Request data object
   */
  buildAddContactRequestData(email, name, publicListId) {
    return {
      apikey: this.apiKey,
      publicAccountID: this.publicAccountID,
      email,
      firstName: name || '',
      publicListID: publicListId,
      consentDate: this.generateConsentDate(),
      consentIP: '127.0.0.1',
      sendActivation: 'false'
    };
  }

  /**
   * Add contact to mailing list
   * @param {Object} contactData - Contact data object
   * @param {string} contactData.email - Contact email
   * @param {string} contactData.name - Contact name
   * @param {string} contactData.role - User role (client or performer)
   * @param {string} contactData.phone - Contact phone (optional)
   * @returns {Promise<Object>} API response
   */
  async addContact(contactData) {
    try {
      // Load API key first
      await this.loadApiKey();

      const { email, name, role } = contactData;
      const publicListId = this.getPublicListIdByRole(role);
      const listName = this.getListNameByRole(role);

      const requestData = this.buildAddContactRequestData(email, name, publicListId);

      const postData = querystring.stringify(requestData);
      const result = await this.makeRequest('/v2/contact/add', postData, 'POST');

      logger.info({
        service: 'elasticEmail',
        operation: 'addContact',
        email,
        listName,
        publicListId
      }, 'Contact added to Elastic Email');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Elastic Email add contact error:', error);
      return { success: false, error: error.message };
    }
  }  /**
   * Update contact information
   * @param {string} email - Contact email
   * @param {string} name - Contact name
   * @param {string} role - User role
   * @returns {Promise<Object>} API response
   */
  async updateContact(email, name, role) {
    try {
      const listName = this.getListNameByRole(role);

      const postData = querystring.stringify({
        apikey: this.apiKey,
        publicAccountID: this.publicAccountID,
        email,
        firstname: name,
        listname: listName
      });

      const result = await this.makeRequest('/v2/contact/update', postData, 'POST');

      logger.info({
        service: 'elasticEmail',
        operation: 'updateContact',
        email,
        listName
      }, 'Contact updated in Elastic Email');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Elastic Email update contact error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove contact from all lists
   * @param {string} email - Contact email
   * @returns {Promise<Object>} API response
   */
  async removeContact(email) {
    try {
      const postData = querystring.stringify({
        apikey: this.apiKey,
        publicAccountID: this.publicAccountID,
        email
      });

      const result = await this.makeRequest('/v2/contact/delete', postData, 'POST');

      logger.info({
        service: 'elasticEmail',
        operation: 'removeContact',
        email
      }, 'Contact removed from Elastic Email');
      return { success: true, data: result };
    } catch (error) {
      logger.error('Elastic Email remove contact error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list name based on user role
   * @param {string} role - User role (client or performer)
   * @returns {string} List name
   */
  getListNameByRole(role) {
    const listNames = {
      client: 'Koncert24.hu - Megrendelő, szervező',
      performer: 'Koncert24.hu - Előadó, manager'  // Fixed typo: Előladó -> Előadó
    };

    return listNames[role] || listNames.client;
  }

  /**
   * Get public list ID based on user role
   * @param {string} role - User role (client or performer)
   * @returns {string} Public List ID (UUID)
   */
  getPublicListIdByRole(role) {
    return this.publicListIds[role] || this.publicListIds.client;
  }

  /**
   * Make HTTP request to Elastic Email Web API v2
   * @param {string} path - API endpoint path
   * @param {string} requestBody - Request body (form data)
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @returns {Promise<Object>} API response
   */
  makeRequest(path, requestBody = '', method = 'POST') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path,
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      if (method !== 'GET' && requestBody) {
        options.headers['Content-Length'] = Buffer.byteLength(requestBody);
      }

      // Removed verbose HTTP request log

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          // Removed verbose response log

          try {
            const result = JSON.parse(data);
            if (result.success) {
              resolve(result.data || result);
            } else {
              reject(new Error(result.error || 'Unknown API error'));
            }
          } catch (parseError) {
            reject(new Error(`API response parse error: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('Elastic Email API request error:', error);
        reject(error);
      });

      if (method !== 'GET' && requestBody) {
        req.write(requestBody);
      }
      req.end();
    });
  }

  /**
   * Create mailing lists if they don't exist
   * @returns {Promise<Object>} Creation results
   */
  async createLists() {
    try {
      const lists = [
        'Koncert24.hu - Megrendelő, szervező',
        'Koncert24.hu - Előadó, manager'
      ];

      const results = [];

      for (const listName of lists) {
        try {
          const postData = querystring.stringify({
            apikey: this.apiKey,
            publicAccountID: this.publicAccountID,
            listname: listName,
            createemptylist: 'true'
          });

          const result = await this.makeRequest('/v2/list/add', postData, 'POST');
          results.push({ list: listName, success: true, data: result });
        } catch (error) {
          // List might already exist, which is fine
          results.push({ list: listName, success: false, error: error.message });
        }
      }

      logger.info({
        service: 'elasticEmail',
        operation: 'createLists',
        listsCount: results.length,
        successCount: results.filter((r) => r.success).length
      }, 'Elastic Email lists creation completed');
      return { success: true, results };
    } catch (error) {
      logger.error('Elastic Email create lists error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ElasticEmailService();
