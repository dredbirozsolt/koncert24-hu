'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('performers', 'travelCostCalculation', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Travel cost calculation base (e.g., Budapest)'
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeColumn('performers', 'travelCostCalculation');
  }
};
