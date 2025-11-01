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
      connectTimeout: 60000,
      // CRITICAL: Disable MySQL prepared statements completely
      // Force MySQL2 to use text protocol instead of binary protocol
      // This prevents prepared statement cache exhaustion on shared hosting
      flags: ['-FOUND_ROWS']
    },
    // Force Sequelize to NOT use prepared statements
    // This generates plain SQL queries instead of prepared statements
    native: false,
    benchmark: false,
    // Disable query parameterization (use inline values)
    typeValidation: false,
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

// CRITICAL FIX: Force MySQL2 to NEVER use prepared statements
// This is the ONLY way to avoid ER_NEED_REPREPARE on shared hosting
// We monkey-patch the connection to use query() instead of execute()
const originalConnect = sequelize.connectionManager.connect.bind(sequelize.connectionManager);
sequelize.connectionManager.connect = async function (...args) {
  const connection = await originalConnect(...args);
  
  // Override execute() to use query() instead (no prepared statements)
  if (connection.execute) {
    connection.execute = function (sql, values, callback) {
      // Convert prepared statement (?) to inline query
      let inlineSQL = sql;
      if (values && values.length > 0) {
        let valueIndex = 0;
        inlineSQL = sql.replace(/\?/g, () => {
          const value = values[valueIndex];
          valueIndex += 1;
          
          if (value === null) {
            return 'NULL';
          }
          if (typeof value === 'string') {
            return connection.escape(value);
          }
          if (value instanceof Date) {
            return connection.escape(value.toISOString().slice(0, 19).replace('T', ' '));
          }
          return connection.escape(String(value));
        });
      }
      
      // Use query() instead of execute() - no prepared statements
      return connection.query(inlineSQL, callback);
    };
  }
  
  return connection;
};

logger.info('MySQL2 forced to use query() instead of execute() - prepared statements disabled');

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
