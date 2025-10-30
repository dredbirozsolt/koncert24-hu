'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatMessage extends Model {
    static associate(models) {
      // Message belongs to a chat session
      ChatMessage.belongsTo(models.ChatSession, {
        foreignKey: 'sessionId',
        as: 'session'
      });

      // Message can be sent by a booking admin
      ChatMessage.belongsTo(models.User, {
        foreignKey: 'adminId',
        as: 'admin'
      });
    }

    /**
     * Megjelöli az üzenetet olvasottként
     */
    async markAsRead() {
      if (!this.isRead) {
        this.isRead = true;
        this.readAt = new Date();
        await this.save();
      }
      return this;
    }

    /**
     * Lekéri az olvasatlan üzenetek számát egy sessionben
     */
    static async getUnreadCount(sessionId, role = null) {
      const where = {
        sessionId,
        isRead: false
      };

      if (role) {
        where.role = role;
      }

      return await this.count({ where });
    }

    /**
     * Megjelöli az összes üzenetet olvasottként egy sessionben
     */
    static async markAllAsRead(sessionId, role = null) {
      const where = {
        sessionId,
        isRead: false
      };

      if (role) {
        where.role = role;
      }

      await this.update(
        {
          isRead: true,
          readAt: new Date()
        },
        { where }
      );
    }
  }

  ChatMessage.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chat_sessions',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'admin', 'system'),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'AI token usage, model info, etc.'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ChatMessage',
    tableName: 'chat_messages',
    underscored: false,
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return ChatMessage;
};
