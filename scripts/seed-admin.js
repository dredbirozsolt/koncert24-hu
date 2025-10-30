#!/usr/bin/env node
require('dotenv').config();
const { sequelize, User } = require('../models');
const crypto = require('crypto');

function displayExistingAdmin(existingAdmin) {
  console.log('⚠️  Admin felhasználó már létezik:');
  console.log(`   Email: ${existingAdmin.email}`);
  console.log(`   Név: ${existingAdmin.name}`);
  console.log('\nHa új admin usert szeretnél, használd a set-admin.js scriptet.');
}

function displayNewAdminCredentials(adminUser, password) {
  console.log('✅ Admin felhasználó sikeresen létrehozva!\n');
  console.log('═══════════════════════════════════════');
  console.log('📧 Email:', adminUser.email);
  console.log('👤 Név:', adminUser.name);
  console.log('🔑 Jelszó:', password);
  console.log('═══════════════════════════════════════');
  console.log('\n⚠️  FONTOS: Mentsd el a jelszót biztonságos helyre!');
  console.log('💡 Bejelentkezés után változtasd meg a jelszót!\n');
  console.log('🌐 Bejelentkezés: http://localhost:3000/auth/login');
}

/**
 * Create initial admin user if none exists
 * Usage: node scripts/seed-admin.js [email] [name]
 */
(async () => {
  try {
    // Check if any admin user exists
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });

    if (existingAdmin) {
      displayExistingAdmin(existingAdmin);
      await sequelize.close();
      process.exit(0);
    }

    // Get email and name from command line or use defaults
    const email = process.argv[2] || 'admin@koncert24.hu';
    const name = process.argv[3] || 'Admin User';

    // Generate random password
    const password = crypto.randomBytes(12).toString('base64').slice(0, 16);
    const phone = '+36301234567';

    // Create admin user
    const adminUser = await User.create({
      name,
      email,
      phone,
      password,
      role: 'admin',
      isActive: true,
      emailVerified: true
    });

    displayNewAdminCredentials(adminUser, password);

    await sequelize.close();
  } catch (e) {
    console.error('❌ Hiba:', e.message);
    await sequelize.close();
    process.exit(1);
  }
})();
