const express = require('express');
const router = express.Router();
const { sequelize, User } = require('../models');
const logger = require('../config/logger');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

// Constants
const INSTALL_LAYOUT = 'install-layout';

// Check if installation is needed
async function checkInstallationNeeded() {
  try {
    // Check if admin user exists
    const adminUser = await User.findOne({ where: { role: 'admin' } });
    return !adminUser;
  } catch {
    // If can't query, probably needs installation
    return true;
  }
}

// Installation home page
router.get('/', async (req, res) => {
  try {
    const needsInstall = await checkInstallationNeeded();

    if (!needsInstall) {
      return res.render('install/already-installed', {
        title: 'Már telepítve van',
        layout: INSTALL_LAYOUT
      });
    }

    res.render('install/welcome', {
      title: 'Koncert24.hu Telepítő',
      layout: 'install-layout'
    });
  } catch (error) {
    logger.error('Install page error:', error);
    res.render('install/welcome', {
      title: 'Koncert24.hu Telepítő',
      layout: INSTALL_LAYOUT
    });
  }
});

// Database check
router.post('/check-database', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ success: true, message: 'Adatbázis kapcsolat rendben' });
  } catch (error) {
    logger.error('Database check error:', error);
    res.json({
      success: false,
      error: `Adatbázis kapcsolat sikertelen: ${error.message}`
    });
  }
});

// Run migrations
router.post('/run-migrations', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('npx sequelize-cli db:migrate');

    if (stderr && !stderr.includes('Loaded configuration') && !stderr.includes('DeprecationWarning')) {
      logger.warn('Migration warnings:', stderr);
    }

    res.json({
      success: true,
      message: 'Migrációk sikeresen lefutottak',
      output: stdout
    });
  } catch (error) {
    logger.error('Migration error:', error);
    res.json({
      success: false,
      error: `Migráció hiba: ${error.message}`
    });
  }
});

// Validation helper functions
function validateAdminName(name) {
  if (!name || name.length < 2) {
    return 'A név minimum 2 karakter hosszú kell legyen';
  }
  return null;
}

function validateAdminEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Érvényes email címet adjon meg';
  }
  return null;
}

function validateAdminPhone(phone) {
  if (!phone || phone.length < 6) {
    return 'Érvényes telefonszámot adjon meg';
  }
  return null;
}

function validateAdminPassword(password) {
  if (!password || password.length < 8) {
    return 'A jelszó minimum 8 karakter hosszú kell legyen';
  }
  if (!/[A-Z]/.test(password)) {
    return 'A jelszónak tartalmaznia kell legalább 1 nagybetűt';
  }
  if (!/[a-z]/.test(password)) {
    return 'A jelszónak tartalmaznia kell legalább 1 kisbetűt';
  }
  if (!/[0-9]/.test(password)) {
    return 'A jelszónak tartalmaznia kell legalább 1 számot';
  }
  return null;
}

// Validate all admin form fields
function validateAdminFields(name, email, phone, password) {
  return validateAdminName(name)
    || validateAdminEmail(email)
    || validateAdminPhone(phone)
    || validateAdminPassword(password);
}

// Create admin user data object
function createAdminUserData(name, email, phone, password) {
  return {
    name,
    email,
    phone,
    password,
    role: 'admin',
    isActive: true,
    emailVerified: true
  };
}

// Create admin user
router.post('/create-admin', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate all fields
    const validationError = validateAdminFields(name, email, phone, password);
    if (validationError) {
      return res.json({ success: false, error: validationError });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.json({ success: false, error: 'Ez az email cím már használatban van' });
    }

    // Create admin user
    const userData = createAdminUserData(name, email, phone, password);
    const adminUser = await User.create(userData);

    logger.info({
      service: 'install',
      operation: 'createAdminUser',
      userId: adminUser.id,
      email
    }, 'Admin user created during installation');

    res.json({
      success: true,
      message: 'Admin felhasználó sikeresen létrehozva',
      user: {
        name: adminUser.name,
        email: adminUser.email
      }
    });
  } catch (error) {
    logger.error('Create admin error:', error);
    res.json({
      success: false,
      error: `Hiba a felhasználó létrehozásakor: ${error.message}`
    });
  }
});

// Mark installation as complete
router.post('/complete', async (req, res) => {
  try {
    // Create a flag file to indicate installation is complete
    const flagPath = path.join(process.cwd(), '.installed');
    await fs.writeFile(flagPath, new Date().toISOString());

    res.json({
      success: true,
      message: 'Telepítés sikeresen befejezve'
    });
  } catch (error) {
    logger.error('Complete installation error:', error);
    res.json({
      success: false,
      error: `Hiba a telepítés befejezésekor: ${error.message}`
    });
  }
});

module.exports = router;
