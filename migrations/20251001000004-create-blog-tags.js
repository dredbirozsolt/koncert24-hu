/**
 * Migration: Blog Tags
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Tags tábla
    await queryInterface.createTable('BlogTags', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Tag neve'
      },
      slug: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'URL-barát slug'
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

    await queryInterface.addIndex('BlogTags', ['slug'], {
      name: 'idx_blog_tags_slug',
      unique: true
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('BlogTags');
  }
};
