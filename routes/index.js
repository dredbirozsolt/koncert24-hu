const express = require('express');
const router = express.Router();
const homeRoutes = require('./home');
const performerRoutes = require('./performers');
// const bookingRoutes = require('./bookings'); // Old booking - disabled, using new booking.js from server.js
const wizardRoutes = require('./wizard');
const infoRoutes = require('./info');
const locationsRoutes = require('./locations');
const eventsRoutes = require('./events');
const partnerRoutes = require('./partners');
const adminRoutes = require('./admin');
const adminChatRoutes = require('./admin-chat');
const adminChatOfflineRoutes = require('./admin-chat-offline');
const adminUsersRoutes = require('./admin-users');
const adminIntegrationsRoutes = require('./admin-integrations');
const adminSocialRoutes = require('./admin-social');
const adminEmailRoutes = require('./admin-email');
const adminCompanyRoutes = require('./admin-company');
const adminAIBehaviorRoutes = require('./admin-ai-behavior');
const apiChatRoutes = require('./api-chat');
const apiSecurityRoutes = require('./api-security');
const installRoutes = require('./install');
const { router: authRoutes } = require('./auth');
const { requireAdminOrSales } = require('../middleware/auth');
const blogRoutes = require('./blog');
const seoRoutes = require('./seo');
const styleguideRoutes = require('./styleguide');

// Installation wizard (should be first)
router.use('/install', installRoutes);

// SEO routes (sitemap, robots.txt)
router.use('/', seoRoutes);

// Main routes
router.use('/', homeRoutes);
router.use('/eloadok', performerRoutes);
router.use('/esemenyek', eventsRoutes);
// router.use('/foglalas', bookingRoutes); // Old booking - disabled, using new booking.js from server.js
router.use('/wizard', wizardRoutes);
router.use('/info', infoRoutes);
router.use('/partners', partnerRoutes);

// Blog routes
router.use('/blog', blogRoutes);

// Style Guide / Design System
router.use('/styleguide', styleguideRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Admin routes (hidden) - Chat requires admin or sales authentication
router.use('/admin/users', adminUsersRoutes);
router.use('/admin/chat', requireAdminOrSales, adminChatOfflineRoutes);
router.use('/admin/chat', requireAdminOrSales, adminChatRoutes);
router.use('/admin/integrations', adminIntegrationsRoutes);
router.use('/admin/social', adminSocialRoutes);
router.use('/admin/email', adminEmailRoutes);
router.use('/admin/company', adminCompanyRoutes);
router.use('/admin/ai-behavior', adminAIBehaviorRoutes);
router.use('/admin', adminRoutes);

// API routes
router.use('/api/locations', locationsRoutes);
router.use('/api/email', require('./api'));
router.use('/api/chat', apiChatRoutes);
router.use('/api/security', apiSecurityRoutes);
router.use('/api', require('./cookie-consent'));

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    basePath: res.locals.basePath
  });
});

module.exports = router;
