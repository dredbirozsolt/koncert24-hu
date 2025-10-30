/**
 * Chat Service - Session Management Helpers
 * Handles session lifecycle, availability checks, and admin session management
 */

const { ChatSession, ChatMessage, BookingAvailability, SystemStatus } = require('../models');
const logger = require('../config/logger');
const settingsService = require('./settingsService');

// Error messages
const ERROR_SESSION_NOT_FOUND = 'Session not found';

// OpenAI reference (injected from main service)
let OpenAI = null;

/**
 * Set OpenAI reference (called from main chatService)
 */
function setOpenAIReference(openai) {
  OpenAI = openai;
}

/**
 * Helper: Check if OpenAI package is available
 */
async function checkOpenAIPackage(aiStatus) {
  logger.debug({
    service: 'chat',
    openAIInstalled: Boolean(OpenAI)
  }, 'Checking OpenAI package');
  if (!OpenAI) {
    await aiStatus.updateStatus(false, 'OpenAI package not installed');
    return false;
  }
  return true;
}

/**
 * Helper: Check if API key is configured
 */
async function checkAPIKey(aiStatus) {
  const apiKey = await settingsService.get('chat.openai_api_key');
  logger.debug({
    service: 'chat',
    apiKeyExists: Boolean(apiKey),
    keyLength: apiKey ? apiKey.length : 0
  }, 'Checking OpenAI API key');
  if (!apiKey) {
    await aiStatus.updateStatus(false, 'OpenAI API key not configured');
    return false;
  }
  return true;
}

/**
 * Check AI service health
 */
async function checkAIHealth() {
  const aiStatus = await SystemStatus.checkAIStatus();
  logger.debug({
    service: 'chat',
    isAvailable: aiStatus.isAvailable
  }, 'AI status retrieved');

  if (!aiStatus.isAvailable) {
    logger.debug({ service: 'chat' }, 'AI manually disabled in system status');
    return false;
  }

  const packageAvailable = await checkOpenAIPackage(aiStatus);
  if (!packageAvailable) {
    return false;
  }

  const apiKeyAvailable = await checkAPIKey(aiStatus);
  if (!apiKeyAvailable) {
    return false;
  }

  try {
    logger.debug({ service: 'chat' }, 'All AI checks passed, updating status to available');
    await aiStatus.updateStatus(true, null);
    return true;
  } catch (error) {
    logger.error({
      err: error,
      service: 'chat'
    }, 'Error during AI status update');
    await aiStatus.updateStatus(false, error.message);
    return false;
  }
}

/**
 * Check if AI service is available and healthy
 */
async function checkAIAvailability(systemStatus) {
  if (!checkAIHealth) {
    logger.warn({ service: 'chat' }, 'AI health checker not initialized');
    return false;
  }
  return systemStatus.ai.available && await checkAIHealth();
}

/**
 * Check if admin chat is available
 */
async function checkAdminAvailability(systemStatus) {
  const availableAdmins = await BookingAvailability.getAvailableAdmins();
  const adminAvailable = systemStatus.adminChat.available && availableAdmins.length > 0;
  return { adminAvailable, availableAdmins };
}

/**
 * Determine session status and fallback reason
 */
function determineSessionStatus(aiAvailable, adminAvailable) {
  if (!aiAvailable && !adminAvailable) {
    return { status: 'offline', fallbackReason: 'both_unavailable' };
  }
  if (!aiAvailable && adminAvailable) {
    return { status: 'escalated', fallbackReason: 'ai_unavailable' };
  }
  return { status: 'active', fallbackReason: null };
}

/**
 * Create chat session record
 */
async function createChatSession(userData, sessionToken, status, fallbackReason, availableAdmins) {
  const { userId, name, email, phone } = userData;

  logger.debug({
    service: 'chat',
    userId,
    status,
    fallbackReason
  }, 'Creating chat session');

  const session = await ChatSession.create({
    sessionToken,
    userId: userId || null,
    userName: name || 'Vendég',
    userEmail: email || null,
    userPhone: phone || null,
    status,
    fallbackReason,
    assignedSalesId: status === 'escalated' && availableAdmins.length > 0
      ? availableAdmins[0].id
      : null
  });

  logger.info({
    service: 'chat',
    sessionId: session.id,
    sessionToken: session.sessionToken,
    status: session.status
  }, 'Chat session created');

  return session;
}

/**
 * Close chat session
 */
async function closeSession(sessionToken) {
  const session = await ChatSession.findOne({
    where: { sessionToken }
  });

  if (!session) {
    throw new Error(ERROR_SESSION_NOT_FOUND);
  }

  await session.closeSession();

  // Generate AI summary if needed
  if (session.messages && session.messages.length > 5) {
    await session.generateAISummary();
  }

  return session;
}

/**
 * Get session with messages
 */
async function getSession(sessionToken) {
  return await ChatSession.findOne({
    where: { sessionToken },
    include: [
      {
        model: ChatMessage,
        as: 'messages',
        order: [['createdAt', 'ASC']]
      }
    ]
  });
}

/**
 * Get active sales sessions
 */
async function getAdminSessions(adminId) {
  return await ChatSession.findAll({
    where: {
      assignedSalesId: adminId,
      status: ['active', 'escalated']
    },
    include: [
      {
        model: ChatMessage,
        as: 'messages',
        limit: 1,
        order: [['createdAt', 'DESC']]
      }
    ],
    order: [['updatedAt', 'DESC']]
  });
}

module.exports = {
  checkAIAvailability,
  checkAdminAvailability,
  determineSessionStatus,
  createChatSession,
  closeSession,
  getSession,
  getAdminSessions,
  checkAIHealth,
  setOpenAIReference
};
