'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Events', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      vtigerId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Vtiger Sales Order ID'
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Tárgy'
      },
      performanceDate: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Előadás dátuma'
      },
      performanceTime: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Előadás időpontja'
      },
      performanceLocation: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Előadás helyszíne'
      },
      itemName: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Tétel megnevezése'
      },
      status: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Állapot (Jóváhagyott, stb.)'
      },
      performerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Performers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Kapcsolódó előadó'
      },
      rawData: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Teljes Vtiger adat JSON formátumban'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Index a gyors kereséshez
    await queryInterface.addIndex('Events', ['vtigerId']);
    await queryInterface.addIndex('Events', ['performanceDate']);
    await queryInterface.addIndex('Events', ['status']);
    await queryInterface.addIndex('Events', ['performerId']);
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('Events');
  }
};
