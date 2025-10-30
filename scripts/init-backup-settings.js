#!/usr/bin/env node

/**
 * Initialize backup settings in database
 */

const { Setting } = require('../models');

async function initBackupSettings() {
  try {
    console.log('Initializing backup settings...');

    await Setting.set('backup.retention.max_count', 30, 'number', 'backup', 'Maximum number of backups to keep');
    await Setting.set('backup.retention.max_age_days', 30, 'number', 'backup', 'Maximum age of backups in days');

    console.log('✅ Backup settings initialized successfully');

    // Ellenőrzés
    const maxCount = await Setting.get('backup.retention.max_count');
    const maxAgeDays = await Setting.get('backup.retention.max_age_days');

    console.log(`  - Max backup count: ${maxCount}`);
    console.log(`  - Max age (days): ${maxAgeDays}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing backup settings:', error.message);
    process.exit(1);
  }
}

initBackupSettings();
