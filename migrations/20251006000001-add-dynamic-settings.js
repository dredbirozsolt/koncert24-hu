/**
 * Migráció: Új dinamikus beállítások hozzáadása
 * - Company address részletes mezők (Schema.org SEO)
 * - SEO default keywords
 * - Általános locale és timezone beállítások
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { Setting } = require('../models');

    console.log('🔧 Új dinamikus beállítások hozzáadása...');

    const newSettings = [
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

    for (const setting of newSettings) {
      try {
        const existing = await Setting.findOne({
          where: { key: setting.key }
        });

        if (!existing) {
          await Setting.create(setting);
          console.log(`✅ Létrehozva: ${setting.key}`);
        } else {
          console.log(`⏭️  Már létezik: ${setting.key}`);
        }
      } catch (error) {
        console.error(`❌ Hiba a(z) ${setting.key} létrehozásakor:`, error.message);
      }
    }

    console.log('✅ Migráció sikeresen befejezve!');
  },

  down: async (queryInterface, Sequelize) => {
    const { Setting } = require('../models');

    console.log('🔧 Dinamikus beállítások törlése...');

    const keysToRemove = [
      'company.address_street',
      'company.address_city',
      'company.address_zip',
      'company.address_country',
      'seo.default_keywords',
      'general.locale',
      'general.timezone'
    ];

    for (const key of keysToRemove) {
      try {
        await Setting.destroy({
          where: { key }
        });
        console.log(`✅ Törölve: ${key}`);
      } catch (error) {
        console.error(`❌ Hiba a(z) ${key} törlésekor:`, error.message);
      }
    }

    console.log('✅ Rollback sikeresen befejezve!');
  }
};
