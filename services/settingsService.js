const { Setting } = require('../models');
const logger = require('../config/logger');
const crypto = require('crypto');

class SettingsService {
  constructor() {
    this.encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY || 'your-32-character-secret-key-here';
    this.algorithm = 'aes-256-cbc';
  }

  // Encrypt sensitive values
  encrypt(text) {
    if (!text) {
      return '';
    }
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey.slice(0, 32)), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error({ err: error, service: 'settings' }, 'Encryption error');
      return text; // Fallback to plain text
    }
  }

  // Decrypt sensitive values
  decrypt(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText;
    }
    try {
      const textParts = encryptedText.split(':');
      const iv = Buffer.from(textParts.shift(), 'hex');
      const encryptedData = textParts.join(':');
      const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey.slice(0, 32)), iv);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error({ err: error, service: 'settings' }, 'Decryption error');
      return encryptedText; // Fallback to encrypted text
    }
  }

  // Get a setting value with fallback to environment variable
  async get(key, defaultValue = null) {
    try {
      // First try to get from database
      const dbValue = await Setting.get(key);
      if (dbValue !== null) {
        return dbValue;
      }

      // Fallback to environment variable
      const envKey = key.toUpperCase().replace(/\./g, '_');
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        return envValue;
      }

      return defaultValue;
    } catch (error) {
      logger.error({ err: error, service: 'settings', key }, 'Error getting setting');
      return defaultValue;
    }
  }

  // Set a setting value
  async set(key, value, type = 'string', category = 'general', description = null) {
    try {
      let processedValue = value;

      // Encrypt sensitive values
      if (type === 'encrypted' && value) {
        processedValue = this.encrypt(value);
      }

      return await Setting.set(key, processedValue, type, category, description);
    } catch (error) {
      logger.error({ err: error, service: 'settings', key }, 'Error setting');
      throw error;
    }
  }

  // Get all settings by category
  async getCategory(category) {
    try {
      return await Setting.getCategory(category);
    } catch (error) {
      logger.error({ err: error, service: 'settings', category }, 'Error getting category');
      return {};
    }
  }

  // Get all settings grouped by category
  async getAllGrouped() {
    try {
      const settings = await Setting.findAll({
        order: [['category', 'ASC'], ['key', 'ASC']]
      });

      const grouped = {};
      for (const setting of settings) {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }

        // Settings are now displayed directly from database

        grouped[setting.category].push({
          key: setting.key,
          value: setting.value, // Show exact database value
          type: setting.type,
          description: setting.description,
          isRequired: setting.isRequired,
          isPublic: setting.isPublic
        });
      }

      return grouped;
    } catch (error) {
      logger.error({ err: error, service: 'settings' }, 'Error getting all grouped settings');
      return {};
    }
  }

  // Initialize settings from environment variables
  async initializeFromEnv() {
    try {
      const envMappings = {
        // Email settings
        'email.method': 'EMAIL_METHOD',
        'email.host': 'EMAIL_HOST',
        'email.port': 'EMAIL_PORT',
        'email.secure': 'EMAIL_SECURE',
        'email.user': 'EMAIL_USER',
        'email.password': 'EMAIL_PASS',
        'email.from': 'EMAIL_FROM',
        'email.admin': 'EMAIL_ADMIN',
        'email.booking': 'EMAIL_BOOKING',

        // Elastic Email
        'elastic_email.api_key': 'ELASTIC_EMAIL_API_KEY',

        // vTiger
        'vtiger.url': 'VTIGER_URL',
        'vtiger.username': 'VTIGER_USERNAME',
        'vtiger.access_key': 'VTIGER_ACCESS_KEY',

        // GeoNames
        'geonames.username': 'GEONAMES_USERNAME',

        // OAuth2
        'oauth2.client_id': 'OAUTH2_CLIENT_ID',
        'oauth2.client_secret': 'OAUTH2_CLIENT_SECRET',
        'oauth2.refresh_token': 'OAUTH2_REFRESH_TOKEN',
        'oauth2.user': 'OAUTH2_USER',

        // General
        'site.domain': 'DOMAIN',
        'booking.notification_email': 'BOOKING_EMAIL'
      };

      for (const [dbKey, envKey] of Object.entries(envMappings)) {
        const envValue = process.env[envKey];
        if (envValue) {
          const existing = await Setting.findOne({ where: { key: dbKey } });
          if (!existing || !existing.value) {
            const isEncrypted = dbKey.includes('password') || dbKey.includes('key')
                               || dbKey.includes('secret') || dbKey.includes('token');
            await this.set(dbKey, envValue, isEncrypted ? 'encrypted' : 'string');
          }
        }
      }

      logger.info({ service: 'settings' }, 'Settings initialized from environment variables');
    } catch (error) {
      logger.error({ err: error, service: 'settings' }, 'Error initializing settings from env');
    }
  }

  // Validate required settings
  async validateRequired() {
    try {
      const requiredSettings = await Setting.findAll({
        where: { isRequired: true }
      });

      const missing = [];
      for (const setting of requiredSettings) {
        const value = await this.get(setting.key);
        if (!value) {
          missing.push(setting.key);
        }
      }

      return {
        isValid: missing.length === 0,
        missing
      };
    } catch (error) {
      logger.error({ err: error, service: 'settings' }, 'Error validating required settings');
      return { isValid: false, missing: [], error: error.message };
    }
  }

  // Helper methods for easy access to common email addresses
  async getAdminEmail() {
    return await this.get('email.admin');
  }

  async getBookingEmail() {
    return await this.get('email.booking');
  }

  // Company information helpers
  async getCompanyName() {
    return await this.get('company.name');
  }

  async getCompanyPhone() {
    return await this.get('company.phone');
  }

  async getCompanyEmail() {
    return await this.get('company.email');
  }
}

module.exports = new SettingsService();
