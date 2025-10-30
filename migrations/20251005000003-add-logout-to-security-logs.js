'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL ALTER TYPE method for ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE SecurityLogs 
      MODIFY COLUMN eventType ENUM(
        'login_success',
        'login_failed',
        'login_locked',
        'logout',
        'password_reset_request',
        'password_reset_success',
        'password_changed',
        'email_changed',
        'csrf_violation',
        'xss_attempt',
        'sql_injection_attempt',
        'rate_limit_exceeded',
        'account_locked',
        'account_unlocked'
      ) NOT NULL COMMENT 'Type of security event'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert back to original ENUM without 'logout'
    await queryInterface.sequelize.query(`
      ALTER TABLE SecurityLogs 
      MODIFY COLUMN eventType ENUM(
        'login_success',
        'login_failed',
        'login_locked',
        'password_reset_request',
        'password_reset_success',
        'password_changed',
        'email_changed',
        'csrf_violation',
        'xss_attempt',
        'sql_injection_attempt',
        'rate_limit_exceeded',
        'account_locked',
        'account_unlocked'
      ) NOT NULL COMMENT 'Type of security event'
    `);
  }
};
