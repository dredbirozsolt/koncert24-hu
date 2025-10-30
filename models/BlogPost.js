/**
 * BlogPost Model - SEO-optimalizált blog cikkek
 */

'use strict';

const { Model } = require('sequelize');
const { generateSlug } = require('../utils/slugHelper');

module.exports = (sequelize, DataTypes) => {
  class BlogPost extends Model {
    static associate(models) {
      // Szerző kapcsolat
      BlogPost.belongsTo(models.User, {
        foreignKey: 'authorId',
        as: 'author'
      });

      // Kategória kapcsolat
      BlogPost.belongsTo(models.BlogCategory, {
        foreignKey: 'categoryId',
        as: 'category'
      });

      // Tagek kapcsolat (many-to-many)
      BlogPost.belongsToMany(models.BlogTag, {
        through: 'PostTags',
        foreignKey: 'postId',
        otherKey: 'tagId',
        as: 'tags'
      });
    }

    /**
     * Olvasási idő számítás (átlagos olvasási sebesség: 200 szó/perc)
     */
    calculateReadingTime() {
      if (!this.content) {return 0;}

      const plainText = this.content.replace(/<[^>]*>/g, '');
      const wordCount = plainText.split(/\s+/).length;
      return Math.ceil(wordCount / 200);
    }

    /**
     * Meta adatok automatikus generálása
     */
    generateSEOMetadata() {
      // Meta title generálás
      if (!this.metaTitle) {
        this.metaTitle = this.title.substring(0, 60);
      }

      // Meta description generálás
      if (!this.metaDescription) {
        // Egyszerű meta description generálás
        const plainText = (this.excerpt || this.content)
          .replace(/<[^>]*>/g, '')
          .trim();
        this.metaDescription = plainText.substring(0, 155);
      }

      // Olvasási idő számítás
      this.readingTime = this.calculateReadingTime();

      // Slug generálás
      if (!this.slug) {
        this.slug = generateSlug(this.title);
      }

      // Canonical URL automatikus generálás
      if (!this.canonicalUrl && this.slug) {
        this.canonicalUrl = `https://koncert24.hu/blog/${this.slug}`;
      }

      // Featured image alt generálás
      if (this.featuredImage && !this.featuredImageAlt) {
        this.featuredImageAlt = `${this.title} featured image`;
      }
    }

    /**
     * Publikálás
     */
    async publish() {
      this.status = 'published';
      this.publishedAt = new Date();
      await this.save();
    }

    /**
     * Időzített cikkek automatikus publikálása
     */
    static async publishScheduledPosts() {
      const { Op } = require('sequelize');

      const scheduledPosts = await this.findAll({
        where: {
          status: 'scheduled',
          publishedAt: {
            [Op.lte]: new Date()
          }
        }
      });

      const published = [];
      for (const post of scheduledPosts) {
        await post.publish();
        published.push({
          id: post.id,
          title: post.title,
          publishedAt: post.publishedAt
        });
      }

      return published;
    }

    /**
     * Megtekintés növelés
     */
    async incrementViews() {
      this.viewCount += 1;
      await this.save({ fields: ['viewCount'], silent: true });
    }

    /**
     * JSON-LD structured data generálás
     */
    generateStructuredData() {
      return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: this.title,
        description: this.metaDescription || this.excerpt,
        image: this.featuredImage,
        datePublished: this.publishedAt,
        dateModified: this.updatedAt,
        author: {
          '@type': 'Person',
          name: this.author ? this.author.name : ''
        },
        publisher: {
          '@type': 'Organization',
          name: '',
          logo: {
            '@type': 'ImageObject',
            url: ''
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `https://koncert24.hu/blog/${this.slug}`
        }
      };
    }

    /**
     * Kapcsolódó cikkek lekérdezése
     */
    static async getRelatedPosts(postId, categoryId, limit = 3) {
      const { Op } = require('sequelize');

      return await this.findAll({
        where: {
          id: { [Op.ne]: postId },
          categoryId,
          status: 'published'
        },
        limit,
        order: [['publishedAt', 'DESC']],
        include: [
          { model: this.sequelize.models.User, as: 'author', attributes: ['name'] },
          { model: this.sequelize.models.BlogCategory, as: 'category', attributes: ['name', 'slug'] }
        ]
      });
    }

    /**
     * Népszerű cikkek lekérdezése
     */
    static async getPopularPosts(limit = 5) {
      return await this.findAll({
        where: { status: 'published' },
        limit,
        order: [['viewCount', 'DESC']],
        include: [
          { model: this.sequelize.models.User, as: 'author', attributes: ['name'] },
          { model: this.sequelize.models.BlogCategory, as: 'category', attributes: ['name', 'slug'] }
        ]
      });
    }

    /**
     * Legújabb cikkek lekérdezése
     */
    static async getRecentPosts(limit = 5) {
      return await this.findAll({
        where: { status: 'published' },
        limit,
        order: [['publishedAt', 'DESC']],
        include: [
          { model: this.sequelize.models.User, as: 'author', attributes: ['name'] },
          { model: this.sequelize.models.BlogCategory, as: 'category', attributes: ['name', 'slug'] }
        ]
      });
    }

    /**
     * Archívum lekérdezése (év/hónap bontásban)
     * @returns {Promise<Array>} - [ { year, month, count, label } ]
     */
    static async getArchive() {
      const { QueryTypes } = require('sequelize');

      const results = await this.sequelize.query(`
        SELECT 
          YEAR(publishedAt) as year,
          MONTH(publishedAt) as month,
          COUNT(*) as count
        FROM BlogPosts
        WHERE status = 'published'
        GROUP BY YEAR(publishedAt), MONTH(publishedAt)
        ORDER BY year DESC, month DESC
        LIMIT 12
      `, { type: QueryTypes.SELECT });

      // Magyar hónap nevek
      const monthNames = [
        'január', 'február', 'március', 'április', 'május', 'június',
        'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
      ];

      return results.map((row) => ({
        year: row.year,
        month: row.month,
        count: row.count,
        label: `${row.year} ${monthNames[row.month - 1]}`
      }));
    }
  }

  BlogPost.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A cím nem lehet üres' },
        len: {
          args: [10, 200],
          msg: 'A cím 10-200 karakter között lehet'
        }
      }
    },
    slug: {
      type: DataTypes.STRING(250),
      allowNull: false,
      unique: true
    },
    excerpt: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A tartalom nem lehet üres' }
      }
    },
    featuredImage: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    featuredImageAlt: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived', 'scheduled'),
      defaultValue: 'draft'
    },
    publishedAt: {
      type: DataTypes.DATE,
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
    metaKeywords: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    focusKeyword: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    canonicalUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    noindex: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    nofollow: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    readingTime: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Kiemelt cikk a blog főoldalon'
    }
  }, {
    sequelize,
    modelName: 'BlogPost',
    tableName: 'BlogPosts',
    timestamps: true,
    hooks: {
      beforeCreate: async (post) => {
        await post.generateSEOMetadata();
      },
      beforeUpdate: async (post) => {
        // Ha cím, tartalom vagy kép változott, regeneráljuk a metadata-t
        if (post.changed('title') || post.changed('content') || post.changed('featuredImage')) {
          await post.generateSEOMetadata();
        }
      }
    }
  });

  return BlogPost;
};
