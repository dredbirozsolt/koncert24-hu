'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_availability', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      admin_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      last_heartbeat: {
        type: Sequelize.DATE,
        allowNull: true
      },
      working_hours: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON format: {"monday": {"start": "09:00", "end": "17:00"}, ...}'
      },
      auto_away_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 15,
        allowNull: false
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
    await queryInterface.addIndex('admin_availability', ['is_online', 'last_heartbeat']);
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('admin_availability');
  }
};
