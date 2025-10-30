/**
 * Settings Key Verification Script
 *
 * Ellenőrzi az adatbázisban lévő settings kulcsokat és
 * megkeresi azokat, amelyek aláhúzást tartalmaznak pontok helyett.
 *
 * Használat:
 *   node scripts/verify-settings-keys.js           - Ellenőrzés
 *   node scripts/verify-settings-keys.js --fix     - Javítás
 */

// .env betöltése
require('dotenv').config();

const { Setting } = require('../models');
const { normalizeKey } = require('../utils/sanitizeHelper');

// Constants
const SEPARATOR_LINE = '═══════════════════════════════════════════════════';
const DASH_LINE = '─────────────────────────────────────────────────';

// Várt kulcsok (ponttal)
const EXPECTED_KEYS = [
  // General
  'general.domain',
  'general.site_name',

  // Company
  'company.name',
  'company.phone',
  'company.email',
  'company.logo',

  // Email
  'email.method',
  'email.host',
  'email.port',
  'email.secure',
  'email.user',
  'email.password',
  'email.from',
  'email.admin',
  'email.booking',

  // VTiger
  'vtiger.url',
  'vtiger.username',
  'vtiger.access_key',

  // GeoNames
  'geonames.username',

  // Exit Popup
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

  // SEO
  'seo.sitemap.enabled',
  'seo.sitemap.auto_generate',
  'seo.sitemap.ping_enabled',
  'seo.robots_txt_enabled',
  'seo.google_analytics_id',
  'seo.google_search_console',
  'seo.google_tag_manager_id',

  // Backup
  'backup.retention.max_count',
  'backup.retention.max_age_days'
];

// Helper: Categorize settings into correct, problematic, unexpected
function categorizeSettings(allSettings) {
  const correctKeys = [];
  const problematicKeys = [];
  const unexpectedKeys = [];

  for (const setting of allSettings) {
    const { key } = setting;

    if (EXPECTED_KEYS.includes(key)) {
      correctKeys.push({ key, value: setting.value });
      continue; // eslint-disable-line no-continue
    }

    if (key.includes('_') && !key.startsWith('_') && !key.endsWith('_id')) {
      const normalizedKey = normalizeKey(key);

      if (EXPECTED_KEYS.includes(normalizedKey)) {
        problematicKeys.push({
          current: key,
          expected: normalizedKey,
          value: setting.value
        });
      } else {
        unexpectedKeys.push({ key, value: setting.value });
      }
    }
  }

  return { correctKeys, problematicKeys, unexpectedKeys };
}

// Helper: Display categorized results
function displayResults(correctKeys, problematicKeys, unexpectedKeys) {
  console.log('✅ HELYES KULCSOK:');
  console.log(`${DASH_LINE}\n`);
  if (correctKeys.length > 0) {
    correctKeys.forEach((item) => {
      console.log(`  ✓ ${item.key}`);
      const displayValue = item.value ? `${item.value.substring(0, 50)}...` : '(üres)';
      console.log(`    Érték: ${displayValue}`);
      console.log('');
    });
  } else {
    console.log('  Nincs helyes kulcs (ez gyanús!)');
  }
  console.log(`Összesen: ${correctKeys.length}\n`);

  console.log('❌ JAVÍTANDÓ KULCSOK:');
  console.log(`${DASH_LINE}\n`);
  if (problematicKeys.length > 0) {
    problematicKeys.forEach((item) => {
      console.log(`  ✗ ${item.key}`);
      const displayValue = item.value ? `${item.value.substring(0, 50)}...` : '(üres)';
      console.log(`    Érték: ${displayValue}`);
      console.log('    Várható: ponttal elválasztva (pl. company.name)');
      console.log('');
    });
  } else {
    console.log('  ✅ Nincs javítandó kulcs!');
  }
  console.log(`Összesen: ${problematicKeys.length}\n`);

  console.log('⚠️  NEM VÁRT KULCSOK (aláhúzással):');
  console.log(`${DASH_LINE}\n`);
  if (unexpectedKeys.length > 0) {
    unexpectedKeys.forEach((item) => {
      console.log(`  ? ${item.key}`);
      const displayValue = item.value ? `${item.value.substring(0, 50)}...` : '(üres)';
      console.log(`    Érték: ${displayValue}`);
      console.log('');
    });
  } else {
    console.log('  Nincs nem várt kulcs');
  }
  console.log(`Összesen: ${unexpectedKeys.length}\n`);
}

// Helper: Find missing keys
function findMissingKeys(correctKeys, problematicKeys) {
  const existingKeys = [
    ...correctKeys.map((k) => k.key),
    ...problematicKeys.map((k) => k.expected)
  ];
  return EXPECTED_KEYS.filter((k) => !existingKeys.includes(k));
}


async function verifyKeys() {
  console.log('🔍 Settings kulcsok ellenőrzése...\n');

  try {
    // Összes setting lekérése
    const allSettings = await Setting.findAll();
    console.log(`📊 Összes setting: ${allSettings.length}\n`);

    // Problémás kulcsok keresése
    const { correctKeys, problematicKeys, unexpectedKeys } = categorizeSettings(allSettings);

    // Eredmények kiírása
    displayResults(correctKeys, problematicKeys, unexpectedKeys);

    // Hiányzó kulcsok keresése
    const missingKeys = findMissingKeys(correctKeys, problematicKeys);

    console.log('❓ HIÁNYZÓ KULCSOK:');
    console.log(`${DASH_LINE}\n`);
    if (missingKeys.length > 0) {
      missingKeys.forEach((key) => {
        console.log(`  - ${key}`);
      });
    } else {
      console.log('  ✅ Minden várt kulcs megtalálható!');
    }
    console.log(`Összesen: ${missingKeys.length}\n`);

    return problematicKeys;
  } catch (error) {
    console.error('❌ Hiba az ellenőrzés során:', error.message);
    throw error;
  }
}

async function processSingleKey(item, stats) {
  try {
    const oldSetting = await Setting.findOne({ where: { key: item.current } });

    if (!oldSetting) {
      console.log(`  ⚠️  ${item.current} - Nem található (átugorva)`);
      stats.failed += 1;
      return;
    }

    const existingNew = await Setting.findOne({ where: { key: item.expected } });

    if (existingNew) {
      console.log(`  ⚠️  ${item.expected} - Már létezik (régi törlése)`);
      await oldSetting.destroy();
      console.log(`     ✓ ${item.current} törölve`);
    } else {
      oldSetting.key = item.expected;
      await oldSetting.save();
      console.log(`  ✓ ${item.current} → ${item.expected}`);
    }

    stats.fixed += 1;
  } catch (error) {
    console.error(`  ✗ ${item.current} - Hiba:`, error.message);
    stats.failed += 1;
  }
}

async function fixKeys(problematicKeys) {
  console.log('\n🔧 Kulcsok javítása...\n');

  const stats = { fixed: 0, failed: 0 };

  for (const item of problematicKeys) {
    await processSingleKey(item, stats);
  }

  console.log('\n📊 Eredmény:');
  console.log(`  Javítva: ${stats.fixed}`);
  console.log(`  Sikertelen: ${stats.failed}`);
  console.log(`  Összesen: ${problematicKeys.length}\n`);
}

async function main() {
  const shouldFix = process.argv.includes('--fix');

  console.log(SEPARATOR_LINE);
  console.log('  Settings Key Verification');
  console.log(`${SEPARATOR_LINE}\n`);

  if (shouldFix) {
    console.log('⚙️  Mód: JAVÍTÁS (--fix)\n');
  } else {
    console.log('ℹ️  Mód: ELLENŐRZÉS (használd --fix a javításhoz)\n');
  }

  try {
    const problematicKeys = await verifyKeys();

    if (shouldFix && problematicKeys.length > 0) {
      console.log(`\n${DASH_LINE}\n`);
      await fixKeys(problematicKeys);
    } else if (problematicKeys.length > 0) {
      console.log('\n💡 TIP: Használd a --fix paramétert a javításhoz:');
      console.log('   node scripts/verify-settings-keys.js --fix\n');
    }

    console.log(SEPARATOR_LINE);
    console.log('✅ Ellenőrzés befejezve');
    console.log(`${SEPARATOR_LINE}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Kritikus hiba:', error);
    process.exit(1);
  }
}

// Script futtatása
if (require.main === module) {
  main();
}

module.exports = { verifyKeys, fixKeys };
