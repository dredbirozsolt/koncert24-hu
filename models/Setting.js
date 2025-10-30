const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Setting = sequelize.define('Setting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json', 'encrypted'),
    defaultValue: 'string'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'general'
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this setting can be accessed without admin rights'
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether this setting is required for system operation'
  }
}, {
  tableName: 'settings',
  timestamps: true,
  indexes: [
    { fields: ['key'] },
    { fields: ['category'] },
    { fields: ['isPublic'] }
  ]
});

// Static methods for easy access
Setting.get = async function (key, defaultValue = null) {
  try {
    const setting = await this.findOne({ where: { key } });
    if (!setting) {
      return defaultValue;
    }

    switch (setting.type) {
      case 'boolean':
        return setting.value === 'true';
      case 'number':
        return parseFloat(setting.value);
      case 'json':
        return JSON.parse(setting.value);
      case 'encrypted':
        // Return raw value - show actual database content for admin interface
        return setting.value;
      default:
        return setting.value;
    }
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
};

Setting.set = async function (key, value, type = 'string', category = 'general', description = null) {
  try {
    let stringValue = value;

    switch (type) {
      case 'boolean':
        stringValue = value ? 'true' : 'false';
        break;
      case 'number':
        stringValue = value.toString();
        break;
      case 'json':
        stringValue = JSON.stringify(value);
        break;
      case 'encrypted':
        // TODO: Implement encryption
        stringValue = value;
        break;
      default:
        stringValue = value?.toString() || '';
    }

    // Use upsert with update fields to ensure type and category are also updated
    const [setting] = await this.upsert(
      {
        key,
        value: stringValue,
        type,
        category,
        description
      },
      {
        // Specify which fields to update if record exists
        fields: ['key', 'value', 'type', 'category', 'description', 'updatedAt']
      }
    );

    return setting;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
};

Setting.getCategory = async function (category) {
  try {
    const settings = await this.findAll({
      where: { category },
      order: [['key', 'ASC']]
    });

    const result = {};
    for (const setting of settings) {
      result[setting.key] = await this.get(setting.key);
    }

    return result;
  } catch (error) {
    console.error(`Error getting category ${category}:`, error);
    return {};
  }
};

// Helper method to initialize default settings
Setting.initializeDefaults = async function () {
  const defaults = [
    // GTM
    {
      key: 'gtm.code',
      value: '',
      type: 'string',
      category: 'gtm',
      description: 'Google Tag Manager container ID',
      isPublic: true,
      isRequired: false
    },
    // Backup
    {
      key: 'backup.retention.max_count',
      value: '30',
      type: 'number',
      category: 'backup',
      description: 'Maximum number of backups to keep',
      isPublic: false,
      isRequired: true
    },
    {
      key: 'backup.retention.max_age_days',
      value: '30',
      type: 'number',
      category: 'backup',
      description: 'Maximum age of backups in days',
      isPublic: false,
      isRequired: true
    },
    // Logs
    {
      key: 'logs.retention.days',
      value: '30',
      type: 'number',
      category: 'logs',
      description: 'Log files retention period in days',
      isPublic: false,
      isRequired: true
    },
    {
      key: 'logs.rotation.interval',
      value: 'daily',
      type: 'string',
      category: 'logs',
      description: 'Log rotation interval (daily, weekly, monthly)',
      isPublic: false,
      isRequired: true
    },
    {
      key: 'logs.max_size_mb',
      value: '10',
      type: 'number',
      category: 'logs',
      description: 'Maximum log file size in MB before rotation',
      isPublic: false,
      isRequired: true
    },
    // Email Settings
    {
      key: 'email.method',
      value: 'smtp',
      type: 'string',
      category: 'email',
      description: 'Email sending method (smtp, oauth2)'
    },
    {
      key: 'email.host',
      value: 'smtp.elasticemail.com',
      type: 'string',
      category: 'email',
      description: 'SMTP server host'
    },
    { key: 'email.port', value: '2525', type: 'number', category: 'email', description: 'SMTP server port' },
    { key: 'email.secure', value: 'false', type: 'boolean', category: 'email', description: 'Use SSL/TLS' },
    { key: 'email.user', value: '', type: 'string', category: 'email', description: 'Email username' },
    { key: 'email.password', value: '', type: 'encrypted', category: 'email', description: 'Email password' },
    { key: 'email.from', value: '', type: 'string', category: 'email', description: 'Default sender email' },
    { key: 'email.admin', value: '', type: 'string', category: 'email', description: 'Admin notification email' },
    { key: 'email.booking', value: '', type: 'string', category: 'email', description: 'Booking notification email' },

    // Elastic Email Settings
    {
      key: 'elastic_email.api_key',
      value: '',
      type: 'encrypted',
      category: 'elastic_email',
      description: 'Elastic Email API Key'
    },

    // vTiger Settings
    { key: 'vtiger.url', value: '', type: 'string', category: 'vtiger', description: 'vTiger CRM URL' },
    { key: 'vtiger.username', value: '', type: 'string', category: 'vtiger', description: 'vTiger username' },
    { key: 'vtiger.access_key', value: '', type: 'encrypted', category: 'vtiger', description: 'vTiger access key' },

    // GeoNames Settings
    { key: 'geonames.username', value: '', type: 'string', category: 'geonames', description: 'GeoNames API username' },

    // OAuth2 Settings
    { key: 'oauth2.client_id', value: '', type: 'string', category: 'oauth2', description: 'OAuth2 Client ID' },
    {
      key: 'oauth2.client_secret',
      value: '',
      type: 'string',
      category: 'oauth2',
      description: 'OAuth2 Client Secret'
    },
    {
      key: 'oauth2.refresh_token',
      value: '',
      type: 'string',
      category: 'oauth2',
      description: 'OAuth2 Refresh Token'
    },
    { key: 'oauth2.user', value: '', type: 'string', category: 'oauth2', description: 'OAuth2 User Email' },

    // General Settings
    {
      key: 'site.name',
      value: 'Koncert24.hu',
      type: 'string',
      category: 'general',
      description: 'Site name',
      isPublic: true
    },
    { key: 'site.domain', value: 'https://koncert24.hu', type: 'string', category: 'general', description: 'Site domain', isPublic: true },
    {
      key: 'company.name',
      value: 'DMF Art Média Kft.',
      type: 'string',
      category: 'general',
      description: 'Company name',
      isPublic: true
    },
    {
      key: 'company.phone',
      value: '+36 70 679 67 11',
      type: 'string',
      category: 'general',
      description: 'Company phone number',
      isPublic: true
    },
    {
      key: 'company.email',
      value: 'iroda@dmf.hu',
      type: 'string',
      category: 'general',
      description: 'Company email address',
      isPublic: true
    },
    {
      key: 'company.logo',
      value: '',
      type: 'string',
      category: 'general',
      description: 'Company logo path',
      isPublic: true
    },
    {
      key: 'booking.notification_email',
      value: '',
      type: 'string',
      category: 'booking',
      description: 'Booking notification email'
    }
  ];

  for (const defaultSetting of defaults) {
    const existing = await this.findOne({ where: { key: defaultSetting.key } });
    if (!existing) {
      await this.create(defaultSetting);
    }
  }
};

module.exports = Setting;
