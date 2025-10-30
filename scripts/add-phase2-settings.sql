-- ============================================================================
-- PHASE 2: További Dinamikus Settings Hozzáadása
-- Dátum: 2025. október 6.
-- Területek: Social Media, Pagination, SEO Image, Facebook App ID
-- ============================================================================

USE dmf_koncert24;

-- 1. SOCIAL MEDIA LINKEK (5 platform)
INSERT IGNORE INTO Settings (`key`, `value`, `createdAt`, `updatedAt`) VALUES
('social.facebook', 'https://facebook.com/koncert24', NOW(), NOW()),
('social.instagram', 'https://instagram.com/koncert24', NOW(), NOW()),
('social.youtube', 'https://youtube.com/@koncert24', NOW(), NOW()),
('social.linkedin', 'https://linkedin.com/company/koncert24', NOW(), NOW()),
('social.tiktok', 'https://tiktok.com/@koncert24', NOW(), NOW());

-- 2. PAGINATION LIMITS (3 típus)
INSERT IGNORE INTO Settings (`key`, `value`, `createdAt`, `updatedAt`) VALUES
('pagination.blog_posts', '12', NOW(), NOW()),
('pagination.performers', '12', NOW(), NOW()),
('pagination.admin_items', '20', NOW(), NOW());

-- 3. OPEN GRAPH DEFAULT IMAGE (3 mező)
INSERT IGNORE INTO Settings (`key`, `value`, `createdAt`, `updatedAt`) VALUES
('seo.default_og_image', '/images/og-image.jpg', NOW(), NOW()),
('seo.og_image_width', '1200', NOW(), NOW()),
('seo.og_image_height', '630', NOW(), NOW());

-- 4. FACEBOOK APP ID
INSERT IGNORE INTO Settings (`key`, `value`, `createdAt`, `updatedAt`) VALUES
('social.facebook_app_id', '', NOW(), NOW());

-- ============================================================================
-- ELLENŐRZÉS
-- ============================================================================
SELECT 
    '=== PHASE 2 SETTINGS ÖSSZESÍTÉS ===' as 'INFO';

SELECT 
    CASE 
        WHEN `key` LIKE 'social.%' THEN '1. Social Media'
        WHEN `key` LIKE 'pagination.%' THEN '2. Pagination'
        WHEN `key` LIKE 'seo.%' AND `key` IN ('seo.default_og_image','seo.og_image_width','seo.og_image_height') THEN '3. OG Image'
        ELSE '4. Other'
    END as 'Kategória',
    `key` as 'Setting Key',
    `value` as 'Default Value'
FROM Settings
WHERE `key` IN (
    'social.facebook', 'social.instagram', 'social.youtube', 'social.linkedin', 'social.tiktok',
    'pagination.blog_posts', 'pagination.performers', 'pagination.admin_items',
    'seo.default_og_image', 'seo.og_image_width', 'seo.og_image_height',
    'social.facebook_app_id'
)
ORDER BY 
    CASE 
        WHEN `key` LIKE 'social.%' AND `key` != 'social.facebook_app_id' THEN 1
        WHEN `key` LIKE 'pagination.%' THEN 2
        WHEN `key` LIKE 'seo.%' THEN 3
        ELSE 4
    END,
    `key`;

SELECT 
    CONCAT('✅ Phase 2 implementálva: ', COUNT(*), ' új Setting') as 'Státusz'
FROM Settings
WHERE `key` IN (
    'social.facebook', 'social.instagram', 'social.youtube', 'social.linkedin', 'social.tiktok',
    'pagination.blog_posts', 'pagination.performers', 'pagination.admin_items',
    'seo.default_og_image', 'seo.og_image_width', 'seo.og_image_height',
    'social.facebook_app_id'
);
