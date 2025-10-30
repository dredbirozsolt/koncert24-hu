/**
 * Quote Email Service
 * Handles sending quote request notification emails to booking email address
 * and confirmation emails to customers
 */

const emailService = require('./emailService');
const { Setting } = require('../models');
const logger = require('../config/logger');

// Constants
const TEXT_PLACEHOLDER = 'Nincs megadva';
const PERFORMER_COUNT_SINGLE = 'Egy előadó';
const PERFORMER_COUNT_MULTIPLE = 'Több előadó';

// HTML Style constants for email templates
const BADGE_NOT_FIXED = '<span style="display: inline-block; padding: 2px 8px; '
  + 'background-color: #fbbf24; color: #78350f; border-radius: 4px; '
  + 'font-size: 12px; margin-left: 8px;">Nem fix</span>';

const EMAIL_CONTAINER_STYLE = 'font-family: -apple-system, BlinkMacSystemFont, '
  + '\'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif; '
  + 'max-width: 600px; margin: 0 auto; background-color: #ffffff; '
  + 'border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);';

/**
 * Build event details HTML for quote email
 * @private
 */
function buildEventDetailsHtml(quoteData) {
  const eventTypesMap = {
    szabadteri: '🌳 Szabadtéri',
    belteri: '🏢 Beltéri',
    ceges: '💼 Céges',
    privat: '🎉 Privát',
    belepos: '🎫 Belépős'
  };

  const eventTypeLabels = {
    outdoorFree: 'Nyilvános ingyenes rendezvény szabadtéren',
    outdoorPaid: 'Nyilvános belépőjegyes rendezvény szabadtéren',
    indoorFree: 'Nyilvános ingyenes rendezvény zárt helyiségben',
    indoorPaid: 'Nyilvános belépőjegyes rendezvény zárt helyiségben',
    privatePersonal: 'Zártkörű magánrendezvény',
    privateCorporate: 'Zártkörű céges rendezvény'
  };

  // Handle eventType (singular - from select dropdown)
  const eventTypeText = quoteData.eventType
    ? eventTypeLabels[quoteData.eventType] || quoteData.eventType
    : null;

  // Handle eventTypes (plural - from checkboxes)
  const eventTypesText = quoteData.eventTypes && quoteData.eventTypes.length > 0
    ? quoteData.eventTypes.map((type) => eventTypesMap[type] || type).join(', ')
    : null;

  // Use eventType if available, otherwise eventTypes, otherwise placeholder
  const eventTypesHtml = eventTypeText || eventTypesText || TEXT_PLACEHOLDER;

  const eventDateText = quoteData.eventDate
    ? new Date(quoteData.eventDate).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    : TEXT_PLACEHOLDER;

  const dateFlexibleBadge = quoteData.eventDateFlexible
    ? BADGE_NOT_FIXED
    : '';

  const timeFlexibleBadge = quoteData.eventTimeFlexible
    ? BADGE_NOT_FIXED
    : '';

  const guestCountMap = {
    '<100': 'Kevesebb mint 100 fő',
    '100-300': '100-300 fő',
    '300-800': '300-800 fő',
    '800+': '800+ fő'
  };

  const guestCountText = guestCountMap[quoteData.guestCount] || quoteData.guestCount || TEXT_PLACEHOLDER;

  return `
    <h3 style="color: #1e293b; margin: 20px 0 10px 0; font-size: 16px; font-weight: 600;">📅 Rendezvény Részletek</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px; width: 40%;">Dátum:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">
          ${eventDateText}${dateFlexibleBadge}
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Időpont:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">
          ${quoteData.eventTime || TEXT_PLACEHOLDER}${timeFlexibleBadge}
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Helyszín:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${quoteData.eventLocation || TEXT_PLACEHOLDER}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Rendezvény típusa:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${eventTypesHtml}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Vendégek száma:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${guestCountText}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Rendezvény neve:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${quoteData.eventName || TEXT_PLACEHOLDER}</td>
      </tr>
      <tr>
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Kategória:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${quoteData.eventCategory || TEXT_PLACEHOLDER}</td>
      </tr>
    </table>
  `;
}

/**
 * Build contact info HTML for quote email
 * @private
 */
function buildContactInfoHtml(quoteData) {
  return `
    <h3 style="color: #1e293b; margin: 20px 0 10px 0; font-size: 16px; font-weight: 600;">👤 Kapcsolattartó</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px; width: 40%;">Név:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">${quoteData.contactName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Email:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">
          <a href="mailto:${quoteData.contactEmail}" style="color: #2563eb; text-decoration: none;">
            ${quoteData.contactEmail}
          </a>
        </td>
      </tr>
      ${quoteData.contactPhone ? `
      <tr>
        <td style="padding: 10px; color: #64748b; font-size: 14px;">Telefon:</td>
        <td style="padding: 10px; color: #1e293b; font-size: 14px;">
          <a href="tel:${quoteData.contactPhone}" style="color: #2563eb; text-decoration: none;">
            ${quoteData.contactPhone}
          </a>
        </td>
      </tr>
      ` : ''}
    </table>
  `;
}

/**
 * Build notes section HTML for quote email
 * @private
 */
function buildNotesHtml(quoteData) {
  if (!quoteData.notes || quoteData.notes.trim() === '') {
    return '';
  }

  return `
    <h3 style="color: #1e293b; margin: 20px 0 10px 0; font-size: 16px; font-weight: 600;">💬 További információk</h3>
    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
      <p style="margin: 0; color: #1e293b; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${quoteData.notes}</p>
    </div>
  `;
}

/**
 * Build performer info HTML for quote email
 * @private
 */
function buildPerformerInfoHtml(performer, quoteData = null) {
  if (!performer) {
    let recommendationDetails = '';

    if (quoteData) {
      if (quoteData.performerCount) {
        const performerCountText = quoteData.performerCount === '1' ? PERFORMER_COUNT_SINGLE : PERFORMER_COUNT_MULTIPLE;
        recommendationDetails += `<p style="margin: 10px 0 0 0; font-size: 14px;">👥 ${performerCountText}</p>`;
      }

      if (quoteData.budget) {
        const budgetText = new Intl.NumberFormat('hu-HU').format(quoteData.budget);
        recommendationDetails += `<p style="margin: 5px 0 0 0; font-size: 14px;">💰 Költségkeret: ${budgetText} Ft</p>`;
      }

      if (quoteData.styles && quoteData.styles.length > 0) {
        recommendationDetails += `<p style="margin: 5px 0 0 0; font-size: 14px;">🎵 Stílusok: ${quoteData.styles.join(', ')}</p>`;
      }
    }

    return `
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
        <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">🎯 Előadó ajánlás kérés</h2>
        <p style="margin: 0; font-size: 14px; opacity: 0.9;">
          Az ügyfél nem választott konkrét előadót, ajánlást kér
        </p>
        ${recommendationDetails}
      </div>
    `;
  }

  return `
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
      <h2 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 700;">🎵 ${performer.name}</h2>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">
        ${performer.performer_type || 'Előadó'} | ${performer.genres ? performer.genres.join(', ') : ''}
      </p>
    </div>
  `;
}

/**
 * Send quote notification email to booking email address
 * @param {Object} quoteData - Quote data from session
 * @param {Object} performer - Performer object
 * @param {string} referenceId - Quote reference ID
 * @returns {Promise<Object>} Send result
 */
async function sendQuoteNotificationEmail(quoteData, performer, referenceId) {
  try {
    const siteName = await Setting.get('site.name') || 'Koncert24.hu';
    const companyName = await Setting.get('company.name') || siteName;
    const bookingEmail = await Setting.get('email.booking');

    if (!bookingEmail) {
      throw new Error('Booking email not configured in settings');
    }

    const formattedDate = quoteData.eventDate
      ? new Date(quoteData.eventDate).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : TEXT_PLACEHOLDER;

    // Build HTML email
    let html = `
      <div style="${EMAIL_CONTAINER_STYLE}">
        <div style="padding: 30px;">
    `;

    html += buildPerformerInfoHtml(performer, quoteData);

    html += `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">
          ⚡ ÚJ AJÁNLATKÉRÉS ÉRKEZETT
        </p>
        <p style="margin: 5px 0 0 0; color: #78350f; font-size: 12px;">
          Hivatkozási szám: <strong>${referenceId}</strong>
        </p>
      </div>
    `;

    html += buildEventDetailsHtml(quoteData);
    html += buildContactInfoHtml(quoteData);
    html += buildNotesHtml(quoteData);

    html += `
      <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin-top: 20px; border-radius: 4px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">
          ⚠️ Teendő
        </p>
        <p style="margin: 5px 0 0 0; color: #1e40af; font-size: 13px;">
          Kérjük, vegye fel a kapcsolatot az ügyféllel 24 órán belül az ajánlat elkészítéséhez!
        </p>
      </div>
    `;

    html += `
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8fafc; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0;">${companyName} - Ajánlatkérő rendszer</p>
        </div>
      </div>
    `;

    // Build text version
    let text = 'ÚJ AJÁNLATKÉRÉS ÉRKEZETT\n\n';

    if (performer) {
      text += `Előadó: ${performer.name}\n`;
    } else {
      text += 'Típus: Előadó ajánlás kérés\n';
      if (quoteData.performerCount) {
        const performerCountText = quoteData.performerCount === '1' ? PERFORMER_COUNT_SINGLE : PERFORMER_COUNT_MULTIPLE;
        text += `Előadók száma: ${performerCountText}\n`;
      }
      if (quoteData.budget) {
        text += `Költségkeret: ${new Intl.NumberFormat('hu-HU').format(quoteData.budget)} Ft\n`;
      }
      if (quoteData.styles && quoteData.styles.length > 0) {
        text += `Preferált stílusok: ${quoteData.styles.join(', ')}\n`;
      }
    }

    text += `Hivatkozási szám: ${referenceId}\n\n`;
    text += '📅 RENDEZVÉNY RÉSZLETEK\n';
    text += `Dátum: ${formattedDate}${quoteData.eventDateFlexible ? ' (Nem fix)' : ''}\n`;
    text += `Időpont: ${quoteData.eventTime || TEXT_PLACEHOLDER}${quoteData.eventTimeFlexible ? ' (Nem fix)' : ''}\n`;
    text += `Helyszín: ${quoteData.eventLocation || TEXT_PLACEHOLDER}\n`;
    text += `Vendégek száma: ${quoteData.guestCount || TEXT_PLACEHOLDER}\n`;
    text += `Rendezvény neve: ${quoteData.eventName || TEXT_PLACEHOLDER}\n`;
    text += `Kategória: ${quoteData.eventCategory || TEXT_PLACEHOLDER}\n\n`;
    text += '👤 KAPCSOLATTARTÓ\n';
    text += `Név: ${quoteData.contactName}\n`;
    text += `Email: ${quoteData.contactEmail}\n`;
    if (quoteData.contactPhone) {
      text += `Telefon: ${quoteData.contactPhone}\n`;
    }

    if (quoteData.notes) {
      text += `\n💬 TOVÁBBI INFORMÁCIÓK\n${quoteData.notes}\n`;
    }

    text += '\n⚠️ Teendő: Kérjük, vegye fel a kapcsolatot az ügyféllel 24 órán belül az ajánlat elkészítéséhez!\n';
    text += `\n${companyName} - Ajánlatkérő rendszer`;

    // Send email
    const performerName = performer ? performer.name : 'Előadó ajánlás';
    const result = await emailService.sendEmail({
      to: bookingEmail,
      subject: `📋 Új ajánlatkérés - ${performerName} - ${formattedDate}`,
      html,
      text
    });

    if (result.success) {
      logger.info({
        service: 'quote',
        operation: 'sendQuoteNotificationEmail',
        referenceId,
        performerId: performer ? performer.id : null,
        to: bookingEmail
      }, 'Quote notification email sent successfully');
    }

    return result;
  } catch (error) {
    logger.error({
      service: 'quote',
      operation: 'sendQuoteNotificationEmail',
      error: error.message
    }, 'Failed to send quote notification email');

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send confirmation email to customer
 * @param {Object} quoteData - Quote data from session
 * @param {Object} performer - Performer object
 * @param {string} referenceId - Quote reference ID
 * @returns {Promise<Object>} Send result
 */
async function sendQuoteConfirmationEmail(quoteData, performer, referenceId) {
  try {
    const siteName = await Setting.get('site.name') || 'Koncert24.hu';
    const companyName = await Setting.get('company.name') || siteName;
    const bookingEmail = await Setting.get('email.booking');

    const formattedDate = quoteData.eventDate
      ? new Date(quoteData.eventDate).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : TEXT_PLACEHOLDER;

    // Build HTML email
    const html = `
      <div style="${EMAIL_CONTAINER_STYLE}">
        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
              <span style="font-size: 32px;">✓</span>
            </div>
            <h1 style="margin: 0 0 10px 0; color: #1e293b; font-size: 28px; font-weight: 700;">Ajánlatkérés Rögzítve!</h1>
            <p style="margin: 0; color: #64748b; font-size: 16px;">Hivatkozási szám: <strong style="color: #1e293b;">${referenceId}</strong></p>
          </div>

          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            Kedves <strong>${quoteData.contactName}</strong>!
          </p>

          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            ${performer
    ? `Köszönjük, hogy a <strong>${siteName}</strong> oldalon keresztül kért ajánlatot <strong>${performer.name}</strong> előadóra!`
    : `Köszönjük, hogy a <strong>${siteName}</strong> oldalon keresztül kért ajánlatot előadó ajánlásra!`
}
          </p>

          <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">
              📧 Mi történik ezután?
            </p>
            <p style="margin: 10px 0 0 0; color: #1e40af; font-size: 13px; line-height: 1.6;">
              Kollégáink <strong>24 órán belül</strong> felveszik Önnel a kapcsolatot az ajánlat részleteivel és az esetleges további kérdések tisztázásával.
            </p>
          </div>

          ${buildPerformerInfoHtml(performer, quoteData)}
          ${buildEventDetailsHtml(quoteData)}

          ${quoteData.notes ? `
          <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0 0 10px 0; color: #1e293b; font-size: 14px; font-weight: 600;">💬 Az Ön üzenete:</p>
            <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${quoteData.notes}</p>
          </div>
          ` : ''}

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0; color: #78350f; font-size: 13px; font-weight: 600;">
              ⚠️ Fontos
            </p>
            <p style="margin: 5px 0 0 0; color: #78350f; font-size: 12px; line-height: 1.6;">
              Ez az ajánlatkérés még <strong>nem minősül végleges foglalásnak</strong>. A foglalás akkor véglegesedik, amikor kollégáink visszaigazolják a részleteket és Ön elfogadja az ajánlatot.
            </p>
          </div>

          ${bookingEmail ? `
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
            Kérdése van? Írjon nekünk: <a href="mailto:${bookingEmail}" style="color: #2563eb; text-decoration: none;">${bookingEmail}</a>
          </p>
          ` : ''}
        </div>

        <div style="text-align: center; padding: 20px; background-color: #f8fafc; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0 0 5px 0;">${companyName}</p>
          <p style="margin: 0;">Ajánlatkérő rendszer</p>
        </div>
      </div>
    `;

    // Build text version
    let text = 'AJÁNLATKÉRÉS RÖGZÍTVE!\n\n';
    text += `Hivatkozási szám: ${referenceId}\n\n`;
    text += `Kedves ${quoteData.contactName}!\n\n`;

    if (performer) {
      text += `Köszönjük, hogy a ${siteName} oldalon keresztül kért ajánlatot ${performer.name} előadóra!\n\n`;
    } else {
      text += `Köszönjük, hogy a ${siteName} oldalon keresztül kért ajánlatot előadó ajánlásra!\n\n`;
      if (quoteData.budget) {
        text += `Költségkeret: ${new Intl.NumberFormat('hu-HU').format(quoteData.budget)} Ft\n`;
      }
      if (quoteData.styles && quoteData.styles.length > 0) {
        text += `Preferált stílusok: ${quoteData.styles.join(', ')}\n`;
      }
      if (quoteData.performerCount) {
        text += `Előadók száma: ${quoteData.performerCount === '1' ? 'Egy előadó' : 'Több előadó'}\n`;
      }
      text += '\n';
    }

    text += '📧 MI TÖRTÉNIK EZUTÁN?\n';
    text += 'Kollégáink 24 órán belül felveszik Önnel a kapcsolatot az ajánlat részleteivel.\n\n';
    text += '📅 RENDEZVÉNY RÉSZLETEK\n';
    text += `Dátum: ${formattedDate}${quoteData.eventDateFlexible ? ' (Nem fix)' : ''}\n`;
    text += `Időpont: ${quoteData.eventTime || TEXT_PLACEHOLDER}${quoteData.eventTimeFlexible ? ' (Nem fix)' : ''}\n`;
    text += `Helyszín: ${quoteData.eventLocation || TEXT_PLACEHOLDER}\n`;
    text += `Vendégek száma: ${quoteData.guestCount || TEXT_PLACEHOLDER}\n`;
    text += `Rendezvény neve: ${quoteData.eventName || TEXT_PLACEHOLDER}\n\n`;

    if (quoteData.notes) {
      text += `💬 AZ ÖN ÜZENETE:\n${quoteData.notes}\n\n`;
    }

    text += '⚠️ FONTOS\n';
    text += 'Ez az ajánlatkérés még nem minősül végleges foglalásnak.\n\n';

    if (bookingEmail) {
      text += `Kérdése van? Írjon nekünk: ${bookingEmail}\n\n`;
    }

    text += `${companyName} - Ajánlatkérő rendszer`;

    // Send email
    const performerName = performer ? performer.name : 'Előadó ajánlás';
    const result = await emailService.sendEmail({
      to: quoteData.contactEmail,
      subject: `✓ Ajánlatkérése rögzítve - ${performerName} - ${referenceId}`,
      html,
      text
    });

    if (result.success) {
      logger.info({
        service: 'quote',
        operation: 'sendQuoteConfirmationEmail',
        referenceId,
        performerId: performer.id,
        to: quoteData.contactEmail
      }, 'Quote confirmation email sent successfully');
    }

    return result;
  } catch (error) {
    logger.error({
      service: 'quote',
      operation: 'sendQuoteConfirmationEmail',
      error: error.message
    }, 'Failed to send quote confirmation email');

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendQuoteNotificationEmail,
  sendQuoteConfirmationEmail
};
