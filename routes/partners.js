'use strict';

const express = require('express');
const router = express.Router();
const { Partner, PartnerCategory } = require('../models');
const { Op } = require('sequelize');
const { getPartnersMetaDescription, generatePartnersListSchema } = require('../utils/seo-helpers');

// Publikus partner lista oldal
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;

    // Kategória slug alapján categoryId meghatározása
    let categoryId = null;
    if (category && category !== 'all') {
      const categoryData = await PartnerCategory.findOne({
        where: { slug: category },
        attributes: ['id']
      });
      if (categoryData) {
        categoryId = categoryData.id;
      }
    }

    // Szűrési feltételek
    const whereClause = { status: 'active' };

    if (categoryId) {
      whereClause.categoryId = categoryId;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Partner lekérés
    const partners = await Partner.findAll({
      where: whereClause,
      include: [{
        model: PartnerCategory,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }],
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    // Kategória statisztikák
    const categoryStats = await Partner.findAll({
      where: { status: 'active' },
      attributes: [
        'categoryId',
        [Partner.sequelize.fn('COUNT', Partner.sequelize.col('id')), 'count']
      ],
      group: ['categoryId'],
      raw: true
    });

    // Kategóriák lekérése
    const categories = await PartnerCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    // Stats objektum összeállítása
    const stats = {
      all: partners.length
    };

    categories.forEach((cat) => {
      const stat = categoryStats.find((s) => s.categoryId === cat.id);
      stats[cat.slug] = stat ? parseInt(stat.count) : 0;
    });

    // Generate dynamic meta description
    const metaDescription = getPartnersMetaDescription(partners.length, partners);

    // Generate ItemList structured data
    const siteDomain = process.env.SITE_DOMAIN || 'http://localhost:3000';
    const structuredData = generatePartnersListSchema(partners, siteDomain);

    res.render('partners/index', {
      title: `Partnereink - ${res.locals.siteName}`,
      pageDescription: metaDescription,
      partners,
      stats,
      selectedCategory: category || 'all',
      searchQuery: search || '',
      structuredData
    });
  } catch (error) {
    req.log.error({ err: error }, 'Error loading partners page:');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni a partnereket',
      error: process.env.NODE_ENV === 'development' ? error : {},
      statusCode: 500
    });
  }
});

// Partner részletek (opcionális)
router.get('/:slug', async (req, res) => {
  try {
    const partner = await Partner.findOne({
      where: {
        slug: req.params.slug,
        status: 'active'
      },
      include: [{
        model: PartnerCategory,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }]
    });

    if (!partner) {
      return res.status(404).render('error', {
        title: 'Partner nem található',
        message: 'A keresett partner nem található',
        statusCode: 404
      });
    }

    res.render('partners/detail', {
      title: `${partner.name} - Partnereink`,
      partner
    });
  } catch (error) {
    req.log.error('Error loading partner detail:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Nem sikerült betölteni a partner adatait',
      statusCode: 500
    });
  }
});

module.exports = router;
