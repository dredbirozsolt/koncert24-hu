'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('performers', 'style', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Performance styles as array from vTiger (Stílus)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('performers', 'style');
  }
};
