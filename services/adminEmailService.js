const logger = require('../config/logger');
const emailService = require('./emailService');
const emailTemplateService = require('./emailTemplateService');

/**
 * Test admin email connection and send test email
 */
async function testAdminEmailConnection() {
  logger.info({
    service: 'adminEmailTest',
    operation: 'testConnection',
    action: 'start'
  }, 'Starting admin email test');

  try {
    const { Setting } = require('../models');

    // Load admin email settings
    const adminEmail = await Setting.get('email.admin');
    const siteName = await Setting.get('general.site_name');
    const companyName = await Setting.get('company.name');

    logger.info({
      service: 'adminEmailTest',
      operation: 'loadConfig',
      adminEmail,
      siteName
    }, 'Admin email test configuration loaded');

    // Send test email
    const emailResult = await sendAdminTestEmail(adminEmail, siteName, companyName);

    return {
      success: true,
      message: 'Admin email teszt sikeres! Ellenőrizze a beérkező emaileket.',
      details: { emailResult }
    };
  } catch (error) {
    logger.error('Admin email test failed:', error);
    return {
      success: false,
      message: `Hiba történt: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Send admin test email
 */
/**
 * Send admin test email
 * Uses centralized email template service with Design System tokens
 */
async function sendAdminTestEmail(adminEmail, siteName, companyName) {
  // Load email service and initialize to get current method
  await emailService.loadConfig();
  await emailService.initializeTransporter();
  const emailMethod = emailService.currentMethod || 'unknown';

  // Generate email using centralized template service
  const emailTemplate = emailTemplateService.generateAdminTestEmail({
    adminEmail,
    emailMethod,
    timestamp: new Date().toLocaleString('hu-HU'),
    siteName,
    companyName
  });

  const emailOptions = {
    to: adminEmail,
    subject: emailTemplate.subject,
    text: emailTemplate.text,
    html: emailTemplate.html
  };

  return await emailService.sendEmail(emailOptions);
}

module.exports = {
  testAdminEmailConnection,
  sendAdminTestEmail
};
