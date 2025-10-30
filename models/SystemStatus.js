'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SystemStatus extends Model {
    static associate(_models) {
      // No associations needed
    }

    /**
     * Szolgáltatás állapotának frissítése
     */
    async updateStatus(isAvailable, errorMessage = null) {
      this.isAvailable = isAvailable;
      this.lastCheckAt = new Date();
      this.errorMessage = errorMessage;
      await this.save();
      return this;
    }

    /**
     * AI szolgáltatás állapotának ellenőrzése
     */
    static async checkAIStatus() {
      let status = await this.findOne({
        where: { serviceName: 'ai' }
      });

      if (!status) {
        status = await this.create({
          serviceName: 'ai',
          isAvailable: false,
          lastCheckAt: new Date()
        });
      }

      return status;
    }

    /**
     * Admin chat szolgáltatás állapotának ellenőrzése
     */
    static async checkAdminChatStatus() {
      let status = await this.findOne({
        where: { serviceName: 'admin_chat' }
      });

      if (!status) {
        status = await this.create({
          serviceName: 'admin_chat',
          isAvailable: true,
          lastCheckAt: new Date()
        });
      }

      return status;
    }

    /**
     * Rendszer állapotának ellenőrzése
     */
    static async checkSystemStatus() {
      let status = await this.findOne({
        where: { serviceName: 'system' }
      });

      if (!status) {
        status = await this.create({
          serviceName: 'system',
          isAvailable: true,
          lastCheckAt: new Date()
        });
      }

      return status;
    }

    /**
     * Teljes rendszer állapot lekérése
     */
    static async getOverallStatus() {
      const [aiStatus, adminChatStatus, systemStatus] = await Promise.all([
        this.checkAIStatus(),
        this.checkAdminChatStatus(),
        this.checkSystemStatus()
      ]);

      return {
        ai: {
          available: aiStatus.isAvailable,
          lastCheck: aiStatus.lastCheckAt,
          error: aiStatus.errorMessage
        },
        adminChat: {
          available: adminChatStatus.isAvailable,
          lastCheck: adminChatStatus.lastCheckAt,
          error: adminChatStatus.errorMessage
        },
        system: {
          available: systemStatus.isAvailable,
          lastCheck: systemStatus.lastCheckAt,
          error: systemStatus.errorMessage
        }
      };
    }

    /**
     * AI szolgáltatás engedélyezése/tiltása manuálisan
     */
    static async toggleAI(enabled) {
      const status = await this.checkAIStatus();
      await status.updateStatus(enabled, enabled ? null : 'Manually disabled');
      return status;
    }

    /**
     * Admin chat szolgáltatás engedélyezése/tiltása manuálisan
     */
    static async toggleAdminChat(enabled) {
      const status = await this.checkAdminChatStatus();
      await status.updateStatus(enabled, enabled ? null : 'Manually disabled');
      return status;
    }
  }

  SystemStatus.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    serviceName: {
      type: DataTypes.ENUM('ai', 'admin_chat', 'system'),
      allowNull: false,
      unique: true
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastCheckAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SystemStatus',
    tableName: 'system_status',
    underscored: false,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return SystemStatus;
};
