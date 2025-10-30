/**
 * Exit Popup Settings Keys Migration
 *
 * Átnevezi az exitPopup.* kulcsokat exit_popup.* formátumra
 * a naming convention konzisztencia érdekében.
 *
 * INDOK: snake_case kategóriák (general, company, exit_popup)
 *
 * Használat:
 *   node scripts/migrate-exit-popup-keys.js           - Dry run (csak listázás)
 *   node scripts/migrate-exit-popup-keys.js --execute - Végrehajtás
 */

// .env betöltése
require('dotenv').config();

const { Setting } = require('../models');

// Constants
const SEPARATOR_LINE = '═══════════════════════════════════════════════════';

// Kulcs párok amikre szükség van migrálásra

// Exit popup kulcsok mapping
const KEY_MAPPINGS = [
  { old: 'exitPopup.enabled', new: 'exit_popup.enabled' },
  { old: 'exitPopup.title', new: 'exit_popup.title' },
  { old: 'exitPopup.message', new: 'exit_popup.message' },
  { old: 'exitPopup.ctaText', new: 'exit_popup.cta_text' },
  { old: 'exitPopup.ctaLink', new: 'exit_popup.cta_link' },
  { old: 'exitPopup.triggerExitIntent', new: 'exit_popup.trigger_exit_intent' },
  { old: 'exitPopup.triggerMobileExit', new: 'exit_popup.trigger_mobile_exit' },
  { old: 'exitPopup.triggerTimed', new: 'exit_popup.trigger_timed' },
  { old: 'exitPopup.delay', new: 'exit_popup.delay' },
  { old: 'exitPopup.excludedPaths', new: 'exit_popup.excluded_paths' }
];

async function checkKeys() {
  console.log('🔍 Exit popup kulcsok ellenőrzése...\n');

  const found = [];
  const missing = [];

  for (const mapping of KEY_MAPPINGS) {
    const oldKey = await Setting.findOne({ where: { key: mapping.old } });
    const newKey = await Setting.findOne({ where: { key: mapping.new } });

    if (oldKey) {
      found.push({
        old: mapping.old,
        new: mapping.new,
        value: oldKey.value,
        hasNew: Boolean(newKey)
      });
    } else {
      missing.push(mapping.old);
    }
  }

  console.log('📊 TALÁLT RÉGI KULCSOK:\n');
  if (found.length > 0) {
    found.forEach((item) => {
      console.log(`  ✓ ${item.old}`);
      console.log(`    → ${item.new}`);
      console.log(`    Érték: ${item.value ? item.value.substring(0, 50) : '(üres)'}`);
      if (item.hasNew) {
        console.log('    ⚠️  ÚJ KULCS MÁR LÉTEZIK - Felülírja');
      }
      console.log('');
    });
  } else {
    console.log('  Nincs régi kulcs (már migrálva vagy nincs beállítva)\n');
  }

  console.log(`Összesen: ${found.length}\n`);

  if (missing.length > 0) {
    console.log('⚠️  HIÁNYZÓ KULCSOK:\n');
    missing.forEach((key) => {
      console.log(`  - ${key}`);
    });
    console.log(`\nÖsszesen: ${missing.length}\n`);
  }

  return found;
}

async function migrateSingleKey(item, stats) {
  try {
    const oldSetting = await Setting.findOne({ where: { key: item.old } });

    if (!oldSetting) {
      console.log(`  ⚠️  ${item.old} - Nem található (átugorva)`);
      stats.failed += 1;
      return;
    }

    const existingNew = await Setting.findOne({ where: { key: item.new } });

    if (existingNew) {
      console.log(`  ⚠️  ${item.new} - Már létezik`);
      console.log(`     Régi érték: ${existingNew.value}`);
      console.log(`     Új érték: ${oldSetting.value}`);

      await existingNew.update({ value: oldSetting.value });
      console.log('     ✓ Frissítve');

      await oldSetting.destroy();
      console.log(`     ✓ Régi kulcs törölve: ${item.old}`);
    } else {
      await oldSetting.update({ key: item.new });
      console.log(`  ✓ ${item.old} → ${item.new}`);
    }

    stats.migrated += 1;
  } catch (error) {
    console.error(`  ✗ ${item.old} - Hiba:`, error.message);
    stats.failed += 1;
  }
}

async function migrateKeys(found) {
  console.log('\n🔧 Kulcsok átnevezése...\n');

  const stats = { migrated: 0, failed: 0 };

  for (const item of found) {
    await migrateSingleKey(item, stats);
  }

  console.log('\n📊 Eredmény:');
  console.log(`  Átnevezve: ${stats.migrated}`);
  console.log(`  Sikertelen: ${stats.failed}`);
  console.log(`  Összesen: ${found.length}\n`);
}

function displayHeader(shouldExecute) {
  console.log(SEPARATOR_LINE);
  console.log('  Exit Popup Keys Migration');
  console.log('  exitPopup.* → exit_popup.*');
  console.log(`${SEPARATOR_LINE}\n`);

  if (shouldExecute) {
    console.log('⚙️  Mód: VÉGREHAJTÁS (--execute)\n');
  } else {
    console.log('ℹ️  Mód: DRY RUN (használd --execute a végrehajtáshoz)\n');
  }
}

function displayNoMigrationNeeded() {
  console.log('✅ Nincs migrálható kulcs.\n');
  console.log(SEPARATOR_LINE);
  console.log('✅ Migráció befejezve (nincs teendő)');
  console.log(`${SEPARATOR_LINE}\n`);
}

function displayDryRunTip() {
  console.log('💡 TIP: Használd a --execute paramétert a migráció végrehajtásához:');
  console.log('   node scripts/migrate-exit-popup-keys.js --execute\n');
}

function displayFooter() {
  console.log(SEPARATOR_LINE);
  console.log('✅ Migráció befejezve');
  console.log(`${SEPARATOR_LINE}\n`);
}

async function main() {
  const shouldExecute = process.argv.includes('--execute');

  displayHeader(shouldExecute);

  try {
    const found = await checkKeys();

    if (found.length === 0) {
      displayNoMigrationNeeded();
      process.exit(0);
    }

    if (shouldExecute) {
      console.log('─────────────────────────────────────────────────\n');
      await migrateKeys(found);
    } else {
      displayDryRunTip();
    }

    displayFooter();
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

module.exports = { checkKeys, migrateKeys, KEY_MAPPINGS };
