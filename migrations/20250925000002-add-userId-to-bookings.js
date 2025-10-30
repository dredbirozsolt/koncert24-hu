'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('bookings', ['userId'], {
      name: 'bookings_userId_index'
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeIndex('bookings', 'bookings_userId_index');
    await queryInterface.removeColumn('bookings', 'userId');
  }
};
