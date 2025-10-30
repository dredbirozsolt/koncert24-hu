/**
 * Migration: Blog Categories tábla létrehozása
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BlogCategories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Kategória neve'
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'URL-barát slug'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Kategória leírás (SEO)'
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'BlogCategories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Szülő kategória (hierarchia)'
      },
      metaTitle: {
        type: Sequelize.STRING(70),
        allowNull: true,
        comment: 'SEO meta title'
      },
      metaDescription: {
        type: Sequelize.STRING(160),
        allowNull: true,
        comment: 'SEO meta description'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Megjelenítési sorrend'
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

    await queryInterface.addIndex('BlogCategories', ['slug'], {
      name: 'idx_blog_categories_slug',
      unique: true
    });

    await queryInterface.addIndex('BlogCategories', ['parentId'], {
      name: 'idx_blog_categories_parent'
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('BlogCategories');
  }
};
