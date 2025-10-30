#!/usr/bin/env node
require('dotenv').config();
const { sequelize, User } = require('../models');

function displayMissingEnvVars() {
  console.log('⚠️  ADMIN_EMAIL és ADMIN_PASSWORD nincs beállítva a .env fájlban');
  console.log('   Add hozzá ezeket a sorokat a .env fájlhoz:');
  console.log('   ADMIN_EMAIL=admin@koncert24.hu');
  console.log('   ADMIN_PASSWORD=yourSecurePassword123');
  console.log('   ADMIN_NAME=Admin User (opcionális)');
  console.log('   ADMIN_PHONE=+36301234567 (opcionális)');
}

async function handleExistingUser(existingUser, adminEmail) {
  if (existingUser.role === 'admin') {
    console.log('✅ Admin felhasználó már létezik:', adminEmail);
  } else {
    await existingUser.update({
      role: 'admin',
      emailVerified: true
    });
    console.log('✅ Felhasználó frissítve admin jogosultságra:', adminEmail);
  }
}

async function createNewAdmin(adminName, adminEmail, adminPhone, adminPassword) {
  const adminUser = await User.create({
    name: adminName,
    email: adminEmail,
    phone: adminPhone,
    password: adminPassword,
    role: 'admin',
    isActive: true,
    emailVerified: true
  });
  console.log('✅ Admin felhasználó létrehozva:', adminUser.email);
}

function displayLoginInfo(adminEmail) {
  console.log('\n🌐 Bejelentkezés: http://localhost:3000/auth/login');
  console.log('📧 Email:', adminEmail);
}

/**
 * Check and create admin user from environment variables
 * Add to .env:
 *   ADMIN_EMAIL=your@email.com
 *   ADMIN_PASSWORD=yourpassword
 *   ADMIN_NAME=Your Name
 */
(async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin User';
    const adminPhone = process.env.ADMIN_PHONE || '+36301234567';

    if (!adminEmail || !adminPassword) {
      displayMissingEnvVars();
      await sequelize.close();
      process.exit(1);
    }

    const existingUser = await User.findOne({ where: { email: adminEmail } });

    if (existingUser) {
      await handleExistingUser(existingUser, adminEmail);
    } else {
      await createNewAdmin(adminName, adminEmail, adminPhone, adminPassword);
    }

    displayLoginInfo(adminEmail);

    await sequelize.close();
  } catch (e) {
    console.error('❌ Hiba:', e.message);
    await sequelize.close();
    process.exit(1);
  }
})();
