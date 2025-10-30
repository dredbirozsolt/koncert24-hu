'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, remove the ENUM constraint by changing to VARCHAR
    await queryInterface.changeColumn('performers', 'category', {
      type: Sequelize.STRING(100),
      allowNull: false,
      comment: 'Dynamic category from vTiger CRM'
    });

    console.log('✅ Performer category column changed to dynamic STRING type');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to ENUM (only if needed)
    await queryInterface.changeColumn('performers', 'category', {
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
    });
  }
};
