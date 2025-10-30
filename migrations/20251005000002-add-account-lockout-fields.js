'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'loginAttempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('Users', 'lockUntil', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Users', 'lastLoginAttempt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'loginAttempts');
    await queryInterface.removeColumn('Users', 'lockUntil');
    await queryInterface.removeColumn('Users', 'lastLoginAttempt');
  }
};
