'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add knowledge base content settings to AI Behavior Settings table
    await queryInterface.bulkInsert('AIBehaviorSettings', [
      {
        category: 'knowledgeBase',
        settingKey: 'companyInfo',
        settingValue: `- Fellépő közvetítő platform Magyarországon
- 2015 óta működünk
- 500+ fellépő az adatbázisban (DJ-k, zenekarok, énekesek, műsorvezetők)
- Országos lefedettség
- 24 órás válaszidő garantált`,
        dataType: 'string',
        label: 'Cég alapinformációk',
        description: 'Általános információk a cégről és szolgáltatásról',
        isActive: true,
        displayOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'eventTypes',
        settingValue: `ESKÜVŐK:
- Szertartásvezető: +40.000-80.000 Ft
- Teljes esküvő csomag: 250.000-500.000 Ft (ceremónia zene + vacsora zene + buli DJ/zenekar)
- First dance koreográfia: +30.000 Ft
- Meglepetés fellépés szervezése: egyedi árajánlat

CÉGES RENDEZVÉNYEK:
- Céges buli (50-200 fő): 150.000-400.000 Ft
- Gála vacsora: 200.000-500.000 Ft
- Csapatépítő esemény: egyedi árajánlat
- Konferencia háttérzene: 80.000-120.000 Ft

SZÜLETÉSNAPOK:
- Gyerek parti animátor: 40.000-60.000 Ft (2 óra)
- Felnőtt szülinap DJ: 60.000-100.000 Ft
- Tematikus parti (80-as, 90-es): +20.000 Ft

BÁLOK, FESZTIVÁLOK:
- Nagyszínpados produkció: 500.000 Ft felett
- Helyszíni technika koordináció: +50.000-100.000 Ft`,
        dataType: 'string',
        label: 'Rendezvénytípusok & Árak',
        description: 'Rendezvénytípusok és becsült árak',
        isActive: true,
        displayOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'travelCosts',
        settingValue: `- Budapest, Pest megye: nincs utazási költség
- Vidék (50-100 km): 15.000-30.000 Ft
- Vidék (100-200 km): 30.000-50.000 Ft
- 200 km felett: egyedi kalkuláció
- Nemzetközi fellépés: egyedi árajánlat`,
        dataType: 'string',
        label: 'Helyszínek & Utazási költségek',
        description: 'Utazási díjak helyszínek szerint',
        isActive: true,
        displayOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'durationExtras',
        settingValue: `- Standard fellépés: 3-4 óra
- Óránkénti meghosszabbítás: +15.000-25.000 Ft
- Korai felállás/soundcheck: +10.000 Ft
- Éjszakai lezárás (00:00 után): +20.000 Ft/óra`,
        dataType: 'string',
        label: 'Időtartam & Extrák',
        description: 'Fellépési időtartamok és plusz szolgáltatások',
        isActive: true,
        displayOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'paymentTerms',
        settingValue: `- Foglalóként: 30% előleg
- Végösszeg: az esemény napján vagy max. 3 nappal utána
- Átutalás vagy készpénz
- Számla minden esetben
- Lemondás 30 nappal előtte: teljes visszatérítés
- Lemondás 14-30 nap között: 50% visszatérítés
- Lemondás 14 napon belül: nincs visszatérítés`,
        dataType: 'string',
        label: 'Fizetési feltételek',
        description: 'Fizetési módok, előleg, lemondási feltételek',
        isActive: true,
        displayOrder: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'bookingProcess',
        settingValue: `1. ELSŐ EGYEZTETÉS (0. nap) - Kitöltött űrlap beérkezik, 24 órán belül visszahívunk, Részletes igényfelmérés
2. AJÁNLAT (1-2. nap) - Személyre szabott árajánlat, Fellépők bemutatása (videók, referenciák), Opcionális választási lehetőségek
3. EGYEZTETÉS (3-7. nap) - Fellépő kiválasztása, Műsorterv megbeszélése, Speciális kérések tisztázása
4. FOGLALÁS (7-14. nap) - Szerződés aláírása, 30% előleg befizetése, Foglalás véglegesítése
5. ESEMÉNY ELŐTT (1-2 hét) - Végső egyeztetés, Helyszín bejárás (opcionális), Technikai részletek tisztázása
6. ESEMÉNY NAPJA - Fellépő érkezés egyeztetett időben, Felállás + soundcheck, Fellépés, Végösszeg kiegyenlítése`,
        dataType: 'string',
        label: 'Foglalási folyamat',
        description: 'A foglalás lépései az elejétől a végéig',
        isActive: true,
        displayOrder: 6,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'musicGenres',
        settingValue: `- Magyar slágerek (retro, modern)
- Külföldi toplista
- Jazz, swing
- Rock, pop-rock
- Elektronikus, house, techno
- Esküvői klasszikusok
- Gyerekdalok (animátorok)
- Roma/cigány zene
- Népdal, nóta
- Egyéb (előre egyeztetett kívánságműsor)`,
        dataType: 'string',
        label: 'Zenei stílusok & Repertoár',
        description: 'Elérhető zenei műfajok és stílusok',
        isActive: true,
        displayOrder: 7,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'contactInfo',
        settingValue: `- Email: bookings@dmf.hu
- Telefonos egyeztetés: űrlap kitöltése után hívunk vissza
- Gyors válaszidő: 24 óra munkanapokon
- Hétvégén: 48 óra (sürgős esetben hívj a forródrótot)`,
        dataType: 'string',
        label: 'Kapcsolat & Elérhetőség',
        description: 'Elérhetőségi információk',
        isActive: true,
        displayOrder: 8,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'promotions',
        settingValue: `- Korai foglalás (3+ hónap előre): 10% kedvezmény
- Több fellépő egyszerre: 10% kedvezmény
- Visszatérő ügyfél: 5% kedvezmény
- Ajánlás után: 5% kedvezmény a következő rendelésre`,
        dataType: 'string',
        label: 'Akciók & Kedvezmények',
        description: 'Elérhető kedvezmények és promóciók',
        isActive: true,
        displayOrder: 9,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        category: 'knowledgeBase',
        settingKey: 'importantRules',
        settingValue: `- Minden ár bruttó (ÁFA-s)
- Árak 2025-re vonatkoznak, változhatnak
- Speciális kérések (pl. pirotechnika) engedélykötelesek
- Szerzői jogi díj (Artisjus) az ügyfél felelőssége
- Fellépőknek biztosítandó: öltöző, frissítő, parkolás`,
        dataType: 'string',
        label: 'Fontos szabályok',
        description: 'Általános szabályok és feltételek',
        isActive: true,
        displayOrder: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Remove knowledge base content settings
    await queryInterface.bulkDelete('AIBehaviorSettings', {
      category: 'knowledgeBase'
    });
  }
};
