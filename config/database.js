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
    timezone: '+01:00',
    // Retry logic for prepared statement errors
    retry: {
      max: 3,
      match: [
        /ER_NEED_REPREPARE/,
        /Prepared statement needs to be re-prepared/
      ]
    }
  }
);

module.exports = { sequelize, Sequelize };
