/**
 * Migration: Add Soft Delete and Anonymization fields to ChatSessions
 * Best Practice: Soft Delete + Anonymization pattern (Slack/Zendesk model)
 * 
 * Új mezők:
 * - deletedAt: Soft delete timestamp
 * - deletionReason: Miért törölve ('auto_cleanup', 'admin', 'gdpr_request')
 * - anonymized: Személyes adatok anonimizálva-e
 * - anonymizedAt: Mikor lett anonimizálva
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('chat_sessions', 'deletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Soft delete timestamp - NULL = active, DATE = deleted'
    });

    await queryInterface.addColumn('chat_sessions', 'deletionReason', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Reason for deletion: auto_cleanup, admin, gdpr_request, user_request'
    });

    await queryInterface.addColumn('chat_sessions', 'anonymized', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Personal data anonymized (userName, userEmail, userPhone nulled)'
    });

    await queryInterface.addColumn('chat_sessions', 'anonymizedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'When anonymization occurred'
    });

    // Index for soft delete queries (performance optimization)
    await queryInterface.addIndex('chat_sessions', ['deletedAt'], {
      name: 'chat_sessions_deleted_at_idx'
    });

    // Index for anonymization queries
    await queryInterface.addIndex('chat_sessions', ['anonymized'], {
      name: 'chat_sessions_anonymized_idx'
    });

    console.log('✅ Soft delete and anonymization fields added to chat_sessions');
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('chat_sessions', 'chat_sessions_deleted_at_idx');
    await queryInterface.removeIndex('chat_sessions', 'chat_sessions_anonymized_idx');
    await queryInterface.removeColumn('chat_sessions', 'anonymizedAt');
    await queryInterface.removeColumn('chat_sessions', 'anonymized');
    await queryInterface.removeColumn('chat_sessions', 'deletionReason');
    await queryInterface.removeColumn('chat_sessions', 'deletedAt');
    console.log('✅ Soft delete fields removed from chat_sessions');
  }
};
