#!/usr/bin/env node

/**
 * Get backup settings from database
 * Returns maxCount and maxAgeDays as JSON
 */

const { Setting } = require('../models');

async function getBackupSettings() {
  try {
    const maxCount = await Setting.get('backup.retention.max_count', 30);
    const maxAgeDays = await Setting.get('backup.retention.max_age_days', 30);

    console.log(JSON.stringify({
      maxCount,
      maxAgeDays
    }));

    process.exit(0);
  } catch (error) {
    console.error('Error getting backup settings:', error.message);
    // Return defaults on error
    console.log(JSON.stringify({
      maxCount: 30,
      maxAgeDays: 30
    }));
    process.exit(1);
  }
}

getBackupSettings();
