'use strict';

const express = require('express');
const { PartnerCategory, Partner } = require('../models');
const logger = require('../config/logger');
const { csrfProtection } = require('../middleware/advancedSecurity');

const router = express.Router();

const NOT_FOUND_MSG = 'Kategória nem található';
const LAYOUT_ADMIN = 'layouts/admin';

// Kategóriák listázása
router.get('/', csrfProtection, async (req, res) => {
  try {
    const categories = await PartnerCategory.findAll({
      order: [['displayOrder', 'ASC'], ['name', 'ASC']],
      include: [{
        model: Partner,
        as: 'partners',
        attributes: ['id', 'status']
      }]
    });

    // Partner számok hozzáadása
    const categoriesWithCounts = categories.map((category) => {
      const categoryData = category.toJSON();
      const allPartners = categoryData.partners || [];
      const activePartners = allPartners.filter((p) => p.status === 'active');

      return {
        ...categoryData,
        partnerCount: allPartners.length,
        activeCount: activePartners.length
      };
    });

    // Statisztikák számítása
    const stats = {
      totalCategories: categories.length,
      activeCategories: categories.filter((c) => c.isActive).length,
      inactiveCategories: categories.filter((c) => !c.isActive).length,
      totalPartners: categoriesWithCounts.reduce((sum, cat) => sum + cat.partnerCount, 0)
    };

    res.render('admin/partners/categories', {
      layout: LAYOUT_ADMIN,
      title: 'Partner Kategóriák',
      categories: categoriesWithCounts,
      stats,
      query: req.query,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Hiba a partner kategóriák listázásakor:', error);
    res.status(500).send('Hiba történt a kategóriák betöltésekor');
  }
});

// Új kategória form
router.get('/new', csrfProtection, (req, res) => {
  try {
    res.render('admin/partners/edit-category', {
      layout: LAYOUT_ADMIN,
      title: 'Új Partner Kategória',
      category: {},
      isEdit: false,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Hiba az új kategória form betöltésekor:', error);
    res.status(500).send('Hiba történt a form betöltésekor');
  }
});

// Kategória szerkesztés form
router.get('/:id/edit', csrfProtection, async (req, res) => {
  try {
    const category = await PartnerCategory.findByPk(req.params.id, {
      include: [{
        model: Partner,
        as: 'partners',
        attributes: ['id', 'name', 'websiteUrl', 'status']
      }]
    });

    if (!category) {
      return res.status(404).send(NOT_FOUND_MSG);
    }

    res.render('admin/partners/edit-category', {
      layout: LAYOUT_ADMIN,
      title: `Kategória szerkesztése: ${category.name}`,
      category: category.toJSON(),
      isEdit: true,
      csrfToken: res.locals.csrfToken || req.session.csrfToken
    });
  } catch (error) {
    logger.error('Hiba a kategória betöltésekor:', error);
    res.status(500).send('Hiba történt a kategória betöltésekor');
  }
});

// Új kategória létrehozása
router.post('/', async (req, res) => {
  try {
    const {
      name, slug, description,
      displayOrder, isActive, metaTitle, metaDescription
    } = req.body;

    logger.info({
      name,
      slug,
      description,
      displayOrder,
      displayOrderType: typeof displayOrder,
      isActive,
      metaTitle,
      metaDescription
    }, 'Creating category with data');

    const category = await PartnerCategory.create({
      name,
      slug: slug || undefined, // Hook fogja generálni ha üres
      description,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === true || isActive === 'true' || isActive === 'on',
      metaTitle,
      metaDescription
    });

    logger.info({
      service: 'adminPartnerCategories',
      operation: 'createCategory',
      categoryId: category.id,
      categoryName: category.name
    }, 'Partner category created');

    res.json({
      success: true,
      message: `Kategória "${category.name}" sikeresen létrehozva!`,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Hiba a kategória létrehozásakor:');

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'A kategória név vagy slug már létezik'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Hiba történt a kategória létrehozásakor'
    });
  }
});

// Kategória aktív állapot toggle (AJAX támogatással)
router.post('/:id/toggle-active', csrfProtection, async (req, res) => {
  try {
    const category = await PartnerCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).send(NOT_FOUND_MSG);
    }

    // Toggle the isActive state
    await category.update({
      isActive: !category.isActive
    });

    logger.info(
      `Partner kategória aktív állapot módosítva: ${category.name} `
      + `(ID: ${category.id}) -> ${category.isActive}`
    );

    // Visszairányítás a szerkesztés oldalra
    res.redirect(`/admin/partners/categories/${req.params.id}/edit`);
  } catch (error) {
    logger.error('Hiba a kategória aktív állapotának módosításakor:', error);
    res.status(500).send('Hiba történt a kategória állapotának módosításakor');
  }
});

// Kategória frissítése
router.post('/:id', async (req, res) => {
  try {
    const {
      name, slug, description,
      displayOrder, isActive, metaTitle, metaDescription
    } = req.body;

    const category = await PartnerCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'A kategória nem található'
      });
    }

    await category.update({
      name,
      slug,
      description,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: isActive === true || isActive === 'true' || isActive === 'on',
      metaTitle,
      metaDescription
    });

    logger.info({
      service: 'adminPartnerCategories',
      operation: 'updateCategory',
      categoryId: category.id,
      categoryName: category.name
    }, 'Partner category updated');

    res.json({
      success: true,
      message: `Kategória "${category.name}" sikeresen frissítve!`,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Hiba a kategória frissítésekor:');

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'A kategória név vagy slug már létezik'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Hiba történt a kategória frissítésekor'
    });
  }
});

// Kategória törlése
router.post('/:id/delete', csrfProtection, async (req, res) => {
  try {
    const category = await PartnerCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).send(NOT_FOUND_MSG);
    }

    // Ellenőrizzük, hogy vannak-e hozzárendelt partnerek
    const partnerCount = await Partner.count({
      where: { categoryId: req.params.id }
    });

    if (partnerCount > 0) {
      const errorMsg = 'A+kategória+nem+törölhető,+mert+vannak+hozzárendelt+partnerek';
      return res.redirect(`/admin/partners/categories?error=${errorMsg}`);
    }

    const categoryName = category.name;
    await category.destroy();

    logger.info({
      service: 'adminPartnerCategories',
      operation: 'deleteCategory',
      categoryId: req.params.id,
      categoryName
    }, 'Partner category deleted');
    res.redirect('/admin/partners/categories?success=Kategória+sikeresen+törölve');
  } catch (error) {
    logger.error('Hiba a kategória törlésekor:', error);
    res.status(500).send('Hiba történt a kategória törlésekor');
  }
});

module.exports = router;
