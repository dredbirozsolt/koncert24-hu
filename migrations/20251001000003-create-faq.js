'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // FAQ Categories tábla
    await queryInterface.createTable('FaqCategories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      icon: {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: 'Emoji ikon (pl. 📋, 🎤, 🔧)'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Megjelenési sorrend'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
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

    // FAQ Items tábla
    await queryInterface.createTable('FaqItems', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'FaqCategories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      question: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      answer: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Megjelenési sorrend a kategórián belül'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      viewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Hányszor nyitották meg'
      },
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

    // Indexek
    await queryInterface.addIndex('FaqItems', ['categoryId']);
    await queryInterface.addIndex('FaqItems', ['isActive']);
    await queryInterface.addIndex('FaqCategories', ['displayOrder']);
    await queryInterface.addIndex('FaqItems', ['displayOrder']);
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('FaqItems');
    await queryInterface.dropTable('FaqCategories');
  }
};
