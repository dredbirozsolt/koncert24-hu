'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // Add admin email setting
    await queryInterface.bulkInsert('settings', [
      {
        key: 'email.admin',
        value: '',
        type: 'string',
        category: 'email',
        description: 'Admin notification email for critical alerts and system events',
        isPublic: false,
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'email.booking',
        value: '',
        type: 'string',
        category: 'email',
        description: 'Booking notification email for reservations and cancellations',
        isPublic: false,
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {
      ignoreDuplicates: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove admin and booking email settings
    await queryInterface.bulkDelete('settings', {
      key: {
        [Sequelize.Op.in]: ['email.admin', 'email.booking']
      }
    });
  }
};
