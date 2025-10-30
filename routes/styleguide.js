const express = require('express');
const router = express.Router();

/**
 * Style Guide / Component Gallery
 * Living documentation of the design system
 */
router.get('/', (req, res) => {
  res.render('styleguide/index', {
    title: 'Design System – Komponens Galéria',
    metaDescription: 'Koncert24.hu design system komponens galéria és dokumentáció',
    layout: 'styleguide-layout',
    theme: req.query.theme || 'light'
  });
});

/**
 * Component categories for navigation
 */
router.get('/typography', (req, res) => {
  res.render('styleguide/typography', {
    title: 'Typography – Design System',
    metaDescription: 'Tipográfiai rendszer és betűtípusok',
    layout: 'layout'
  });
});

router.get('/colors', (req, res) => {
  res.render('styleguide/colors', {
    title: 'Colors – Design System',
    metaDescription: 'Színrendszer és színpaletták',
    layout: 'layout'
  });
});

router.get('/components', (req, res) => {
  res.render('styleguide/components', {
    title: 'Components – Design System',
    metaDescription: 'Újrafelhasználható komponensek',
    layout: 'layout'
  });
});

module.exports = router;
