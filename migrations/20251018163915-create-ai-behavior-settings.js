'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AIBehaviorSettings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Kategória: personality, escalation, prohibited, responseStyle, etc.'
      },
      settingKey: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Beállítás kulcs, pl: tone, language, autoEscalateKeywords'
      },
      settingValue: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Érték (JSON string, ha összetett)'
      },
      dataType: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'array', 'object'),
        defaultValue: 'string',
        comment: 'Adat típus a valid parse-hoz'
      },
      label: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Admin UI-ban megjelenő cimke'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Segítő szöveg az admin felületen'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0
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

    // Indexes
    await queryInterface.addIndex('AIBehaviorSettings', ['category'], {
      name: 'idx_ai_behavior_category'
    });
    await queryInterface.addIndex('AIBehaviorSettings', ['category', 'settingKey'], {
      name: 'idx_ai_behavior_category_key',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AIBehaviorSettings');
  }
};
