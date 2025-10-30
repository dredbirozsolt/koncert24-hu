/**
 * FaqItem Model - GYIK kérdések és válaszok
 */

'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FaqItem extends Model {
    static associate(models) {
      // FAQ item tartozik egy kategóriához
      FaqItem.belongsTo(models.FaqCategory, {
        foreignKey: 'categoryId',
        as: 'category'
      });
    }

    /**
     * Megtekintés számláló növelése
     */
    async incrementViewCount() {
      this.viewCount += 1;
      await this.save({ fields: ['viewCount'], silent: true });
    }

    /**
     * Legnépszerűbb kérdések
     */
    static async getMostViewed(limit = 10) {
      return await this.findAll({
        where: { isActive: true },
        order: [['viewCount', 'DESC']],
        limit,
        include: [{
          model: sequelize.models.FaqCategory,
          as: 'category',
          attributes: ['name', 'icon']
        }]
      });
    }

    /**
     * Keresés kérdés/válasz alapján
     */
    static async search(searchTerm) {
      const { Op } = require('sequelize');

      return await this.findAll({
        where: {
          isActive: true,
          [Op.or]: [
            { question: { [Op.like]: `%${searchTerm}%` } },
            { answer: { [Op.like]: `%${searchTerm}%` } }
          ]
        },
        include: [{
          model: sequelize.models.FaqCategory,
          as: 'category',
          where: { isActive: true }
        }],
        order: [['viewCount', 'DESC']]
      });
    }

    /**
     * FAQ Schema.org formátumra konvertálás
     */
    toSchemaFormat() {
      return {
        question: this.question,
        answer: this.answer
      };
    }

    /**
     * Összes aktív FAQ Schema formátumban
     */
    static async getAllForSchema() {
      const items = await this.findAll({
        where: { isActive: true },
        order: [['displayOrder', 'ASC']],
        attributes: ['question', 'answer']
      });

      return items.map((item) => item.toSchemaFormat());
    }
  }

  FaqItem.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    question: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A kérdés nem lehet üres' },
        len: {
          args: [10, 500],
          msg: 'A kérdés 10-500 karakter között lehet'
        }
      }
    },
    answer: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A válasz nem lehet üres' },
        len: {
          args: [20, 5000],
          msg: 'A válasz 20-5000 karakter között lehet'
        }
      }
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'FaqItem',
    tableName: 'FaqItems',
    timestamps: true
  });

  return FaqItem;
};
