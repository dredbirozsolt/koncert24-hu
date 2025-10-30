'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('CookieConsents', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sessionId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Anonymous session identifier'
      },
      consentId: {
        type: Sequelize.STRING(36),
        allowNull: false,
        unique: true,
        comment: 'Unique identifier for this consent record'
      },
      essential: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Essential cookies (always true)'
      },
      statistics: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Statistical/Analytics cookies (e.g., Google Analytics)'
      },
      marketing: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Marketing cookies (e.g., Facebook Pixel)'
      },
      ipHash: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: 'SHA256 hash of IP address for privacy'
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      consentMethod: {
        type: Sequelize.ENUM('accept_all', 'accept_selected', 'essential_only'),
        allowNull: false,
        comment: 'How the user gave consent'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this consent expires (typically 12 months)'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('CookieConsents', ['userId']);
    await queryInterface.addIndex('CookieConsents', ['sessionId']);
    await queryInterface.addIndex('CookieConsents', ['consentId']);
    await queryInterface.addIndex('CookieConsents', ['createdAt']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('CookieConsents');
  }
};
