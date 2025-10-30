/**
 * BlogTag Model
 */

'use strict';

const { Model } = require('sequelize');
const { generateSlug } = require('../utils/slugHelper');

module.exports = (sequelize, DataTypes) => {
  class BlogTag extends Model {
    static associate(models) {
      // Cikkek kapcsolat (many-to-many)
      BlogTag.belongsToMany(models.BlogPost, {
        through: 'PostTags',
        foreignKey: 'tagId',
        otherKey: 'postId',
        as: 'posts'
      });
    }

    /**
     * Tag használat számának lekérdezése
     */
    async getUsageCount() {
      const { sequelize: seq } = this.constructor;
      return await seq.models.PostTags.count({
        where: { tagId: this.id }
      });
    }

    /**
     * Népszerű tagek lekérdezése
     */
    static async getPopularTags(limit = 20) {
      const { sequelize: seq } = this;

      // Egyszerű SQL query a many-to-many kapcsolat miatt
      const [tags] = await seq.query(`
        SELECT 
          bt.id,
          bt.name,
          bt.slug,
          COUNT(DISTINCT bp.id) as postCount
        FROM BlogTags bt
        INNER JOIN PostTags pt ON bt.id = pt.tagId
        INNER JOIN BlogPosts bp ON pt.postId = bp.id
        WHERE bp.status = 'published'
        GROUP BY bt.id, bt.name, bt.slug
        ORDER BY postCount DESC
        LIMIT :limit
      `, {
        replacements: { limit },
        type: seq.QueryTypes.SELECT
      });

      return tags;
    }
  }

  BlogTag.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: 'A tag neve nem lehet üres' }
      }
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    }
  }, {
    sequelize,
    modelName: 'BlogTag',
    tableName: 'BlogTags',
    timestamps: true,
    hooks: {
      beforeCreate: (tag) => {
        if (!tag.slug) {
          tag.slug = generateSlug(tag.name);
        }
      }
    }
  });

  return BlogTag;
};
