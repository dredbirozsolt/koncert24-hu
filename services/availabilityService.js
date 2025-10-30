/**
 * Availability Service
 * Manages booking admin availability and system status
 */

const logger = require('../config/logger');
const { BookingAvailability, SystemStatus, User } = require('../models');
const settingsService = require('./settingsService');

/**
 * Internal helper: Ensure availability record exists and update heartbeat
 */
async function ensureAvailabilityAndUpdateHeartbeat(adminId) {
  let availability = await BookingAvailability.findOne({
    where: { adminId }
  });

  if (availability) {
    await availability.updateHeartbeat();
  } else {
    // Create new availability record
    availability = await BookingAvailability.create({
      adminId,
      isOnline: true,
      lastHeartbeat: new Date(),
      autoAwayMinutes: 15
    });
  }

  return availability;
}

/**
 * Update admin heartbeat (called by Chrome extension)
 */
function updateAdminHeartbeat(adminId) {
  return ensureAvailabilityAndUpdateHeartbeat(adminId);
}

/**
 * Set admin online manually
 */
function setAdminOnline(adminId) {
  return ensureAvailabilityAndUpdateHeartbeat(adminId);
}

/**
 * Set admin offline manually
 */
async function setAdminOffline(adminId) {
  const availability = await BookingAvailability.findOne({
    where: { adminId }
  });

  if (availability) {
    await availability.setOffline();
  }

  return availability;
}

/**
 * Update heartbeat (alias for updateAdminHeartbeat)
 */
async function updateHeartbeat(adminId) {
  return await updateAdminHeartbeat(adminId);
}

/**
 * Get online admins
 */
async function getOnlineAdmins() {
  return await BookingAvailability.getOnlineAdmins();
}

/**
 * Get available admins (online)
 */
async function getAvailableAdmins() {
  return await BookingAvailability.getAvailableAdmins();
}

/**
 * Update auto away minutes
 */
async function updateAutoAwayMinutes(adminId, minutes) {
  const availability = await BookingAvailability.findOne({
    where: { adminId }
  });

  if (!availability) {
    throw new Error('Admin availability not found');
  }

  availability.autoAwayMinutes = minutes;
  await availability.save();

  return availability;
}

/**
 * Cleanup stale admin heartbeats (CRON job)
 */
async function cleanupStaleAdmins() {
  const cleanedCount = await BookingAvailability.cleanupStaleAdmins();
  logger.info({ service: 'availability', cleanedCount }, 'Cleaned up stale admin(s)');
  return cleanedCount;
}

/**
 * Check admin status
 */
async function checkAdminStatus() {
  const availableAdmins = await getAvailableAdmins();
  const adminChatEnabled = await settingsService.get('chat.admin_chat_enabled', true);

  const isAvailable = adminChatEnabled && availableAdmins.length > 0;

  const status = await SystemStatus.checkAdminChatStatus();
  await status.updateStatus(
    isAvailable,
    isAvailable ? null : 'No admins available or service disabled'
  );

  return {
    available: isAvailable,
    adminCount: availableAdmins.length,
    admins: availableAdmins.map((a) => ({
      id: a.adminId,
      name: a.admin.name,
      email: a.admin.email,
      isOnline: a.isOnline,
      lastHeartbeat: a.lastHeartbeat
    }))
  };
}

/**
 * Check AI status
 */
async function checkAIStatus() {
  const aiEnabled = await settingsService.get('chat.ai_enabled', true);
  const apiKey = await settingsService.get('chat.openai_api_key');

  const isAvailable = aiEnabled && Boolean(apiKey);

  const status = await SystemStatus.checkAIStatus();
  await status.updateStatus(
    isAvailable,
    isAvailable ? null : 'AI disabled or API key not configured'
  );

  return {
    available: isAvailable,
    reason: isAvailable ? null : 'AI disabled or API key missing'
  };
}

/**
 * Check overall system status
 */
async function checkSystemStatus() {
  const [aiStatus, adminStatus] = await Promise.all([
    checkAIStatus(),
    checkAdminStatus()
  ]);

  const overallStatus = await SystemStatus.getOverallStatus();

  return {
    ai: aiStatus,
    adminChat: adminStatus,
    system: overallStatus.system,
    mode: determineOverallMode(aiStatus.available, adminStatus.available)
  };
}

/**
 * Determine overall system mode
 */
function determineOverallMode(aiAvailable, adminAvailable) {
  if (aiAvailable && adminAvailable) {
    return 'full_service'; // AI + Admin backup
  }

  if (!aiAvailable && adminAvailable) {
    return 'admin_only'; // Only admin available
  }

  if (aiAvailable && !adminAvailable) {
    return 'ai_only'; // Only AI available
  }

  return 'offline_mode'; // Nothing available
}

/**
 * Toggle AI service
 */
async function toggleAI(enabled) {
  await settingsService.set('chat.ai_enabled', enabled);
  await SystemStatus.toggleAI(enabled);

  logger.info({ service: 'availability', feature: 'ai', enabled }, 'AI service toggled');

  return { enabled };
}

/**
 * Toggle admin chat service
 */
async function toggleAdminChat(enabled) {
  await settingsService.set('chat.admin_chat_enabled', enabled);
  await SystemStatus.toggleAdminChat(enabled);

  logger.info({ service: 'availability', feature: 'adminChat', enabled }, 'Admin chat service toggled');

  return { enabled };
}

/**
 * Get admin availability info
 */
async function getAdminAvailability(adminId) {
  const availability = await BookingAvailability.findOne({
    where: { adminId },
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'name', 'email']
      }
    ]
  });

  if (!availability) {
    return null;
  }

  return {
    adminId: availability.adminId,
    adminName: availability.admin.name,
    isOnline: availability.isOnline,
    lastHeartbeat: availability.lastHeartbeat,
    autoAwayMinutes: availability.autoAwayMinutes
  };
}

/**
 * Get all admin availability statuses
 */
async function getAllAdminAvailability() {
  const availabilities = await BookingAvailability.findAll({
    include: [
      {
        model: User,
        as: 'admin',
        attributes: ['id', 'name', 'email']
      }
    ],
    order: [['is_online', 'DESC'], ['last_heartbeat', 'DESC']]
  });

  return availabilities.map((a) => ({
    adminId: a.admin_id,
    adminName: a.admin.name,
    adminEmail: a.admin.email,
    isOnline: a.is_online,
    lastHeartbeat: a.last_heartbeat,
    autoAwayMinutes: a.auto_away_minutes
  }));
}

module.exports = {
  updateAdminHeartbeat,
  updateHeartbeat,
  setAdminOnline,
  setAdminOffline,
  getOnlineAdmins,
  getAvailableAdmins,
  updateAutoAwayMinutes,
  cleanupStaleAdmins,
  checkAdminStatus,
  checkAIStatus,
  checkSystemStatus,
  toggleAI,
  toggleAdminChat,
  getAdminAvailability,
  getAllAdminAvailability,
  determineOverallMode
};
