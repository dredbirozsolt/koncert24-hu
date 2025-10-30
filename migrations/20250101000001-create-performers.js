'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('performers', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      vtigerId: {
        type: Sequelize.STRING(50),
        unique: true,
        allowNull: true,
        comment: 'vTiger CRM contact ID'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false
      },
      category: {
        type: Sequelize.ENUM(
          'pop',
          'mulatos',
          'retro',
          'tacmusor',
          'musorzerveto',
          'humorista',
          'kiegeszito',
          'hiphop',
          'musical',
          'gyermek'
        ),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      shortDescription: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      imageUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      videoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Performance duration in minutes'
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      website: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      featuredOrder: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Order for featured performers on homepage'
      },
      lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last sync from vTiger CRM'
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
    await queryInterface.addIndex('performers', ['category']);
    await queryInterface.addIndex('performers', ['isActive']);
    await queryInterface.addIndex('performers', ['featuredOrder']);
    await queryInterface.addIndex('performers', ['slug']);
    await queryInterface.addIndex('performers', ['vtigerId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('performers');
  }
};
