'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('locations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      name_en: { // eslint-disable-line camelcase
        type: Sequelize.STRING(255),
        allowNull: true
      },
      country_code: { // eslint-disable-line camelcase
        type: Sequelize.CHAR(2),
        allowNull: false
      },
      country_name: { // eslint-disable-line camelcase
        type: Sequelize.STRING(100),
        allowNull: false
      },
      admin_level: { // eslint-disable-line camelcase
        type: Sequelize.INTEGER,
        allowNull: true
      },
      place_type: { // eslint-disable-line camelcase
        type: Sequelize.ENUM('city', 'town', 'village', 'hamlet'),
        allowNull: false,
        defaultValue: 'city'
      },
      population: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      },
      osm_id: { // eslint-disable-line camelcase
        type: Sequelize.BIGINT,
        allowNull: true
      },
      created_at: { // eslint-disable-line camelcase
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: { // eslint-disable-line camelcase
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Indexek hozzáadása
    await queryInterface.addIndex('locations', ['name'], {
      name: 'idx_locations_name'
    });

    await queryInterface.addIndex('locations', ['country_code'], {
      name: 'idx_locations_country'
    });

    await queryInterface.addIndex('locations', ['place_type'], {
      name: 'idx_locations_place_type'
    });

    await queryInterface.addIndex('locations', ['population'], {
      name: 'idx_locations_population'
    });

    // Composit index a gyakori keresésekhez
    await queryInterface.addIndex('locations', ['country_code', 'place_type', 'name'], {
      name: 'idx_locations_search'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('locations');
  }
};
