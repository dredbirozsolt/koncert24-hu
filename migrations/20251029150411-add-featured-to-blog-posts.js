'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('BlogPosts', 'featured', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Kiemelt cikk a blog főoldalon'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('BlogPosts', 'featured');
  }
};
