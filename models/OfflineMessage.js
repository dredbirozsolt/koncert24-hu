'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OfflineMessage extends Model {
    static associate(models) {
      // Offline message can be linked to a chat session
      OfflineMessage.belongsTo(models.ChatSession, {
        foreignKey: 'sessionId',
        as: 'session'
      });

      // Admin who replied
      OfflineMessage.belongsTo(models.User, {
        foreignKey: 'repliedByAdminId',
        as: 'repliedBy'
      });
    }

    /**
     * Email küldés megjelölése
     */
    async markEmailSent() {
      this.emailSentAt = new Date();
      this.status = 'sent';
      await this.save();
      return this;
    }

    /**
     * Válasz megjelölése
     */
    async markReplied(adminId) {
      this.status = 'replied';
      this.repliedByAdminId = adminId;
      this.repliedAt = new Date();
      await this.save();
      return this;
    }

    /**
     * Archiválás
     */
    async archive() {
      this.status = 'archived';
      await this.save();
      return this;
    }

    /**
     * Függőben lévő és nemrég lezárt üzenetek lekérése
     * @param {number} retentionDays - Hány napig jelenítse meg a lezárt/elvett üzeneteket (alapértelmezett: 14)
     */
    static async getPendingMessages(retentionDays = 14) {
      const { Op } = require('sequelize');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      return await this.findAll({
        where: {
          [Op.or]: [
            // Aktív üzenetek (pending, sent)
            { status: ['pending', 'sent'] },
            // Lezárt üzenetek (replied) az utolsó X napból
            {
              status: 'replied',
              repliedAt: { [Op.gte]: cutoffDate }
            },
            // Elvett üzenetek (archived) az utolsó X napból
            {
              status: 'archived',
              updatedAt: { [Op.gte]: cutoffDate }
            }
          ]
        },
        order: [
          // Aktívak előre, lezártak/elvettek hátra
          [sequelize.literal("CASE WHEN status IN ('pending', 'sent') THEN 0 ELSE 1 END"), 'ASC'],
          ['createdAt', 'DESC']
        ],
        include: [
          {
            model: sequelize.models.User,
            as: 'repliedBy',
            attributes: ['id', 'name', 'email']
          }
        ]
      });
    }

    /**
     * Elküldetlen üzenetek lekérése (email küldéshez)
     */
    static async getUnsentMessages() {
      return await this.findAll({
        where: {
          status: 'pending',
          emailSentAt: null
        },
        order: [['createdAt', 'ASC']]
      });
    }
  }

  OfflineMessage.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'chat_sessions',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'replied', 'archived'),
      defaultValue: 'pending'
    },
    emailSentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    repliedByAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    repliedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'OfflineMessage',
    tableName: 'offline_messages',
    underscored: false,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return OfflineMessage;
};
