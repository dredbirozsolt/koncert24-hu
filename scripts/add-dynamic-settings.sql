-- Új dinamikus beállítások hozzáadása
-- Futtasd: mysql -u root -p dmf_koncert24 < scripts/add-dynamic-settings.sql

-- Company address részletek (SEO/Schema.org)
INSERT IGNORE INTO Settings (`key`, `value`, `type`, `category`, `description`, `createdAt`, `updatedAt`)
VALUES 
('company.address_street', '', 'string', 'general', 'Utca, házszám (Schema.org strukturált adat)', NOW(), NOW()),
('company.address_city', '', 'string', 'general', 'Város (Schema.org strukturált adat)', NOW(), NOW()),
('company.address_zip', '', 'string', 'general', 'Irányítószám (Schema.org strukturált adat)', NOW(), NOW()),
('company.address_country', 'Magyarország', 'string', 'general', 'Ország (Schema.org strukturált adat)', NOW(), NOW());

-- SEO beállítások
INSERT IGNORE INTO Settings (`key`, `value`, `type`, `category`, `description`, `createdAt`, `updatedAt`)
VALUES 
('seo.default_keywords', 'koncert, rendezvény, előadó, fellépő, zenész, esküvő, céges rendezvény', 'string', 'seo', 'Alapértelmezett SEO kulcsszavak (vesszővel elválasztva)', NOW(), NOW());

-- Általános nyelvi és időzóna beállítások
INSERT IGNORE INTO Settings (`key`, `value`, `type`, `category`, `description`, `createdAt`, `updatedAt`)
VALUES 
('general.locale', 'hu_HU', 'string', 'general', 'Nyelvi beállítás (locale kód, pl. hu_HU, en_US)', NOW(), NOW()),
('general.timezone', 'Europe/Budapest', 'string', 'general', 'Időzóna beállítás (pl. Europe/Budapest)', NOW(), NOW());

-- Ellenőrzés
SELECT 
    CASE 
        WHEN COUNT(*) = 7 THEN '✅ Minden új beállítás sikeresen létrehozva!'
        ELSE CONCAT('⚠️ ', COUNT(*), ' beállítás létezik a 7-ből')
    END AS eredmeny
FROM Settings 
WHERE `key` IN (
    'company.address_street',
    'company.address_city',
    'company.address_zip',
    'company.address_country',
    'seo.default_keywords',
    'general.locale',
    'general.timezone'
);
