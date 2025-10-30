const pino = require('pino');
const path = require('path');
const rfs = require('rotating-file-stream');

// ============================================
// LOGGER CONFIGURATION - ENVIRONMENT VARIABLES
// ============================================
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

// Logging configuration from environment (Industry Best Practice)
// Small traffic defaults (low volume application)
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '50M';              // 50MB per file
const LOG_ROTATION_INTERVAL = process.env.LOG_ROTATION_INTERVAL || '1d';  // Daily rotation
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '14', 10);  // 14 days retention
const LOG_COMPRESS = process.env.LOG_COMPRESS === 'true';            // No compression (easier to read)

// Logs directory path
const logsDir = path.join(__dirname, '..', 'logs');

// Generate log filename with date (always starting from index 1)
function generateLogFilename(time, index) {
  // Always use current date for log filename
  const date = time || new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Always use index starting from 1 (default to 1 if not provided)
  const fileIndex = index || 1;

  return `app-${year}-${month}-${day}-${fileIndex}.log`;
}

// Create rotating log stream for production
function createLogStream() {
  return rfs.createStream(generateLogFilename, {
    interval: LOG_ROTATION_INTERVAL,    // From env: daily rotation (1d)
    maxFiles: LOG_RETENTION_DAYS,       // From env: 14 days retention
    compress: LOG_COMPRESS,             // From env: no compression (false)
    path: logsDir,
    size: LOG_MAX_SIZE,                 // From env: 50MB max file size
    initialRotation: true               // Use generated filename immediately
  });
}

// Logger configuration for development and production
const loggerConfig = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime
};

// In development, use pretty printing to console only
// In production, log to file with rotation
if (isProduction) {
  console.log('🔴 LOGGER: Production mode - logging to file');
  const logStream = createLogStream();
  module.exports = pino(loggerConfig, logStream);
} else {
  console.log('🟢 LOGGER: Development mode - pretty print to console');
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  };
  module.exports = pino(loggerConfig);
}
