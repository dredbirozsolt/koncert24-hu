#!/usr/bin/env node

/**
 * Check and Fix Setting Keys
 *
 * This script checks the database for settings with underscores that should have dots,
 * and optionally fixes them.
 */

const { Setting } = require('../models');
const { sequelize } = require('../config/database');

// Keys that should have dots but might have underscores due to mongoSanitize
const EXPECTED_KEYS = [
  // General settings
  'general.domain',
  'general.site_name',

  // Company settings
  'company.name',
  'company.phone',
  'company.email',
  'company.logo',

  // Email settings
  'email.method',
  'email.host',
  'email.port',
  'email.secure',
  'email.user',
  'email.password',
  'email.from',
  'email.admin',
  'email.booking',

  // VTiger settings
  'vtiger.url',
  'vtiger.username',
  'vtiger.access_key',

  // GeoNames settings
  'geonames.username',

  // Exit Popup settings
  'exit_popup.enabled',
  'exit_popup.title',
  'exit_popup.message',
  'exit_popup.cta_text',
  'exit_popup.cta_link',
  'exit_popup.trigger_exit_intent',
  'exit_popup.trigger_mobile_exit',
  'exit_popup.trigger_timed',
  'exit_popup.delay',
  'exit_popup.excluded_paths',

  // SEO settings
  'seo.sitemap.enabled',
  'seo.sitemap.auto_generate',
  'seo.sitemap.ping_enabled',
  'seo.robots_txt_enabled',
  'seo.google_analytics_id',
  'seo.google_search_console',
  'seo.google_tag_manager_id',

  // Backup settings
  'backup.retention.max_count',
  'backup.retention.max_age_days'
];

function identifyProblematicKeys(allSettings) {
  const problematicKeys = [];
  const correctKeys = [];

  for (const setting of allSettings) {
    const { key } = setting;

    if (key.includes('_')) {
      const expectedKey = key.replace(/_/, '.');

      if (EXPECTED_KEYS.includes(expectedKey)) {
        problematicKeys.push({
          id: setting.id,
          currentKey: key,
          expectedKey,
          value: setting.value
        });
      }
    } else if (key.includes('.')) {
      correctKeys.push(key);
    }
  }

  return { problematicKeys, correctKeys };
}

function displayResults(problematicKeys, correctKeys) {
  console.log('✅ Correct keys (with dots):');
  correctKeys.forEach((key) => console.log(`   - ${key}`));
  console.log('');

  if (problematicKeys.length === 0) {
    console.log('✨ No problematic keys found! All keys are correct.\n');
  } else {
    console.log('⚠️  Problematic keys (with underscores):');
    problematicKeys.forEach((item) => {
      console.log(`   ❌ ${item.currentKey} → should be → ${item.expectedKey}`);
    });
    console.log('');
  }
}

async function checkKeys() {
  console.log('🔍 Checking settings keys in database...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    const allSettings = await Setting.findAll({
      attributes: ['id', 'key', 'value'],
      raw: true
    });

    console.log(`📊 Total settings in database: ${allSettings.length}\n`);

    const { problematicKeys, correctKeys } = identifyProblematicKeys(allSettings);
    displayResults(problematicKeys, correctKeys);

    return { problematicKeys, correctKeys };
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function fixKeys(problematicKeys) {
  console.log('\n🔧 Fixing problematic keys...\n');

  let fixed = 0;
  let failed = 0;

  for (const item of problematicKeys) {
    try {
      // Check if the correct key already exists
      const existingSetting = await Setting.findOne({
        where: { key: item.expectedKey }
      });

      if (existingSetting) {
        console.log(`   ⚠️  Skipping ${item.currentKey} - ${item.expectedKey} already exists`);

        // Delete the old key with underscore
        await Setting.destroy({ where: { key: item.currentKey } });
        console.log(`   🗑️  Deleted old key: ${item.currentKey}`);
      } else {
        // Update the key
        await Setting.update(
          { key: item.expectedKey },
          { where: { key: item.currentKey } }
        );
        console.log(`   ✅ Fixed: ${item.currentKey} → ${item.expectedKey}`);
        fixed += 1;
      }
    } catch (error) {
      console.error(`   ❌ Failed to fix ${item.currentKey}:`, error.message);
      failed += 1;
    }
  }

  console.log(`\n📊 Results: ${fixed} fixed, ${failed} failed\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');

  console.log('========================================');
  console.log('  Settings Keys Check & Fix Tool');
  console.log('========================================\n');

  try {
    const { problematicKeys } = await checkKeys();

    if (shouldFix && problematicKeys.length > 0) {
      await fixKeys(problematicKeys);
      console.log('✅ Done! Keys have been fixed.\n');
    } else if (problematicKeys.length > 0) {
      console.log('💡 To fix these keys, run: node scripts/check-and-fix-setting-keys.js --fix\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { checkKeys, fixKeys };
