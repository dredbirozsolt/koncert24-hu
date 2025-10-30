require('dotenv').config();
const { database } = require('./environment');

module.exports = {
  development: {
    username: database.user,
    password: database.password,
    database: database.database,
    host: database.host,
    port: database.port,
    dialect: 'mysql',
    timezone: '+01:00',
    logging: console.log,
    migrationStorageTableName: 'SequelizeMeta'
  },
  test: {
    username: database.user,
    password: database.password,
    database: `${database.database}_test`,
    host: database.host,
    port: database.port,
    dialect: 'mysql',
    timezone: '+01:00',
    logging: false,
    migrationStorageTableName: 'SequelizeMeta'
  },
  production: {
    username: database.user,
    password: database.password,
    database: database.database,
    host: database.host,
    port: database.port,
    dialect: 'mysql',
    timezone: '+01:00',
    logging: false,
    migrationStorageTableName: 'SequelizeMeta',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};
