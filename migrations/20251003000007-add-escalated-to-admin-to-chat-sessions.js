'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('chat_sessions', 'escalated_to_admin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      after: 'status'
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeColumn('chat_sessions', 'escalated_to_admin');
  }
};
