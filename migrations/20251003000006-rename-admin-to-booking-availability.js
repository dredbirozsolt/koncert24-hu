'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // Átnevezzük az admin_availability táblát booking_availability-re
    await queryInterface.renameTable('admin_availability', 'booking_availability');
  },

  async down(queryInterface, _Sequelize) {
    // Visszaállítjuk az eredeti nevet
    await queryInterface.renameTable('booking_availability', 'admin_availability');
  }
};
