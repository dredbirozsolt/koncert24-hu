const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { User, SecurityLog } = require('../../models');
const logger = require('../../config/logger');
const authService = require('../../services/authService');
const { requireAuth } = require('../../middleware/auth');
const { sendVerificationEmail } = require('../../services/authHelpers');
const {
  REDIRECT_PROFILE_ERROR_NOTFOUND,
  REDIRECT_PROFILE,
  HEADER_USER_AGENT,
  handlePasswordChangeValidationError
} = require('./helpers');

// Profile page (protected)
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);

    if (!user) {
      return res.redirect('/auth/login');
    }

    req.session.user = user.toSafeJSON();

    res.render('auth/profile', {
      title: 'Profil',
      user: user.toSafeJSON(),
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error('Profile page error:', error);
    res.redirect('/auth/login');
  }
});

// Resend verification email
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findByPk(userId);

    if (!user) {
      logger.error({ service: 'auth', operation: 'resendVerification', userId }, 'User not found');
      return res.redirect(REDIRECT_PROFILE_ERROR_NOTFOUND);
    }

    if (user.emailVerified) {
      return res.redirect('/auth/profile?success=already_verified');
    }

    // Generate new verification token
    user.emailVerificationToken = User.generateVerificationToken();
    await user.save();

    try {
      await sendVerificationEmail(user, req);
      logger.info({
        service: 'auth',
        operation: 'resendVerification',
        userId: user.id,
        email: user.email
      }, 'Verification email resent');
      res.redirect('/auth/profile?success=verification_sent');
    } catch (emailError) {
      logger.error({ err: emailError, service: 'auth', operation: 'sendVerification' }, 'Email sending error');
      res.redirect('/auth/profile?error=verification');
    }
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'resendVerification' }, 'Resend verification error');
    res.redirect('/auth/profile?error=verification');
  }
});

// Profile edit page (protected)
router.get('/profile/edit', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.redirect(REDIRECT_PROFILE_ERROR_NOTFOUND);
    }

    res.render('auth/profile-edit', {
      title: 'Profil szerkesztése',
      user,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error('Profile edit page error:', error);
    res.redirect(REDIRECT_PROFILE);
  }
});

// Update basic info (name, phone)
router.post('/profile/update-basic-info', requireAuth, [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('A név 2-100 karakter között lehet')
    .matches(/^[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ\s\-']+$/).withMessage('A név csak betűket tartalmazhat'),
  body('phone')
    .trim()
    .isLength({ min: 6, max: 20 }).withMessage('A telefonszám 6-20 karakter között lehet')
    .matches(/^[\d\s+\-()]+$/).withMessage('Érvénytelen telefonszám formátum')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Basic info update validation failed:', errors.array());
      return res.redirect('/auth/profile/edit?error=validation');
    }

    const { userId } = req.session;
    const { name, phone } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.redirect('/auth/profile/edit?error=notfound');
    }

    await user.update({ name, phone });

    logger.info({
      service: 'authProfile',
      operation: 'updateBasicInfo',
      userId: user.id,
      email: user.email
    }, 'User updated basic info');
    res.redirect('/auth/profile?success=basic_info_updated');
  } catch (error) {
    logger.error('Update basic info error:', error);
    res.redirect('/auth/profile/edit?error=server');
  }
});

// Change password page
router.get('/profile/change-password', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.redirect(REDIRECT_PROFILE_ERROR_NOTFOUND);
    }

    res.render('auth/change-password', {
      title: 'Jelszó módosítása',
      user,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error('Change password page error:', error);
    res.redirect(REDIRECT_PROFILE);
  }
});

// Change password POST
router.post('/profile/change-password', requireAuth, [
  body('currentPassword').notEmpty().withMessage('Jelenlegi jelszó kötelező'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Az új jelszónak legalább 8 karakterből kell állnia')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('A jelszónak tartalmaznia kell kis- és nagybetűt, valamint számot'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('A jelszavak nem egyeznek');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Change password validation failed:', errors.array());
      const errorType = handlePasswordChangeValidationError(errors);
      return res.redirect(`/auth/profile/change-password?error=${errorType}`);
    }

    const { userId } = req.session;
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    // Fetch user object
    const user = await User.findByPk(userId);
    if (!user) {
      logger.error({ service: 'authProfile', operation: 'changePassword', userId }, 'User not found');
      return res.redirect('/auth/profile/change-password?error=user_not_found');
    }

    const result = await authService.changePassword(
      user,  // <- user object, not userId
      currentPassword,
      newPassword,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return res.redirect(`/auth/profile/change-password?error=${result.error}`);
    }

    logger.info({
      service: 'authProfile',
      operation: 'changePassword',
      userId: user.id,
      email: user.email
    }, 'Password changed successfully');
    res.redirect('/auth/profile?success=password_changed');
  } catch (error) {
    logger.error({
      service: 'authProfile',
      operation: 'changePassword',
      error: error.message,
      stack: error.stack,
      code: error.code,
      originalCode: error.original?.code
    }, 'Change password error');
    res.redirect('/auth/profile/change-password?error=server');
  }
});

// Delete account
router.post('/delete-account', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    const user = await User.findByPk(userId);

    if (!user) {
      logger.error({ service: 'authProfile', operation: 'deleteAccount', userId }, 'User not found');
      return res.redirect('/auth/profile?error=notfound');
    }

    const userEmail = user.email;
    const userName = user.name;

    // Log before deletion
    await SecurityLog.log('account_deleted', {
      userId: user.id,
      email: userEmail,
      ipAddress,
      userAgent,
      details: 'User deleted their account',
      severity: 'medium'
    });

    // Delete user
    await user.destroy();

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error after account deletion:', err);
      }
    });

    logger.info({
      service: 'authProfile',
      operation: 'deleteAccount',
      email: userEmail,
      name: userName
    }, 'User account deleted successfully');

    // Redirect to homepage with message
    res.redirect('/?success=account_deleted');
  } catch (error) {
    logger.error({ err: error, service: 'authProfile', operation: 'deleteAccount' }, 'Delete account error');
    res.redirect('/auth/profile?error=delete');
  }
});

module.exports = router;
