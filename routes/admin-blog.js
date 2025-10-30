/**
 * Admin Blog Routes - Blog cikkek kezelése
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { BlogPost, BlogCategory, BlogTag, User } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/advancedSecurity');
const logger = require('../config/logger');
const { Op } = require('sequelize');
const { validateUploadedFile, logFileUpload } = require('../middleware/fileUploadSecurity');

// Mount taxonomy sub-router for categories and tags
const taxonomyRouter = require('./admin-blog-taxonomy');
router.use('/', taxonomyRouter);

// Constants for duplicate strings
const LAYOUT_ADMIN = 'layouts/admin';

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
 * Helper: Determine published date based on status
 */
function determinePublishedDate(status, publishedAt) {
  if (status === 'published') {
    return publishedAt ? new Date(publishedAt) : new Date();
  }
  if (status === 'scheduled') {
    if (!publishedAt) {
      return { error: 'Időzített státusz esetén a publikálási dátum kötelező' };
    }
    return new Date(publishedAt);
  }
  return null;
}

/**
 * Helper: Determine published date for UPDATE operation
 */
function determinePublishedDateForUpdate(post, status, publishedAt) {
  const isFirstPublish = status === 'published' && post.status !== 'published';

  if (isFirstPublish || status === 'scheduled') {
    const result = determinePublishedDate(status, publishedAt);
    if (result && result.error) {
      return result;
    }
    return result;
  }

  if (status === 'published' && publishedAt) {
    return new Date(publishedAt);
  }

  return post.publishedAt;
}

/**
 * Helper: Process new tags and return created tag IDs
 */
async function processNewTags(newTags) {
  const createdTagIds = [];
  if (!newTags || newTags.length === 0) {
    return createdTagIds;
  }

  const newTagsArray = Array.isArray(newTags) ? newTags : [newTags];
  for (const tagName of newTagsArray) {
    if (tagName && tagName.trim()) {
      const trimmedName = tagName.trim();
      const tagSlug = generateSlugFromText(trimmedName);

      const [tag] = await BlogTag.findOrCreate({
        where: { name: trimmedName },
        defaults: { name: trimmedName, slug: tagSlug }
      });
      createdTagIds.push(tag.id);
    }
  }
  return createdTagIds;
}

/**
 * Helper: Merge and filter valid tag IDs
 */
function mergeTagIds(createdTagIds, existingTags) {
  const allTagIds = [...createdTagIds];
  if (!existingTags || existingTags.length === 0) {
    return allTagIds;
  }

  const tagIds = Array.isArray(existingTags) ? existingTags : [existingTags];
  const validTagIds = tagIds.filter((id) => !String(id).startsWith('new_') && !isNaN(parseInt(id)));
  allTagIds.push(...validTagIds);
  return allTagIds;
}

/**
 * Helper: Build where clause for blog post filtering
 */
function buildPostWhereClause(status, search) {
  const where = {};
  if (status !== 'all') {
    where.status = status;
  }
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { excerpt: { [Op.like]: `%${search}%` } }
    ];
  }
  return where;
}

/**
 * Helper: Determine featured image for blog post
 */
function determineFeaturedImage(req) {
  if (req.file) {
    return `/uploads/blog/${req.file.filename}`;
  }
  return req.body.existingImage || null;
}

/**
 * Helper: Create blog post with provided data
 */
async function createBlogPostRecord(postData, userId) {
  const post = await BlogPost.create({
    ...postData,
    authorId: userId
  });

  // Calculate reading time
  await post.calculateReadingTime();

  return post;
}

/**
 * Helper: Log blog post creation
 */
function logPostCreation(post, userId) {
  logger.info({
    service: 'adminBlog',
    operation: 'createPost',
    postId: post.id,
    title: post.title,
    userId
  }, 'Blog post created');
}

async function assignTagsToPost(post, newTags, tags) {
  const createdTagIds = await processNewTags(newTags);
  const allTagIds = mergeTagIds(createdTagIds, tags);
  if (allTagIds.length > 0) {
    await post.setTags(allTagIds);
  }
}

async function updateBlogPostRecord(post, postData) {
  await post.update(postData);
  await post.calculateReadingTime();
}

function logPostUpdate(post, userId) {
  logger.info({
    service: 'adminBlog',
    operation: 'updatePost',
    postId: post.id,
    title: post.title,
    userId
  }, 'Blog post updated');
}

const HEADER_X_REQUESTED_WITH = 'x-requested-with';

/**
 * Check if request is AJAX
 * @param {Object} req - Express request
 * @returns {boolean}
 */
function isAjaxRequest(req) {
  return req.headers[HEADER_X_REQUESTED_WITH] === 'XMLHttpRequest';
}

/**
 * Delete old blog post image
 * @param {string} imagePath - Image path to delete
 */
async function deleteOldImage(imagePath) {
  if (!imagePath) {
    return;
  }

  const oldImagePath = path.join(__dirname, '../public', imagePath);
  try {
    await fs.unlink(oldImagePath);
  } catch (err) {
    logger.warn('Could not delete old image:', err.message);
  }
}

/**
 * Handle featured image for blog post update
 * @param {Object} post - Blog post object
 * @param {Object} req - Express request object
 * @returns {string} Featured image path
 */
async function handleFeaturedImage(post, req) {
  if (req.file) {
    // Delete old image if exists
    await deleteOldImage(post.featuredImage);
    return `/uploads/blog/${req.file.filename}`;
  }

  if (req.body.existingImage) {
    return req.body.existingImage;
  }

  return post.featuredImage;
}

// Multer konfiguráció képfeltöltéshez
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads/blog');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `blog-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Csak képfájlok engedélyezettek (jpeg, jpg, png, gif, webp)'));
  }
});

/**
 * GET /admin/blog - Blog cikkek listázása
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = res.locals.paginationAdminItems || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    // Szűrési feltételek
    const where = buildPostWhereClause(status, search);

    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'author', attributes: ['name'] },
        { model: BlogCategory, as: 'category', attributes: ['name'] }
      ]
    });

    const totalPages = Math.ceil(count / limit);

    res.render('admin/blog/index', {
      layout: LAYOUT_ADMIN,
      title: 'Blog Kezelés',
      posts,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      status,
      search,
      user: req.session.user
    });
  } catch (error) {
    logger.error('Error loading admin blog list:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt a cikkek betöltése során'
    });
  }
});

/**
 * GET /admin/blog/new - Új cikk létrehozása form
 */
router.get('/new', requireAuth, async (req, res) => {
  try {
    const categories = await BlogCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });
    const tags = await BlogTag.findAll({
      order: [['name', 'ASC']]
    });

    res.render('admin/blog/edit', {
      layout: LAYOUT_ADMIN,
      title: 'Új cikk létrehozása',
      currentPath: req.path,
      post: null,
      categories,
      tags,
      isEdit: false
    });
  } catch (error) {
    logger.error('Error loading new blog form:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt az űrlap betöltése során'
    });
  }
});

/**
 * GET /admin/blog/:id/edit - Cikk szerkesztése form
 */
router.get('/:id/edit', requireAuth, async (req, res) => {
  try {
    const post = await BlogPost.findByPk(req.params.id, {
      include: [
        { model: BlogCategory, as: 'category' },
        { model: BlogTag, as: 'tags' }
      ]
    });

    if (!post) {
      return res.status(404).render('error', {
        title: '404',
        message: 'A keresett cikk nem található',
        statusCode: 404
      });
    }

    const categories = await BlogCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });
    const tags = await BlogTag.findAll({
      order: [['name', 'ASC']]
    });

    res.render('admin/blog/edit', {
      layout: LAYOUT_ADMIN,
      title: 'Cikk szerkesztése',
      currentPath: req.path,
      post,
      categories,
      tags,
      isEdit: true
    });
  } catch (error) {
    logger.error('Error loading blog edit form:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt az űrlap betöltése során'
    });
  }
});

/**
 * IMPORTANT: Category routes must come BEFORE blog post routes!
 * The router.post('/:id') route would match '/categories' as an id parameter.
 * Express router matches routes in the order they are defined.
 */

/**
 * POST /admin/blog - Új cikk létrehozása
 */
router.post(
  '/',
  requireAuth,
  upload.single('featuredImage'),
  csrfProtection,
  validateUploadedFile,
  logFileUpload,
  async (req, res) => {
    try {
      const {
        title,
        slug,
        excerpt,
        content,
        categoryId,
        status,
        publishedAt,
        metaTitle,
        metaDescription,
        tags,
        featured
      } = req.body;

      // Kép URL
      const featuredImage = determineFeaturedImage(req);

      // Slug generálás ha nincs
      const finalSlug = slug || generateSlugFromText(title);

      // Publikálási dátum kezelése
      const publishedDateResult = determinePublishedDate(status, publishedAt);
      if (publishedDateResult && publishedDateResult.error) {
        return res.status(400).send(publishedDateResult.error);
      }
      const finalPublishedAt = publishedDateResult;

      // Blog post létrehozása
      const post = await createBlogPostRecord({
        title,
        slug: finalSlug,
        excerpt,
        content,
        featuredImage,
        categoryId: categoryId || null,
        status: status || 'draft',
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || excerpt,
        publishedAt: finalPublishedAt,
        featured: featured === '1' || featured === 'true' || featured === true
      }, req.session.user.id);

      // Tagek hozzárendelése
      await assignTagsToPost(post, req.body.newTags, tags);

      logPostCreation(post, req.session.userId);

      // Dual response: JSON for AJAX, redirect for form submission
      if (isAjaxRequest(req)) {
        return res.json({
          success: true,
          message: 'Blog bejegyzés sikeresen létrehozva!',
          post: {
            id: post.id,
            title: post.title,
            slug: post.slug
          }
        });
      }
      res.redirect('/admin/blog?success=created');
    } catch (error) {
      logger.error({ err: error, service: 'adminBlog', operation: 'createPost' }, 'Error creating blog post');

      // Dual response for errors too
      if (isAjaxRequest(req)) {
        return res.status(500).json({
          success: false,
          message: error.message || 'Hiba történt a cikk létrehozása során'
        });
      }

      res.status(500).render('error', {
        title: 'Hiba',
        message: `Hiba történt a cikk létrehozása során: ${error.message}`,
        statusCode: 500
      });
    }
  });

/**
 * POST /admin/blog/:id - Cikk frissítése
 */
router.post('/:id',
  requireAuth,
  upload.single('featuredImage'),
  csrfProtection,              // CSRF validálás multer után
  validateUploadedFile,
  logFileUpload,
  async (req, res) => {
    try {
      const post = await BlogPost.findByPk(req.params.id);

      if (!post) {
        return res.status(404).render('error', {
          title: '404',
          message: 'A keresett cikk nem található',
          statusCode: 404
        });
      }

      const {
        title,
        slug,
        excerpt,
        content,
        categoryId,
        status,
        publishedAt,
        metaTitle,
        metaDescription,
        tags,
        featured
      } = req.body;

      // Kép kezelés
      const featuredImage = await handleFeaturedImage(post, req);

      // Publikálási dátum kezelése
      const publishedDateResult = determinePublishedDateForUpdate(post, status, publishedAt);
      if (publishedDateResult && publishedDateResult.error) {
        return res.status(400).send(publishedDateResult.error);
      }
      const finalPublishedAt = publishedDateResult;

      // Post frissítése + olvasási idő újraszámítása
      await updateBlogPostRecord(post, {
        title,
        slug,
        excerpt,
        content,
        featuredImage,
        categoryId: categoryId || null,
        status: status || 'draft',
        metaTitle: metaTitle || title,
        metaDescription: metaDescription || excerpt,
        publishedAt: finalPublishedAt,
        featured: featured === '1' || featured === 'true' || featured === true
      });

      // Tagek frissítése
      await assignTagsToPost(post, req.body.newTags, tags);

      logPostUpdate(post, req.session.userId);

      // Dual response: JSON for AJAX, redirect for form submission
      if (isAjaxRequest(req)) {
        return res.json({
          success: true,
          message: 'Blog bejegyzés sikeresen frissítve!',
          post: {
            id: post.id,
            title: post.title,
            slug: post.slug
          }
        });
      }
      res.redirect('/admin/blog?success=updated');
    } catch (error) {
      logger.error('Error updating blog post:', error);

      // Dual response for errors too
      if (isAjaxRequest(req)) {
        return res.status(500).json({
          success: false,
          message: error.message || 'Hiba történt a cikk frissítése során'
        });
      }

      res.status(500).render('error', {
        title: 'Hiba',
        message: `Hiba történt a cikk frissítése során: ${error.message}`,
        statusCode: 500
      });
    }
  });

/**
 * POST /admin/blog/:id/delete - Cikk törlése
 */
router.post('/:id/delete', requireAuth, async (req, res) => {
  try {
    const post = await BlogPost.findByPk(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Cikk nem található' });
    }

    // Kép törlése
    if (post.featuredImage) {
      const imagePath = path.join(__dirname, '../public', post.featuredImage);
      try {
        await fs.unlink(imagePath);
      } catch (err) {
        logger.warn('Could not delete image:', err.message);
      }
    }

    await post.destroy();

    logger.info({
      service: 'adminBlog',
      operation: 'deletePost',
      postId: post.id,
      title: post.title,
      userId: req.session.userId
    }, 'Blog post deleted');
    res.redirect('/admin/blog?success=deleted');
  } catch (error) {
    logger.error('Error deleting blog post:', error);
    res.status(500).json({ success: false, message: 'Hiba történt a törlés során' });
  }
});

/**
 * POST /admin/blog/tags/create - Új címke létrehozása
 */
router.post('/upload-image',
  requireAuth,
  upload.single('image'),
  validateUploadedFile,
  logFileUpload,
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Nincs feltöltött fájl' });
      }

      const imageUrl = `/uploads/blog/${req.file.filename}`;
      res.json({ success: true, url: imageUrl });
    } catch (error) {
      logger.error('Error uploading image:', error);
      res.status(500).json({ success: false, message: 'Hiba történt a kép feltöltése során' });
    }
  });

/**
 * ============================================================================
 * BLOG KATEGÓRIA KEZELÉS
 * ============================================================================
 */

/**
 * GET /admin/blog/categories - Blog kategóriák listája
 */

module.exports = router;
