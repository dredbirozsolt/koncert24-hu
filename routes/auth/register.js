const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../../config/logger');
const authService = require('../../services/authService');
const { sendVerificationEmail } = require('../../services/authHelpers');
const { requireNoAuth } = require('../../middleware/auth');
const { registerProtection } = require('../../middleware/authProtection');
const { MESSAGE_VALID_EMAIL, HEADER_USER_AGENT } = require('./helpers');

// Register page
router.get('/register', requireNoAuth, (req, res) => {
  const validationErrors = req.session.validationErrors || [];
  delete req.session.validationErrors;

  res.render('auth/register', {
    title: 'Regisztráció',
    error: req.query.error,
    formData: req.session.formData || {},
    validationErrors
  });
});

// Register success page
router.get('/register-success', (req, res) => {
  res.render('auth/register-success', {
    title: 'Sikeres regisztráció',
    email: req.session.registrationEmail
  });
});

// Register route with protection
router.post('/register', registerProtection, [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('A név 2-100 karakter között kell legyen'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage(MESSAGE_VALID_EMAIL),
  body('phone')
    .isLength({ min: 6, max: 20 })
    .withMessage('A telefonszám 6-20 karakter között kell legyen'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('A jelszó minimum 8 karakter hosszú kell legyen')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('A jelszónak tartalmaznia kell kis- és nagybetűt, valamint legalább egy számot'),
  body('passwordConfirm')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('A jelszavak nem egyeznek');
      }
      return true;
    }),
  body('role')
    .isIn(['client', 'performer'])
    .withMessage('Érvényes szerepkört válasszon'),
  body('terms')
    .equals('on')
    .withMessage('El kell fogadnia a felhasználási feltételeket')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.formData = req.body;
      req.session.validationErrors = errors.array();
      return res.redirect('/auth/register?error=validation');
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    const result = await authService.registerUser(req.body, ipAddress, userAgent);

    if (!result.success) {
      req.session.formData = req.body;
      return res.redirect(`/auth/register?error=${result.error}`);
    }

    const { user } = result;
    delete req.session.formData;

    // Send verification email
    try {
      await sendVerificationEmail(user, req);
      logger.info({
        service: 'auth',
        operation: 'register',
        userId: user.id,
        email: user.email
      }, 'Verification email sent');
    } catch (emailError) {
      logger.error({
        err: emailError,
        service: 'auth',
        operation: 'sendVerificationEmail',
        userId: user.id
      }, 'Failed to send verification email');
      // Continue anyway - user is registered
    }

    req.session.registrationEmail = user.email;
    logger.info({
      service: 'auth',
      operation: 'register',
      userId: user.id,
      email: user.email
    }, 'User registered successfully');
    res.redirect('/auth/register-success');
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'register' }, 'Registration error');
    req.session.formData = req.body;
    res.redirect('/auth/register?error=server');
  }
});

module.exports = router;
