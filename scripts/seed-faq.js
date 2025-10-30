/* eslint-disable max-len */
/**
 * Seed script - FAQ adatok feltöltése
 * Note: max-len disabled because this file contains long FAQ answer texts
 */

const { FaqCategory, FaqItem } = require('../models');

const faqData = [
  {
    category: { name: 'Általános', icon: '📋', displayOrder: 1 },
    items: [
      {
        question: 'Hogyan működik a foglalási folyamat?',
        answer: 'A foglalási folyamat egyszerű: válasszon előadót vagy rendezvénytípust, töltse ki az online foglalási űrlapot a rendezvény részleteivel. Kollégánk 24 órán belül felveszi Önnel a kapcsolatot, egyeztet a részletekről és elküldi az ajánlatot. Elfogadás után szerződést kötünk és lebonyolítjuk a rendezvényt.',
        displayOrder: 1
      },
      {
        question: 'Milyen típusú rendezvényekre tudok előadót foglalni?',
        answer: 'Szolgáltatásunk minden típusú rendezvényre elérhető: esküvők, céges rendezvények, szülinapi bulik, fesztiválok, bálok, céges karácsonyi rendezvények, utcabálok, falunapi rendezvények, és közösségi események. Akár intim családi összejövetelről, akár nagyszabású céges eseményről van szó, segítünk megtalálni a tökéletes előadót.',
        displayOrder: 2
      },
      {
        question: 'Mennyibe kerül egy előadó foglalása?',
        answer: 'Az árak előadónként és rendezvénytípusonként változnak. A végső ár függ a rendezvény időtartamától, helyszínétől, technikai igényektől és az előadó népszerűségétől. Kérjen árajánlatot a foglalási űrlapon keresztül, és kollégánk személyre szabott ajánlatot küld Önnek 24 órán belül.',
        displayOrder: 3
      },
      {
        question: 'Mennyi idővel előre kell foglalnom?',
        answer: 'Javasoljuk, hogy legalább 2-3 hónappal a rendezvény előtt foglaljon, különösen népszerű időszakokban (tavasz-nyár, ünnepek). Sürgős esetekben is tudunk segíteni, akár néhány hetes előkészítési idővel is, de a választék ekkor korlátozottabb lehet.',
        displayOrder: 4
      },
      {
        question: 'Mi van, ha le kell mondanom a foglalást?',
        answer: 'A lemondási feltételek a szerződésben kerülnek rögzítésre. Általában 30 nappal a rendezvény előtti lemondás esetén nincs lemondási díj, 30-14 nap között 30%, 14-7 nap között 50%, 7 napon belül pedig 100% lemondási díjat számítunk fel. Rendkívüli esetekben egyedi megoldást keresünk.',
        displayOrder: 5
      }
    ]
  },
  {
    category: { name: 'Előadók', icon: '🎤', displayOrder: 2 },
    items: [
      {
        question: 'Milyen előadók közül választhatok?',
        answer: 'Széles választékot kínálunk: zenészek (élő zene, DJ-k), énekesek, zenekarok (pop, rock, jazz, blues, folk), táncosok, stand-up comedy-sok, bűvészek, és műsorvezetők. Minden előadónk profi, tapasztalt és megbízható. Böngésszen előadóink között kategóriák vagy műfaj szerint.',
        displayOrder: 1
      },
      {
        question: 'Tudok előadókat személyesen meghallgatni előre?',
        answer: 'Igen, lehetőség van élő próbára vagy online bemutatkozó beszélgetésre. Minden előadónknak van videó és audio bemutatkozója az oldalon, ahol meghallgathatja korábbi fellépéseit. Ha szeretné személyesen is meghallgatni, ezt egyeztetjük a foglalási folyamat során.',
        displayOrder: 2
      },
      {
        question: 'Mit tartalmaz az előadó szolgáltatása?',
        answer: 'Az alap szolgáltatás magában foglalja az előadó fellépését a megbeszélt időtartamban. A műszaki háttér (hangosítás, fények) egyeztetés tárgyát képezi - egyes előadók saját felszereléssel érkeznek, más esetekben biztosítani kell. Az árban általában benne van az utazási költség egy bizonyos körzetben, távolabbi helyszínek esetén felár számítható.',
        displayOrder: 3
      },
      {
        question: 'Tudok egyedi kéréseket is megadni az előadónak?',
        answer: 'Természetesen! Szeretnék egy adott dalt eljátszani? Van különleges téma vagy dress code? Egyeztessen velünk és az előadóval a foglalás során. Legtöbb előadónk rugalmasan alkalmazkodik az egyedi kérésekhez, legyen szó repertoárról, öltözékről vagy különleges meglepetésekről.',
        displayOrder: 4
      }
    ]
  },
  {
    category: { name: 'Technikai kérdések', icon: '🔧', displayOrder: 3 },
    items: [
      {
        question: 'Ki biztosítja a hangosítást és fényeket?',
        answer: 'Ez előadótól függően változik. Egyes előadók saját professzionális felszereléssel rendelkeznek, míg mások esetében a helyszínnek vagy Önnek kell biztosítania. A foglalási folyamat során pontosan egyeztetjük a technikai igényeket. Szükség esetén szakmai partnereink segítségével teljes technikai hátteret tudunk biztosítani.',
        displayOrder: 1
      },
      {
        question: 'Milyen helyszíni feltételek szükségesek?',
        answer: 'Alapvetően szükséges: megfelelő méretű színpad vagy fellépési terület, áramforrás (230V, minimum 16A), biztonságos környezet. Részletes műszaki igénylista egyeztetésre kerül az előadóval. Külső helyszín esetén fontos az időjárás elleni védelem (sátor, fedett terület) és megfelelő világítás.',
        displayOrder: 2
      },
      {
        question: 'Mi történik rossz időjárás esetén szabadtéri rendezvénynél?',
        answer: 'Külső rendezvények esetén javasoljuk tartalék fedett helyszín biztosítását. Ha az időjárás lehetetlenné teszi a fellépést és ez előre látható, lehetőség van időpont módosításra lemondási díj nélkül. Az eseti döntéseket a szerződésben rögzítjük.',
        displayOrder: 3
      }
    ]
  },
  {
    category: { name: 'Fizetés és szerződés', icon: '💰', displayOrder: 4 },
    items: [
      {
        question: 'Hogyan kell fizetnem?',
        answer: 'Elfogadunk banki átutalást és készpénzes fizetést. Általában foglalóként a teljes összeg 30%-át kérjük a szerződés aláírását követően, a fennmaradó 70%-ot pedig a rendezvény előtt 7-14 nappal. Egyedi fizetési konstrukciók is megbeszélhetők.',
        displayOrder: 1
      },
      {
        question: 'Kapok számlát?',
        answer: 'Természetesen, minden foglalásról hivatalos számlát állítunk ki. Cégünk bejegyzett vállalkozás, minden tranzakció teljesen legális és elszámolható. ÁFA-s számlát biztosítunk minden megrendeléshez.',
        displayOrder: 2
      },
      {
        question: 'Van-e lehetőség részletfizetésre?',
        answer: 'Nagyobb volumenű rendezvények esetén (pl. többnapos fesztiválok, nagyszabású céges események) egyedi részletfizetési konstrukciót tudunk kialakítani. Ez minden esetben egyeztetés és szerződésmódosítás tárgyát képezi.',
        displayOrder: 3
      }
    ]
  },
  {
    category: { name: 'Előadóknak', icon: '🎵', displayOrder: 5 },
    items: [
      {
        question: 'Hogyan csatlakozhatok előadóként a platformhoz?',
        answer: 'Nagyon szívesen látjuk új előadókat! Töltse ki az "Előadóknak" oldalon található jelentkezési űrlapot, mellékelje bemutatkozó anyagait (videók, demók, referenciák). Kollégánk 5 munkanapon belül felveszi Önnel a kapcsolatot és tájékoztatja a további lépésekről.',
        displayOrder: 1
      },
      {
        question: 'Mennyibe kerül az előadói regisztráció?',
        answer: 'A regisztráció és a platformon való megjelenés teljesen ingyenes! Csak akkor számítunk fel jutalékot, ha sikeres foglalás történik. A jutalék mértéke egyénileg kerül megbeszélésre, általában 10-20% között van a foglalás értékétől függően.',
        displayOrder: 2
      },
      {
        question: 'Milyen gyakran kapok fellépési lehetőségeket?',
        answer: 'Ez függ a profilodtól, elérhetőségedtől és az aktuális kereslettől. Aktív profil, jó referenciák és rugalmas hozzáállás esetén akár heti rendszerességgel is érkezhetnek megkeresések. Minél teljesebb a profilod (videók, képek, részletes leírás), annál több megkeresésre számíthatsz.',
        displayOrder: 3
      },
      {
        question: 'Magam szabhatom meg az áramat?',
        answer: 'Igen, az árazás rugalmas és egyéni. Közösen kialakítjuk az árlistádat különböző rendezvénytípusokra és időtartamokra. Figyelembe vesszük a piaci árakat és a te elképzeléseidet is. Az ár mindig egyeztetésre kerül konkrét foglalás esetén.',
        displayOrder: 4
      }
    ]
  }
];

async function seedFaq() {
  try {
    console.log('🌱 FAQ seed script indítása...\n');

    for (const data of faqData) {
      // Kategória létrehozása
      const [category] = await FaqCategory.findOrCreate({
        where: { name: data.category.name },
        defaults: data.category
      });

      console.log(`✓ Kategória: ${category.name} (${category.icon})`);

      // Item-ek létrehozása
      for (const itemData of data.items) {
        const [_item, created] = await FaqItem.findOrCreate({
          where: {
            categoryId: category.id,
            question: itemData.question
          },
          defaults: {
            ...itemData,
            categoryId: category.id
          }
        });

        if (created) {
          console.log(`  + ${itemData.question.substring(0, 50)}...`);
        }
      }
      console.log('');
    }

    console.log('✅ FAQ seed sikeres!\n');

    // Statisztikák
    const categoryCount = await FaqCategory.count();
    const itemCount = await FaqItem.count();
    console.log(`📊 Összesen: ${categoryCount} kategória, ${itemCount} kérdés\n`);
  } catch (error) {
    console.error('❌ Hiba a seed során:', error);
    throw error;
  }
}

// Ha közvetlenül futtatjuk
if (require.main === module) {
  seedFaq()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = seedFaq;
