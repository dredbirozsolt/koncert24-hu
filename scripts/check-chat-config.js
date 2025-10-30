#!/usr/bin/env node

/**
 * Chat Configuration Checker
 * Ellenőrzi a chat rendszer aktuális beállításait
 */

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Load models
const { Setting } = require('../models');
const availabilityService = require('../services/availabilityService');

// Constants
const SEPARATOR_LINE = '═'.repeat(60);
const DASH_LINE = '─'.repeat(60);
const NOT_SET = '(nincs beállítva)';
const CHAT_OPENAI_API_KEY = 'chat.openai_api_key';

// Helper: Display chat settings
async function displayChatSettings() {
  console.log('📊 CHAT BEÁLLÍTÁSOK:');
  console.log(DASH_LINE);

  const chatSettings = [
    'chat.ai_enabled',
    'chat.admin_chat_enabled',
    CHAT_OPENAI_API_KEY,
    'chat.auto_offline_minutes',
    'chat.working_hours_enabled',
    'chat.widget_position',
    'chat.welcome_message',
    'chat.offline_message'
  ];

  for (const key of chatSettings) {
    const setting = await Setting.findOne({ where: { key } });
    let value = setting ? setting.value : NOT_SET;

    // Mask API key
    if (key === CHAT_OPENAI_API_KEY && value && value !== NOT_SET) {
      value = `${value.substring(0, 10)}...${value.substring(value.length - 4)}`;
    }

    // Format boolean
    if (value === 'true') {value = '✅ true';}
    if (value === 'false') {value = '❌ false';}

    console.log(`  ${key.padEnd(35)} = ${value}`);
  }

  console.log('');
}

// Helper: Display system status
async function displaySystemStatus() {
  console.log('🔍 SYSTEM STATUS:');
  console.log(DASH_LINE);

  const systemStatus = await availabilityService.checkSystemStatus();

  console.log('  AI Service:');
  console.log(`    - Elérhető: ${systemStatus.ai.available ? '✅ Igen' : '❌ Nem'}`);
  if (systemStatus.ai.reason) {
    console.log(`    - Indok: ${systemStatus.ai.reason}`);
  }

  console.log('  Admin Chat Service:');
  console.log(`    - Elérhető: ${systemStatus.adminChat.available ? '✅ Igen' : '❌ Nem'}`);
  console.log(`    - Online adminok: ${systemStatus.adminChat.adminCount}`);

  if (systemStatus.adminChat.admins && systemStatus.adminChat.admins.length > 0) {
    console.log('    - Adminok:');
    systemStatus.adminChat.admins.forEach((admin) => {
      const status = admin.isOnline ? '🟢' : '🔴';
      console.log(`      ${status} ${admin.name} (${admin.email})`);
      console.log(`         Utolsó heartbeat: ${admin.lastHeartbeat}`);
    });
  }

  console.log(`  Teljes rendszer mód: ${getModeEmoji(systemStatus.mode)} ${systemStatus.mode}`);
  console.log('');

  return systemStatus;
}

// Helper: Display admin availability
async function displayAdminAvailability() {
  console.log('👥 ADMIN ELÉRHETŐSÉG:');
  console.log(DASH_LINE);

  const allAdmins = await availabilityService.getAllAdminAvailability();

  if (allAdmins.length === 0) {
    console.log('  ⚠️  Nincs regisztrált admin availability');
  } else {
    allAdmins.forEach((admin) => {
      const status = admin.isOnline ? '🟢 ONLINE' : '🔴 OFFLINE';
      console.log(`  ${status} ${admin.adminName} (${admin.adminEmail})`);
      console.log(`    - Admin ID: ${admin.adminId}`);
      console.log(`    - Utolsó heartbeat: ${admin.lastHeartbeat}`);
      console.log(`    - Munkaidő beállítva: ${admin.workingHours ? 'Igen' : 'Nem'}`);
      console.log(`    - Auto-offline: ${admin.autoAwayMinutes} perc`);
      console.log(`    - Munkaidőben: ${admin.isInWorkingHours ? 'Igen' : 'Nem'}`);
      console.log('');
    });
  }
}

// Helper: Display offline mode causes
function displayOfflineCauses(aiEnabled, adminChatEnabled, openaiApiKey, systemStatus) {
  console.log('  ⚠️  A chat OFFLINE módban működik!');
  console.log('');
  console.log('  Lehetséges okok:');

  if (!aiEnabled || aiEnabled.value !== 'true') {
    console.log('    ❌ AI nincs engedélyezve (chat.ai_enabled = false)');
  }

  if (!adminChatEnabled || adminChatEnabled.value !== 'true') {
    console.log('    ❌ Admin chat nincs engedélyezve (chat.admin_chat_enabled = false)');
  }

  if (!openaiApiKey || !openaiApiKey.value) {
    console.log('    ❌ OpenAI API kulcs nincs beállítva');
  }

  if (systemStatus.adminChat.adminCount === 0) {
    console.log('    ❌ Nincs elérhető admin (0 online admin)');
  }

  console.log('');
  console.log('  Megoldás:');
  console.log('    1. Látogass el: http://localhost:3000/admin/chat/settings');
  console.log('    2. Engedélyezd az AI-t vagy Admin chat-et');
  console.log('    3. Ha AI-t használsz: add meg az OpenAI API kulcsot');
  console.log('    4. Ha Admin chat-et használsz: lépj be admin dashboardra');
}

// Helper: Display other modes
function displayOtherModes(mode) {
  if (mode === 'ai_only') {
    console.log('  ✅ A chat AI-only módban működik');
    console.log('  ℹ️  Csak AI válaszol, adminok nem érhetők el');
  } else if (mode === 'admin_only') {
    console.log('  ✅ A chat admin-only módban működik');
    console.log('  ℹ️  Csak adminok válaszolnak, AI nincs elérhető');
  } else if (mode === 'full_service') {
    console.log('  ✅ A chat FULL SERVICE módban működik');
    console.log('  ℹ️  AI + admin backup is elérhető');
  }
}

// Helper: Display diagnosis
async function displayDiagnosis(systemStatus) {
  console.log('🔧 DIAGNÓZIS:');
  console.log(DASH_LINE);

  const aiEnabled = await Setting.findOne({ where: { key: 'chat.ai_enabled' } });
  const adminChatEnabled = await Setting.findOne({ where: { key: 'chat.admin_chat_enabled' } });
  const openaiApiKey = await Setting.findOne({ where: { key: CHAT_OPENAI_API_KEY } });

  if (systemStatus.mode === 'offline_mode') {
    displayOfflineCauses(aiEnabled, adminChatEnabled, openaiApiKey, systemStatus);
  } else {
    displayOtherModes(systemStatus.mode);
  }

  console.log('');
}

function getModeEmoji(mode) {
  /* eslint-disable camelcase */
  const emojis = {
    full_service: '✅',
    ai_only: '🤖',
    admin_only: '👤',
    offline_mode: '⚠️'
  };
  /* eslint-enable camelcase */
  return emojis[mode] || '❓';
}

function displayHeader() {
  console.log(SEPARATOR_LINE);
  console.log('  CHAT KONFIGURÁCIÓ ELLENŐRZÉS');
  console.log(SEPARATOR_LINE);
  console.log('');
}

function displayFooter() {
  console.log(SEPARATOR_LINE);
}

async function checkChatConfig() {
  try {
    displayHeader();

    await displayChatSettings();
    const systemStatus = await displaySystemStatus();
    await displayAdminAvailability();
    await displayDiagnosis(systemStatus);

    displayFooter();

    process.exit(0);
  } catch (error) {
    console.error('❌ HIBA:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
checkChatConfig();
