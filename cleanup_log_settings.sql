-- ============================================
-- CLEANUP: Remove obsolete log settings from database
-- These settings are now managed via environment variables (.env)
-- ============================================

-- Check current log settings
SELECT 'Current log settings before cleanup:' AS info;
SELECT id, `key`, value, type, category 
FROM Settings 
WHERE `key` LIKE 'logs.%' 
ORDER BY `key`;

-- Delete obsolete settings (rotation and max_size are now in .env)
DELETE FROM Settings WHERE `key` = 'logs.rotation.interval';
DELETE FROM Settings WHERE `key` = 'logs.max_size_mb';

-- Verify remaining settings (only retention days should remain)
SELECT '' AS '';
SELECT 'Log settings after cleanup:' AS info;
SELECT id, `key`, value, type, category 
FROM Settings 
WHERE `key` LIKE 'logs.%' 
ORDER BY `key`;

SELECT '' AS '';
SELECT 'Cleanup complete! Only logs.retention.days should remain (managed from admin UI)' AS result;
SELECT 'Rotation and size settings are now in .env file (industry standard)' AS note;
