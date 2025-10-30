'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('performers', 'technicalRequirements', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Technical requirements/rider from VTiger (cf_811)',
      after: 'travelCostCalculation'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('performers', 'technicalRequirements');
  }
};
