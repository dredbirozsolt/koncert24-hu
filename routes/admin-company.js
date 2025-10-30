const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { requireAdmin } = require('../middleware/auth');
const { normalizeSettingsKeys } = require('../utils/sanitizeHelper');
const logger = require('../config/logger');

// Constants
const SETTING_KEY_COMPANY_LOGO = 'company.logo';

// Multer configuration for company logo upload
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'company');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: company-logo-timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `company-logo-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Csak képfájlok engedélyezettek (JPEG, PNG, GIF, SVG, WebP)!'));
  }
});

// GET /admin/company - Company Information page
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');

    // Get all settings
    const allSettings = await Setting.findAll({
      order: [['category', 'ASC'], ['key', 'ASC']]
    });

    // Create flat settings object
    const flatSettings = {};
    allSettings.forEach((setting) => {
      flatSettings[setting.key] = setting.value;
    });

    res.render('admin/company-settings', {
      layout: 'layouts/admin',
      title: 'Cégadatok',
      flatSettings
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminCompany', operation: 'loadPage' },
      'Company settings page error'
    );
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Beállítások betöltése sikertelen',
      error: { status: 500 }
    });
  }
});

// POST /admin/company/save - Save company settings
router.post('/save', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Érvénytelen beállítások formátum'
      });
    }

    // Normalize keys (convert underscores back to dots)
    const normalizedSettings = normalizeSettingsKeys(settings);

    let updatedCount = 0;

    // Update each setting (only company.*)
    for (const [key, value] of Object.entries(normalizedSettings)) {
      // Only save company.* fields
      if (key.startsWith('company.') && value && value.toString().trim() !== '') {
        await Setting.set(key, value, 'string', 'company', `Company setting: ${key}`);
        updatedCount += 1;
      }
    }

    res.json({
      success: true,
      message: `${updatedCount} beállítás sikeresen mentve`
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminCompany', operation: 'saveSettings' },
      'Company settings update error'
    );
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /admin/company/upload-logo - Upload company logo
router.post('/upload-logo', requireAdmin, logoUpload.single('companyLogo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nincs feltöltött fájl'
      });
    }

    const { Setting } = require('../models');
    const logoPath = `/uploads/company/${req.file.filename}`;

    // Get old logo before saving new one
    const oldLogoSetting = await Setting.findOne({ where: { key: SETTING_KEY_COMPANY_LOGO } });
    const oldLogoPath = oldLogoSetting ? oldLogoSetting.value : null;

    // Save new logo path to settings
    await Setting.set(SETTING_KEY_COMPANY_LOGO, logoPath, 'string', 'company', 'Company logo path');

    // Delete old logo file if exists and different from new one
    if (oldLogoPath && oldLogoPath !== logoPath) {
      const oldLogoFilePath = path.join(process.cwd(), 'public', oldLogoPath);
      try {
        await fs.unlink(oldLogoFilePath);
      } catch (unlinkError) {
        // Old file deletion is not critical
        logger.warn(
          { service: 'adminCompany', oldLogoPath, error: unlinkError.message },
          'Old logo file deletion failed'
        );
      }
    }

    res.json({
      success: true,
      message: 'Céglogó sikeresen feltöltve',
      logoPath
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminCompany', operation: 'uploadLogo' },
      'Logo upload error'
    );

    // Delete uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error(
          { err: unlinkError, service: 'adminCompany', filePath: req.file.path },
          'Failed to delete uploaded file'
        );
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Logo feltöltése sikertelen'
    });
  }
});

// DELETE /admin/company/delete-logo - Delete company logo
router.delete('/delete-logo', requireAdmin, async (req, res) => {
  try {
    const { Setting } = require('../models');
    const logoSetting = await Setting.findOne({ where: { key: SETTING_KEY_COMPANY_LOGO } });

    if (!logoSetting || !logoSetting.value) {
      return res.json({
        success: true,
        message: 'Nincs törölhető logó'
      });
    }

    const logoFilePath = path.join(process.cwd(), 'public', logoSetting.value);

    // Delete the file
    try {
      await fs.unlink(logoFilePath);
    } catch (unlinkError) {
      logger.warn(
        { service: 'adminCompany', logoFilePath, error: unlinkError.message },
        'Logo file deletion failed'
      );
    }

    // Clear the setting
    await logoSetting.update({ value: '' });

    res.json({
      success: true,
      message: 'Céglogó sikeresen törölve'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminCompany', operation: 'deleteLogo' },
      'Logo deletion error'
    );
    res.status(500).json({
      success: false,
      message: error.message || 'Logo törlése sikertelen'
    });
  }
});

module.exports = router;
