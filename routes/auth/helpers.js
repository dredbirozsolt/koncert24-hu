const logger = require('../../config/logger');
const emailService = require('../../services/emailService');

// Constants
const VIEW_VERIFICATION_RESULT = 'auth/verification-result';
const TITLE_EMAIL_VERIFICATION = 'Email megerősítés';
const REDIRECT_FORGOT_PASSWORD_INVALID = '/auth/forgot-password?error=invalid_token';
const MESSAGE_VALID_EMAIL = 'Érvényes email címet adjon meg';
const HEADER_USER_AGENT = 'user-agent';
const REDIRECT_PROFILE_ERROR_NOTFOUND = '/auth/profile?error=notfound';
const REDIRECT_PROFILE = '/auth/profile';
const MESSAGE_EMAIL_VERIFICATION_ERROR = 'Hiba történt az email megerősítése során.';

// Helper function to setup session after login
const setupLoginSession = (req, res, user, callback) => {
  req.session.userId = user.id;
  req.session.user = user.toSafeJSON();

  let returnTo = req.session.returnTo || '/';
  delete req.session.returnTo;

  if (user.role === 'admin' && returnTo === '/') {
    returnTo = '/admin';
  }

  req.session.save((err) => {
    if (err) {
      logger.error('Session save error:', err);
      return res.redirect('/auth/login?error=session');
    }
    callback(returnTo);
  });
};

// Helper function to handle password change validation errors
const handlePasswordChangeValidationError = (errors) => {
  const firstError = errors.array()[0];
  if (firstError.msg.includes('nem egyeznek')) {
    return 'password_mismatch';
  }
  if (firstError.msg.includes('8 karakter')) {
    return 'weak_password';
  }
  return 'validation';
};

// Helper function to send password reset email
const sendPasswordResetWithUrl = async (user, resetToken, res) => {
  const basePath = res.locals.basePath || '/';
  const resetUrl = `${res.locals.siteDomain}${basePath}auth/reset-password?token=${resetToken}`;

  try {
    await emailService.sendPasswordResetEmail(user, resetUrl, res.locals.siteName);
    logger.info({
      service: 'auth',
      operation: 'passwordResetEmail',
      userId: user.id,
      email: user.email,
      resetUrl
    }, 'Password reset email sent');
  } catch (error) {
    logger.error({
      err: error,
      service: 'auth',
      operation: 'passwordResetEmail',
      userId: user.id,
      email: user.email
    }, 'Email service error');
    throw error;
  }
};

module.exports = {
  VIEW_VERIFICATION_RESULT,
  TITLE_EMAIL_VERIFICATION,
  REDIRECT_FORGOT_PASSWORD_INVALID,
  MESSAGE_VALID_EMAIL,
  HEADER_USER_AGENT,
  REDIRECT_PROFILE_ERROR_NOTFOUND,
  REDIRECT_PROFILE,
  MESSAGE_EMAIL_VERIFICATION_ERROR,
  setupLoginSession,
  handlePasswordChangeValidationError,
  sendPasswordResetWithUrl
};
