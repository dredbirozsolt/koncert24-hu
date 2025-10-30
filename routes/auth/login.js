const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { SecurityLog } = require('../../models');
const logger = require('../../config/logger');
const authService = require('../../services/authService');
const { requireNoAuth } = require('../../middleware/auth');
const { loginProtection } = require('../../middleware/authProtection');
const { MESSAGE_VALID_EMAIL, HEADER_USER_AGENT, setupLoginSession } = require('./helpers');

// Login page
router.get('/login', requireNoAuth, (req, res) => {
  res.render('auth/login', {
    title: 'Bejelentkezés',
    error: req.query.error,
    success: req.query.success,
    returnTo: req.session.returnTo
  });
});

// Login POST route with protection
router.post('/login', loginProtection, [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage(MESSAGE_VALID_EMAIL),
  body('password')
    .isLength({ min: 6 })
    .withMessage('A jelszó minimum 6 karakter hosszú kell legyen')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/auth/login?error=validation');
    }

    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    const result = await authService.validateLogin(email, password, ipAddress, userAgent);

    if (!result.success) {
      return res.redirect(`/auth/login?error=${result.error}`);
    }

    const { user } = result;

    if (!user.isActive) {
      await SecurityLog.log('login_failed', {
        userId: user.id,
        email: user.email,
        ipAddress,
        userAgent,
        details: 'Account inactive',
        severity: 'low'
      });
      return res.redirect('/auth/login?error=inactive');
    }
    await user.reload();

    setupLoginSession(req, res, user, (returnTo) => {
      logger.info({
        service: 'auth',
        operation: 'login',
        userId: user.id,
        email: user.email,
        role: user.role
      }, 'User logged in');
      res.redirect(returnTo);
    });
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'login' }, 'Login error');
    res.redirect('/auth/login?error=server');
  }
});

// Logout
router.post('/logout', (req, res) => {
  const userEmail = req.session.user ? req.session.user.email : 'unknown';
  const { userId } = req.session;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get(HEADER_USER_AGENT);

  if (req.session.user) {
    logger.info({
      service: 'authLogin',
      operation: 'logout',
      userId,
      email: userEmail
    }, 'User logged out');
  }

  req.session.destroy(async (err) => {
    if (err) {
      logger.error('Logout error:', err);
    } else if (userId) {
      try {
        await SecurityLog.log('logout', {
          userId,
          email: userEmail,
          ipAddress,
          userAgent,
          details: 'User logged out',
          severity: 'low'
        });
      } catch (logError) {
        logger.error('Failed to log logout:', logError);
      }
    }
    res.redirect('/');
  });
});

module.exports = router;
