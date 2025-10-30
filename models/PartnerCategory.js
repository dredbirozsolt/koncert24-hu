'use strict';

const { Model } = require('sequelize');
const { generateSlug } = require('../utils/slugHelper');

module.exports = (sequelize, DataTypes) => {
  class PartnerCategory extends Model {
    static associate(models) {
      // Partner kapcsolat
      PartnerCategory.hasMany(models.Partner, {
        foreignKey: 'categoryId',
        as: 'partners'
      });
    }

    // Partner szám lekérése
    async getPartnerCount() {
      const { Partner } = sequelize.models;
      return await Partner.count({
        where: { categoryId: this.id }
      });
    }

    // Aktív partnerek száma
    async getActivePartnerCount() {
      const { Partner } = sequelize.models;
      return await Partner.count({
        where: {
          categoryId: this.id,
          status: 'active'
        }
      });
    }
  }

  PartnerCategory.init({
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
        notEmpty: { msg: 'A kategória neve kötelező' },
        len: {
          args: [2, 100],
          msg: 'A név 2-100 karakter között legyen'
        }
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'A slug kötelező' },
        is: {
          args: /^[a-z0-9-]+$/,
          msg: 'A slug csak kisbetűket, számokat és kötőjelet tartalmazhat'
        }
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: {
          args: { min: 0 },
          msg: 'A sorrend nem lehet negatív'
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    metaTitle: {
      type: DataTypes.STRING(70),
      allowNull: true,
      validate: {
        len: {
          args: [0, 70],
          msg: 'A meta cím maximum 70 karakter lehet'
        }
      }
    },
    metaDescription: {
      type: DataTypes.STRING(165),
      allowNull: true,
      validate: {
        len: {
          args: [0, 165],
          msg: 'A meta leírás maximum 165 karakter lehet'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'PartnerCategory',
    tableName: 'partner_categories',
    timestamps: true,
    hooks: {
      beforeCreate: (category) => {
        // Automatikus slug generálás ha nincs megadva
        if (!category.slug && category.name) {
          category.slug = generateSlug(category.name);
        }
      },
      beforeUpdate: (category) => {
        // Slug frissítése ha a név változik
        if (category.changed('name') && !category.changed('slug')) {
          category.slug = generateSlug(category.name);
        }
      }
    }
  });

  return PartnerCategory;
};
