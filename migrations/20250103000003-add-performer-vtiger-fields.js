'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('performers', 'performanceType', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Type of performance (élő, élő ének zenei alapra, etc.)'
    });

    await queryInterface.addColumn('performers', 'travelCost', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Travel cost per km in Ft'
    });

    await queryInterface.addColumn('performers', 'vatRate', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'VAT rate percentage (ÁFA %)'
    });

    await queryInterface.addColumn('performers', 'contactFirstName', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Contact person first name'
    });

    await queryInterface.addColumn('performers', 'contactLastName', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Contact person last name'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('performers', 'performanceType');
    await queryInterface.removeColumn('performers', 'travelCost');
    await queryInterface.removeColumn('performers', 'vatRate');
    await queryInterface.removeColumn('performers', 'contactFirstName');
    await queryInterface.removeColumn('performers', 'contactLastName');
  }
};
