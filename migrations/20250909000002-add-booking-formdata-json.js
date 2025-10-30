'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add formData JSON column to store additional form fields
    await queryInterface.addColumn('bookings', 'formData', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Additional form data (JSON format) for fields not in main schema'
    });
  },

  async down(queryInterface, _Sequelize) {
    // Remove formData column
    await queryInterface.removeColumn('bookings', 'formData');
  }
};
