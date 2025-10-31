/**
 * Authentication Service
 * Handles authentication business logic
 */

const crypto = require('crypto');
const { User, SecurityLog } = require('../models');
const emailService = require('./emailService');
const logger = require('../config/logger');

class AuthService {
  /**
   * Validate login credentials
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ipAddress - Request IP
   * @param {string} userAgent - Request user agent
   * @returns {Promise<Object>} Result object
   */
  async validateLogin(email, password, ipAddress, userAgent) {
    const user = await User.findByEmail(email);

    if (!user) {
      await this.logFailedLogin(email, ipAddress, userAgent, 'User not found');
      return { success: false, error: 'invalid' };
    }

    if (user.isLocked()) {
      await this.logLockedLogin(user, ipAddress, userAgent);
      return { success: false, error: 'locked', lockUntil: user.lockUntil };
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      await this.logFailedLogin(email, ipAddress, userAgent, 'Invalid password', user.id);
      return { success: false, error: 'invalid' };
    }

    await this.handleSuccessfulLogin(user, ipAddress, userAgent);
    return { success: true, user };
  }

  /**
   * Handle successful login
   */
  async handleSuccessfulLogin(user, ipAddress, userAgent) {
    await user.resetLoginAttempts();
    
    // Try to update last login, but don't fail login if it errors
    try {
      await user.updateLastLogin();
    } catch (error) {
      logger.warn({
        service: 'authService',
        operation: 'updateLastLogin',
        userId: user.id,
        error: error.message,
        msg: 'Failed to update last login time (non-critical)'
      });
    }

    await SecurityLog.log('login_success', {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      severity: 'low'
    });

    logger.info({
      service: 'authService',
      operation: 'login',
      userId: user.id,
      email: user.email
    }, 'User logged in');
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(email, ipAddress, userAgent, reason, userId = null) {
    await SecurityLog.log('login_failed', {
      userId,
      email,
      ipAddress,
      userAgent,
      details: reason,
      severity: 'low'
    });
  }

  /**
   * Log locked account login attempt
   */
  async logLockedLogin(user, ipAddress, userAgent) {
    await SecurityLog.log('login_locked', {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      details: `Account locked until ${user.lockUntil}`,
      severity: 'medium'
    });
    logger.warn({
      service: 'auth',
      operation: 'login',
      email: user.email,
      lockUntil: user.lockUntil,
      ipAddress
    }, 'Login attempt on locked account');
  }

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @param {string} ipAddress - Request IP
   * @param {string} userAgent - Request user agent
   * @returns {Promise<Object>} Result object
   */
  async registerUser(userData, ipAddress, userAgent) {
    const { name, email, password, phone, role } = userData;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return { success: false, error: 'exists' };
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create user with plain text password - Sequelize hook will hash it
    const user = await User.create({
      name,
      email,
      password, // Plain text - beforeCreate hook handles hashing
      phone,
      role: role || 'user',
      emailVerificationToken,
      emailVerified: false,
      isActive: true
    });

    await SecurityLog.log('user_registered', {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      severity: 'low'
    });

    logger.info({
      service: 'authService',
      operation: 'register',
      userId: user.id,
      email
    }, 'New user registered');

    return { success: true, user, emailVerificationToken };
  }

  /**
   * Verify email token
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Result object
   */
  async verifyEmailToken(token) {
    const user = await User.findOne({ where: { emailVerificationToken: token } });

    if (!user) {
      return { success: false, error: 'invalid' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'already_verified' };
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await user.save();

    logger.info({
      service: 'authService',
      operation: 'verifyEmail',
      userId: user.id,
      email: user.email
    }, 'Email verified');

    return { success: true, user };
  }

  /**
   * Initiate password reset
   * @param {string} email - User email
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Result object
   */
  async initiatePasswordReset(email, ipAddress) {
    const user = await User.findByEmail(email);

    if (!user) {
      return { success: false, error: 'not_found' };
    }

    if (!user.canRequestPasswordReset()) {
      return { success: false, error: 'rate_limit' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.incrementPasswordResetAttempts();
    await user.save();

    await SecurityLog.log('password_reset_requested', {
      userId: user.id,
      email: user.email,
      ipAddress,
      severity: 'medium'
    });

    return { success: true, user, resetToken };
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Result object
   */
  async resetPassword(token, newPassword, ipAddress) {
    const user = await User.findOne({
      where: { passwordResetToken: token }
    });

    if (!user) {
      return { success: false, error: 'invalid_token' };
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return { success: false, error: 'expired_token' };
    }

    // Set plain text password - Sequelize hook will hash it automatically
    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.passwordResetAttempts = 0;
    await user.save();

    await SecurityLog.log('password_reset_completed', {
      userId: user.id,
      email: user.email,
      ipAddress,
      severity: 'medium'
    });

    logger.info({
      service: 'authService',
      operation: 'passwordResetCompleted',
      userId: user.id,
      email: user.email
    }, 'Password reset completed');

    try {
      await emailService.sendPasswordChangedNotification(user);
    } catch (emailError) {
      logger.error('Failed to send password changed notification:', emailError);
    }

    return { success: true, user };
  }

  /**
   * Change user password
   * @param {Object} user - User object
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Result object
   */
  async changePassword(user, oldPassword, newPassword, ipAddress, userAgent) {
    const isOldPasswordValid = await user.comparePassword(oldPassword);

    if (!isOldPasswordValid) {
      return { success: false, error: 'invalid_old_password' };
    }

    // Set plain text password - Sequelize hook will hash it automatically
    user.password = newPassword;
    
    // Save with retry logic for MySQL prepared statement errors
    await this._saveWithRetry(user);

    await SecurityLog.log('password_changed', {
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      severity: 'medium'
    });

    logger.info({
      service: 'authService',
      operation: 'passwordChanged',
      userId: user.id,
      email: user.email
    }, 'Password changed');

    try {
      await emailService.sendPasswordChangedNotification(user);
    } catch (emailError) {
      logger.error('Failed to send password changed notification:', emailError);
    }

    return { success: true };
  }

  /**
   * Initiate email change
   * @param {Object} user - User object
   * @param {string} newEmail - New email address
   * @param {string} ipAddress - Request IP
   * @returns {Promise<Object>} Result object
   */
  async initiateEmailChange(user, newEmail, ipAddress) {
    const existingUser = await User.findByEmail(newEmail);
    if (existingUser) {
      return { success: false, error: 'email_exists' };
    }

    const oldEmailToken = crypto.randomBytes(32).toString('hex');
    const newEmailToken = crypto.randomBytes(32).toString('hex');

    user.pendingEmail = newEmail;
    user.oldEmailVerificationToken = oldEmailToken;
    user.newEmailVerificationToken = newEmailToken;
    user.emailChangeVerifiedOld = false;
    user.emailChangeVerifiedNew = false;
    await user.save();

    await SecurityLog.log('email_change_requested', {
      userId: user.id,
      email: user.email,
      ipAddress,
      details: `New email: ${newEmail}`,
      severity: 'medium'
    });

    return { success: true, oldEmailToken, newEmailToken };
  }

  /**
   * Verify email change token (old or new)
   * @param {string} token - Verification token
   * @param {string} type - 'old' or 'new'
   * @returns {Promise<Object>} Result object
   */
  async verifyEmailChangeToken(token, type) {
    const whereClause = type === 'old'
      ? { emailChangeOldToken: token }
      : { emailChangeNewToken: token };

    const user = await User.findOne({ where: whereClause });

    if (!user) {
      return { success: false, error: 'invalid_token' };
    }

    if (type === 'old') {
      user.emailChangeOldVerified = true;
    } else {
      user.emailChangeNewVerified = true;
    }

    if (user.emailChangeOldVerified && user.emailChangeNewVerified) {
      const oldEmail = user.email;
      user.email = user.pendingEmail;
      user.pendingEmail = null;
      user.emailChangeOldToken = null;
      user.emailChangeNewToken = null;
      user.emailChangeOldVerified = false;
      user.emailChangeNewVerified = false;
      await user.save();

      await SecurityLog.log('email_changed', {
        userId: user.id,
        email: user.email,
        details: `Old email: ${oldEmail}`,
        severity: 'high'
      });

      return { success: true, completed: true, user, oldEmail };
    }

    await user.save();
    return { success: true, completed: false };
  }

  /**
   * Handle user logout
   * @param {Object} user - User object
   * @param {string} ipAddress - Request IP
   */
  async handleLogout(user, ipAddress) {
    await SecurityLog.log('logout', {
      userId: user.id,
      email: user.email,
      ipAddress,
      severity: 'low'
    });

    logger.info({
      service: 'authService',
      operation: 'logout',
      userId: user.id,
      email: user.email
    }, 'User logged out');
  }

  /**
   * Helper: Save model with retry logic for MySQL prepared statement errors
   * @private
   */
  async _saveWithRetry(model, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await model.save();
        logger.debug({
          service: 'authService',
          operation: '_saveWithRetry',
          attempt,
          msg: 'Model saved successfully'
        });
        return;
      } catch (error) {
        logger.warn({
          service: 'authService',
          operation: '_saveWithRetry',
          attempt,
          maxRetries,
          errorCode: error.original?.code,
          willRetry: error.original?.code === 'ER_NEED_REPREPARE' && attempt < maxRetries,
          msg: 'Save attempt failed'
        });
        
        // Retry on prepared statement errors
        if (error.original?.code === 'ER_NEED_REPREPARE' && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
          // eslint-disable-next-line no-continue
          continue;
        }
        throw error;
      }
    }
  }
}

module.exports = new AuthService();
