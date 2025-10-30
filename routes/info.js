const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const seoService = require('../services/seoService');
const settingsService = require('../services/settingsService');
const { FaqCategory, FaqItem } = require('../models');

// Rólunk
router.get('/rolunk', async (req, res) => {
  const companyName = await settingsService.getCompanyName();
  res.render('info/about', {
    title: `Rólunk - ${companyName}`,
    pageDescription: `Ismerje meg a ${companyName}-t - több évtizedes tapasztalat a rendezvényszervezés területén.`
  });
});

// Előadóknak
router.get('/eloadoknak', async (req, res) => {
  const companyName = await settingsService.getCompanyName();
  res.render('info/for-performers', {
    title: `Előadóknak - ${companyName}`,
    pageDescription: 'Csatlakozzon előadóink közé! Információk művészeknek és előadóknak.'
  });
});

// Megrendelőknek
router.get('/megrendeloknek', async (req, res) => {
  const companyName = await settingsService.getCompanyName();
  res.render('info/for-clients', {
    title: `Megrendelőknek - ${companyName}`,
    pageDescription: 'Információk megrendelőknek - hogyan működik a foglalási folyamat, mit várhat tőlünk.'
  });
});

// Adatkezelési tájékoztató
router.get('/adatkezeles', async (req, res) => {
  const companyName = await settingsService.getCompanyName();
  res.render('info/privacy', {
    title: `Adatkezelési tájékoztató - ${companyName}`,
    pageDescription: `${companyName} adatkezelési tájékoztatója - hogyan kezeljük az Ön személyes adatait.`
  });
});

// GYIK - Gyakran Ismételt Kérdések
router.get('/gyik', async (req, res) => {
  try {
    // FAQ kategóriák és item-ek lekérése az adatbázisból
    const categories = await FaqCategory.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC']],
      include: [{
        model: FaqItem,
        as: 'items',
        where: { isActive: true },
        required: false,
        order: [['displayOrder', 'ASC']]
      }]
    });

    // Átalakítás a view által várt formátumra
    const faqs = categories.map((cat) => ({
      title: cat.name,
      icon: cat.icon || '📌',
      questions: cat.items.map((item) => ({
        question: item.question,
        answer: item.answer,
        keywords: item.keywords || ''
      }))
    }));

    // SEO meta tagek generálása
    const companyName = await settingsService.getCompanyName();
    const faqDescription = 'Válaszok a leggyakoribb kérdésekre a koncertszervezésről, előadók foglalásáról, '
      + `árakról és technikai részletekről. Minden, amit tudnia kell a ${companyName} szolgáltatásairól.`;
    const faqKeywords = ['gyik', 'gyakori kérdések', 'koncertszervezés', 'előadó foglalás', 'árak', 'szerződés'];

    const domain = await settingsService.get('general.domain');

    const metaTags = seoService.generateMetaTags({
      title: 'Gyakran Ismételt Kérdések (GYIK)',
      description: faqDescription,
      keywords: faqKeywords,
      url: `${domain}/info/gyik`
    });

    // FAQ Schema.org strukturált adat generálása
    const allQuestions = await FaqItem.getAllForSchema();
    const faqSchema = seoService.generateFAQSchema(allQuestions);

    const faqPageDescription = 'Válaszok a leggyakoribb kérdésekre a koncertszervezésről, '
      + 'előadók foglalásáról, árakról és technikai részletekről.';

    res.render('info/faq', {
      title: 'Gyakran Ismételt Kérdések (GYIK)',
      pageDescription: faqPageDescription,
      metaTags,
      faqSchema,
      faqs
    });
  } catch (error) {
    logger.error('Error rendering FAQ page:', error);
    res.status(500).render('error', {
      title: 'Hiba történt',
      message: 'Hiba történt a GYIK oldal betöltése során.',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router;
