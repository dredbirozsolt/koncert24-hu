'use strict';

/**
 * Migration: Rename admin-related fields to sales-related fields in chat_sessions
 * 
 * This migration renames database columns to match the terminology refactor:
 * - assignedAdminId → assignedSalesId
 * - escalatedToAdmin → escalatedToSales
 * 
 * This aligns with the codebase change where "admin" role handlers are now "sales" handlers
 * for better semantic clarity between system administrators and sales personnel.
 */

module.exports = {
  /**
   * Apply the migration
   * Renames columns from admin terminology to sales terminology
   */
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Rename assignedAdminId to assignedSalesId
      await queryInterface.renameColumn(
        'chat_sessions',
        'assignedAdminId',
        'assignedSalesId',
        { transaction }
      );

      // Rename escalatedToAdmin to escalatedToSales
      await queryInterface.renameColumn(
        'chat_sessions',
        'escalatedToAdmin',
        'escalatedToSales',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Successfully renamed admin fields to sales fields in chat_sessions');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  /**
   * Rollback the migration
   * Reverts column names back to admin terminology
   */
  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Revert assignedSalesId back to assignedAdminId
      await queryInterface.renameColumn(
        'chat_sessions',
        'assignedSalesId',
        'assignedAdminId',
        { transaction }
      );

      // Revert escalatedToSales back to escalatedToAdmin
      await queryInterface.renameColumn(
        'chat_sessions',
        'escalatedToSales',
        'escalatedToAdmin',
        { transaction }
      );

      await transaction.commit();
      console.log('✅ Successfully reverted sales fields back to admin fields in chat_sessions');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
};
