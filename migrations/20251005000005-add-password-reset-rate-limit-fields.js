'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'passwordResetAttempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Number of password reset attempts in the current window'
    });

    await queryInterface.addColumn('Users', 'passwordResetWindowStart', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Start time of password reset rate limit window'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'passwordResetAttempts');
    await queryInterface.removeColumn('Users', 'passwordResetWindowStart');
  }
};
