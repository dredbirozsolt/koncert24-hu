'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const { Partner } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const settingsService = require('../services/settingsService');
const { csrfProtection, generateCsrfTokenMiddleware } = require('../middleware/advancedSecurity');
const { validateUploadedFile, logFileUpload } = require('../middleware/fileUploadSecurity');

const router = express.Router();

// Multer konfiguráció logo feltöltéshez
const uploadDir = path.join(__dirname, '../public/uploads/partners');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Csak képfájlok engedélyezettek (JPG, PNG, GIF, SVG, WebP)'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter
});

// Helper: Generate URL-friendly slug from partner name
function generatePartnerSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper: Determine logo URL from file upload or body string
function determineLogoUrl(file, bodyLogoUrl) {
  if (file) {
    return `/uploads/partners/${file.filename}`;
  }
  if (bodyLogoUrl) {
    return bodyLogoUrl;
  }
  return null;
}

// Helper: Build partner data object from request
function buildPartnerData(body, slug, logoUrl) {
  return {
    name: body.name,
    slug,
    websiteUrl: body.websiteUrl,
    logo: logoUrl,
    description: body.description || null,
    categoryId: body.categoryId ? parseInt(body.categoryId) : null,
    partnershipType: body.partnershipType || 'organic',
    isVerified: body.isVerified === 'on',
    backlinkUrl: body.backlinkUrl || null,
    domainAuthority: body.domainAuthority ? parseInt(body.domainAuthority) : null,
    pageAuthority: body.pageAuthority ? parseInt(body.pageAuthority) : null,
    displayOrder: parseInt(body.displayOrder) || 0,
    showOnHomepage: body.showOnHomepage === 'on',
    status: body.status,
    contactEmail: body.contactEmail || null,
    contactName: body.contactName || null,
    contactPhone: body.contactPhone || null,
    notes: body.notes || null
  };
}

// Constants
const ADMIN_PARTNERS_PATH = '/admin/partners';
const MSG_PARTNER_NOT_FOUND = 'Partner nem található';
const PARTNERS_FORM_VIEW = 'admin/partners/form';
const LAYOUT_ADMIN = 'layouts/admin';

// Label mappings
const typeLabels = {
  reciprocal: 'Kölcsönös',
  sponsored: 'Szponzorált',
  organic: 'Organikus',
  affiliate: 'Affiliate'
};

// Partner lista oldal
router.get('/', async (req, res) => {
  try {
    const { PartnerCategory } = require('../models');
    const { status, categoryId, search } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId);
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { websiteUrl: { [Op.like]: `%${search}%` } }
      ];
    }

    const partners = await Partner.findAll({
      where: whereClause,
      include: [{
        model: PartnerCategory,
        as: 'category',
        attributes: ['id', 'name', 'slug']
      }],
      order: [['displayOrder', 'DESC'], ['name', 'ASC']]
    });

    // Aktív kategóriák lekérése
    const categories = await PartnerCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    const renderData = {
      layout: LAYOUT_ADMIN,
      title: 'Partner Kezelés',
      partners,
      categories: categories.map((c) => c.toJSON()),
      filters: {
        status: status || '',
        categoryId: categoryId || '',
        search: search || ''
      },
      typeLabels,
      user: res.locals.user || req.session?.user || null
    };

    logger.debug(
      {
        service: 'adminPartners',
        partnerCount: partners.length,
        categoryCount: categories.length
      },
      'Partner list loaded'
    );

    res.render('admin/partners/index', renderData);
  } catch (error) {
    logger.error({ err: error, service: 'adminPartners', operation: 'loadPage' }, 'Hiba a partnerek betöltésekor');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt a partnerek betöltésekor',
      statusCode: 500
    });
  }
});

// Új partner form
router.get('/new', generateCsrfTokenMiddleware, async (req, res) => {
  try {
    const { PartnerCategory } = require('../models');
    const categories = await PartnerCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render(PARTNERS_FORM_VIEW, {
      layout: LAYOUT_ADMIN,
      title: 'Új Partner',
      partner: {},
      categories: categories.map((c) => c.toJSON()),
      isEdit: false,
      csrfToken: res.locals.csrfToken || req.session.csrfToken,
      user: res.locals.user || req.session?.user || null
    });
  } catch (error) {
    logger.error('Hiba az új partner form betöltésekor:', error);
    res.status(500).send('Hiba történt a form betöltésekor');
  }
});

// Partner létrehozása
router.post('/',
  upload.single('logo'),
  csrfProtection,              // CSRF validálás multer után
  validateUploadedFile,
  logFileUpload,
  async (req, res) => {
    let partnerData;
    try {
      // Slug generálás helper-rel
      const slug = generatePartnerSlug(req.body.name);

      // Logo URL meghatározása helper-rel
      const logoUrl = determineLogoUrl(req.file, req.body.logoUrl);

      // Partner adat összeállítása helper-rel
      partnerData = buildPartnerData(req.body, slug, logoUrl);

      logger.debug(
        {
          service: 'adminPartners',
          partnerName: req.body.name,
          slug,
          hasFile: Boolean(req.file)
        },
        'Creating partner'
      );

      const newPartner = await Partner.create(partnerData);

      logger.info(
        { service: 'adminPartners', partnerId: newPartner.id, partnerName: partnerData.name },
        'Partner created'
      );

      // AJAX kérés esetén JSON választ küldünk
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: 'Partner sikeresen létrehozva!',
          partner: { id: newPartner.id, name: newPartner.name, slug: newPartner.slug }
        });
      }

      // Normál form submit esetén redirect
      res.redirect(ADMIN_PARTNERS_PATH);
    } catch (error) {
      logger.error(
        { err: error, service: 'adminPartners', operation: 'createPartner' },
        'Hiba a partner létrehozásakor'
      );

      // AJAX kérés esetén JSON hibaüzenetet küldünk
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: error.message || 'Hiba történt a partner létrehozásakor'
        });
      }

      // Normál form submit esetén HTML error page
      res.status(500).render(PARTNERS_FORM_VIEW, {
        layout: LAYOUT_ADMIN,
        title: 'Új Partner',
        partner: partnerData || {},
        isEdit: false,
        user: res.locals.user || req.session?.user || null,
        error: error.message || 'Hiba történt a partner létrehozásakor'
      });
    }
  });

// Partner szerkesztés form
router.get('/:id/edit', generateCsrfTokenMiddleware, async (req, res) => {
  try {
    const { PartnerCategory } = require('../models');

    const partner = await Partner.findByPk(req.params.id);

    if (!partner) {
      return res.status(404).render('error', {
        title: 'Hiba',
        message: MSG_PARTNER_NOT_FOUND,
        error: { status: 404 }
      });
    }

    const categories = await PartnerCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['name', 'ASC']]
    });

    res.render(PARTNERS_FORM_VIEW, {
      layout: LAYOUT_ADMIN,
      title: 'Partner Szerkesztése',
      partner,
      categories: categories.map((c) => c.toJSON()),
      isEdit: true,
      csrfToken: res.locals.csrfToken || req.session.csrfToken,
      user: res.locals.user || req.session?.user || null
    });
  } catch (error) {
    logger.error('Hiba a partner betöltésekor:', error);
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt a partner betöltésekor',
      error: { status: 500 }
    });
  }
});

// Partner főoldalon megjelenítés toggle (AJAX támogatással)
router.post('/:id/toggle-homepage', csrfProtection, async (req, res) => {
  try {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) {
      return res.status(404).send(MSG_PARTNER_NOT_FOUND);
    }

    // Toggle the showOnHomepage state
    await partner.update({
      showOnHomepage: !partner.showOnHomepage
    });

    logger.info(
      `Partner főoldalon megjelenítés módosítva: ${partner.name} `
      + `(ID: ${partner.id}) -> ${partner.showOnHomepage}`
    );

    // Visszairányítás a szerkesztés oldalra
    res.redirect(`/admin/partners/${req.params.id}/edit`);
  } catch (error) {
    logger.error('Hiba a partner főoldal állapotának módosításakor:', error);
    res.status(500).send('Hiba történt az állapot módosításakor');
  }
});

/**
 * Helper: Update partner slug if name changed
 */
function updatePartnerSlug(name, originalName, currentSlug) {
  if (name === originalName) {
    return currentSlug;
  }
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Helper: Handle partner logo upload/update
 */
function handlePartnerLogoUpload(req, partner) {
  const defaultLogo = partner.logo;

  // Ha törölni kell a logót
  if (req.body.deleteLogo === 'true') {
    if (partner.logo && partner.logo.startsWith('/uploads/partners/')) {
      const oldPath = path.join(__dirname, '../public', partner.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    return null;
  }

  if (req.file) {
    const newLogoUrl = `/uploads/partners/${req.file.filename}`;

    if (partner.logo && partner.logo.startsWith('/uploads/partners/')) {
      const oldPath = path.join(__dirname, '../public', partner.logo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    return newLogoUrl;
  }

  if (req.body.logoUrl) {
    return req.body.logoUrl;
  }

  return defaultLogo;
}

/**
 * Partner frissítése
 */
router.post('/:id',
  upload.single('logo'),
  validateUploadedFile,
  logFileUpload,
  async (req, res) => {
    let partner;
    let partnerData;

    try {
      partner = await Partner.findByPk(req.params.id);

      if (!partner) {
        return res.status(404).render('error', {
          message: MSG_PARTNER_NOT_FOUND,
          error: { status: 404 }
        });
      }

      const slug = updatePartnerSlug(req.body.name, partner.name, partner.slug);
      const logoUrl = handlePartnerLogoUpload(req, partner);
      partnerData = buildPartnerData(req.body, slug, logoUrl);

      await partner.update(partnerData);

      logger.info(
        { service: 'adminPartners', operation: 'updatePartner', partnerId: partner.id, partnerName: partner.name },
        'Partner updated'
      );

      // AJAX kérés esetén JSON választ küldünk
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          message: 'Partner sikeresen frissítve!',
          partner: { id: partner.id, name: partner.name, slug: partner.slug }
        });
      }

      // Normál form submit esetén redirect
      res.redirect(ADMIN_PARTNERS_PATH);
    } catch (error) {
      logger.error('Hiba a partner frissítésekor:', error);

      // AJAX kérés esetén JSON hibaüzenetet küldünk
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: error.message || 'Hiba történt a partner frissítésekor'
        });
      }

      // Normál form submit esetén HTML error page
      res.status(500).render(PARTNERS_FORM_VIEW, {
        layout: LAYOUT_ADMIN,
        title: 'Partner Szerkesztése',
        partner: partner ? { ...partner.toJSON(), ...partnerData } : (partnerData || {}),
        isEdit: true,
        error: error.message || 'Hiba történt a partner frissítésekor'
      });
    }
  });

// Partner törlése
router.post('/:id/delete', async (req, res) => {
  try {
    const partner = await Partner.findByPk(req.params.id);

    if (!partner) {
      return res.status(404).json({ error: MSG_PARTNER_NOT_FOUND });
    }

    const partnerName = partner.name;
    await partner.destroy();

    logger.info(
      { service: 'adminPartners', operation: 'deletePartner', partnerId: req.params.id, partnerName },
      'Partner deleted'
    );
    res.redirect(ADMIN_PARTNERS_PATH);
  } catch (error) {
    logger.error('Hiba a partner törlésekor:', error);
    res.status(500).json({ error: 'Hiba történt a partner törlésekor' });
  }
});

/**
 * Helper: Check if backlink exists on page
 */
async function checkBacklinkExists(backlinkUrl, siteDomain) {
  const response = await axios.get(backlinkUrl, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const $ = cheerio.load(response.data);
  let hasBacklink = false;

  $('a').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && href.includes(siteDomain)) {
      hasBacklink = true;
      return false;
    }
  });

  return hasBacklink;
}

/**
 * Helper: Update partner verification status
 */
async function updatePartnerVerification(partner, isVerified) {
  await partner.update({
    isVerified,
    lastVerified: new Date()
  });

  logger.info({
    service: 'adminPartners',
    operation: 'verifyBacklink',
    partnerId: partner.id,
    partnerName: partner.name,
    isVerified
  }, 'Backlink verification completed');
}

// Backlink ellenőrzés
router.post('/:id/verify-backlink', async (req, res) => {
  try {
    const partner = await Partner.findByPk(req.params.id);

    if (!partner) {
      return res.status(404).json({ error: MSG_PARTNER_NOT_FOUND, success: false });
    }

    if (!partner.backlinkUrl) {
      return res.json({
        success: false,
        error: 'Nincs megadva backlink URL',
        isVerified: false
      });
    }

    try {
      const fullDomain = await settingsService.get('general.domain');
      const siteDomain = fullDomain ? fullDomain.replace('https://', '').replace('http://', '') : '';

      const hasBacklink = await checkBacklinkExists(partner.backlinkUrl, siteDomain);
      await updatePartnerVerification(partner, hasBacklink);

      res.json({
        success: true,
        isVerified: hasBacklink,
        message: hasBacklink
          ? 'Backlink megtalálva és ellenőrizve!'
          : 'Backlink nem található az oldalon'
      });
    } catch (axiosError) {
      logger.error({
        service: 'adminPartners',
        operation: 'verifyBacklink',
        partnerId: partner.id,
        partnerName: partner.name,
        url: partner.url,
        error: axiosError.message
      }, 'Backlink verification failed');

      await partner.update({
        isVerified: false,
        lastVerified: new Date()
      });

      res.json({
        success: false,
        isVerified: false,
        error: `Nem sikerült elérni az oldalt: ${axiosError.message}`
      });
    }
  } catch (error) {
    logger.error('Hiba a backlink ellenőrzésekor:', error);
    res.status(500).json({ error: 'Hiba történt a backlink ellenőrzésekor', success: false });
  }
});

module.exports = router;
