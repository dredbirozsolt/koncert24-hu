'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add performer cleanup job - runs monthly on the 1st at 3 AM
    await queryInterface.bulkInsert('cron_jobs', [
      {
        id: 'performer-cleanup',
        name: 'Performer Cleanup',
        schedule: '0 3 1 * *', // Every month on the 1st at 3:00 AM
        description: 'Cleanup inactive performers with no bookings (older than 1 year)',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('cron_jobs', {
      id: 'performer-cleanup'
    });
  }
};
