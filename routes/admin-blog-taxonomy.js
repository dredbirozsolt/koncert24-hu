/**
 * Admin Blog Taxonomy Routes - Kategóriák és címkék kezelése
 * Sub-router for blog categories and tags management
 */

const express = require('express');
const router = express.Router();
const { BlogPost, BlogCategory, BlogTag } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/advancedSecurity');
const logger = require('../config/logger');

// Constants
const CONTENT_TYPE_HEADER = 'content-type';
const MIME_TYPE_JSON = 'application/json';
const LAYOUT_ADMIN = 'layouts/admin';
const ROUTE_BLOG_CATEGORIES = '/admin/blog/categories';
const ROUTE_CATEGORIES = '/categories';
const ERROR_CATEGORY_NOT_FOUND = 'Kategória+nem+található';
const ERROR_CATEGORY_HAS_POSTS = 'A+kategória+nem+törölhető,+mert+vannak+hozzárendelt+bejegyzések';
const MSG_CATEGORY_CREATED = 'Kategória sikeresen létrehozva!';
const MSG_CATEGORY_UPDATED = 'Kategória sikeresen frissítve!';

/**
 * Helper: Generate slug from Hungarian text
 */
function generateSlugFromText(text) {
  return text.toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íî]/g, 'i')
    .replace(/[óöő]/g, 'o')
    .replace(/[úüű]/g, 'u')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Check if request is JSON
 */
function isJsonRequest(req) {
  return req.headers[CONTENT_TYPE_HEADER] && req.headers[CONTENT_TYPE_HEADER].includes(MIME_TYPE_JSON);
}

/**
 * GET /admin/blog/categories - Blog kategóriák listája
 */
router.get(ROUTE_CATEGORIES, requireAuth, async (req, res) => {
  try {
    const categories = await BlogCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      include: [{
        model: BlogPost,
        as: 'posts',
        attributes: ['id']
      }]
    });

    res.render('admin/blog/categories', {
      layout: LAYOUT_ADMIN,
      title: 'Blog Kategóriák',
      currentPath: req.path,
      categories,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    logger.error('Error loading blog categories:', error);
    res.status(500).send('Hiba történt a kategóriák betöltése során');
  }
});

/**
 * GET /admin/blog/categories/new - Új kategória létrehozása
 */
router.get('/categories/new', requireAuth, (req, res) => {
  res.render('admin/blog/edit-category', {
    layout: LAYOUT_ADMIN,
    title: 'Új kategória létrehozása',
    currentPath: req.path,
    category: null,
    isEdit: false
  });
});

/**
 * GET /admin/blog/categories/:id/edit - Kategória szerkesztése
 */
router.get('/categories/:id/edit', requireAuth, async (req, res) => {
  try {
    const category = await BlogCategory.findByPk(req.params.id, {
      include: [{
        model: BlogPost,
        as: 'posts',
        attributes: ['id', 'title', 'slug']
      }]
    });

    if (!category) {
      return res.redirect(`${ROUTE_BLOG_CATEGORIES}?error=${ERROR_CATEGORY_NOT_FOUND}`);
    }

    res.render('admin/blog/edit-category', {
      layout: LAYOUT_ADMIN,
      title: 'Kategória szerkesztése',
      currentPath: req.path,
      category,
      isEdit: true
    });
  } catch (error) {
    logger.error('Error loading blog category:', error);
    res.status(500).send('Hiba történt a kategória betöltése során');
  }
});

/**
 * POST /admin/blog/categories - Új kategória létrehozása
 * MOVED HERE to prevent conflict with POST /:id route
 */
router.post(ROUTE_CATEGORIES, requireAuth, csrfProtection, async (req, res) => {
  try {
    const { name, slug, description, metaTitle, metaDescription, displayOrder } = req.body;

    const category = await BlogCategory.create({
      name,
      slug,
      description,
      metaTitle,
      metaDescription,
      displayOrder: displayOrder || 0
    });

    logger.info({
      service: 'adminBlog',
      operation: 'createCategory',
      categoryName: name,
      categoryId: category.id,
      userId: req.session.userId
    }, 'Blog category created');

    // Handle JSON requests from frontend
    if (isJsonRequest(req)) {
      return res.json({
        success: true,
        message: MSG_CATEGORY_CREATED,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug
        }
      });
    }

    // Handle traditional form submissions
    res.redirect('/admin/blog/categories?success=Kategória+sikeresen+létrehozva');
  } catch (error) {
    logger.error('Error creating blog category:', error);

    // Handle JSON requests
    if (isJsonRequest(req)) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Hiba történt a kategória létrehozása során'
      });
    }

    // Handle traditional form submissions
    res.redirect('/admin/blog/categories/new?error=Hiba+történt+a+kategória+létrehozása+során');
  }
});

/**
 * POST /admin/blog/categories/:id - Kategória frissítése
 * MOVED HERE to prevent conflict with POST /:id route
 */
router.post('/categories/:id', requireAuth, csrfProtection, async (req, res) => {
  try {
    const category = await BlogCategory.findByPk(req.params.id);

    if (!category) {
      if (isJsonRequest(req)) {
        return res.status(404).json({
          success: false,
          message: 'Kategória nem található'
        });
      }
      return res.redirect(`${ROUTE_BLOG_CATEGORIES}?error=${ERROR_CATEGORY_NOT_FOUND}`);
    }

    const { name, slug, description, metaTitle, metaDescription, displayOrder } = req.body;

    await category.update({
      name,
      slug,
      description,
      metaTitle,
      metaDescription,
      displayOrder: displayOrder || 0
    });

    logger.info({
      service: 'adminBlog',
      operation: 'updateCategory',
      categoryId: category.id,
      categoryName: category.name,
      userId: req.session.userId
    }, 'Blog category updated');

    // Handle JSON requests from frontend
    if (isJsonRequest(req)) {
      return res.json({
        success: true,
        message: MSG_CATEGORY_UPDATED,
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug
        }
      });
    }

    // Handle traditional form submissions
    res.redirect('/admin/blog/categories?success=Kategória+sikeresen+frissítve');
  } catch (error) {
    logger.error('Error updating blog category:', error);

    // Handle JSON requests
    if (isJsonRequest(req)) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Hiba történt a kategória frissítése során'
      });
    }

    // Handle traditional form submissions
    res.redirect(`/admin/blog/categories/${req.params.id}/edit?error=Hiba+történt+a+kategória+frissítése+során`);
  }
});

/**
 * POST /admin/blog/categories/:id/delete - Kategória törlése
 * MOVED HERE to prevent conflict with POST /:id/delete route
 */
router.post('/categories/:id/delete', requireAuth, csrfProtection, async (req, res) => {
  try {
    const category = await BlogCategory.findByPk(req.params.id);

    if (!category) {
      return res.redirect(`${ROUTE_BLOG_CATEGORIES}?error=${ERROR_CATEGORY_NOT_FOUND}`);
    }

    // Ellenőrizzük, hogy van-e bejegyzés ebben a kategóriában
    const postCount = await BlogPost.count({
      where: { categoryId: req.params.id }
    });

    if (postCount > 0) {
      return res.redirect(`${ROUTE_BLOG_CATEGORIES}?error=${ERROR_CATEGORY_HAS_POSTS}`);
    }

    const categoryName = category.name;
    const categoryId = category.id;
    await category.destroy();

    logger.info({
      service: 'adminBlog',
      operation: 'deleteCategory',
      categoryId,
      categoryName,
      userId: req.session.userId
    }, 'Blog category deleted');
    res.redirect('/admin/blog/categories?success=Kategória+sikeresen+törölve');
  } catch (error) {
    logger.error('Error deleting blog category:', error);
    res.redirect('/admin/blog/categories?error=Hiba+történt+a+kategória+törlése+során');
  }
});

/**
 * GET /admin/blog/tags - Blog címkék listája
 */
router.get('/tags', requireAuth, async (req, res) => {
  try {
    const { sequelize } = BlogTag;

    // Get all tags with post counts using raw SQL
    const tags = await sequelize.query(`
      SELECT 
        bt.id,
        bt.name,
        bt.slug,
        bt.createdAt,
        COUNT(DISTINCT pt.postId) as postCount
      FROM BlogTags bt
      LEFT JOIN PostTags pt ON bt.id = pt.tagId
      GROUP BY bt.id, bt.name, bt.slug, bt.createdAt
      ORDER BY bt.name ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    res.render('admin/blog/tags', {
      layout: LAYOUT_ADMIN,
      title: 'Blog Címkék',
      pageTitle: 'Blog Címkék Kezelése',
      tags,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error({
      error: error.message,
      stack: error.stack,
      service: 'adminBlog',
      operation: 'fetchTags'
    }, 'Error fetching blog tags');

    res.status(500).render('admin/blog/tags', {
      layout: LAYOUT_ADMIN,
      title: 'Blog Címkék',
      pageTitle: 'Blog Címkék Kezelése',
      tags: [],
      error: 'Hiba történt a címkék betöltése során'
    });
  }
});

/**
 * POST /admin/blog/tags/create - Új címke létrehozása
 */
router.post('/tags/create', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A címke neve nem lehet üres'
      });
    }

    const slug = generateSlugFromText(name.trim());

    // Check if tag already exists
    const existingTag = await BlogTag.findOne({
      where: { slug }
    });

    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'Ez a címke már létezik'
      });
    }

    const tag = await BlogTag.create({
      name: name.trim(),
      slug
    });

    logger.info({
      service: 'adminBlog',
      operation: 'createTag',
      tagName: name.trim(),
      tagId: tag.id,
      userId: req.session.userId
    }, 'Blog tag created');

    res.json({
      success: true,
      message: 'Címke sikeresen létrehozva',
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug
      }
    });
  } catch (error) {
    logger.error('Error creating blog tag:', error);
    res.status(500).json({
      success: false,
      message: 'Hiba történt a címke létrehozása során'
    });
  }
});

/**
 * DELETE /admin/blog/tags/:id - Címke törlése
 */
router.delete('/tags/:id', requireAuth, csrfProtection, async (req, res) => {
  try {
    const tagId = req.params.id;
    const tag = await BlogTag.findByPk(tagId);

    if (!tag) {
      if (isJsonRequest(req)) {
        return res.status(404).json({ success: false, message: 'Címke nem található' });
      }
      return res.redirect('/admin/blog/tags?error=Címke+nem+található');
    }

    // Check post count with raw SQL
    const { sequelize } = BlogTag;
    const result = await sequelize.query(
      'SELECT COUNT(*) as count FROM PostTags WHERE tagId = ?',
      { replacements: [tagId], type: sequelize.QueryTypes.SELECT }
    );
    const postCount = result[0].count;

    if (postCount > 0) {
      const errorMsg = `A címke nem törölhető, ${postCount} bejegyzéshez van hozzárendelve`;
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, message: errorMsg });
      }
      return res.redirect(`/admin/blog/tags?error=${encodeURIComponent(errorMsg)}`);
    }

    await tag.destroy();

    logger.info({
      service: 'adminBlog',
      operation: 'deleteTag',
      tagId,
      tagName: tag.name,
      userId: req.session.userId
    }, 'Blog tag deleted');

    if (isJsonRequest(req)) {
      return res.json({ success: true, message: 'Címke sikeresen törölve' });
    }
    res.redirect('/admin/blog/tags?success=Címke+sikeresen+törölve');
  } catch (error) {
    logger.error('Error deleting blog tag:', error);
    if (isJsonRequest(req)) {
      return res.status(500).json({ success: false, message: 'Hiba történt' });
    }
    res.redirect('/admin/blog/tags?error=Hiba+történt+a+címke+törlése+során');
  }
});

module.exports = router;
