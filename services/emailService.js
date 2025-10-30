/* eslint-disable max-len */
// HTML email templates contain long inline styles for email client compatibility
require('dotenv').config();
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../config/logger');
const emailTemplateService = require('./emailTemplateService');

// Company name constant for email footers
const COMPANY_NAME = 'DMF Art Média Kft.';

// Locale constant for date formatting
const LOCALE_HU = 'hu-HU';

// Error messages
const MSG_ADMIN_EMAIL_NOT_CONFIGURED = 'Admin email not configured';
const LOG_MSG_ADMIN_EMAIL_NOT_CONFIGURED = 'Admin email address not configured';

/**
 * Email Service with OAuth2 and SMTP support
 * Supports both OAuth2 for Gmail/Google Workspace and traditional SMTP
 */
class EmailService {
  /**
   * Constructor - Initialize email service
   */
  constructor() {
    this.transporter = null;
    this.oauth2Client = null;
    this.initialized = false;
    this.currentMethod = null;
    this.config = null; // Will be loaded dynamically
    // Don't initialize in constructor - do it async when needed
  }

  /**
   * Load configuration from settings service
   */
  async loadConfig() {
    // Always reload config to get fresh settings from database
    // Don't cache config as admin settings can change

    try {
      const { Setting } = require('../models');

      this.config = {
        // Gmail OAuth2 settings
        clientId: await Setting.get('email.oauth2_client_id'),
        clientSecret: await Setting.get('email.oauth2_client_secret'),
        redirectUri: 'https://developers.google.com/oauthplayground',
        refreshToken: await Setting.get('email.oauth2_refresh_token'),
        // SMTP settings
        host: await Setting.get('email.host'),
        port: parseInt(await Setting.get('email.port')) || 587,
        secure: (await Setting.get('email.secure')) === 'true'
                || (await Setting.get('email.port')) === '465',
        smtpUser: await Setting.get('email.user'),
        smtpPassword: await Setting.get('email.password'),
        // OAuth2 user (Gmail account)
        oauth2User: await Setting.get('email.oauth2_user'),
        // Email addresses
        fromName: await Setting.get('general.site_name'),
        fromAddress: await Setting.get('email.from'),
        adminAddress: await Setting.get('email.admin'),
        bookingAddress: await Setting.get('email.booking'),
        domain: await Setting.get('general.domain'),
        // Email method preference: 'oauth2' or 'smtp'
        preferredMethod: await Setting.get('email.method') || 'smtp'
      };

      logger.info({
        service: 'email',
        operation: 'loadConfig',
        method: this.config.preferredMethod
      }, 'Email configuration loaded from database settings');
    } catch (error) {
      logger.error('Failed to load email configuration:', error);
      throw error;
    }
  }

  /**
   * Check if OAuth2 configuration is complete
   * @returns {boolean} OAuth2 config validity
   */
  hasOAuth2Config() {
    return Boolean(
      this.config.clientId
      && this.config.clientSecret
      && this.config.refreshToken
      && this.config.oauth2User
    );
  }

  /**
   * Check if SMTP configuration is complete
   * @returns {boolean} SMTP config validity
   */
  hasSMTPConfig() {
    return Boolean(
      this.config.host
      && this.config.smtpUser
      && this.config.smtpPassword
    );
  }

  /**
   * Determine which email method to use based on configuration and preference
   * @returns {string} Email method to use: 'oauth2' or 'smtp'
   */
  determineEmailMethod() {
    const { preferredMethod } = this.config;
    const hasOAuth2 = this.hasOAuth2Config();
    const hasSMTP = this.hasSMTPConfig();

    switch (preferredMethod) {
      case 'oauth2':
        if (hasOAuth2) {
          return 'oauth2';
        }
        throw new Error(
          'OAuth2 selected but configuration incomplete. '
          + 'Please check: client_id, client_secret, refresh_token, and oauth2.user settings.'
        );

      case 'smtp':
        if (hasSMTP) {
          return 'smtp';
        }
        throw new Error(
          'SMTP selected but configuration incomplete. '
          + 'Please check: host, port, user, and password settings.'
        );

      default:
        throw new Error(`Unknown email method: ${this.config.preferredMethod}. Use 'smtp' or 'oauth2'`);
    }
  }

  /**
   * Initialize the email transporter based on configuration and preference
   */
  async initializeTransporter() {
    try {
      // Always reinitialize to handle config changes
      // Load fresh config first
      await this.loadConfig();

      const method = this.determineEmailMethod();
      const hasOAuth2 = this.hasOAuth2Config();
      const hasSMTP = this.hasSMTPConfig();

      this.currentMethod = method;

      if (method === 'oauth2') {
        await this.initializeOAuth2();
      } else {
        await this.initializeSMTP();
      }

      this.initialized = true;
      logger.info({
        service: 'email',
        method: method.toUpperCase(),
        hasOAuth2,
        hasSMTP,
        preferredMethod: this.config.preferredMethod
      }, 'Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
      throw error;
    }
  }

  /**
   * Initialize OAuth2 transporter
   */
  async initializeOAuth2() {
    try {
      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        this.config.clientId,
        this.config.clientSecret,
        this.config.redirectUri
      );

      this.oauth2Client.setCredentials({
        // eslint-disable-next-line camelcase -- Google OAuth2 API field
        refresh_token: this.config.refreshToken
      });

      // Get access token
      const { token: accessToken } = await this.oauth2Client.getAccessToken();

      // Create transporter with OAuth2
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.config.oauth2User,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
          refreshToken: this.config.refreshToken,
          accessToken
        }
      });

      // Verify the OAuth2 connection
      await this.transporter.verify();

      logger.info({
        service: 'email',
        operation: 'initializeOAuth2',
        user: this.config.user
      }, 'OAuth2 email transporter initialized and verified');
    } catch (error) {
      logger.error('OAuth2 initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize SMTP transporter
   */
  async initializeSMTP() {
    const transportConfig = {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPassword
      }
    };

    // Add TLS configuration for non-secure connections
    if (!this.config.secure) {
      transportConfig.tls = {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      };
    }

    this.transporter = nodemailer.createTransport(transportConfig);

    // Verify the SMTP connection
    await this.transporter.verify();

    logger.info(
      `SMTP email transporter initialized and verified: ${this.config.host}:${this.config.port} `
      + `(secure: ${this.config.secure})`
    );
  }

  /**
     * Initialize basic SMTP transporter (fallback)
     */
  initializeBasicSMTP() {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    logger.info({
      service: 'email',
      operation: 'initializeSMTP',
      host: this.config.host,
      user: this.config.user
    }, 'Basic SMTP email transporter initialized');
  }

  /**
     * Verify email configuration
     * @returns {Promise<boolean>} Connection status
     */
  async verifyConnection() {
    try {
      // Load config first
      await this.loadConfig();

      // Debug info
      const method = this.determineEmailMethod();
      logger.debug({
        service: 'email',
        selectedMethod: method,
        preferredMethod: this.config.preferredMethod,
        hasOAuth2: this.hasOAuth2Config(),
        hasSMTP: this.hasSMTPConfig(),
        oauth2Details: {
          clientId: this.config.clientId ? 'SET' : 'MISSING',
          clientSecret: this.config.clientSecret ? 'SET' : 'MISSING',
          refreshToken: this.config.refreshToken ? 'SET' : 'MISSING',
          oauth2User: this.config.oauth2User ? 'SET' : 'MISSING'
        }
      }, 'Email test debug info');

      // Always reinitialize to get fresh config
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Failed to initialize email transporter');
      }

      await this.transporter.verify();
      logger.info({
        service: 'email',
        operation: 'verifyConnection',
        method: this.config.preferredMethod
      }, 'Email server connection verified');

      return true;
    } catch (error) {
      logger.error('Email server connection failed:', error);

      return false;
    }
  }

  /**
     * Send email
     * @param {Object} options - Email options
     * @param {string} options.to - Recipient email address
     * @param {string} options.subject - Email subject
     * @param {string} options.text - Plain text content
     * @param {string} options.html - HTML content (optional)
     * @param {string} options.from - Sender email (optional, uses default)
     * @returns {Promise<Object>} Send result
     */
  async sendEmail(options) {
    try {
      // Load fresh config and reinitialize
      await this.loadConfig();
      await this.initializeTransporter();

      if (!this.transporter) {
        throw new Error('Failed to initialize email transporter');
      }

      logger.debug({
        service: 'email',
        currentMethod: this.currentMethod,
        transporterType: this.transporter.options?.service || this.transporter.options?.host,
        recipient: options.to
      }, 'Sending email');

      const defaultFrom = `"${this.config.fromName}" <${this.config.fromAddress}>`;
      const mailOptions = {
        from: options.from || defaultFrom,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || null
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info({
        service: 'email',
        operation: 'sendEmail',
        to: options.to,
        subject: options.subject,
        messageId: info.messageId
      }, 'Email sent successfully');

      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      logger.error({
        service: 'email',
        operation: 'sendEmail',
        to: options.to,
        subject: options.subject,
        error: error.message
      }, 'Failed to send email');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send cron job error notification email to admin
   * Uses centralized email template service with Design System tokens
   * @param {Object} error - Error object
   * @param {string} cronJobName - Name of the cron job
   * @param {Object} additionalData - Additional context data
   * @returns {Promise<Object>} Send result
   */
  async sendCronErrorNotification(error, cronJobName, additionalData = {}) {
    try {
      // Load configuration first
      await this.loadConfig();
      await this.initializeTransporter();

      if (!this.config.adminAddress) {
        logger.warn({
          service: 'email',
          operation: 'sendCronErrorNotification',
          cronJobName
        }, LOG_MSG_ADMIN_EMAIL_NOT_CONFIGURED);

        return { success: false, error: MSG_ADMIN_EMAIL_NOT_CONFIGURED };
      }

      const emailMethod = this.currentMethod || 'unknown';
      const timestamp = new Date().toLocaleString(LOCALE_HU);

      // Generate email using centralized template service
      const emailTemplate = emailTemplateService.generateCronErrorEmail({
        cronJobName,
        errorMessage: error.message || 'Ismeretlen hiba történt',
        stackTrace: error.stack || null,
        additionalData,
        timestamp,
        emailMethod,
        siteName: this.config.fromName,
        companyName: COMPANY_NAME
      });

      const result = await this.sendEmail({
        to: this.config.adminAddress,
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html
      });

      if (result.success) {
        logger.info({
          service: 'email',
          operation: 'cronErrorNotification',
          cronJobName,
          messageId: result.messageId
        }, 'Cron error notification sent');
      }

      return result;
    } catch (emailError) {
      logger.error('Failed to send cron error notification:', emailError);

      return { success: false, error: emailError.message };
    }
  }

  /**
   * Send critical error notification email
   * @param {Object} error - Error object
   * @param {string} context - Context where error occurred
   * @param {Object} _additionalData - Additional debug data (reserved for future use)
   * @returns {Promise<Object>} Send result
   */
  async sendCriticalErrorNotification(error, context, _additionalData = {}) {
    try {
      await this.loadConfig();

      if (!this.config.adminAddress) {
        logger.warn({
          service: 'email',
          operation: 'sendCriticalErrorNotification',
          context
        }, LOG_MSG_ADMIN_EMAIL_NOT_CONFIGURED);
        return { success: false, error: MSG_ADMIN_EMAIL_NOT_CONFIGURED };
      }

      const { subject, html, text } = emailTemplateService.generateNotificationEmail({
        title: `KRITIKUS HIBA - ${context}`,
        message: `Kontextus: ${context}\nHiba: ${error.message || 'Ismeretlen hiba'}\n\nStack trace:\n${error.stack || 'N/A'}`,
        variant: 'error',
        siteName: this.config.fromName,
        companyName: COMPANY_NAME
      });

      return await this.sendEmail({
        to: this.config.adminAddress,
        subject,
        text,
        html
      });
    } catch (emailError) {
      logger.error('Failed to send critical error notification:', emailError);
      return { success: false, error: emailError.message };
    }
  }

  async sendNotificationEmail(subject, message) {
    try {
      await this.loadConfig();

      if (!this.config.adminAddress) {
        logger.warn({
          service: 'email',
          operation: 'sendNotificationEmail',
          subject
        }, LOG_MSG_ADMIN_EMAIL_NOT_CONFIGURED);
        return { success: false, error: MSG_ADMIN_EMAIL_NOT_CONFIGURED };
      }

      const { subject: emailSubject, html, text } = emailTemplateService.generateNotificationEmail({
        title: subject,
        message,
        variant: 'info',
        siteName: this.config.fromName,
        companyName: COMPANY_NAME
      });

      return await this.sendEmail({
        to: this.config.adminAddress,
        subject: emailSubject,
        text,
        html
      });
    } catch (emailError) {
      logger.error('Failed to send notification email:', emailError);
      return { success: false, error: emailError.message };
    }
  }

  /**
   * Send test email
   * @param {string} to - Test recipient email
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(to) {
    // Load fresh config and reinitialize
    await this.loadConfig();
    await this.initializeTransporter();

    const method = this.currentMethod || 'unknown';
    const subject = `${this.config.fromName} - Email teszt`;
    const text = `Ez egy teszt email a ${this.config.fromName} rendszerből ${method.toUpperCase()} módszerrel. `
      + 'Ha megkapta, az email konfiguráció megfelelően működik!';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">📧 Email Teszt</h1>
          <p style="margin: 5px 0 0 0;">${this.config.fromName}</p>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <p>${text}</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Email módszer:</strong> ${method.toUpperCase()}</p>
            <p><strong>Időpont:</strong> ${new Date().toLocaleString(LOCALE_HU)}</p>
            <p><strong>Konfiguráció:</strong></p>
            <ul>
              <li>OAuth2 elérhető: ${this.hasOAuth2Config() ? '✅' : '❌'}</li>
              <li>SMTP elérhető: ${this.hasSMTPConfig() ? '✅' : '❌'}</li>
              <li>Preferált módszer: ${this.config.preferredMethod}</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject,
      text,
      html: htmlContent
    });
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetUrl - Password reset URL with token
   * @param {string} siteName - Site name for email
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(user, resetUrl, siteName) {
    await this.loadConfig();
    await this.initializeTransporter();

    const subject = `${siteName} - Jelszó visszaállítás`;
    const text = `Kedves ${user.name}!\n\n`
          + `Jelszó visszaállítást kértél a ${siteName} oldalon.\n\n`
          + `A jelszó visszaállításához kattints az alábbi linkre:\n${resetUrl}\n\n`
          + 'Ez a link 1 órán belül jár le.\n\n'
          + 'Ha nem te kérted a jelszó visszaállítást, figyelmen kívül hagyhatod ezt az emailt.\n\n'
          + `Üdvözlettel,\n${siteName} csapat`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); 
                    color: white; padding: 30px; text-align: center; 
                    border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">🔐 Jelszó visszaállítás</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 20px 0; font-size: 16px;">Kedves <strong>${user.name}</strong>!</p>
          <p style="margin: 0 0 25px 0; line-height: 1.6;">
            Jelszó visszaállítást kértél a ${siteName} oldalon. 
            A jelszó visszaállításához kattints az alábbi gombra:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; 
                      padding: 15px 30px; text-decoration: none; border-radius: 8px; 
                      font-weight: 600; font-size: 16px;">
              🔑 Jelszó visszaállítása
            </a>
          </div>
          <p style="margin: 25px 0; padding: 15px; background-color: #fff3cd; 
                    border-left: 4px solid #ffc107; color: #856404; font-size: 14px;">
            ⚠️ Ez a link 1 órán belül jár le.
          </p>
          <p style="margin: 25px 0 0 0; font-size: 14px; color: #6c757d; line-height: 1.5;">
            Ha a gomb nem működik, másold be ezt a linket a böngésződbe:<br>
            <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
          </p>
          <p style="margin: 25px 0 0 0; padding: 15px; background-color: #d1ecf1; 
                    border-left: 4px solid #0c5460; color: #0c5460; font-size: 14px;">
            ℹ️ Ha nem te kérted a jelszó visszaállítást, figyelmen kívül hagyhatod ezt az emailt. 
            A jelszavad nem fog megváltozni.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; text-align: center;">
            © ${new Date().getFullYear()} ${siteName} - ${COMPANY_NAME}
          </p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send password changed notification
   * @param {Object} user - User object
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordChangedNotification(user) {
    await this.loadConfig();
    await this.initializeTransporter();

    const { Setting } = require('../models');
    const siteName = await Setting.get('general.site_name') || this.config.fromName;
    const companyName = await Setting.get('company.name') || 'DMF Zrt.';

    const { subject, html, text } = emailTemplateService.generatePasswordChangedEmail({
      user,
      siteName,
      companyName
    });

    return await this.sendEmail({
      to: user.email,
      subject,
      text,
      html
    });
  }

  /**
   * Send email change verification emails (both old and new)
   * @param {Object} user - User object
   * @param {string} oldEmailToken - Token for old email verification
   * @param {string} newEmailToken - Token for new email verification
   * @returns {Promise<Object>} Send result
   */
  async sendEmailChangeVerification(user, oldEmailToken, newEmailToken) {
    await this.loadConfig();
    await this.initializeTransporter();

    const { generateEmailChangeVerificationEmail } = require('./emailTemplateService-user');

    const oldEmailUrl = `${this.config.domain}/auth/verify-email-change/old/${oldEmailToken}`;
    const newEmailUrl = `${this.config.domain}/auth/verify-email-change/new/${newEmailToken}`;

    const templates = generateEmailChangeVerificationEmail({
      user,
      oldEmailUrl,
      newEmailUrl,
      fromName: this.config.fromName
    });

    // Send both emails
    const oldEmailResult = await this.sendEmail({
      to: user.email,
      subject: templates.old.subject,
      text: templates.old.text,
      html: templates.old.html
    });

    const newEmailResult = await this.sendEmail({
      to: user.pendingEmail,
      subject: templates.new.subject,
      text: templates.new.text,
      html: templates.new.html
    });

    return {
      success: oldEmailResult.success && newEmailResult.success,
      oldEmailResult,
      newEmailResult
    };
  }

  /**
   * Send email change confirmation (after both verifications complete)
   * @param {Object} user - User object with new email
   * @param {string} oldEmail - Old email address
   * @returns {Promise<Object>} Send result
   */
  async sendEmailChangeConfirmation(user, oldEmail) {
    await this.loadConfig();
    await this.initializeTransporter();

    const { generateEmailChangeConfirmationEmail } = require('./emailTemplateService-user');

    const timestamp = new Date().toLocaleString(LOCALE_HU, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const templates = generateEmailChangeConfirmationEmail({
      user,
      oldEmail,
      timestamp,
      fromName: this.config.fromName
    });

    // Send to both emails
    const oldEmailResult = await this.sendEmail({
      to: oldEmail,
      subject: templates.old.subject,
      text: templates.old.text,
      html: templates.old.html
    });

    const newEmailResult = await this.sendEmail({
      to: user.email,
      subject: templates.new.subject,
      text: templates.new.text,
      html: templates.new.html
    });

    return {
      success: oldEmailResult.success && newEmailResult.success,
      oldEmailResult,
      newEmailResult
    };
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
