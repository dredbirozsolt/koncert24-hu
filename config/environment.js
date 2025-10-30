/**
 * Environment configuration module
 * Centralized environment variable management with validation and defaults
 */

/**
 * Get environment variable with validation
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not found
 * @param {boolean} required - Whether the variable is required
 * @returns {string} Environment variable value
 * @throws {Error} If required variable is missing
 */
function getEnvVar(key, defaultValue = '', required = false) {
  /* eslint-disable no-process-env */
  const value = process.env[key];
  /* eslint-enable no-process-env */

  if (required && (!value || value.trim() === '')) {
    throw new Error(`Required environment variable ${key} is missing or empty`);
  }

  return value || defaultValue;
}

/**
 * Get environment variable as number
 * @param {string} key - Environment variable key
 * @param {number} defaultValue - Default value if not found
 * @param {boolean} required - Whether the variable is required
 * @returns {number} Environment variable value as number
 */
function getEnvNumber(key, defaultValue = 0, required = false) {
  const value = getEnvVar(key, String(defaultValue), required);
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    if (required) {
      throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
    }

    return defaultValue;
  }

  return parsed;
}

/**
 * Get environment variable as boolean
 * @param {string} key - Environment variable key
 * @param {boolean} defaultValue - Default value if not found
 * @returns {boolean} Environment variable value as boolean
 */
function getEnvBoolean(key, defaultValue = false) {
  const value = getEnvVar(key, String(defaultValue));

  return value.toLowerCase() === 'true' || value === '1';
}

// Database configuration
const database = {
  host: getEnvVar('DB_HOST', 'localhost', true),
  user: getEnvVar('DB_USER', '', true),
  password: getEnvVar('DB_PASSWORD', '', true),
  database: getEnvVar('DB_NAME', '', true),
  port: getEnvNumber('DB_PORT', 3306)
};

/**
 * Validate session secret meets security requirements
 * @param {string} secret - Session secret to validate
 * @returns {string} Validated secret
 * @throws {Error} If secret doesn't meet requirements
 */
function validateSessionSecret(secret) {
  // Minimum length check
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 32 characters long. '
      + 'Use: node scripts/generate-session-secret.js to generate a secure secret.'
    );
  }

  // Check for weak patterns
  const weakPatterns = [
    { pattern: /your_.*_here/i, message: 'contains placeholder text' },
    { pattern: /change.*production/i, message: 'contains "change in production" pattern' },
    { pattern: /^.*(12345|23456|34567|45678|56789).*$/i, message: 'contains simple sequential numbers' },
    { pattern: /^.*(qwerty|asdfgh|zxcvbn).*$/i, message: 'contains keyboard pattern' },
    { pattern: /^(password|secret|admin|test|default)$/i, message: 'contains common word as entire secret' }
  ];

  for (const { pattern, message } of weakPatterns) {
    if (pattern.test(secret)) {
      throw new Error(
        `SESSION_SECRET is insecure: ${message}. `
        + 'Use: node scripts/generate-session-secret.js to generate a secure secret.'
      );
    }
  }

  // Warn in development if secret is too short (but allow it)
  if (secret.length < 64 && getEnvVar('NODE_ENV') !== 'production') {
    /* eslint-disable no-console */
    console.warn(
      `⚠️  WARNING: SESSION_SECRET is only ${secret.length} characters. `
      + 'Recommended: 64+ characters for production. '
      + 'Use: node scripts/generate-session-secret.js'
    );
    /* eslint-enable no-console */
  }

  return secret;
}

// Server configuration
const server = {
  port: getEnvNumber('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  basePath: getEnvVar('BASE_PATH', ''),
  sessionSecret: validateSessionSecret(getEnvVar('SESSION_SECRET', '', true)),
  sessionMaxAge: getEnvNumber('SESSION_MAX_AGE', 24 * 60 * 60 * 1000),
  isProduction: getEnvVar('NODE_ENV') === 'production',
  isDevelopment: getEnvVar('NODE_ENV') === 'development'
};

// VTiger configuration
const vtiger = {
  baseUrl: getEnvVar('VTIGER_URL', '', false),
  username: getEnvVar('VTIGER_USERNAME', '', false),
  accessKey: getEnvVar('VTIGER_ACCESS_KEY', '', false)
};

// Email SMTP configuration
const emailSmtp = {
  host: getEnvVar('EMAIL_HOST', '', false),
  port: getEnvNumber('EMAIL_PORT', 587),
  secure: getEnvBoolean('EMAIL_SECURE', false),
  user: getEnvVar('EMAIL_USER', '', false),
  pass: getEnvVar('EMAIL_PASS', '', false),
  from: getEnvVar('EMAIL_FROM', '', false),
  replyTo: getEnvVar('EMAIL_REPLY_TO'),
  subject: getEnvVar('EMAIL_SUBJECT', 'vTiger Sync Notification'),
  to: getEnvVar('EMAIL_TO', '', false),
  cc: getEnvVar('EMAIL_CC'),
  bcc: getEnvVar('EMAIL_BCC')
};

// Email OAuth2 configuration
const emailOauth2 = {
  clientId: getEnvVar('OAUTH2_CLIENT_ID', '', false),
  clientSecret: getEnvVar('OAUTH2_CLIENT_SECRET', '', false),
  refreshToken: getEnvVar('OAUTH2_REFRESH_TOKEN', '', false),
  accessToken: getEnvVar('OAUTH2_ACCESS_TOKEN', '', false),
  user: getEnvVar('EMAIL_USER', '', false),
  from: getEnvVar('EMAIL_FROM', '', false),
  to: getEnvVar('EMAIL_TO', '', false),
  cc: getEnvVar('EMAIL_CC')
};

// Logger configuration
const logger = {
  level: getEnvVar('LOG_LEVEL', 'warn'), // Changed from 'info' to 'warn' to reduce logs
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  logFilePath: getEnvVar('LOG_FILE_PATH'),
  isProduction: getEnvVar('NODE_ENV') === 'production'
};

// GeoNames configuration
const geonames = {
  username: getEnvVar('GEONAMES_USERNAME', 'demo', false)
};

module.exports = {
  database,
  server,
  vtiger,
  email: {
    smtp: emailSmtp,
    oauth2: emailOauth2
  },
  logger,
  geonames
};
