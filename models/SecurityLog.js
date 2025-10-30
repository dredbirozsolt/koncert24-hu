const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityLog = sequelize.define('SecurityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  eventType: {
    type: DataTypes.ENUM(
      'login_success',
      'login_failed',
      'login_locked',
      'logout',
      'password_reset_request',
      'password_reset_success',
      'password_changed',
      'email_changed',
      'csrf_violation',
      'xss_attempt',
      'sql_injection_attempt',
      'rate_limit_exceeded',
      'account_locked',
      'account_unlocked'
    ),
    allowNull: false,
    comment: 'Type of security event'
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    defaultValue: 'low',
    allowNull: false
  }
}, {
  tableName: 'SecurityLogs',
  timestamps: true
});

// Helper method security log létrehozásához
SecurityLog.log = async function (eventType, {
  userId = null,
  email = null,
  ipAddress = null,
  userAgent = null,
  details = null,
  severity = 'low'
} = {}) {
  try {
    await this.create({
      userId,
      email,
      eventType,
      ipAddress,
      userAgent,
      details,
      severity
    });
  } catch (error) {
    console.error('Failed to create security log:', error);
  }
};

module.exports = SecurityLog;
