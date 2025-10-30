const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CookieConsent = sequelize.define('CookieConsent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Anonymous session identifier'
  },
  consentId: {
    type: DataTypes.STRING(36),
    allowNull: false,
    unique: true,
    comment: 'Unique identifier for this consent record'
  },
  essential: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Essential cookies (always true)'
  },
  statistics: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Statistical/Analytics cookies (e.g., Google Analytics)'
  },
  marketing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Marketing cookies (e.g., Facebook Pixel)'
  },
  ipHash: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'SHA256 hash of IP address for privacy'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User agent string'
  },
  consentMethod: {
    type: DataTypes.ENUM('accept_all', 'accept_selected', 'essential_only'),
    allowNull: false,
    comment: 'How the user gave consent'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'When this consent expires (typically 12 months)'
  }
}, {
  tableName: 'CookieConsents',
  timestamps: true
});

// Association with User model
CookieConsent.associate = (models) => {
  CookieConsent.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

module.exports = CookieConsent;
