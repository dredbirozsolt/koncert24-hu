const logger = require('../config/logger');
const emailService = require('./emailService');
const emailTemplateService = require('./emailTemplateService');

/**
 * Send booking notification email to admin
 */
async function sendBookingNotificationEmail(bookingData, performer, bookingId) {
  try {
    const { Setting } = require('../models');
    const bookingEmail = await Setting.get('email.booking');

    if (!bookingEmail) {
      throw new Error('Booking email not configured in settings');
    }

    const siteName = await Setting.get('general.site_name') || 'Koncert24';

    const eventTypeLabels = {
      outdoorFree: 'Nyilvános ingyenes rendezvény szabadtéren',
      outdoorPaid: 'Nyilvános belépőjegyes rendezvény szabadtéren',
      indoorFree: 'Nyilvános ingyenes rendezvény zárt helyiségben',
      indoorPaid: 'Nyilvános belépőjegyes rendezvény zárt helyiségben',
      privatePersonal: 'Zártkörű magánrendezvény',
      privateCorporate: 'Zártkörű céges rendezvény',
      wedding: 'Esküvő',
      corporate: 'Céges rendezvény',
      birthday: 'Születésnap',
      festival: 'Fesztivál',
      private: 'Magánrendezvény',
      other: 'Egyéb'
    };

    const eventTypeText = eventTypeLabels[bookingData.eventType] || bookingData.eventType || 'Nincs megadva';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
        Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">🎉 Új Foglalás Érkezett!</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
            <p style="margin: 0; color: #92400e;">
              ⚠️ Új foglalás érkezett! Kérjük, vegye fel a kapcsolatot az ügyféllel.
            </p>
          </div>
          
          <h3>🎤 Előadó: ${performer.name}</h3>
          <p><strong>Foglalás #${bookingId}</strong></p>
          
          <h3>📅 Rendezvény részletei</h3>
          <p><strong>Dátum:</strong> ${bookingData.eventDate || 'Nincs megadva'}${bookingData.eventDateFlexible ? ' <em>(Még nem fix a dátum)</em>' : ''}</p>
          <p><strong>Időpont:</strong> ${bookingData.eventTime || 'Nincs megadva'}${bookingData.eventTimeFlexible ? ' <em>(Még nem fix az időpont)</em>' : ''}</p>
          <p><strong>Helyszín:</strong> ${bookingData.eventLocation || 'Nincs megadva'}</p>
          ${bookingData.venueAddress ? `<p><strong>Pontos cím:</strong> ${bookingData.venueAddress}</p>` : ''}
          <p><strong>Típus:</strong> ${eventTypeText}</p>
          <p><strong>Vendégszám:</strong> ${bookingData.guestCount || 'Nincs megadva'}</p>
          ${bookingData.eventName ? `<p><strong>Rendezvény neve:</strong> ${bookingData.eventName}</p>` : ''}
          ${bookingData.eventCategory ? `<p><strong>Kategória:</strong> ${bookingData.eventCategory}</p>` : ''}
          
          <h3>👤 Kapcsolattartó (szerződéses)</h3>
          <p><strong>Név:</strong> ${bookingData.contactName}</p>
          <p><strong>E-mail:</strong> ${bookingData.contactEmail}</p>
          <p><strong>Telefon:</strong> ${bookingData.contactPhone || 'Nincs megadva'}</p>
          
          <h3>🧾 Megrendelő adatai</h3>
          <p><strong>Név/Cégnév:</strong> ${bookingData.clientName}</p>
          <p><strong>Székhely:</strong> ${bookingData.clientAddress}</p>
          <p><strong>Adószám:</strong> ${bookingData.taxNumber}</p>
          ${
  bookingData.registrationNumber
    ? `<p><strong>Cégjegyzékszám:</strong> ${bookingData.registrationNumber}</p>`
    : ''
}
          <p><strong>Képviselő / Anyja neve:</strong> ${bookingData.representativeName}</p>
          
          <h3>📇 Kapcsolattartók</h3>
          <h4 style="margin: 10px 0 5px 0;">Rendezvény napi kapcsolattartó:</h4>
          <p style="margin: 5px 0;"><strong>Név:</strong> ${bookingData.eventDayContactName}</p>
          ${
  bookingData.eventDayContactEmail
    ? `<p style="margin: 5px 0;"><strong>E-mail:</strong> ${bookingData.eventDayContactEmail}</p>`
    : ''
}
          <p style="margin: 5px 0;"><strong>Telefon:</strong> ${bookingData.eventDayContactPhone}</p>
          
          <h4 style="margin: 15px 0 5px 0;">Technikai kapcsolattartó:</h4>
          <p style="margin: 5px 0;"><strong>Név:</strong> ${bookingData.techContactName}</p>
          <p style="margin: 5px 0;"><strong>E-mail:</strong> ${bookingData.techContactEmail}</p>
          <p style="margin: 5px 0;"><strong>Telefon:</strong> ${bookingData.techContactPhone}</p>
          
          ${
  bookingData.billingEmail
    ? `<h3>📧 Számlázás</h3><p><strong>Számlázási e-mail:</strong> ${bookingData.billingEmail}</p>`
    : ''
}
          
          ${bookingData.notes ? `<h3>💬 Megjegyzés</h3><p>${bookingData.notes}</p>` : ''}
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: bookingEmail,
      subject: `🎉 Új Foglalás #${bookingId} - ${performer.name}`,
      html: htmlContent,
      text: `Új foglalás érkezett!\n\nFoglalás #${bookingId}\nEloadó: ${performer.name}\n\n`
        + `Kapcsolattartó: ${bookingData.contactName}\nE-mail: ${bookingData.contactEmail}`
    });

    logger.info({
      service: 'bookingEmail',
      operation: 'sendNotification',
      bookingId,
      to: bookingEmail
    }, 'Booking notification email sent');
  } catch (error) {
    logger.error({
      service: 'bookingEmail',
      operation: 'sendNotification',
      error: error.message
    }, 'Failed to send booking notification email');
    throw error;
  }
}

/**
 * Send booking confirmation email to customer
 */
async function sendBookingConfirmationEmail(bookingData, performer, bookingId) {
  try {
    const { Setting } = require('../models');
    const siteName = await Setting.get('general.site_name') || 'Koncert24';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
        Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">✅ Foglalási igény Elküldve</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p>Kedves ${bookingData.contactName}!</p>
          <p>A foglalási igényét sikeresen fogadtuk.</p>
          
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;">✅ Kollégáink hamarosan felveszik Önnel a kapcsolatot.</p>
          </div>
          
          <p><strong>Foglalás #${bookingId}</strong></p>
          
          <h3>🎤 Előadó: ${performer.name}</h3>
          
          <h3>📅 Rendezvény részletei</h3>
          <p><strong>Dátum:</strong> ${bookingData.eventDate || 'Nincs megadva'}${bookingData.eventDateFlexible ? ' <em>(Még nem fix a dátum)</em>' : ''}</p>
          <p><strong>Időpont:</strong> ${bookingData.eventTime || 'Nincs megadva'}${bookingData.eventTimeFlexible ? ' <em>(Még nem fix az időpont)</em>' : ''}</p>
          <p><strong>Helyszín:</strong> ${bookingData.eventLocation || 'Nincs megadva'}</p>
          
          <p style="margin-top: 30px;">Köszönjük, hogy a ${siteName}-t választotta!</p>
        </div>
      </div>
    `;

    await emailService.sendEmail({
      to: bookingData.contactEmail,
      subject: `✅ Foglalás Megerősítés - ${performer.name}`,
      html: htmlContent,
      text: `Kedves ${bookingData.contactName}!\n\n`
        + 'Köszönjük foglalását! Kollégáink hamarosan felveszik Önnel a kapcsolatot.\n\n'
        + `Foglalás #${bookingId}\nElőadó: ${performer.name}`
    });

    logger.info({
      service: 'bookingEmail',
      operation: 'sendConfirmation',
      bookingId,
      to: bookingData.contactEmail
    }, 'Booking confirmation email sent');
  } catch (error) {
    logger.error({
      service: 'bookingEmail',
      operation: 'sendConfirmation',
      error: error.message
    }, 'Failed to send booking confirmation email');
    throw error;
  }
}

/**
 * Test booking email connection and send test email
 */
async function testBookingEmailConnection() {
  logger.info({
    service: 'bookingEmailTest',
    operation: 'testConnection',
    action: 'start'
  }, 'Starting booking email test');

  try {
    const { Setting } = require('../models');

    // Load booking email settings
    const bookingEmail = await Setting.get('email.booking');
    const siteName = await Setting.get('general.site_name');
    const companyName = await Setting.get('company.name');

    logger.info({
      service: 'bookingEmailTest',
      operation: 'loadConfig',
      bookingEmail,
      siteName
    }, 'Booking email test configuration loaded');

    // Send test email
    const emailResult = await sendBookingTestEmail(bookingEmail, siteName, companyName);

    return {
      success: true,
      message: 'Booking email teszt sikeres! Ellenőrizze a beérkező emaileket.',
      details: { emailResult }
    };
  } catch (error) {
    logger.error('Booking email test failed:', error);
    return {
      success: false,
      message: `Hiba történt: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Send booking test email
 */
async function sendBookingTestEmail(bookingEmail, siteName, companyName) {
  // Load email service and initialize to get current method
  await emailService.loadConfig();
  await emailService.initializeTransporter();
  const emailMethod = emailService.currentMethod || 'unknown';

  // Ensure we have default values
  const finalSiteName = siteName || 'Koncert24.hu';
  const finalCompanyName = companyName || 'Koncert24';

  // Generate email using Design System template
  const { subject, html, text } = emailTemplateService.generateBookingEmail({
    bookingEmail,
    siteName: finalSiteName,
    companyName: finalCompanyName,
    emailMethod,
    bookingData: null // null = test email
  });

  const emailOptions = {
    to: bookingEmail,
    subject,
    text,
    html
  };

  return await emailService.sendEmail(emailOptions);
}

module.exports = {
  sendBookingNotificationEmail,
  sendBookingConfirmationEmail,
  testBookingEmailConnection,
  sendBookingTestEmail
};
