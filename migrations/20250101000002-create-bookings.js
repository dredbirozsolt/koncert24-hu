'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      vtigerLeadId: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'vTiger CRM Lead ID when synced'
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
      // Client information
      clientName: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      clientEmail: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      clientPhone: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      clientCompany: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      // Event information
      eventDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      eventTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      eventLocation: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      eventType: {
        type: Sequelize.ENUM(
          'wedding',
          'corporate',
          'birthday',
          'festival',
          'private',
          'other'
        ),
        allowNull: false
      },
      expectedGuests: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      // Additional information
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      budget: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      // Status tracking
      status: {
        type: Sequelize.ENUM(
          'pending',
          'contacted',
          'confirmed',
          'cancelled',
          'completed'
        ),
        defaultValue: 'pending'
      },
      isSyncedToVtiger: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      syncAttempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      lastSyncAttempt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      syncError: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // Admin notes
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true
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

    // Add indexes
    await queryInterface.addIndex('bookings', ['performerId']);
    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['eventDate']);
    await queryInterface.addIndex('bookings', ['isSyncedToVtiger']);
    await queryInterface.addIndex('bookings', ['clientEmail']);
    await queryInterface.addIndex('bookings', ['vtigerLeadId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bookings');
  }
};
