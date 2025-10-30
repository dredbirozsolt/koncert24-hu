'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'community' to eventCategory ENUM
    await queryInterface.changeColumn('bookings', 'eventCategory', {
      type: Sequelize.ENUM(
        'wedding',
        'corporate',
        'birthday',
        'festival',
        'private',
        'community',  // Added this value
        'other',
        'outdoor_free',
        'outdoor_paid',
        'indoor_free',
        'indoor_paid',
        'private_personal',
        'private_corporate'
      ),
      allowNull: true,
      comment: 'Event category from form - updated with community'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove 'community' from eventCategory ENUM
    await queryInterface.changeColumn('bookings', 'eventCategory', {
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
      allowNull: true,
      comment: 'Event category from form'
    });
  }
};
