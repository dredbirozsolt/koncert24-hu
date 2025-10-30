#!/usr/bin/env node

/**
 * Session Secret Generator Script
 * Generates a cryptographically secure random session secret
 *
 * Usage:
 *   node scripts/generate-session-secret.js
 *
 * This will:
 * 1. Generate a strong 64-byte random session secret
 * 2. Display it in the console
 * 3. Optionally update the .env file
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Generate a cryptographically secure random session secret
 * @param {number} bytes - Number of random bytes to generate (default: 64)
 * @returns {string} Hexadecimal string representation
 */
function generateSessionSecret(bytes = 64) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Validate if a session secret meets security requirements
 * @param {string} secret - Session secret to validate
 * @returns {Object} Validation result with passed flag and messages
 */
function validateSessionSecret(secret) {
  const results = {
    passed: true,
    warnings: [],
    errors: []
  };

  // Check minimum length (should be at least 32 characters)
  if (!secret || secret.length < 32) {
    results.passed = false;
    results.errors.push('❌ Session secret is too short (minimum 32 characters required)');
  }

  // Check for common weak patterns
  const weakPatterns = [
    /your_.*_here/i,
    /change.*production/i,
    /secret/i,
    /password/i,
    /12345/,
    /qwerty/i,
    /admin/i
  ];

  const foundWeakPattern = weakPatterns.find((pattern) => pattern.test(secret));
  if (foundWeakPattern) {
    results.passed = false;
    results.errors.push(`❌ Session secret contains weak pattern: ${foundWeakPattern}`);
  }

  // Check for randomness (should have good character distribution)
  const uniqueChars = new Set(secret.toLowerCase().split('')).size;
  if (uniqueChars < 10) {
    results.warnings.push('⚠️  Low character diversity (possible weak randomness)');
  }

  // Warn if secret is too short for production
  if (secret.length < 64) {
    results.warnings.push(`⚠️  Secret length is ${secret.length} characters. Recommended: 64+ for production`);
  }

  return results;
}

/**
 * Update .env file with new session secret
 * @param {string} newSecret - New session secret
 * @param {string} envPath - Path to .env file
 */
function updateEnvFile(newSecret, envPath) {
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace SESSION_SECRET line
    const sessionSecretRegex = /^SESSION_SECRET=.*/m;
    if (sessionSecretRegex.test(envContent)) {
      envContent = envContent.replace(sessionSecretRegex, `SESSION_SECRET=${newSecret}`);
    } else {
      // Add if not exists
      envContent += `\n# Session Configuration\nSESSION_SECRET=${newSecret}\n`;
    }

    // Create backup
    const backupPath = `${envPath}.backup-${Date.now()}`;
    fs.copyFileSync(envPath, backupPath);
    console.log(`\n📦 Backup created: ${backupPath}`);

    // Write new content
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env file updated successfully!');

    return true;
  } catch (error) {
    console.error(`❌ Error updating .env file: ${error.message}`);
    return false;
  }
}

/**
 * Interactive prompt for user confirmation
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Helper: Check and validate existing secret
 * Returns: { hasSecret, secret, shouldRegenerate }
 */
async function checkExistingSecret(envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^SESSION_SECRET=(.*)$/m);

    if (!match || !match[1]) {
      return { hasSecret: false, shouldRegenerate: true };
    }

    const currentSecret = match[1];
    console.log(`\n🔍 Current SESSION_SECRET: ${currentSecret.substring(0, 20)}...`);

    // Validate current secret
    console.log('\n📊 Security Validation:');
    const validation = validateSessionSecret(currentSecret);

    validation.errors.forEach((err) => console.log(`   ${err}`));
    validation.warnings.forEach((warn) => console.log(`   ${warn}`));

    if (validation.passed && validation.warnings.length === 0) {
      console.log('   ✅ Current secret passes all security checks');

      const answer = await promptUser('\n❓ Secret is already secure. Generate new one anyway? (yes/no): ');
      if (answer !== 'yes' && answer !== 'y') {
        return { hasSecret: true, secret: currentSecret, shouldRegenerate: false };
      }
    }

    return { hasSecret: true, secret: currentSecret, shouldRegenerate: true };
  } catch (error) {
    console.warn(`⚠️  Could not read current secret: ${error.message}`);
    return { hasSecret: false, shouldRegenerate: true };
  }
}

/**
 * Helper: Display validation results for new secret
 */
function displayNewSecretValidation(newSecret) {
  console.log('\n✨ NEW SESSION SECRET GENERATED:');
  console.log('═'.repeat(60));
  console.log(newSecret);
  console.log('═'.repeat(60));

  console.log('\n📊 New Secret Validation:');
  console.log(`   ✅ Length: ${newSecret.length} characters`);
  console.log(`   ✅ Character diversity: ${new Set(newSecret.split('')).size} unique characters`);
  console.log('   ✅ Cryptographically secure: Yes (crypto.randomBytes)');
}

/**
 * Helper: Handle env file update
 */
async function handleEnvUpdate(newSecret, envPath) {
  const answer = await promptUser('\n❓ Update .env file with new secret? (yes/no): ');

  if (answer === 'yes' || answer === 'y') {
    const success = updateEnvFile(newSecret, envPath);

    if (success) {
      console.log('\n🎉 SUCCESS! Session secret updated.');
      console.log('\n⚠️  IMPORTANT:');
      console.log('   1. Restart your Node.js server for changes to take effect');
      console.log('   2. All existing user sessions will be invalidated');
      console.log('   3. Users will need to log in again');
      console.log('   4. Keep the backup file (.env.backup-*) in a secure location');
    }
  } else {
    console.log('\n✋ .env file NOT updated.');
    console.log('   Copy the secret above and manually update your .env file:');
    console.log(`   SESSION_SECRET=${newSecret}`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🔐 SESSION SECRET GENERATOR\n');
  console.log('═'.repeat(60));

  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  const envExists = fs.existsSync(envPath);

  if (envExists) {
    console.log(`\n📄 Found .env file: ${envPath}`);

    // Check and validate existing secret
    const { shouldRegenerate } = await checkExistingSecret(envPath);

    if (!shouldRegenerate) {
      console.log('\n✋ Keeping existing secret. Exiting.');
      return;
    }
  } else {
    console.log(`\n⚠️  .env file not found at: ${envPath}`);
  }

  // Generate new secret
  console.log('\n🔄 Generating new session secret...');
  const newSecret = generateSessionSecret(64);

  // Display validation
  displayNewSecretValidation(newSecret);

  if (envExists) {
    await handleEnvUpdate(newSecret, envPath);
  } else {
    console.log('\n📝 Add this to your .env file:');
    console.log(`   SESSION_SECRET=${newSecret}`);
  }

  console.log('\n✅ Done!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  generateSessionSecret,
  validateSessionSecret
};
