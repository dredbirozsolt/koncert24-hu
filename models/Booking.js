const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vtigerLeadId: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'vTiger CRM Lead ID when synced'
  },
  performerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'performers',
      key: 'id'
    }
  },
  // Client information
  clientName: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  clientEmail: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  clientPhone: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  clientCompany: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  // Event information
  eventDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  eventTime: {
    type: DataTypes.TIME,
    allowNull: true
  },
  eventTimeFlexible: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indicates if event time is not yet fixed'
  },
  eventLocation: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  eventType: {
    type: DataTypes.ENUM(
      'wedding',
      'corporate',
      'birthday',
      'festival',
      'private',
      'other',
      'outdoor_free',
      'outdoor_paid',
      'indoor_free',
      'indoor_paid',
      'private_personal',
      'private_corporate'
    ),
    allowNull: false
  },
  expectedGuests: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // Additional information
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  // Status tracking
  status: {
    type: DataTypes.ENUM(
      // Új foglalás, még nem dolgozták fel
      'pending',
      // Felvették a kapcsolatot a klienssel
      'contacted',
      // Megerősített foglalás
      'confirmed',
      // Visszamondott
      'cancelled',
      // Lezárt esemény
      'completed'
    ),
    defaultValue: 'pending'
  },
  isSyncedToVtiger: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  syncAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastSyncAttempt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  syncError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Admin notes
  adminNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },

  // Additional form fields
  eventAddress: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  eventName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  eventCategory: {
    type: DataTypes.ENUM(
      'wedding',
      'corporate',
      'birthday',
      'festival',
      'private',
      'community',
      'other',
      'outdoor_free',
      'outdoor_paid',
      'indoor_free',
      'indoor_paid',
      'private_personal',
      'private_corporate'
    ),
    allowNull: true
  },
  companyAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  taxNumber: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  registrationNumber: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  representative: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  onSiteContactName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  onSiteContactPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  technicalContactName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  technicalContactPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  technicalContactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  invoiceEmail: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'bookings',
  timestamps: true,
  indexes: [
    { fields: ['performerId'] },
    { fields: ['status'] },
    { fields: ['eventDate'] },
    { fields: ['isSyncedToVtiger'] },
    { fields: ['clientEmail'] },
    { fields: ['vtigerLeadId'] }
  ]
});

module.exports = Booking;
