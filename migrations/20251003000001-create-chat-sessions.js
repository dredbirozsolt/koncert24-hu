'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_sessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      session_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      user_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      user_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      user_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      current_page: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'escalated', 'resolved', 'closed', 'offline'),
        defaultValue: 'active',
        allowNull: false
      },
      assigned_admin_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      escalation_reason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      fallback_reason: {
        type: Sequelize.ENUM('ai_unavailable', 'no_admin_online', 'both_unavailable', 'ai_error'),
        allowNull: true
      },
      escalated_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ai_summary: {
        type: Sequelize.TEXT,
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
    await queryInterface.addIndex('chat_sessions', ['session_token']);
    await queryInterface.addIndex('chat_sessions', ['status', 'created_at']);
    await queryInterface.addIndex('chat_sessions', ['assigned_admin_id']);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('chat_sessions');
  }
};
