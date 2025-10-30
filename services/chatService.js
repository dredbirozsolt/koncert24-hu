/**
 * Chat Service
 * Handles AI chat, admin escalation, and offline fallback logic
 */

const { ChatSession, ChatMessage, OfflineMessage, SystemStatus, BookingAvailability } = require('../models');
const logger = require('../config/logger');
const settingsService = require('./settingsService');
const crypto = require('crypto');
const sessionHelpers = require('./chatService-session');
const { sendOfflineMessageEmail: sendOfflineEmail } = require('./chatService-offline');

// Error messages
const ERROR_SESSION_NOT_FOUND = 'Session not found';

// OpenAI import (will be installed later)
let OpenAI = null;
try {
  OpenAI = require('openai');
} catch {
  logger.warn({ service: 'chat' }, 'OpenAI package not installed. AI features will be disabled.');
}

// Destructure session helpers
const {
  checkAIAvailability,
  checkAdminAvailability,
  determineSessionStatus,
  createChatSession,
  closeSession: closeSessionHelper,
  getSession: getSessionHelper,
  getAdminSessions: getAdminSessionsHelper,
  checkAIHealth,
  setOpenAIReference
} = sessionHelpers;

// Initialize OpenAI reference for session helpers
setOpenAIReference(OpenAI);

/**
 * Initialize chat session
 * Determines the best available service (AI/Admin/Offline)
 */
/**
 * Helper: Get welcome message based on status
 */
function getWelcomeMessage(status) {
  if (status === 'offline') {
    return 'Jelenleg nincs elérhető munkatárs. Kérjük, hagyja üzenetét, és hamarosan válaszolunk!';
  }
  if (status === 'escalated') {
    return 'Üdvözlöm! Egy munkatársunk hamarosan segít Önnek.';
  }
  return 'Üdvözlöm! Miben segíthetek?';
}

/**
 * Helper: Get mode based on status
 */
function getModeFromStatus(status) {
  if (status === 'offline') {
    return 'offline_mode';
  }
  if (status === 'escalated') {
    return 'admin_only';
  }
  return 'full_service';
}

/**
 * Helper: Send welcome message
 */
async function sendWelcomeMessage(session, status) {
  const welcomeMessage = getWelcomeMessage(status);
  await ChatMessage.create({
    sessionId: session.id,
    role: 'system',
    content: welcomeMessage
  });
}

/**
 * Initialize new chat session
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Session data
 */
async function initializeChat(userData = {}) {
  try {
    logger.debug({
      service: 'chat',
      hasUserData: Boolean(userData?.userId || userData?.email)
    }, 'Initializing chat session');

    const systemStatus = await SystemStatus.getOverallStatus();
    logger.debug({
      service: 'chat',
      aiAvailable: systemStatus.ai.available,
      adminAvailable: systemStatus.adminChat.available
    }, 'System status retrieved');

    const sessionToken = crypto.randomBytes(32).toString('hex');

    const aiAvailable = await checkAIAvailability(systemStatus);
    const { adminAvailable, availableAdmins } = await checkAdminAvailability(systemStatus);

    const { status, fallbackReason } = determineSessionStatus(aiAvailable, adminAvailable);

    const session = await createChatSession(userData, sessionToken, status, fallbackReason, availableAdmins);

    logger.info({
      service: 'chat',
      sessionId: session.id,
      status,
      mode: getModeFromStatus(status)
    }, 'Chat session created');

    await sendWelcomeMessage(session, status);

    const mode = getModeFromStatus(status);

    return {
      session,
      mode,
      aiAvailable,
      adminAvailable
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'chat',
      userData: userData?.email || 'anonymous'
    }, 'Chat initialization error');
    throw error;
  }
}

// Helper: Handle offline session response
function handleOfflineSessionResponse() {
  return {
    role: 'system',
    content: 'A rendszer jelenleg offline módban működik. Kérjük, használja az offline üzenet formot.'
  };
}

// Helper: Handle escalated session response
function handleEscalatedSessionResponse(session) {
  const hasAdminReply = session.messages && session.messages.some((msg) => msg.role === 'admin');

  if (hasAdminReply) {
    // Admin already in conversation - don't send automatic response
    return null;
  }

  // Check if there's an assigned sales person available
  const hasAssignedSales = session.assignedSalesId && session.assignedSalesId !== null;

  if (!hasAssignedSales) {
    // No sales person available - show offline form
    return {
      role: 'system',
      content: '💬 Jelenleg nincs elérhető munkatársunk.\n\n'
        + '**Mit szeretne tenni?**\n\n'
        + '✉️ **Offline üzenetet hagy** → Kitölti az alábbi űrlapot, és 24 órán belül visszahívjuk\n\n'
        + '💬 **AI asszisztenssel folytatja** → Írjon új üzenetet, és szívesen válaszolok további kérdéseire\n\n'
        + '_Az űrlap 3 másodperc múlva jelenik meg..._',
      showOfflineForm: true
    };
  }

  // First message after escalation - inform user
  return {
    role: 'system',
    content: 'Üzenete továbbítva lett egy munkatársunknak. Hamarosan válaszolunk.'
  };
}

// Helper: Handle AI response with potential escalation
async function handleAIResponse(session, messageContent) {
  try {
    const response = await getAIResponse(session, messageContent);

    // Check if escalation needed based on DB keywords
    const { shouldAutoEscalate } = require('./chatBehaviorRules');
    const needsEscalation = await shouldAutoEscalate(messageContent);

    // Also check if AI is uncertain
    const responseLower = response.content.toLowerCase();
    const aiUncertain = responseLower.includes('nem tudom')
      || responseLower.includes('nem vagyok biztos')
      || responseLower.includes('munkatárs');

    if (needsEscalation || aiUncertain) {
      try {
        await escalateToSales(session.id, 'user_request_or_complex_query');
        response.content += '\n\n🔄 Kérdését továbbítottam egy munkatársunknak, aki hamarosan válaszol!';
      } catch (escalationError) {
        logger.warn({
          err: escalationError,
          service: 'chat',
          sessionId: session.id
        }, 'Escalation failed - no admin available');

        // No admin available - replace AI response with clear options
        // Don't mix AI answer with offline form message - keep it clean
        response.content = '💬 Jelenleg nincs elérhető munkatársunk.\n\n'
          + '**Mit szeretne tenni?**\n\n'
          + '✉️ **Offline üzenetet hagy** → Kitölti az alábbi űrlapot, és 24 órán belül visszahívjuk\n\n'
          + '💬 **AI asszisztenssel folytatja** → Írjon új üzenetet, és szívesen válaszolok további kérdéseire\n\n'
          + '_Az űrlap 3 másodperc múlva jelenik meg..._';
        response.showOfflineForm = true;
      }
    }

    return response;
  } catch (error) {
    logger.error({
      err: error,
      service: 'chat',
      sessionId: session.id
    }, 'AI error');
    throw error;
  }
}

/**
 * Handle user message
 * Routes message to AI or admin based on session status
 */
async function handleUserMessage(sessionToken, messageContent) {
  const session = await ChatSession.findOne({
    where: { sessionToken },
    include: ['messages']
  });

  if (!session) {
    throw new Error(ERROR_SESSION_NOT_FOUND);
  }

  // Save user message
  const userMessage = await ChatMessage.create({
    sessionId: session.id,
    role: 'user',
    content: messageContent
  });

  // Handle based on session status
  let response;
  if (session.status === 'offline') {
    response = handleOfflineSessionResponse();
  } else if (session.status === 'escalated') {
    response = handleEscalatedSessionResponse(session);
  } else {
    response = await handleAIResponse(session, messageContent);
  }

  // Save AI/system response (only if there is a response)
  let aiMessage = null;
  if (response) {
    aiMessage = await ChatMessage.create({
      sessionId: session.id,
      role: response.role,
      content: response.content,
      metadata: response.metadata || null
    });

    // Preserve showOfflineForm flag from response
    if (response.showOfflineForm) {
      aiMessage.showOfflineForm = true;
    }
  }

  return {
    userMessage,
    aiMessage,
    session
  };
}

/**
 * Build enhanced system prompt with performer context (RAG)
 */
async function buildEnhancedSystemPrompt(userMessage, sessionId) {
  const systemPrompt = await buildSystemPrompt();

  // Check if user message contains performer name - RAG approach
  const { searchPerformerByName } = require('./chatKnowledgeBase');
  const performerContext = await searchPerformerByName(userMessage);

  // If performer found, add context to system prompt
  if (performerContext) {
    logger.info({
      service: 'chat',
      sessionId,
      hasPerformerContext: true,
      performerContextLength: performerContext.length
    }, 'RAG: Added performer context to system prompt');
    return `${systemPrompt}\n\n${performerContext}`;
  }

  logger.info({
    service: 'chat',
    sessionId,
    hasPerformerContext: false,
    userMessageSample: userMessage.substring(0, 50)
  }, 'RAG: No performer context found');

  return systemPrompt;
}

/**
 * Build conversation history for AI
 */
async function buildConversationHistory(session, userMessage, systemPrompt) {
  const messages = await ChatMessage.findAll({
    where: { sessionId: session.id },
    order: [['createdAt', 'ASC']],
    limit: 20 // Keep last 20 messages for context
  });

  const conversationHistory = messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));

  // Add system prompt
  conversationHistory.unshift({
    role: 'system',
    content: systemPrompt
  });

  // Add current user message
  conversationHistory.push({
    role: 'user',
    content: userMessage
  });

  return conversationHistory;
}

/**
 * Get AI response using OpenAI
 */
async function getAIResponse(session, userMessage) {
  if (!OpenAI) {
    throw new Error('OpenAI not available');
  }

  // Check AI health
  const aiHealthy = await checkAIHealth();
  if (!aiHealthy) {
    throw new Error('AI service unavailable');
  }

  // Get OpenAI API key from settings
  const apiKey = await settingsService.get('chat.openai_api_key');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  // Build enhanced system prompt (with RAG if needed)
  const enhancedSystemPrompt = await buildEnhancedSystemPrompt(userMessage, session.id);

  // Build conversation history
  const conversationHistory = await buildConversationHistory(session, userMessage, enhancedSystemPrompt);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: conversationHistory,
      temperature: 0.7,
      // eslint-disable-next-line camelcase -- OpenAI API parameter
      max_tokens: 500
    });

    const responseContent = completion.choices[0].message.content;

    return {
      role: 'assistant',
      content: responseContent,
      metadata: {
        model: completion.model,
        tokens: completion.usage.total_tokens,
        // eslint-disable-next-line camelcase -- OpenAI API response field
        finish_reason: completion.choices[0].finish_reason
      }
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'chat',
      sessionId: session.id,
      messageLength: userMessage?.length
    }, 'OpenAI API error');
    throw error;
  }
}

/**
 * Build system prompt for AI
 */
async function buildSystemPrompt() {
  const { formatBehaviorRulesForAI } = require('./chatBehaviorRules');
  const { AIBehaviorSetting } = require('../models');

  const knowledgeBase = await getKnowledgeBase();
  const behaviorRules = await formatBehaviorRulesForAI();
  const companyName = await settingsService.get('general.site_name');

  // Load system prompt settings from database
  const systemPromptSettings = await AIBehaviorSetting.getAllByCategory();
  const promptConfig = systemPromptSettings.systemPrompt || [];

  const getSetting = (key, fallback = '') => {
    const setting = promptConfig.find((s) => s.settingKey === key);
    return setting ? setting.getParsedValue() : fallback;
  };

  // Get settings with fallbacks
  const introText = getSetting('introText',
    'Te egy segítőkész ügyfélszolgálati asszisztens vagy a {{companyName}} oldalon. '
    + 'A {{companyName}} egy zenei fellépők és előadók közvetítő oldala.'
  ).replace(/\{\{companyName\}\}/g, companyName);

  const brevityWarning = getSetting('brevityWarning',
    '⚠️ FONTOS: RÖVID, LÉNYEGRETÖRŐ válaszok! Max 3-4 mondat!');

  const reminders = getSetting('reminders', [
    'Ha nem tudod a választ, mondd meg őszintén',
    'Összetett foglalási kéréseket eszkaláld',
    'Ne találj ki információkat',
    'Árak változhatnak, mindig jelezd ezt',
    'Tartsd be a fenti viselkedési szabályokat!',
    'LEGYÉL RÖVID! Ne írd túl a választ!'
  ]);

  const remindersList = Array.isArray(reminders)
    ? reminders.map((r) => `- ${r}`).join('\n')
    : reminders;

  const knowledgeBaseSectionTitle = getSetting('knowledgeBaseSectionTitle',
    'TUDÁSBÁZIS (Publikus információk):');
  const remindersSectionTitle = getSetting('remindersSectionTitle',
    'FONTOS EMLÉKEZTETŐK:');

  return `${introText}

${brevityWarning}

${behaviorRules}

${knowledgeBaseSectionTitle}
════════════════════════════════════════
${knowledgeBase}

${remindersSectionTitle}
${remindersList}`;
}

/**
 * Get knowledge base for AI context
 * Uses enhanced knowledge base with industry-specific information
 * For full knowledge base content, see: services/chatKnowledgeBase.js
 */
async function getKnowledgeBase() {
  const { getEnhancedKnowledgeBase } = require('./chatKnowledgeBase');
  return await getEnhancedKnowledgeBase();
}

/**
 * Escalate session to sales
 * @throws {Error} 'NO_ADMIN_AVAILABLE' if no sales person is online
 */
async function escalateToSales(sessionId, reason) {
  const session = await ChatSession.findByPk(sessionId);
  if (!session) {
    throw new Error(ERROR_SESSION_NOT_FOUND);
  }

  // Get available admin
  const availableAdmins = await BookingAvailability.getAvailableAdmins();
  if (availableAdmins.length === 0) {
    const error = new Error('NO_ADMIN_AVAILABLE');
    error.code = 'NO_ADMIN_AVAILABLE';
    throw error;
  }

  // Assign to first available admin (can be improved with load balancing)
  const assignedAdmin = availableAdmins[0];

  await session.escalateToSales(assignedAdmin.adminId, reason);

  // Get system message template from DB
  const { AIBehaviorSetting } = require('../models');
  const escalationSettings = await AIBehaviorSetting.getAllByCategory();
  const escalationConfig = escalationSettings.escalation || [];

  const systemMessageSetting = escalationConfig.find((s) => s.settingKey === 'systemMessageTemplate');
  const systemMessageTemplate = systemMessageSetting
    ? systemMessageSetting.getParsedValue()
    : 'Beszélgetés átadva: {{adminName}} munkatársunknak';

  const systemMessage = systemMessageTemplate.replace(/\{\{adminName\}\}/g, assignedAdmin.admin.name);

  // System message
  await ChatMessage.create({
    sessionId,
    role: 'system',
    content: systemMessage
  });

  return session;
}

/**
 * Handle admin message
 */
async function handleAdminMessage(sessionId, adminId, messageContent) {
  const session = await ChatSession.findByPk(sessionId);
  if (!session) {
    throw new Error(ERROR_SESSION_NOT_FOUND);
  }

  // Save admin message
  const adminMessage = await ChatMessage.create({
    sessionId,
    role: 'admin',
    content: messageContent,
    adminId
  });

  // Update session
  if (session.status !== 'escalated') {
    session.status = 'escalated';
    session.assignedSalesId = adminId;
    await session.save();
  }

  return adminMessage;
}

/**
 * Submit offline message
 */
async function submitOfflineMessage(messageData) {
  const { sessionId, name, email, phone, message } = messageData;

  // Create offline message
  const offlineMsg = await OfflineMessage.create({
    sessionId: sessionId || null,
    name,
    email,
    phone,
    message,
    status: 'pending'
  });

  // Send email notification to booking admin
  try {
    await sendOfflineEmail(offlineMsg);
    await offlineMsg.markEmailSent();
  } catch (error) {
    logger.error({
      err: error,
      service: 'chat',
      offlineMessageId: offlineMsg.id,
      email: offlineMsg.email
    }, 'Failed to send offline message email');
  }

  return offlineMsg;
}

module.exports = {
  initializeChat,
  handleUserMessage,
  handleAdminMessage,
  escalateToSales,
  submitOfflineMessage,
  sendOfflineMessageEmail: sendOfflineEmail,
  closeSession: closeSessionHelper,
  getSession: getSessionHelper,
  getAdminSessions: getAdminSessionsHelper,
  checkAIHealth,
  getAIResponse
};
