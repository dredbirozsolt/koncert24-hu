const express = require('express');
const router = express.Router();
const { setupUserLocals } = require('../middleware/auth');

// Make user available in templates
router.use(setupUserLocals);

// Import sub-routers
const loginRoutes = require('./auth/login');
const registerRoutes = require('./auth/register');
const profileRoutes = require('./auth/profile');
const emailRoutes = require('./auth/email');
const passwordRoutes = require('./auth/password');

// Mount sub-routers
router.use('/', loginRoutes);
router.use('/', registerRoutes);
router.use('/', profileRoutes);
router.use('/', emailRoutes);
router.use('/', passwordRoutes);

// Export for backward compatibility
const { requireAuth, requireNoAuth } = require('../middleware/auth');
module.exports = { router, requireAuth, requireNoAuth };
