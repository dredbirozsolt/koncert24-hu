'use strict';

/**
 * Migration: Rename all snake_case columns to camelCase
 * This is a comprehensive migration to follow JavaScript naming conventions
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, _Sequelize) {
    // chat_sessions már kész - skip
    // chat_messages már kész - skip
    
    // 3. offline_messages table
    await queryInterface.renameColumn('offline_messages', 'session_id', 'sessionId');
    await queryInterface.renameColumn('offline_messages', 'current_page', 'currentPage');
    await queryInterface.renameColumn('offline_messages', 'user_agent', 'userAgent');
    await queryInterface.renameColumn('offline_messages', 'ip_address', 'ipAddress');
    await queryInterface.renameColumn('offline_messages', 'email_sent_at', 'emailSentAt');
    await queryInterface.renameColumn('offline_messages', 'replied_by_admin_id', 'repliedByAdminId');
    await queryInterface.renameColumn('offline_messages', 'replied_at', 'repliedAt');
    await queryInterface.renameColumn('offline_messages', 'created_at', 'createdAt');
    await queryInterface.renameColumn('offline_messages', 'updated_at', 'updatedAt');

    // 4. booking_availability table
    await queryInterface.renameColumn('booking_availability', 'admin_id', 'adminId');
    await queryInterface.renameColumn('booking_availability', 'is_online', 'isOnline');
    await queryInterface.renameColumn('booking_availability', 'last_heartbeat', 'lastHeartbeat');
    await queryInterface.renameColumn('booking_availability', 'working_hours', 'workingHours');
    await queryInterface.renameColumn('booking_availability', 'auto_away_minutes', 'autoAwayMinutes');
    await queryInterface.renameColumn('booking_availability', 'created_at', 'createdAt');
    await queryInterface.renameColumn('booking_availability', 'updated_at', 'updatedAt');

    // 5. system_status table
    await queryInterface.renameColumn('system_status', 'service_name', 'serviceName');
    await queryInterface.renameColumn('system_status', 'is_available', 'isAvailable');
    await queryInterface.renameColumn('system_status', 'last_check_at', 'lastCheckAt');
    await queryInterface.renameColumn('system_status', 'error_message', 'errorMessage');
    await queryInterface.renameColumn('system_status', 'updated_at', 'updatedAt');

    console.log('✅ All columns renamed to camelCase successfully');
  },

  async down(queryInterface, Sequelize) {
    // Revert back to snake_case
    
    // 1. chat_sessions table
    await queryInterface.renameColumn('chat_sessions', 'sessionToken', 'session_token');
    await queryInterface.renameColumn('chat_sessions', 'userId', 'user_id');
    await queryInterface.renameColumn('chat_sessions', 'userName', 'user_name');
    await queryInterface.renameColumn('chat_sessions', 'userEmail', 'user_email');
    await queryInterface.renameColumn('chat_sessions', 'userPhone', 'user_phone');
    await queryInterface.renameColumn('chat_sessions', 'ipAddress', 'ip_address');
    await queryInterface.renameColumn('chat_sessions', 'userAgent', 'user_agent');
    await queryInterface.renameColumn('chat_sessions', 'currentPage', 'current_page');
    // NOTE: These fields were later renamed to sales terminology in migration 20251018000001
    await queryInterface.renameColumn('chat_sessions', 'assignedSalesId', 'assigned_admin_id');
    await queryInterface.renameColumn('chat_sessions', 'escalatedToSales', 'escalated_to_admin');
    await queryInterface.renameColumn('chat_sessions', 'escalationReason', 'escalation_reason');
    await queryInterface.renameColumn('chat_sessions', 'fallbackReason', 'fallback_reason');
    await queryInterface.renameColumn('chat_sessions', 'escalatedAt', 'escalated_at');
    await queryInterface.renameColumn('chat_sessions', 'resolvedAt', 'resolved_at');
    await queryInterface.renameColumn('chat_sessions', 'closedAt', 'closed_at');
    await queryInterface.renameColumn('chat_sessions', 'aiSummary', 'ai_summary');
    await queryInterface.renameColumn('chat_sessions', 'createdAt', 'created_at');
    await queryInterface.renameColumn('chat_sessions', 'updatedAt', 'updated_at');

    // 2. chat_messages table
    await queryInterface.renameColumn('chat_messages', 'sessionId', 'session_id');
    await queryInterface.renameColumn('chat_messages', 'adminId', 'admin_id');
    await queryInterface.renameColumn('chat_messages', 'isRead', 'is_read');
    await queryInterface.renameColumn('chat_messages', 'readAt', 'read_at');
    await queryInterface.renameColumn('chat_messages', 'createdAt', 'created_at');
    await queryInterface.renameColumn('chat_messages', 'updatedAt', 'updated_at');

    // 3. offline_messages table
    await queryInterface.renameColumn('offline_messages', 'sessionId', 'session_id');
    await queryInterface.renameColumn('offline_messages', 'currentPage', 'current_page');
    await queryInterface.renameColumn('offline_messages', 'userAgent', 'user_agent');
    await queryInterface.renameColumn('offline_messages', 'ipAddress', 'ip_address');
    await queryInterface.renameColumn('offline_messages', 'emailSentAt', 'email_sent_at');
    await queryInterface.renameColumn('offline_messages', 'repliedByAdminId', 'replied_by_admin_id');
    await queryInterface.renameColumn('offline_messages', 'repliedAt', 'replied_at');
    await queryInterface.renameColumn('offline_messages', 'createdAt', 'created_at');
    await queryInterface.renameColumn('offline_messages', 'updatedAt', 'updated_at');

    // 4. booking_availability table
    await queryInterface.renameColumn('booking_availability', 'adminId', 'admin_id');
    await queryInterface.renameColumn('booking_availability', 'isOnline', 'is_online');
    await queryInterface.renameColumn('booking_availability', 'lastHeartbeat', 'last_heartbeat');
    await queryInterface.renameColumn('booking_availability', 'workingHours', 'working_hours');
    await queryInterface.renameColumn('booking_availability', 'autoAwayMinutes', 'auto_away_minutes');
    await queryInterface.renameColumn('booking_availability', 'createdAt', 'created_at');
    await queryInterface.renameColumn('booking_availability', 'updatedAt', 'updated_at');

    // 5. system_status table
    await queryInterface.renameColumn('system_status', 'serviceName', 'service_name');
    await queryInterface.renameColumn('system_status', 'isAvailable', 'is_available');
    await queryInterface.renameColumn('system_status', 'lastCheckAt', 'last_check_at');
    await queryInterface.renameColumn('system_status', 'errorMessage', 'error_message');
    await queryInterface.renameColumn('system_status', 'updatedAt', 'updated_at');

    console.log('✅ All columns reverted to snake_case successfully');
  }
};
