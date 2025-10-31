/**
 * Connection Rotation Service
 *
 * Periodikusan újraindítja a MySQL connection pool-t, hogy elkerüljük
 * a prepared statement cache túlcsordulást (ER_NEED_REPREPARE).
 *
 * Ez egy shared hosting megoldás, ahol nem tudjuk növelni a
 * max_prepared_stmt_count értékét a MySQL szerveren.
 */

const logger = require('../config/logger');

class ConnectionRotationService {
  constructor(sequelize, intervalMs = 3600000) { // Default: 1 óra
    this.sequelize = sequelize;
    this.intervalMs = intervalMs;
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Elindítja a connection rotation job-ot
   */
  start() {
    if (this.isRunning) {
      logger.warn('Connection rotation service már fut.');
      return;
    }

    logger.info(`Connection rotation service indítása ${this.intervalMs / 1000} másodperces intervallummal...`);
    
    this.intervalId = setInterval(async () => {
      await this.rotate();
    }, this.intervalMs);

    this.isRunning = true;
  }

  /**
   * Leállítja a connection rotation job-ot
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('Connection rotation service leállítva.');
    }
  }

  /**
   * Egyszer lefuttatja a connection rotation logikát
   */
  async rotate() {
    try {
      logger.info('Connection pool rotation indítása...');

      const { connectionManager } = this.sequelize;
      const { pool } = connectionManager;

      if (!pool) {
        logger.warn('Connection pool nem található, rotation kihagyása.');
        return;
      }

      // Statisztikák a rotation előtt
      const beforeStats = {
        size: pool.size,
        available: pool.available,
        using: pool.using,
        waiting: pool.waiting
      };

      logger.debug('Pool állapot rotation előtt:', beforeStats);

      // Lezárjuk az idle kapcsolatokat
      await connectionManager.drain();

      // Rövid várakozás
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Statisztikák a rotation után
      const afterStats = {
        size: pool.size,
        available: pool.available,
        using: pool.using,
        waiting: pool.waiting
      };

      logger.info('Connection pool rotation sikeres.', {
        before: beforeStats,
        after: afterStats
      });
    } catch (error) {
      logger.error('Hiba a connection pool rotation során:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Service állapot lekérdezése
   */
  getStatus() {
    const { connectionManager } = this.sequelize;
    const { pool } = connectionManager;

    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      pool: pool ? {
        size: pool.size,
        available: pool.available,
        using: pool.using,
        waiting: pool.waiting
      } : null
    };
  }
}

module.exports = ConnectionRotationService;
