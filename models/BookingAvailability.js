'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BookingAvailability extends Model {
    static associate(models) {
      // Booking availability belongs to a booking admin user
      BookingAvailability.belongsTo(models.User, {
        foreignKey: 'adminId',
        as: 'admin'
      });
    }

    /**
     * Heartbeat frissítése (Chrome extension hívja)
     */
    async updateHeartbeat() {
      this.lastHeartbeat = new Date();
      this.isOnline = true;
      await this.save();
      return this;
    }

    /**
     * Admin offline állapotba helyezése
     */
    async setOffline() {
      this.isOnline = false;
      await this.save();
      return this;
    }

    /**
     * Online booking adminok lekérése
     * Csak sales szerepkörű felhasználók (admin nem kap eszkalált chateket)
     */
    static async getOnlineAdmins() {
      const now = new Date();
      const autoAwayThreshold = new Date(now - (15 * 60 * 1000)); // 15 perc

      return await this.findAll({
        where: {
          isOnline: true,
          lastHeartbeat: {
            [sequelize.Sequelize.Op.gte]: autoAwayThreshold
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'name', 'email', 'role'],
            where: {
              role: 'sales' // Csak sales szerepkörű felhasználók
            }
          }
        ]
      });
    }

    /**
     * Elérhető booking adminok (online)
     */
    static async getAvailableAdmins() {
      return await this.getOnlineAdmins();
    }

    /**
     * Elavult heartbeat-ek tisztítása (CRON job hívja)
     */
    static async cleanupStaleAdmins() {
      const now = new Date();

      const admins = await this.findAll({
        where: {
          isOnline: true
        }
      });

      let cleanedCount = 0;
      for (const admin of admins) {
        const minutesSinceHeartbeat = Math.floor(
          (now - new Date(admin.lastHeartbeat)) / 1000 / 60
        );

        if (minutesSinceHeartbeat >= admin.autoAwayMinutes) {
          await admin.setOffline();
          cleanedCount += 1;
        }
      }

      return cleanedCount;
    }
  }

  BookingAvailability.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    lastHeartbeat: {
      type: DataTypes.DATE,
      allowNull: true
    },
    autoAwayMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
      comment: 'Auto offline after X minutes of inactivity'
    }
  }, {
    sequelize,
    modelName: 'BookingAvailability',
    tableName: 'booking_availability',
    underscored: false,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return BookingAvailability;
};
