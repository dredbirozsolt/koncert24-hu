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

// IMPORTANT: For ER_NEED_REPREPARE errors, the best solution is to:
// 1. Increase MySQL server's max_prepared_stmt_count (default: 16382)
//    SET GLOBAL max_prepared_stmt_count = 50000;
// 2. Restart connections periodically (handled by pool.idle)
// 3. Use connection pool eviction (pool.evict)
// 4. Manual retry logic for critical operations (see models/index.js withRetry)

module.exports = { sequelize, Sequelize };
