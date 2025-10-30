'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SecurityLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
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
      email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      eventType: {
        type: Sequelize.ENUM(
          'login_success',
          'login_failed',
          'login_locked',
          'password_reset_request',
          'password_reset_success',
          'password_change',
          'email_change',
          'suspicious_activity',
          'csrf_violation',
          'xss_attempt',
          'sql_injection_attempt',
          'rate_limit_exceeded',
          'account_locked',
          'account_unlocked'
        ),
        allowNull: false
      },
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      details: {
        type: Sequelize.JSON,
        allowNull: true
      },
      severity: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'low',
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Index a gyorsabb kereséshez
    await queryInterface.addIndex('SecurityLogs', ['userId']);
    await queryInterface.addIndex('SecurityLogs', ['email']);
    await queryInterface.addIndex('SecurityLogs', ['eventType']);
    await queryInterface.addIndex('SecurityLogs', ['ipAddress']);
    await queryInterface.addIndex('SecurityLogs', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('SecurityLogs');
  }
};
