const { Sequelize } = require('sequelize');
const logger = require('./logger');
const { database } = require('./environment');

const sequelize = new Sequelize(
  database.database,
  database.user,
  database.password,
  {
    host: database.host,
    port: database.port,
    dialect: 'mysql',
    logging: (msg) => logger.debug(msg),
    dialectOptions: {
      // CRITICAL: Disable prepared statements for shared hosting
      // MySQL shared hosting has limited prepared statement cache (max_prepared_stmt_count)
      // This prevents ER_NEED_REPREPARE errors completely by not using prepared statements at all
      connectTimeout: 60000
    },
    // Disable query queueing and use plain SQL queries (no prepared statements)
    native: false,
    benchmark: false,
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    pool: {
      max: 2,           // REDUCED from 5 to 2 for shared hosting (fewer prepared statements)
      min: 0,
      acquire: 30000,
      idle: 5000,       // REDUCED from 10000 to 5000 (faster connection recycling)
      evict: 3000       // ADDED: Check for idle connections every 3 seconds
    },
    timezone: '+01:00'
  }
);

// Helper function to drain connection pool
async function drainConnectionPool() {
  try {
    const { connectionManager } = sequelize;
    await connectionManager.drain();
    logger.info('Drained connection pool to clear prepared statements');
  } catch (drainError) {
    logger.warn('Failed to drain connection pool:', drainError.message);
  }
}

// CRITICAL: Wrap sequelize.query() to add retry logic for ER_NEED_REPREPARE errors
// This is a shared hosting workaround where we cannot modify MySQL server variables
const originalQuery = sequelize.query.bind(sequelize);
sequelize.query = async function queryWithRetry(...args) {
  const MAX_RETRIES = 10;  // Increased from 3 to 10 for severe prepared statement issues
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await originalQuery(...args);
    } catch (error) {
      lastError = error;

      // Retry on prepared statement errors
      const shouldRetry = error.original?.code === 'ER_NEED_REPREPARE' && attempt < MAX_RETRIES;
      if (!shouldRetry) {
        throw error;
      }

      logger.warn({
        service: 'database',
        operation: 'queryRetry',
        attempt,
        maxRetries: MAX_RETRIES,
        error: error.message
      }, `Retrying query due to ER_NEED_REPREPARE (attempt ${attempt}/${MAX_RETRIES})`);

      // On 3rd+ retry, try to clear prepared statements by reconnecting
      if (attempt >= 3) {
        await drainConnectionPool();
      }

      // Exponential backoff with cap at 1000ms
      const backoffMs = Math.min(100 * attempt, 1000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
};

module.exports = { sequelize, Sequelize };
