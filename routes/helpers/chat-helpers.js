/**
 * Chat Route Helpers
 * Shared utility functions for chat routes (API and Admin)
 */

const logger = require('../../config/logger');
const { ChatSession, ChatMessage } = require('../../models');
const { Op } = require('sequelize');

/**
 * Validate session access
 * Checks if user has permission to access a chat session
 * @param {string} sessionId - Session ID to validate
 * @param {number|null} userId - User ID (null for guest)
 * @param {boolean} isAdmin - Whether user is admin/sales
 * @returns {Promise<Object>} - Session object if valid
 * @throws {Error} - If session not found or unauthorized
 */
async function validateSessionAccess(sessionId, userId = null, isAdmin = false) {
  const session = await ChatSession.findByPk(sessionId);

  if (!session) {
    throw new Error('Session not found');
  }

  // Admins can access any session
  if (isAdmin) {
    return session;
  }

  // Users can only access their own sessions
  if (!userId || session.userId !== userId) {
    throw new Error('Unauthorized access to session');
  }

  return session;
}

/**
 * Handle chat error response
 * Standardized error handling for chat routes
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} userMessage - User-friendly error message
 * @returns {Object} - JSON error response
 */
function handleChatError(res, error, statusCode = 500, userMessage = 'An error occurred') {
  logger.error({
    err: error,
    service: 'chatHelpers',
    operation: 'handleChatError',
    statusCode
  }, 'Chat error occurred');

  return res.status(statusCode).json({
    success: false,
    error: userMessage,
    ...(process.env.NODE_ENV === 'development' && { debug: error.message })
  });
}

/**
 * Handle chat render error
 * Standardized error handling for rendered chat pages
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} view - View template to render (default: 'error')
 * @param {string} title - Page title
 * @param {string} message - User-friendly error message
 */
function handleChatRenderError(res, error, view = 'error', title = 'Hiba', message = 'Hiba történt') {
  logger.error({
    err: error,
    service: 'chatHelpers',
    operation: 'handleChatRenderError',
    view
  }, 'Chat render error occurred');

  res.status(500).render(view, {
    title,
    message,
    error: process.env.NODE_ENV === 'development' ? error : {}
  });
}

/**
 * Validate message content
 * Ensures message content is valid
 * @param {string} content - Message content to validate
 * @returns {string} - Trimmed and validated content
 * @throws {Error} - If content is invalid
 */
function validateMessage(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Message content is required');
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    throw new Error('Message content cannot be empty');
  }

  if (trimmed.length > 5000) {
    throw new Error('Message content is too long (max 5000 characters)');
  }

  return trimmed;
}

/**
 * Get validation error response
 * Formats express-validator errors for consistent response
 * @param {Object} errors - Express-validator errors object
 * @returns {Object} - Formatted error response
 */
function getValidationErrors(errors) {
  return {
    success: false,
    errors: errors.array().map((err) => ({
      field: err.param,
      message: err.msg
    }))
  };
}

/**
 * Check session timeout
 * Determines if a session has timed out
 * @param {Object} session - ChatSession instance
 * @param {number} timeoutMinutes - Timeout threshold in minutes (default: 30)
 * @returns {boolean} - True if session has timed out
 */
function isSessionTimedOut(session, timeoutMinutes = 30) {
  if (!session || !session.lastActivityAt) {
    return false;
  }

  const lastActivity = new Date(session.lastActivityAt);
  const now = new Date();
  const diffMinutes = (now - lastActivity) / (1000 * 60);

  return diffMinutes > timeoutMinutes;
}

/**
 * Get session status info
 * Returns human-readable session status information
 * @param {Object} session - ChatSession instance
 * @returns {Object} - Status information
 */
function getSessionStatus(session) {
  const status = session.status || 'active';
  const hasSales = Boolean(session.assignedSalesId);
  const isTimedOut = isSessionTimedOut(session);

  let statusText = 'Aktív';
  let statusClass = 'status-active';

  if (isTimedOut) {
    statusText = 'Időtúllépés';
    statusClass = 'status-timeout';
  } else if (status === 'closed') {
    statusText = 'Lezárt';
    statusClass = 'status-closed';
  } else if (status === 'waiting') {
    statusText = 'Várakozik';
    statusClass = 'status-waiting';
  } else if (hasSales) {
    statusText = 'Értékesítővel';
    statusClass = 'status-with-sales';
  }

  return {
    status: statusText,
    statusClass,
    hasSales,
    isTimedOut
  };
}

/**
 * Format session for API response
 * Standardizes session data for API responses
 * @param {Object} session - ChatSession instance
 * @param {boolean} includeMessages - Whether to include messages
 * @returns {Object} - Formatted session data
 */
async function formatSessionForAPI(session, includeMessages = false) {
  const formatted = {
    id: session.id,
    status: session.status,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    hasSales: Boolean(session.assignedSalesId),
    statusInfo: getSessionStatus(session)
  };

  if (includeMessages) {
    const messages = await ChatMessage.findAll({
      where: { sessionId: session.id },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'content', 'sender', 'createdAt', 'isRead']
    });
    formatted.messages = messages;
  }

  return formatted;
}

/**
 * Validate session creation data
 * Validates and sanitizes session creation input
 * @param {Object} data - Session creation data
 * @returns {Object} - Validated and sanitized data
 */
function validateSessionCreation(data) {
  const validated = {
    userName: null,
    userEmail: null,
    userPhone: null,
    currentPage: null
  };

  // Optional name
  if (data.name && typeof data.name === 'string') {
    validated.userName = data.name.trim().substring(0, 100);
  }

  // Optional email
  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = data.email.trim().toLowerCase();
    if (emailRegex.test(email)) {
      validated.userEmail = email;
    }
  }

  // Optional phone
  if (data.phone && typeof data.phone === 'string') {
    validated.userPhone = data.phone.trim().substring(0, 20);
  }

  // Optional current page
  if (data.currentPage && typeof data.currentPage === 'string') {
    validated.currentPage = data.currentPage.trim().substring(0, 255);
  }

  return validated;
}

/**
 * Check if admin can access session
 * Validates admin permission for session access
 * @param {Object} session - ChatSession instance
 * @param {number} adminId - Admin user ID
 * @returns {boolean} - True if admin can access
 */
function canAdminAccessSession(session, adminId) {
  // Admin can access if:
  // 1. Session has no assigned sales person yet
  // 2. Session is assigned to this admin
  // 3. Admin has escalated permissions (checked elsewhere)

  if (!session.assignedSalesId) {
    return true;
  }

  return session.assignedSalesId === adminId;
}

/**
 * Build message query filters
 * Constructs Sequelize where clause for message queries
 * @param {Object} filters - Filter options
 * @returns {Object} - Sequelize where clause
 */
function buildMessageQueryFilters(filters = {}) {
  const where = {};

  if (filters.sessionId) {
    where.sessionId = filters.sessionId;
  }

  if (filters.sender) {
    where.sender = filters.sender;
  }

  if (filters.unreadOnly) {
    where.isRead = false;
  }

  if (filters.since) {
    where.createdAt = { [Op.gte]: new Date(filters.since) };
  }

  return where;
}

module.exports = {
  // Session validation
  validateSessionAccess,
  validateSessionCreation,
  canAdminAccessSession,

  // Message validation
  validateMessage,

  // Error handling
  handleChatError,
  handleChatRenderError,
  getValidationErrors,

  // Session utilities
  isSessionTimedOut,
  getSessionStatus,
  formatSessionForAPI,

  // Query builders
  buildMessageQueryFilters
};
