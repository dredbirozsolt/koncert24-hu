
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CronJob = sequelize.define('CronJob', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  schedule: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastRunAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastStatus: {
    type: DataTypes.ENUM('success', 'error', 'running'),
    allowNull: true
  },
  lastError: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'cron_jobs',
  timestamps: true
});

module.exports = CronJob;
