/**
 * Script: Új dinamikus beállítások hozzáadása
 * - Company address részletes mezők (Schema.org SEO)
 * - SEO default keywords
 * - Általános locale és timezone beállítások
 */

const { Setting } = require('../models');

/**
 * Returns array of new settings to add
 */
function getNewSettings() {
  return [
    // Company address részletek (SEO/Schema.org)
    {
      key: 'company.address_street',
      value: '',
      type: 'string',
      category: 'general',
      description: 'Utca, házszám (Schema.org strukturált adat)'
    },
    {
      key: 'company.address_city',
      value: '',
      type: 'string',
      category: 'general',
      description: 'Város (Schema.org strukturált adat)'
    },
    {
      key: 'company.address_zip',
      value: '',
      type: 'string',
      category: 'general',
      description: 'Irányítószám (Schema.org strukturált adat)'
    },
    {
      key: 'company.address_country',
      value: 'Magyarország',
      type: 'string',
      category: 'general',
      description: 'Ország (Schema.org strukturált adat)'
    },

    // SEO beállítások
    {
      key: 'seo.default_keywords',
      value: 'koncert, rendezvény, előadó, fellépő, zenész, esküvő, céges rendezvény',
      type: 'string',
      category: 'seo',
      description: 'Alapértelmezett SEO kulcsszavak (vesszővel elválasztva)'
    },

    // Általános nyelvi és időzóna beállítások
    {
      key: 'general.locale',
      value: 'hu_HU',
      type: 'string',
      category: 'general',
      description: 'Nyelvi beállítás (locale kód, pl. hu_HU, en_US)'
    },
    {
      key: 'general.timezone',
      value: 'Europe/Budapest',
      type: 'string',
      category: 'general',
      description: 'Időzóna beállítás (pl. Europe/Budapest)'
    }
  ];
}

/**
 * Processes a single setting (create or skip if exists)
 */
async function processSetting(setting, stats) {
  try {
    const existing = await Setting.findOne({
      where: { key: setting.key }
    });

    if (existing) {
      console.log(`⏭️  Már létezik: ${setting.key}`);
      stats.skipped += 1;
    } else {
      await Setting.create(setting);
      console.log(`✅ Létrehozva: ${setting.key}`);
      stats.created += 1;
    }
  } catch (error) {
    console.error(`❌ Hiba a(z) ${setting.key} létrehozásakor:`, error.message);
  }
}

async function addDynamicSettings() {
  try {
    console.log('🔧 Új dinamikus beállítások hozzáadása...\n');

    const newSettings = getNewSettings();
    const stats = { created: 0, skipped: 0 };

    for (const setting of newSettings) {
      await processSetting(setting, stats);
    }

    console.log('\n✅ Script befejezve!');
    console.log(`   📝 ${stats.created} új beállítás létrehozva`);
    console.log(`   ⏭️  ${stats.skipped} beállítás már létezett\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Hiba történt:', error);
    process.exit(1);
  }
}

// Futtatás
addDynamicSettings();
