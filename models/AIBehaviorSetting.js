/**
 * AIBehaviorSetting Model - AI asszisztens viselkedési szabályok
 * Design system: standard Sequelize model pattern (FaqCategory mintájára)
 */

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AIBehaviorSetting extends Model {
    static associate(_models) {
      // No associations for now
    }

    /**
     * Összes aktív beállítás lekérdezése kategóriánként csoportosítva
     */
    static async getAllByCategory() {
      const settings = await this.findAll({
        where: { isActive: true },
        order: [['displayOrder', 'ASC'], ['settingKey', 'ASC']]
      });

      // Define desired category order
      const categoryOrder = [
        'systemPrompt',
        'personality',
        'escalation',
        'prohibited',
        'responseStyle',
        'specialCases',
        'privacy',
        'salesGuidelines',
        'knowledgeBase'
      ];

      // Group by category
      const grouped = {};
      settings.forEach((setting) => {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }
        grouped[setting.category].push(setting);
      });

      // Return in desired order
      const ordered = {};
      categoryOrder.forEach((cat) => {
        if (grouped[cat]) {
          ordered[cat] = grouped[cat];
        }
      });

      // Add any remaining categories not in predefined order
      Object.keys(grouped).forEach((cat) => {
        if (!ordered[cat]) {
          ordered[cat] = grouped[cat];
        }
      });

      return ordered;
    }

    /**
     * Egy kategória összes beállítása
     */
    static async getByCategory(category) {
      return await this.findAll({
        where: {
          category,
          isActive: true
        },
        order: [['displayOrder', 'ASC'], ['settingKey', 'ASC']]
      });
    }

    /**
     * Egy konkrét beállítás értékének lekérése
     */
    static async getSetting(category, settingKey) {
      const setting = await this.findOne({
        where: {
          category,
          settingKey,
          isActive: true
        }
      });

      if (!setting) {
        return null;
      }

      return setting.getParsedValue();
    }

    /**
     * Beállítás értékének frissítése
     */
    static async updateSetting(category, settingKey, value) {
      const setting = await this.findOne({
        where: { category, settingKey }
      });

      if (!setting) {
        throw new Error(`Setting not found: ${category}.${settingKey}`);
      }

      // Convert value to string based on dataType BEFORE assigning
      let stringValue;
      if (setting.dataType === 'array' || setting.dataType === 'object') {
        stringValue = JSON.stringify(value);
      } else if (setting.dataType === 'boolean') {
        stringValue = value ? 'true' : 'false';
      } else if (setting.dataType === 'number') {
        stringValue = String(value);
      } else {
        stringValue = String(value);
      }

      // Use update() method to bypass validation
      await setting.update({ settingValue: stringValue }, { validate: false });

      return setting;
    }

    /**
     * Parse setting value based on dataType
     */
    getParsedValue() {
      switch (this.dataType) {
        case 'boolean':
          return this.settingValue === 'true';
        case 'number':
          return Number(this.settingValue);
        case 'array':
        case 'object':
          try {
            return JSON.parse(this.settingValue);
          } catch {
            return this.settingValue;
          }
        default:
          return this.settingValue;
      }
    }
  }

  AIBehaviorSetting.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A kategória kötelező' }
      }
    },
    settingKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A beállítás kulcs kötelező' }
      }
    },
    settingValue: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'Az érték kötelező' }
      }
    },
    dataType: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'array', 'object'),
      defaultValue: 'string'
    },
    label: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'AIBehaviorSetting',
    tableName: 'AIBehaviorSettings',
    timestamps: true
  });

  return AIBehaviorSetting;
};
