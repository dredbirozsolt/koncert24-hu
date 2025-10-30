'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('quotes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      referenceId: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'Format: AJ-YYYY-NNNN'
      },
      performerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'performers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      // Event Details
      eventDate: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      eventDateFlexible: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      eventTime: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      eventLocation: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      eventTypes: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of event types: szabadteri, belteri, ceges, privat, belepos'
      },
      guestCount: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Options: <100, 100-300, 300-1000, 1000+'
      },
      eventName: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      eventCategory: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      // Contact Details
      contactName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      contactEmail: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      contactPhone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Status
      status: {
        type: Sequelize.ENUM('pending', 'contacted', 'confirmed', 'rejected', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false
      },
      // Timestamps
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add index for faster lookups
    await queryInterface.addIndex('quotes', ['referenceId']);
    await queryInterface.addIndex('quotes', ['performerId']);
    await queryInterface.addIndex('quotes', ['status']);
    await queryInterface.addIndex('quotes', ['createdAt']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('quotes');
  }
};
