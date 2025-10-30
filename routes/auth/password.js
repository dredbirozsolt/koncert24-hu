const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { User } = require('../../models');
const logger = require('../../config/logger');
const authService = require('../../services/authService');
const { requireNoAuth } = require('../../middleware/auth');
const { passwordResetProtection } = require('../../middleware/authProtection');
const {
  REDIRECT_FORGOT_PASSWORD_INVALID,
  HEADER_USER_AGENT,
  sendPasswordResetWithUrl
} = require('./helpers');

// Forgot Password - Show form
router.get('/forgot-password', requireNoAuth, (req, res) => {
  res.render('auth/forgot-password', {
    title: `Elfelejtett jelszó - ${res.locals.siteName}`,
    pageTitle: `Elfelejtett jelszó - ${res.locals.siteName}`,
    pageDescription: 'Jelszó helyreállítás email címmel',
    basePath: res.locals.basePath,
    error: req.query.error,
    success: req.query.success,
    email: req.query.email || ''
  });
});

// Forgot password sent confirmation
router.get('/forgot-password-sent', requireNoAuth, (req, res) => {
  res.render('auth/forgot-password-sent', {
    title: `Jelszó helyreállítás elküldve - ${res.locals.siteName}`,
    pageTitle: 'Jelszó helyreállítás elküldve',
    basePath: res.locals.basePath
  });
});

// Forgot Password - Process form with protection
router.post('/forgot-password', passwordResetProtection, requireNoAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    if (!email) {
      return res.redirect('/auth/forgot-password?error=missing');
    }

    const result = await authService.initiatePasswordReset(email, ipAddress, userAgent);

    if (!result.success) {
      if (result.error === 'notfound') {
        return res.redirect(`/auth/forgot-password?error=notfound&email=${encodeURIComponent(email)}`);
      }
      return res.redirect(`/auth/forgot-password?error=${result.error}`);
    }

    try {
      await sendPasswordResetWithUrl(result.user, result.resetToken, res);
      res.redirect('/auth/forgot-password-sent');
    } catch (emailError) {
      logger.error('Password reset email error:', emailError);
      res.redirect('/auth/forgot-password?error=email_failed');
    }
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.redirect('/auth/forgot-password?error=server');
  }
});

// Reset Password - Show form
router.get('/reset-password', requireNoAuth, async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.redirect(REDIRECT_FORGOT_PASSWORD_INVALID);
    }

    const user = await User.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.redirect(REDIRECT_FORGOT_PASSWORD_INVALID);
    }

    res.render('auth/reset-password', {
      title: `Új jelszó beállítása - ${res.locals.siteName}`,
      pageTitle: `Új jelszó beállítása - ${res.locals.siteName}`,
      pageDescription: 'Új jelszó beállítása',
      basePath: res.locals.basePath,
      token,
      error: req.query.error,
      success: req.query.success
    });
  } catch (error) {
    logger.error('Reset password page error:', error);
    res.redirect('/auth/forgot-password?error=server');
  }
});

// Reset Password - Process form
router.post('/reset-password', requireNoAuth, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get(HEADER_USER_AGENT);

    if (!token || !password || !confirmPassword) {
      return res.redirect(`/auth/reset-password?token=${token}&error=missing`);
    }

    if (password !== confirmPassword) {
      return res.redirect(`/auth/reset-password?token=${token}&error=passwords_no_match`);
    }

    if (password.length < 8) {
      return res.redirect(`/auth/reset-password?token=${token}&error=password_too_short`);
    }

    // Validate password strength
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return res.redirect(`/auth/reset-password?token=${token}&error=password_weak`);
    }

    const result = await authService.resetPassword(token, password, ipAddress, userAgent);

    if (!result.success) {
      if (result.error === 'invalid') {
        return res.redirect(REDIRECT_FORGOT_PASSWORD_INVALID);
      }
      return res.redirect(`/auth/reset-password?token=${token}&error=${result.error}`);
    }

    logger.info({
      service: 'auth',
      operation: 'passwordReset',
      userId: result.user.id,
      email: result.user.email
    }, 'Password reset successful');
    res.redirect('/auth/login?success=password_reset');
  } catch (error) {
    logger.error({ err: error, service: 'auth', operation: 'passwordReset' }, 'Reset password error');
    res.redirect(`/auth/reset-password?token=${req.body.token}&error=server`);
  }
});

module.exports = router;
