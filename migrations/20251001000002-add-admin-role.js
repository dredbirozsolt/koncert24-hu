'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    // Modify the role ENUM to include 'admin'
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('client', 'performer', 'admin') NOT NULL DEFAULT 'client' COMMENT 'client = Megrendelő/szervező, performer = Előadó/manager, admin = Adminisztrátor';"
    );
  },

  down: async (queryInterface, _Sequelize) => {
    // Revert back to original ENUM (remove 'admin')
    // Note: This will fail if any users have 'admin' role
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('client', 'performer') NOT NULL DEFAULT 'client' COMMENT 'client = Megrendelő/szervező, performer = Előadó/manager';"
    );
  }
};
