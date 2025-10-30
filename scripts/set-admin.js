#!/usr/bin/env node
require('dotenv').config();
const { sequelize, User } = require('../models');

function displayCurrentUserData(user) {
  console.log('Jelenlegi adatok:');
  console.log('  Email:', user.email);
  console.log('  Név:', user.name);
  console.log('  Szerep:', user.role);
}

function displaySuccessMessage(user) {
  console.log('\n✅ Szerepkör sikeresen frissítve: admin');
  console.log('\nMost már bejelentkezhetsz admin jogosultsággal:');
  console.log('URL: http://localhost:3000/admin/login');
  console.log('Email:', user.email);
  console.log('Jelszó: (a regisztrációkor megadott jelszavad)');
}

(async () => {
  try {
    const email = process.argv[2] || 'zsolt@dmf.hu';

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`❌ Felhasználó nem található: ${email}`);
      await sequelize.close();
      process.exit(1);
    }

    displayCurrentUserData(user);
    await user.update({ role: 'admin' });
    displaySuccessMessage(user);

    await sequelize.close();
  } catch (e) {
    console.error('❌ Hiba:', e.message);
    await sequelize.close();
    process.exit(1);
  }
})();
