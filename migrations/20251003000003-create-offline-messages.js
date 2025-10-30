'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('offline_messages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'chat_sessions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      current_page: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'replied', 'archived'),
        defaultValue: 'pending',
        allowNull: false
      },
      email_sent_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      replied_by_admin_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      replied_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Indexek
    await queryInterface.addIndex('offline_messages', ['status', 'created_at']);
    await queryInterface.addIndex('offline_messages', ['email']);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('offline_messages');
  }
};
