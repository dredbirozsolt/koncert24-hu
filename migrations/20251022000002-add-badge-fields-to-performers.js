'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('performers', 'isFeatured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Featured/highlighted performer (Kiemelt)'
    });

    await queryInterface.addColumn('performers', 'isPopular', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Popular performer (Népszerű)'
    });

    await queryInterface.addColumn('performers', 'hasDiscount', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has special discount/promotion (Kedvezményes)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('performers', 'isFeatured');
    await queryInterface.removeColumn('performers', 'isPopular');
    await queryInterface.removeColumn('performers', 'hasDiscount');
  }
};
