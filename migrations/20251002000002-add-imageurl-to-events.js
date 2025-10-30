'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Events', 'imageUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Előadó képének URL-je (Product modulból)'
    });

    // Index a gyorsabb képkereséshez
    await queryInterface.addIndex('Events', ['imageUrl']);
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeIndex('Events', ['imageUrl']);
    await queryInterface.removeColumn('Events', 'imageUrl');
  }
};
