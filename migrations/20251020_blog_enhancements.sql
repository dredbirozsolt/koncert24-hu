-- =====================================================
-- Blog Rendszer Fejlesztések - 2025.10.20
-- =====================================================

-- 1. Users tábla bővítése (avatar és bio mezők)
-- =====================================================
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(255) DEFAULT NULL COMMENT 'Avatar image URL',
  ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL COMMENT 'Author biography';

-- 2. BlogPosts tábla bővítése (featured flag)
-- =====================================================
ALTER TABLE BlogPosts
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE COMMENT 'Is this a featured post?';

-- Index hozzáadása a featured postsokhoz
CREATE INDEX IF NOT EXISTS idx_blogposts_featured ON BlogPosts(featured, status, publishedAt);

-- 3. Settings tábla feltöltése blog konfigurációval
-- =====================================================

-- Blog szerző beállítása (ha még nincs)
INSERT INTO settings (category, settingKey, value, description, createdAt, updatedAt) 
VALUES ('blog', 'default_author_id', '1', 'Default blog author user ID', NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

-- Social media linkek (ha még nincsenek)
INSERT INTO settings (category, settingKey, value, description, createdAt, updatedAt) 
VALUES 
  ('social', 'facebook_url', '', 'Facebook page URL', NOW(), NOW()),
  ('social', 'twitter_url', '', 'Twitter profile URL', NOW(), NOW()),
  ('social', 'linkedin_url', '', 'LinkedIn page URL', NOW(), NOW())
ON DUPLICATE KEY UPDATE updatedAt = NOW();

-- 4. Első cikk kiemeléseként beállítása (ha van publikált cikk)
-- =====================================================
UPDATE BlogPosts 
SET featured = TRUE 
WHERE id = (
  SELECT id FROM (
    SELECT id 
    FROM BlogPosts 
    WHERE status = 'published' 
    ORDER BY viewCount DESC, publishedAt DESC 
    LIMIT 1
  ) AS temp
);

-- 5. Default author bio feltöltése (első user számára)
-- =====================================================
UPDATE users 
SET bio = 'Tapasztalt rendezvényszervező és koncertmenedzser, több mint 10 éves tapasztalattal a szakmában.'
WHERE id = 1 AND (bio IS NULL OR bio = '');

-- =====================================================
-- Migration vége
-- =====================================================

SELECT 'Blog enhancements migration completed successfully!' AS status;
