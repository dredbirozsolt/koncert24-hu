'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatSession extends Model {
    static associate(models) {
      // Chat session belongs to a user
      ChatSession.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      });

      // Chat session can be assigned to a sales person
      ChatSession.belongsTo(models.User, {
        foreignKey: 'assignedSalesId',
        as: 'assignedSales'
      });

      // Chat session has many messages
      ChatSession.hasMany(models.ChatMessage, {
        foreignKey: 'sessionId',
        as: 'messages'
      });
    }

    /**
     * Default scope: only active (non-deleted) sessions
     */
    static get defaultScope() {
      return {
        where: {
          deletedAt: null
        }
      };
    }

    /**
     * Lekéri az aktív chat sessionöket (deletedAt automatikusan szűrve)
     */
    static async getActiveSessions() {
      return await this.findAll({
        where: {
          status: ['active', 'escalated']
          // deletedAt: null automatikusan hozzáadva a defaultScope által
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'email']
          },
          {
            model: sequelize.models.User,
            as: 'assignedSales',
            attributes: ['id', 'name', 'email']
          },
          {
            model: sequelize.models.ChatMessage,
            as: 'messages',
            limit: 1,
            order: [['createdAt', 'DESC']]
          }
        ],
        order: [['updatedAt', 'DESC']]
      });
    }

    /**
     * Soft delete: Megjelöli töröltnek + anonimizálja
     */
    async softDelete(reason = 'admin') {
      this.deletedAt = new Date();
      this.deletionReason = reason;
      await this.anonymize();
      await this.save();
    }

    /**
     * Személyes adatok anonimizálása
     */
    async anonymize() {
      this.userName = null;
      this.userEmail = null;
      this.userPhone = null;
      this.anonymized = true;
      this.anonymizedAt = new Date();
      await this.save();
    }

    /**
     * Visszaállítás (restore) - csak ha van mentett adat
     */
    async restore() {
      if (!this.deletedAt) {
        throw new Error('Session is not deleted');
      }
      if (this.anonymized) {
        throw new Error('Cannot restore anonymized session');
      }
      this.deletedAt = null;
      this.deletionReason = null;
      await this.save();
    }

    /**
     * Eszkalálja a sessiont egy értékesítőhöz
     */
    async escalateToSales(salesId, reason) {
      this.status = 'escalated';
      this.escalatedToSales = true;
      this.escalationReason = reason;
      this.assignedSalesId = salesId;
      this.escalatedAt = new Date();
      await this.save();

      // Rendszer üzenet hozzáadása
      await sequelize.models.ChatMessage.create({
        sessionId: this.id,
        role: 'system',
        content: `Chat escalated to sales. Reason: ${reason}`
      });

      return this;
    }

    /**
     * Bezárja a sessiont
     */
    async closeSession() {
      this.status = 'closed';
      this.closedAt = new Date();
      await this.save();
      return this;
    }

    /**
     * Generál egy AI összefoglalót a beszélgetésről
     */
    async generateAISummary() {
      const messages = await this.getMessages({
        order: [['createdAt', 'ASC']]
      });

      // Egyszerű összefoglaló (később OpenAI-val lehet finomítani)
      const summary = `Chat session with ${this.userName || 'Guest'}\n`
        + `Duration: ${this.createdAt} - ${this.closedAt || 'ongoing'}\n`
        + `Messages: ${messages.length}\n`
        + `Status: ${this.status}`;

      this.aiSummary = summary;
      await this.save();
      return summary;
    }
  }

  ChatSession.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionToken: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    userName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    userEmail: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    userPhone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'escalated', 'resolved', 'closed', 'offline'),
      defaultValue: 'active'
    },
    escalatedToSales: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    assignedSalesId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    escalationReason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fallbackReason: {
      type: DataTypes.ENUM('ai_unavailable', 'no_admin_online', 'both_unavailable', 'ai_error'),
      allowNull: true
    },
    aiSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    escalatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Soft Delete fields
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    deletionReason: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null
    },
    // Anonymization fields
    anonymized: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    anonymizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    sequelize,
    modelName: 'ChatSession',
    tableName: 'chat_sessions',
    underscored: false,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return ChatSession;
};
