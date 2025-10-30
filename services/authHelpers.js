const logger = require('../config/logger');
const emailService = require('../services/emailService');
const elasticEmailService = require('../services/elasticEmailService');
const settingsService = require('../services/settingsService');
const { User } = require('../models');

// Helper function for sending verification email
async function sendVerificationEmail(user, _req) {
  // Get site configuration
  const siteDomain = await settingsService.get('site.domain');
  const siteName = await settingsService.get('site.name');
  const companyName = await settingsService.get('company.name');

  const verificationUrl = `${siteDomain}/auth/verify-email?token=${user.emailVerificationToken}`;

  await emailService.sendEmail({
    to: user.email,
    subject: `${siteName} - Üdvözlünk! Email megerősítés szükséges`,
    text: `Kedves ${user.name}!\n\nÜdvözlünk a ${siteName} oldalon!\n\n`
          + `A regisztráció befejezéséhez kérjük, erősítsd meg email címedet:\n${verificationUrl}\n\n`
          + `Üdvözlettel,\n${siteName} csapat`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); 
                    color: white; padding: 30px; text-align: center; 
                    border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">🎉 Üdvözlünk!</h1>
        </div>
        <div style="padding: 30px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
          <p style="margin: 0 0 20px 0; font-size: 16px;">Kedves <strong>${user.name}</strong>!</p>
          <p style="margin: 0 0 25px 0; line-height: 1.6;">
            Köszönjük, hogy regisztráltál a ${siteName} oldalon! 
            A regisztráció befejezéséhez kérjük, erősítsd meg email címedet:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="display: inline-block; background-color: #2563eb; color: white; 
                      padding: 15px 30px; text-decoration: none; border-radius: 8px; 
                      font-weight: 600; font-size: 16px;">
              ✅ Email megerősítése
            </a>
          </div>
          <p style="margin: 25px 0 0 0; font-size: 14px; color: #6c757d; line-height: 1.5;">
            Ha a gomb nem működik, másold be ezt a linket a böngésződbe:<br>
            <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
          <p style="margin: 0; font-size: 12px; color: #6c757d; text-align: center;">
            © ${new Date().getFullYear()} ${siteName} - ${companyName}
          </p>
        </div>
      </div>
    `
  });
}

// Helper function for user registration logic
async function createUserAccount(userData) {
  const { name, email, phone, password, role } = userData;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return { error: 'exists' };
  }

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    password,
    role,
    emailVerificationToken: User.generateVerificationToken()
  });

  return { user };
}

// Helper function for handling registration success
async function handleRegistrationSuccess(user, req, res) {
  logger.info({
    service: 'authHelpers',
    operation: 'registrationSuccess',
    userId: user.id,
    email: user.email,
    role: user.role
  }, 'New user registered');

  // Auto-login after registration
  req.session.userId = user.id;
  req.session.user = user.toSafeJSON();
  delete req.session.formData;

  // Send verification email
  try {
    await sendVerificationEmail(user, req);
    logger.info({
      service: 'authHelpers',
      operation: 'sendWelcomeEmail',
      userId: user.id,
      email: user.email
    }, 'Welcome email sent to new user');
  } catch (emailError) {
    logger.error('Failed to send welcome email:', emailError);
  }

  // Add user to newsletter list
  try {
    await elasticEmailService.addContact({
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role
    });
    logger.info({
      service: 'authHelpers',
      operation: 'addToNewsletter',
      userId: user.id,
      email: user.email,
      role: user.role
    }, 'User added to newsletter list');
  } catch (newsletterError) {
    logger.error('Failed to add user to newsletter:', newsletterError);
    // Don't fail registration if newsletter signup fails
  }

  res.redirect('/?registered=1');
}

module.exports = {
  sendVerificationEmail,
  createUserAccount,
  handleRegistrationSuccess
};
