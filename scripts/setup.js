#!/usr/bin/env node
/**
 * Interactive Setup Script for Koncert24.hu
 * Handles initial database setup and admin user creation
 */

require('dotenv').config();
const readline = require('readline');
const { sequelize, User } = require('../models');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Helper function to check if user confirmed
const isUserConfirmed = (answer) => {
  const lower = answer.toLowerCase();
  return lower === 'igen' || lower === 'i' || lower === 'yes' || lower === 'y';
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  box: (lines) => {
    const maxLen = Math.max(...lines.map((l) => l.length));
    console.log(`\n${'═'.repeat(maxLen + 4)}`);
    lines.forEach((line) => console.log(`  ${line.padEnd(maxLen)}  `));
    console.log(`${'═'.repeat(maxLen + 4)}\n`);
  }
};

async function checkDatabaseConnection() {
  try {
    await sequelize.authenticate();
    log.success('Adatbázis kapcsolat rendben');
    return true;
  } catch (error) {
    log.error(`Adatbázis kapcsolat sikertelen: ${error.message}`);
    log.info('Ellenőrizd a .env fájlban az adatbázis beállításokat');
    return false;
  }
}

async function hasAdminUser() {
  try {
    return await User.findOne({ where: { role: 'admin' } });
  } catch {
    return null;
  }
}

async function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Érvénytelen email formátum';
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    return 'Ez az email cím már használatban van';
  }

  return null;
}

function validatePhone(phone) {
  if (phone.length < 6 || phone.length > 20) {
    return 'A telefonszám 6-20 karakter között kell legyen';
  }
  return null;
}

function validatePassword(password) {
  if (password.length < 8) {
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

// Helper: Prompt for name with validation
async function promptName() {
  let name = '';
  while (!name) {
    name = await question('Teljes név: ');
    if (!name || name.length < 2) {
      log.warning('A név minimum 2 karakter hosszú kell legyen');
      name = '';
    }
  }
  return name;
}

// Helper: Prompt for email with validation
async function promptEmail() {
  let email = '';
  while (!email) {
    email = await question('Email cím: ');
    const emailError = await validateEmail(email);
    if (emailError) {
      log.warning(emailError);
      email = '';
    }
  }
  return email;
}

// Helper: Prompt for phone with validation
async function promptPhone() {
  let phone = '';
  while (!phone) {
    phone = await question('Telefonszám (pl. +36301234567): ');
    const phoneError = validatePhone(phone);
    if (phoneError) {
      log.warning(phoneError);
      phone = '';
    }
  }
  return phone;
}

// Helper: Prompt for password with validation and confirmation
async function promptPassword() {
  log.info('A jelszónak tartalmaznia kell:');
  log.info('  - Minimum 8 karaktert');
  log.info('  - Legalább 1 nagybetűt');
  log.info('  - Legalább 1 kisbetűt');
  log.info('  - Legalább 1 számot');

  let password = '';
  while (!password) {
    password = await question('Jelszó: ');
    const passwordError = validatePassword(password);
    if (passwordError) {
      log.warning(passwordError);
      password = '';
      // eslint-disable-next-line no-continue -- Validation loop: restart prompt on invalid input
      continue;
    }

    const passwordConfirm = await question('Jelszó megerősítése: ');
    if (password !== passwordConfirm) {
      log.warning('A jelszavak nem egyeznek');
      password = '';
    }
  }
  return password;
}

async function createAdminUser() {
  log.title('📝 Admin felhasználó adatai');

  const name = await promptName();
  const email = await promptEmail();
  const phone = await promptPhone();
  const password = await promptPassword();

  // Confirm
  console.log(`\n${'─'.repeat(50)}`);
  console.log('Létrehozandó admin felhasználó:');
  console.log('─'.repeat(50));
  console.log(`Név:      ${name}`);
  console.log(`Email:    ${email}`);
  console.log(`Telefon:  ${phone}`);
  console.log('─'.repeat(50));

  const confirm = await question('\nRendben van? (igen/nem): ');

  if (!isUserConfirmed(confirm)) {
    log.warning('Megszakítva');
    return null;
  }

  // Create user
  try {
    return await User.create({
      name,
      email,
      phone,
      password,
      role: 'admin',
      isActive: true,
      emailVerified: true
    });
  } catch (error) {
    log.error(`Hiba a felhasználó létrehozásakor: ${error.message}`);
    return null;
  }
}

async function runMigrations() {
  log.title('🔄 Adatbázis migrációk futtatása');

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    const { stdout: _stdout, stderr } = await execAsync('npx sequelize-cli db:migrate');
    if (stderr && !stderr.includes('Loaded configuration')) {
      log.warning('Migráció figyelmeztetések:');
      console.log(stderr);
    }
    log.success('Migrációk sikeresen lefutottak');
    return true;
  } catch (error) {
    log.error(`Migráció hiba: ${error.message}`);
    return false;
  }
}

/**
 * Handles migration step (ask user and run if confirmed)
 */
async function handleMigrations() {
  const migrateAnswer = await question('\nFuttassam az adatbázis migrációkat? (igen/nem): ');
  if (isUserConfirmed(migrateAnswer)) {
    const migrationsOk = await runMigrations();
    if (!migrationsOk) {
      log.warning('A migrációk nem futottak le teljesen, de folytathatod');
    }
  }
}

/**
 * Checks and handles existing admin user
 */
async function handleExistingAdmin() {
  log.title('👤 Admin felhasználó ellenőrzése');
  const existingAdmin = await hasAdminUser();

  if (existingAdmin) {
    log.info('Admin felhasználó már létezik:');
    console.log(`   Email: ${existingAdmin.email}`);
    console.log(`   Név:   ${existingAdmin.name}`);

    const createNew = await question('\nLétrehozzak egy új admin felhasználót is? (igen/nem): ');
    if (!isUserConfirmed(createNew)) {
      log.info('Telepítés befejezve');
      rl.close();
      await sequelize.close();
      process.exit(0);
    }
  }
}

/**
 * Displays final success message
 */
function displayFinalMessage(adminUser) {
  if (adminUser) {
    log.box([
      '✅ Telepítés sikeres!',
      '',
      'Admin bejelentkezési adatok:',
      `Email:    ${adminUser.email}`,
      `Név:      ${adminUser.name}`,
      '',
      '🌐 Bejelentkezés: http://localhost:3000/auth/login',
      '',
      '💡 A bejelentkezés után automatikusan',
      '   az admin felületre kerülsz'
    ]);
  } else {
    log.warning('Admin felhasználó létrehozása megszakítva');
  }
}

async function main() {
  console.clear();

  log.box([
    '🎵 Koncert24.hu - Telepítő',
    '',
    'Ez a script végigvezet az első telepítésen',
    'és létrehozza az admin felhasználót'
  ]);

  // Check database connection
  log.title('🔌 Adatbázis kapcsolat ellenőrzése');
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    rl.close();
    process.exit(1);
  }

  // Run migrations
  await handleMigrations();

  // Check for existing admin
  await handleExistingAdmin();

  // Create admin user
  const adminUser = await createAdminUser();
  displayFinalMessage(adminUser);

  rl.close();
  await sequelize.close();
}

// Run setup
main().catch((error) => {
  log.error(`Váratlan hiba: ${error.message}`);
  console.error(error);
  rl.close();
  sequelize.close();
  process.exit(1);
});
