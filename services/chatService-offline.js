/**
 * Chat Service - Offline Message Helpers
 * Handles offline message email notifications
 */

const logger = require('../config/logger');
const settingsService = require('./settingsService');
const emailService = require('./emailService');
const emailTemplateService = require('./emailTemplateService');

/**
 * Escape HTML for email safety
 */
function escapeHtml(text) {
  if (!text) {return '';}

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Send offline message email notification
 */
async function sendOfflineMessageEmail(offlineMessage) {
  // Get settings
  const bookingEmail = await settingsService.get('email.booking')
    /* eslint-disable no-process-env */
    || process.env.EMAIL_BOOKING || process.env.BOOKINGS_EMAIL;
    /* eslint-enable no-process-env */

  const siteName = await settingsService.get('general.site_name') || 'Koncert24.hu';
  const companyName = await settingsService.get('general.company_name') || 'DMF Art Média Kft.';
  const domain = await settingsService.get('general.domain') || 'https://koncert24.hu';

  // Format timestamp safely
  const timestamp = offlineMessage.createdAt || offlineMessage.created_at || new Date();
  const formattedTime = new Date(timestamp).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Generate email content using template service
  const subject = `💬 Új offline chat üzenet - ${offlineMessage.name}`;

  const contentHtml = `
    ${emailTemplateService.renderAlertBox({
    title: '💬 Új offline chat üzenet érkezett',
    message: 'Egy látogató offline üzenetet küldött a chat widgetből. Kérjük, válaszoljon minél hamarabb!',
    variant: 'info'
  })}

    ${emailTemplateService.renderInfoBox({
    title: '👤 Küldő adatai',
    items: [
      { label: 'Név', value: escapeHtml(offlineMessage.name) },
      {
        label: 'Email',
        value: `<a href="mailto:${escapeHtml(offlineMessage.email)}">${escapeHtml(offlineMessage.email)}</a>`
      },
      ...(offlineMessage.phone ? [{ label: 'Telefon', value: escapeHtml(offlineMessage.phone) }] : []),
      { label: 'Időpont', value: formattedTime }
    ],
    variant: 'gray'
  })}

    ${emailTemplateService.renderCodeBlock({
    title: '📝 Üzenet tartalma',
    code: escapeHtml(offlineMessage.message),
    variant: 'gray'
  })}

    ${emailTemplateService.renderAlertBox({
    title: '⚡ Teendő',
    message: `Kérjük, válaszoljon az ügyfélnek minél hamarabb ezen a címen:
      <a href="mailto:${escapeHtml(offlineMessage.email)}">${escapeHtml(offlineMessage.email)}</a><br><br>
      Az üzenet az admin felületen is megtekinthető:
      <a href="${domain}/admin/chat/offline-messages"
         style="color: #2563eb; text-decoration: none; font-weight: 600;">Admin Panel</a>`,
    variant: 'success'
  })}
  `;

  const html = emailTemplateService.renderBaseLayout({
    title: subject,
    headerHtml: emailTemplateService.renderHeader({
      title: '💬 Offline Chat Üzenet',
      subtitle: `${siteName} - Chat rendszer`,
      variant: 'info'
    }),
    contentHtml,
    footerHtml: emailTemplateService.renderFooter({ siteName, companyName })
  });

  await emailService.sendEmail({
    to: bookingEmail,
    subject,
    html
  });

  logger.info({
    service: 'chat',
    offlineMessageId: offlineMessage.id,
    recipientEmail: bookingEmail
  }, 'Offline message email sent');
}

module.exports = {
  sendOfflineMessageEmail,
  escapeHtml
};
