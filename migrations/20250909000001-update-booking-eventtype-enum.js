'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Modify the eventType enum column to include new event types
    await queryInterface.changeColumn('bookings', 'eventType', {
      type: Sequelize.ENUM(
        'wedding',
        'corporate',
        'birthday',
        'festival',
        'private',
        'other',
        'outdoor_free',
        'outdoor_paid',
        'indoor_free',
        'indoor_paid',
        'private_personal',
        'private_corporate'
      ),
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to original enum values
    await queryInterface.changeColumn('bookings', 'eventType', {
      type: Sequelize.ENUM(
        'wedding',
        'corporate',
        'birthday',
        'festival',
        'private',
        'other'
      ),
      allowNull: false
    });
  }
};
