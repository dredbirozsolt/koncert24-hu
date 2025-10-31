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
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    timezone: '+01:00'
  }
);

// Global retry logic for MySQL prepared statement errors
const originalQuery = sequelize.query.bind(sequelize);
sequelize.query = async function queryWithRetry(...args) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await originalQuery(...args);
    } catch (error) {
      lastError = error;
      
      // Retry on prepared statement errors
      if (error.original?.code === 'ER_NEED_REPREPARE' && attempt < maxRetries) {
        logger.warn({
          service: 'database',
          operation: 'query',
          attempt,
          maxRetries,
          error: error.message,
          msg: 'Retrying query due to prepared statement error'
        });
        
        // Wait before retry
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
