/**
 * FaqCategory Model - GYIK kategóriák
 */

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FaqCategory extends Model {
    static associate(models) {
      // Egy kategóriának több FAQ item-je van
      FaqCategory.hasMany(models.FaqItem, {
        foreignKey: 'categoryId',
        as: 'items'
      });
    }

    /**
     * Aktív kategóriák lekérdezése sorrendben
     */
    static async getActiveCategories() {
      return await this.findAll({
        where: { isActive: true },
        order: [['displayOrder', 'ASC'], ['name', 'ASC']],
        include: [{
          model: sequelize.models.FaqItem,
          as: 'items',
          where: { isActive: true },
          required: false,
          order: [['displayOrder', 'ASC']]
        }]
      });
    }

    /**
     * Kategória és item-jei lekérdezése
     */
    async getItemsWithCount() {
      const items = await sequelize.models.FaqItem.findAll({
        where: {
          categoryId: this.id,
          isActive: true
        },
        order: [['displayOrder', 'ASC']]
      });

      return {
        category: this,
        items,
        itemCount: items.length
      };
    }
  }

  FaqCategory.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'A kategória neve kötelező' }
      }
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'FaqCategory',
    tableName: 'FaqCategories',
    timestamps: true
  });

  return FaqCategory;
};
