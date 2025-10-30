/**
 * BlogCategory Model
 */

'use strict';

const { Model } = require('sequelize');
const { generateSlug } = require('../utils/slugHelper');

module.exports = (sequelize, DataTypes) => {
  class BlogCategory extends Model {
    static associate(models) {
      // Cikkek kapcsolat
      BlogCategory.hasMany(models.BlogPost, {
        foreignKey: 'categoryId',
        as: 'posts'
      });

      // Hierarchia - szülő kategória
      BlogCategory.belongsTo(models.BlogCategory, {
        foreignKey: 'parentId',
        as: 'parent'
      });

      // Hierarchia - gyermek kategóriák
      BlogCategory.hasMany(models.BlogCategory, {
        foreignKey: 'parentId',
        as: 'children'
      });
    }

    /**
     * Cikkek számának lekérdezése
     */
    async getPostCount() {
      return await sequelize.models.BlogPost.count({
        where: {
          categoryId: this.id,
          status: 'published'
        }
      });
    }

    /**
     * Teljes útvonal generálás hierarchiában
     */
    async getFullPath() {
      const path = [this.slug];
      let current = this;

      while (current.parentId) {
        current = await BlogCategory.findByPk(current.parentId);
        if (current) {
          path.unshift(current.slug);
        }
      }

      return path.join('/');
    }
  }

  BlogCategory.init({
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
        notEmpty: { msg: 'A kategória neve nem lehet üres' }
      }
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metaTitle: {
      type: DataTypes.STRING(70),
      allowNull: true
    },
    metaDescription: {
      type: DataTypes.STRING(160),
      allowNull: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'BlogCategory',
    tableName: 'BlogCategories',
    timestamps: true,
    hooks: {
      beforeCreate: (category) => {
        if (!category.slug) {
          category.slug = generateSlug(category.name);
        }
        if (!category.metaTitle) {
          category.metaTitle = category.name;
        }
      },
      beforeUpdate: (category) => {
        if (category.changed('name') && !category.changed('slug')) {
          category.slug = generateSlug(category.name);
        }
      }
    }
  });

  return BlogCategory;
};
