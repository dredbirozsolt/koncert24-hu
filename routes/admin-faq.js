/**
 * Admin FAQ Routes - GYIK kezelés admin felület
 */

const express = require('express');
const router = express.Router();
const { FaqCategory, FaqItem } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/advancedSecurity');
const logger = require('../config/logger');

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const ERROR_CATEGORY_NOT_FOUND = '/admin/faq?error=Kategória+nem+található';
const ERROR_GENERAL = '/admin/faq?error=Hiba+történt';
const ERROR_QUESTION_NOT_FOUND = '/admin/faq?error=Kérdés+nem+található';

/**
 * GET /admin/faq - GYIK kezelő lista
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const categories = await FaqCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      include: [{
        model: FaqItem,
        as: 'items',
        order: [['displayOrder', 'ASC']]
      }]
    });

    res.render('admin/faq/index', {
      layout: LAYOUT_ADMIN,
      title: 'GYIK Kezelés',
      currentPath: req.path,
      categories,
      success: req.query.success,
      error: req.query.error
    });
  } catch (error) {
    logger.error('Error loading FAQ admin:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt a GYIK kezelő betöltése során',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * GET /admin/faq/categories/new - Új kategória form
 */
router.get('/categories/new', requireAdmin, csrfProtection, (req, res) => {
  res.render('admin/faq/edit-category', {
    layout: LAYOUT_ADMIN,
    title: 'Új Kategória',
    category: null,
    user: req.session.user,
    csrfToken: res.locals.csrfToken || req.session.csrfToken
  });
});

/**
 * GET /admin/faq/categories/:id/edit - Kategória szerkesztés
 */
router.get('/categories/:id/edit', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const category = await FaqCategory.findByPk(req.params.id);

    if (!category) {
      return res.redirect(ERROR_CATEGORY_NOT_FOUND);
    }

    res.render('admin/faq/edit-category', {
      layout: LAYOUT_ADMIN,
      title: 'Kategória Szerkesztése',
      category,
      user: req.session.user,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Error loading category:', error);
    res.redirect(ERROR_GENERAL);
  }
});

/**
 * POST /admin/faq/categories - Új kategória létrehozása
 */
router.post('/categories', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { name, icon, displayOrder, isActive } = req.body;

    const category = await FaqCategory.create({
      name,
      icon: icon || '📌',
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === 'true' || isActive === '1' || isActive === true
    });

    logger.info({
      service: 'adminFaq',
      operation: 'createCategory',
      categoryId: name
    }, 'FAQ category created');

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Kategória sikeresen létrehozva!', category });
    }

    res.redirect('/admin/faq?success=Kategória+létrehozva');
  } catch (error) {
    logger.error('Error creating category:', error);

    // AJAX request - return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect('/admin/faq/categories/new?error=Hiba+történt+a+létrehozás+során');
  }
});

/**
 * POST /admin/faq/categories/:id - Kategória frissítése
 */
router.post('/categories/:id', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { name, icon, displayOrder, isActive } = req.body;
    const category = await FaqCategory.findByPk(req.params.id);

    if (!category) {
      // AJAX request - return JSON error
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'Kategória nem található' });
      }
      return res.redirect(ERROR_CATEGORY_NOT_FOUND);
    }

    await category.update({
      name,
      icon: icon || '📌',
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === 'true' || isActive === '1' || isActive === true
    });

    logger.info({
      service: 'adminFaq',
      operation: 'updateCategory',
      categoryId: category.id,
      categoryName: category.name
    }, 'FAQ category updated');

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'Kategória sikeresen frissítve!', category });
    }

    res.redirect('/admin/faq?success=Kategória+frissítve');
  } catch (error) {
    logger.error('Error updating category:', error);

    // AJAX request - return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect(`/admin/faq/categories/${req.params.id}/edit?error=Hiba+történt`);
  }
});

/**
 * POST /admin/faq/categories/:id/delete - Kategória törlése
 */
router.post('/categories/:id/delete', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const category = await FaqCategory.findByPk(req.params.id);

    if (!category) {
      return res.redirect(ERROR_CATEGORY_NOT_FOUND);
    }

    const categoryName = category.name;
    await category.destroy();
    logger.info({
      service: 'adminFaq',
      operation: 'deleteCategory',
      categoryId: req.params.id,
      categoryName
    }, 'FAQ category deleted');

    res.redirect('/admin/faq?success=Kategória+törölve');
  } catch (error) {
    logger.error('Error deleting category:', error);
    res.redirect('/admin/faq?error=Hiba+történt+a+törlés+során');
  }
});

/**
 * GET /admin/faq/items/new - Új FAQ item form
 */
router.get('/items/new', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const categories = await FaqCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('admin/faq/edit-item', {
      layout: LAYOUT_ADMIN,
      title: 'Új Kérdés',
      item: null,
      categories,
      user: req.session.user,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Error loading item form:', error);
    res.redirect(ERROR_GENERAL);
  }
});

/**
 * GET /admin/faq/items/:id/edit - FAQ item szerkesztés
 */
router.get('/items/:id/edit', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const item = await FaqItem.findByPk(req.params.id, {
      include: [{ model: FaqCategory, as: 'category' }]
    });

    if (!item) {
      return res.redirect(ERROR_QUESTION_NOT_FOUND);
    }

    const categories = await FaqCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render('admin/faq/edit-item', {
      layout: LAYOUT_ADMIN,
      title: 'Kérdés Szerkesztése',
      item,
      categories,
      user: req.session.user,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Error loading item:', error);
    res.redirect(ERROR_GENERAL);
  }
});

/**
 * POST /admin/faq/items - Új FAQ item létrehozása
 */
router.post('/items', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { categoryId, question, answer, displayOrder, isActive } = req.body;

    const item = await FaqItem.create({
      categoryId: parseInt(categoryId),
      question,
      answer,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === 'true' || isActive === '1' || isActive === true
    });

    logger.info({
      service: 'adminFaq',
      operation: 'createItem',
      categoryId,
      questionPreview: question.substring(0, 50)
    }, 'FAQ item created');

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'GYIK elem sikeresen létrehozva!', item });
    }

    res.redirect('/admin/faq?success=Kérdés+létrehozva');
  } catch (error) {
    logger.error('Error creating item:', error);

    // AJAX request - return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect('/admin/faq/items/new?error=Hiba+történt+a+létrehozás+során');
  }
});

/**
 * POST /admin/faq/items/:id - FAQ item frissítése
 */
router.post('/items/:id', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const { categoryId, question, answer, displayOrder, isActive } = req.body;
    const item = await FaqItem.findByPk(req.params.id);

    if (!item) {
      // AJAX request - return JSON error
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ success: false, message: 'Kérdés nem található' });
      }
      return res.redirect(ERROR_QUESTION_NOT_FOUND);
    }

    await item.update({
      categoryId: parseInt(categoryId),
      question,
      answer,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === 'true' || isActive === '1' || isActive === true
    });

    logger.info({
      service: 'adminFaq',
      operation: 'updateItem',
      itemId: item.id,
      questionPreview: item.question.substring(0, 50)
    }, 'FAQ item updated');

    // AJAX request - return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, message: 'GYIK elem sikeresen frissítve!', item });
    }

    res.redirect('/admin/faq?success=Kérdés+frissítve');
  } catch (error) {
    logger.error('Error updating item:', error);

    // AJAX request - return JSON error
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.redirect(`/admin/faq/items/${req.params.id}/edit?error=Hiba+történt`);
  }
});

/**
 * POST /admin/faq/items/:id/delete - FAQ item törlése
 */
router.post('/items/:id/delete', requireAdmin, csrfProtection, async (req, res) => {
  try {
    const item = await FaqItem.findByPk(req.params.id);

    if (!item) {
      return res.redirect(ERROR_QUESTION_NOT_FOUND);
    }

    const questionPreview = item.question.substring(0, 50);
    await item.destroy();
    logger.info({
      service: 'adminFaq',
      operation: 'deleteItem',
      itemId: req.params.id,
      questionPreview
    }, 'FAQ item deleted');

    res.redirect('/admin/faq?success=Kérdés+törölve');
  } catch (error) {
    logger.error('Error deleting item:', error);
    res.redirect('/admin/faq?error=Hiba+történt+a+törlés+során');
  }
});

module.exports = router;
