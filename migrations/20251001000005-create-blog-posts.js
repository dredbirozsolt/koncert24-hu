/**
 * Migration: Blog Posts tábla létrehozása
 * SEO-optimalizált blog rendszerhez
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BlogPosts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Cikk címe (SEO optimalizált)'
      },
      slug: {
        type: Sequelize.STRING(250),
        allowNull: false,
        unique: true,
        comment: 'URL-barát slug'
      },
      excerpt: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Rövid összefoglaló (meta description)'
      },
      content: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
        comment: 'Cikk teljes tartalma (HTML)'
      },
      featuredImage: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Kiemelt kép URL'
      },
      featuredImageAlt: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Kiemelt kép alt szöveg (SEO)'
      },
      authorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      categoryId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'BlogCategories',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      status: {
        type: Sequelize.ENUM('draft', 'published', 'archived'),
        defaultValue: 'draft',
        allowNull: false
      },
      publishedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Publikálás időpontja'
      },
      metaTitle: {
        type: Sequelize.STRING(70),
        allowNull: true,
        comment: 'SEO meta title (max 60-70 karakter)'
      },
      metaDescription: {
        type: Sequelize.STRING(160),
        allowNull: true,
        comment: 'SEO meta description (max 155-160 karakter)'
      },
      metaKeywords: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'SEO kulcsszavak (vesszővel elválasztva)'
      },
      focusKeyword: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Fő kulcsszó SEO optimalizáláshoz'
      },
      canonicalUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Canonical URL (duplicate content elkerülése)'
      },
      noindex: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Robots noindex direktíva'
      },
      nofollow: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Robots nofollow direktíva'
      },
      viewCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Megtekintések száma'
      },
      readingTime: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Becsült olvasási idő percben'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Indexek SEO optimalizáláshoz
    await queryInterface.addIndex('BlogPosts', ['slug'], {
      name: 'idx_blog_posts_slug',
      unique: true
    });

    await queryInterface.addIndex('BlogPosts', ['status', 'publishedAt'], {
      name: 'idx_blog_posts_status_published'
    });

    await queryInterface.addIndex('BlogPosts', ['authorId'], {
      name: 'idx_blog_posts_author'
    });

    await queryInterface.addIndex('BlogPosts', ['categoryId'], {
      name: 'idx_blog_posts_category'
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.dropTable('BlogPosts');
  }
};
