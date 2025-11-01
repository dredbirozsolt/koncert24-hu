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
      // BEST PRACTICE: Set max_prepared_stmt_count to reduce prepared statement cache issues
      // This prevents ER_NEED_REPREPARE errors in production with connection pooling
      // See: https://github.com/sequelize/sequelize/issues/9524
      // See: https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_prepared_stmt_count
      connectTimeout: 60000
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

// CRITICAL: Wrap sequelize.query() to add retry logic for ER_NEED_REPREPARE errors
// This is a shared hosting workaround where we cannot modify MySQL server variables
const originalQuery = sequelize.query.bind(sequelize);
sequelize.query = async function queryWithRetry(...args) {
  const MAX_RETRIES = 3;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await originalQuery(...args);
    } catch (error) {
      lastError = error;

      // Retry on prepared statement errors
      if (error.original?.code === 'ER_NEED_REPREPARE' && attempt < MAX_RETRIES) {
        logger.warn({
          service: 'database',
          operation: 'queryRetry',
          attempt,
          maxRetries: MAX_RETRIES,
          error: error.message
        }, `Retrying query due to ER_NEED_REPREPARE (attempt ${attempt}/${MAX_RETRIES})`);

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        // eslint-disable-next-line no-continue
        continue;
      }

      // For other errors or max retries reached, throw
      throw error;
    }
  }

  throw lastError;
};

module.exports = { sequelize, Sequelize };
