const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { User } = require('../../models');
const logger = require('../../config/logger');
const emailService = require('../../services/emailService');
const authService = require('../../services/authService');
const { requireAuth } = require('../../middleware/auth');
const { sendVerificationEmail } = require('../../services/authHelpers');
const crypto = require('crypto');
const {
  VIEW_VERIFICATION_RESULT,
  TITLE_EMAIL_VERIFICATION,
  MESSAGE_VALID_EMAIL,
  HEADER_USER_AGENT,
  REDIRECT_PROFILE_ERROR_NOTFOUND,
  REDIRECT_PROFILE,
  MESSAGE_EMAIL_VERIFICATION_ERROR
} = require('./helpers');

// Change email page
router.get('/profile/change-email', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.redirect(REDIRECT_PROFILE_ERROR_NOTFOUND);
    }

    res.render('auth/change-email', {
      title: 'Email cím módosítása',
      user,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'changeEmailPage' }, 'Change email page error');
    res.redirect(REDIRECT_PROFILE);
  }
});

// Change email POST
router.post('/profile/change-email', requireAuth, [
  body('newEmail')
    .isEmail().withMessage(MESSAGE_VALID_EMAIL)
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Jelszó kötelező')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/auth/profile/change-email?error=validation');
    }

    const { userId } = req.session;
    const { newEmail, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Fetch user object
    const user = await User.findByPk(userId);
    if (!user) {
      logger.error({ service: 'auth', operation: 'changeEmail', userId }, 'User not found');
      return res.redirect('/auth/profile/change-email?error=user_not_found');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.redirect('/auth/profile/change-email?error=invalid_password');
    }

    // Check if new email is same as current
    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return res.redirect('/auth/profile/change-email?error=same_email');
    }

    const result = await authService.initiateEmailChange(
      user,  // <- user object, not userId
      newEmail,
      ipAddress
    );

    if (!result.success) {
      return res.redirect(`/auth/profile/change-email?error=${result.error}`);
    }

    // Send verification emails
    try {
      await emailService.sendEmailChangeVerification(
        user,
        result.oldEmailToken,
        result.newEmailToken
      );
    } catch (emailError) {
      logger.error({ err: emailError, service: 'auth', operation: 'sendEmailChange' }, 'Email sending error');
      return res.redirect('/auth/profile/change-email?error=email_failed');
    }

    logger.info({
      service: 'auth',
      operation: 'emailChangeInit',
      userId: user.id,
      oldEmail: user.email,
      newEmail
    }, 'Email change verification sent');
    res.redirect('/auth/profile/change-email?success=verification_sent');
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'changeEmail' }, 'Change email error');
    res.redirect('/auth/profile/change-email?error=server');
  }
});

// Verify email change - old email
router.get('/verify-email-change/old/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: { oldEmailVerificationToken: token }
    });

    if (!user || !user.pendingEmail) {
      logger.warn({
        service: 'authEmail',
        operation: 'verifyOldEmail',
        token: token.substring(0, 10),
        reason: user ? 'no_pending_email' : 'user_not_found'
      }, 'Email change verification failed - invalid old token');
      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: false,
        message: 'Érvénytelen vagy lejárt megerősítő link.'
      });
    }

    await user.update({ emailChangeVerifiedOld: true });

    if (user.emailChangeVerifiedNew) {
      await user.update({
        email: user.pendingEmail,
        pendingEmail: null,
        oldEmailVerificationToken: null,
        newEmailVerificationToken: null,
        emailChangeVerifiedOld: false,
        emailChangeVerifiedNew: false,
        emailVerified: true
      });

      logger.info({
        service: 'authEmail',
        operation: 'emailChangeCompleted',
        userId: user.id,
        email: user.email
      }, 'Email changed successfully');

      try {
        await emailService.sendEmailChangeConfirmation(user);
      } catch (emailError) {
        logger.error('Email change confirmation error:', emailError);
      }

      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: true,
        message: 'Email cím sikeresen módosítva! Mostantól az új email címével jelentkezhet be.'
      });
    }

    logger.info({
      service: 'authEmail',
      operation: 'oldEmailVerified',
      userId: user.id,
      email: user.email,
      pendingEmail: user.pendingEmail
    }, 'Email change - old verified, waiting for new');
    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: true,
      message: 'Jelenlegi email cím megerősítve! Kérjük, erősítse meg az új email címét is.'
    });
  } catch (error) {
    logger.error('Verify email change (old) error:', error);
    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: false,
      message: MESSAGE_EMAIL_VERIFICATION_ERROR
    });
  }
});

// Verify email change - new email
router.get('/verify-email-change/new/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      where: { newEmailVerificationToken: token }
    });

    if (!user || !user.pendingEmail) {
      logger.warn({
        service: 'authEmail',
        operation: 'verifyNewEmail',
        token: token.substring(0, 10),
        reason: user ? 'no_pending_email' : 'user_not_found'
      }, 'Email change verification failed - invalid new token');
      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: false,
        message: 'Érvénytelen vagy lejárt megerősítő link.'
      });
    }

    await user.update({ emailChangeVerifiedNew: true });

    if (user.emailChangeVerifiedOld) {
      const oldEmail = user.email;
      await user.update({
        email: user.pendingEmail,
        pendingEmail: null,
        oldEmailVerificationToken: null,
        newEmailVerificationToken: null,
        emailChangeVerifiedOld: false,
        emailChangeVerifiedNew: false,
        emailVerified: true
      });

      logger.info({
        service: 'authEmail',
        operation: 'emailChangeCompleted',
        userId: user.id,
        oldEmail,
        newEmail: user.email
      }, 'Email changed successfully');

      try {
        await emailService.sendEmailChangeConfirmation(user, oldEmail);
      } catch (emailError) {
        logger.error('Email change confirmation error:', emailError);
      }

      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: true,
        message: 'Email cím sikeresen módosítva! Mostantól az új email címével jelentkezhet be.'
      });
    }

    logger.info({
      service: 'authEmail',
      operation: 'newEmailVerified',
      userId: user.id,
      pendingEmail: user.pendingEmail
    }, 'Email change - new verified, waiting for old');
    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: true,
      message: 'Új email cím megerősítve! Kérjük, erősítse meg a jelenlegi email címét is.'
    });
  } catch (error) {
    logger.error('Verify email change (new) error:', error);
    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: false,
      message: MESSAGE_EMAIL_VERIFICATION_ERROR
    });
  }
});

// Request verification email page (public - no auth required)
router.get('/request-verification', async (req, res) => {
  try {
    res.render('auth/resend-verification', {
      title: 'Megerősítő email újraküldése',
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error('Request verification page error:', error);
    res.redirect('/auth/login');
  }
});

// Request verification email POST (public - no auth required)
router.post('/request-verification', [
  body('email')
    .isEmail().withMessage(MESSAGE_VALID_EMAIL)
    .normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/auth/request-verification?error=validation');
    }

    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.redirect('/auth/request-verification?error=not_found');
    }

    if (user.emailVerified) {
      return res.redirect('/auth/request-verification?error=already_verified');
    }

    // Generate new token if expired or missing
    if (!user.emailVerificationToken) {
      user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
      await user.save();
    }

    // Send verification email
    try {
      await sendVerificationEmail(user, req);
      logger.info({
        service: 'authEmail',
        operation: 'requestVerification',
        email: user.email
      }, 'Verification email sent');
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      return res.redirect('/auth/request-verification?error=email_error');
    }

    res.redirect('/auth/request-verification?success=true');
  } catch (error) {
    logger.error('Request verification error:', error);
    res.redirect('/auth/request-verification?error=server');
  }
});

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: false,
        message: 'Hiányzó megerősítő token.'
      });
    }

    const user = await User.findOne({
      where: { emailVerificationToken: token }
    });

    if (!user) {
      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: false,
        message: 'Érvénytelen vagy lejárt megerősítő token.'
      });
    }

    if (user.emailVerified) {
      return res.render(VIEW_VERIFICATION_RESULT, {
        title: TITLE_EMAIL_VERIFICATION,
        success: true,
        message: 'Az email címe már korábban megerősítésre került.'
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    if (req.session.userId === user.id) {
      req.session.user = user.toSafeJSON();
    }

    logger.info({
      service: 'authEmail',
      operation: 'emailVerified',
      userId: user.id,
      email: user.email
    }, 'Email verified successfully');

    if (req.session.userId === user.id) {
      return res.redirect(`/auth/profile?success=${encodeURIComponent('Email címed sikeresen megerősítve!')}`);
    }

    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: true,
      message: 'Email címed sikeresen megerősítve! Most már bejelentkezhetsz.'
    });
  } catch (error) {
    logger.error('Verify email error:', error);
    res.render(VIEW_VERIFICATION_RESULT, {
      title: TITLE_EMAIL_VERIFICATION,
      success: false,
      message: MESSAGE_EMAIL_VERIFICATION_ERROR
    });
  }
});

module.exports = router;
