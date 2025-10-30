/**
 * Email Template Service - Booking Email Generators
 * Handles booking-related email template generation
 */

/* eslint-disable max-len -- Email templates contain long HTML strings */

/**
 * Generate booking test email content
 * @private
 */
function generateBookingTestContent({ bookingEmail, emailMethod, siteName, renderInfoBox, renderBadge, renderAlertBox, BASE_STYLES }) {
  return `
    <h2 style="${BASE_STYLES.h2}">🎵 Kedves Kollégák!</h2>
    <p style="${BASE_STYLES.paragraph}">
      Ez egy teszt email a <strong>${siteName}</strong> foglalási értesítési rendszer működésének ellenőrzésére.
    </p>

    ${renderInfoBox({
    title: '📋 Rendszer Információk',
    items: [
      `<strong>Teszt időpontja:</strong> ${new Date().toLocaleString('hu-HU')}`,
      `<strong>Email cím:</strong> ${bookingEmail}`,
      '<strong>Célja:</strong> Új foglalások és lemondások',
      `<strong>Email módszer:</strong> ${renderBadge({
        text: emailMethod.toUpperCase(),
        variant: emailMethod.toLowerCase() === 'oauth2' ? 'success' : 'info'
      })}`
    ]
  })}

    <p style="${BASE_STYLES.paragraph}">
      ✅ <strong>Ha ezt az emailt megkapta, a booking email konfiguráció tökéletesen működik!</strong>
    </p>

    ${renderAlertBox({
    type: 'success',
    title: '🎤 Ez az értesítési csatorna a jövőben aktiválódik:',
    message: `
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">🎤 Új előadó foglalási kérelmek</li>
          <li style="margin: 5px 0;">📝 Foglalási részletek módosítása</li>
          <li style="margin: 5px 0;">❌ Foglalások lemondása</li>
          <li style="margin: 5px 0;">💰 Fizetési státusz változások</li>
          <li style="margin: 5px 0;">📧 Ügyfél kapcsolatfelvételek</li>
        </ul>
      `
  })}
  `;
}

/**
 * Generate booking confirmation email content
 * @private
 */
function generateBookingConfirmationContent({ bookingData, bookingEmail, renderInfoBox, renderAlertBox, BASE_STYLES, COLORS }) {
  const eventDate = bookingData.eventDate
    ? new Date(bookingData.eventDate).toLocaleString('hu-HU')
    : 'N/A';

  const qrCodeSection = bookingData.qrCode ? `
    <div style="text-align: center; margin: 30px 0;">
      <p style="${BASE_STYLES.paragraph}"><strong>📱 QR Kód a belépéshez:</strong></p>
      <img src="${bookingData.qrCode}" alt="QR Kód" style="max-width: 200px; height: auto;" />
      <p style="${BASE_STYLES.paragraph}; font-size: 12px; color: ${COLORS.gray[600]};">
        Ezt a QR kódot mutassa fel a helyszínen a belépéshez.
      </p>
    </div>
  ` : '';

  const paymentSection = bookingData.paymentStatus ? renderAlertBox({
    type: bookingData.paymentStatus === 'paid' ? 'success' : 'warning',
    title: bookingData.paymentStatus === 'paid' ? '✅ Fizetés Rendezve' : '⚠️ Fizetés Függőben',
    message: bookingData.paymentStatus === 'paid'
      ? 'A foglalás összege rendezve lett. Köszönjük!'
      : 'A foglalás összegét a helyszínen kell rendezni.'
  }) : '';

  const cancellationSection = bookingData.cancellationPolicy ? renderInfoBox({
    title: '📋 Lemondási Feltételek',
    items: [bookingData.cancellationPolicy]
  }) : '';

  return `
    <h2 style="${BASE_STYLES.h2}">🎵 Kedves ${bookingData.customerName || 'Vásárló'}!</h2>
    <p style="${BASE_STYLES.paragraph}">
      Köszönjük foglalását! Az alábbi részletekkel rögzítettük rendelését.
    </p>

    ${renderInfoBox({
    title: '📋 Foglalás Részletei',
    items: [
      `<strong>Foglalás azonosító:</strong> #${bookingData.id}`,
      `<strong>Esemény:</strong> ${bookingData.eventName || 'N/A'}`,
      `<strong>Dátum:</strong> ${eventDate}`,
      `<strong>Helyszín:</strong> ${bookingData.venueName || 'N/A'}`,
      `<strong>Jegyek száma:</strong> ${bookingData.ticketCount || 0} db`,
      `<strong>Végösszeg:</strong> ${bookingData.totalAmount || 0} Ft`
    ]
  })}

    ${qrCodeSection}
    ${paymentSection}
    ${cancellationSection}

    <p style="${BASE_STYLES.paragraph}">
      Kérdése van? Írjon nekünk: <a href="mailto:${bookingEmail}" style="${BASE_STYLES.link}">${bookingEmail}</a>
    </p>
  `;
}

/**
 * Generate booking email template
 * @param {Object} params - Booking email parameters
 * @param {string} params.bookingEmail - Booking email address
 * @param {string} params.siteName - Site name
 * @param {string} params.companyName - Company name
 * @param {string} params.emailMethod - Email method (oauth2/smtp)
 * @param {Object} params.bookingData - Optional booking data for confirmation emails
 * @param {Object} helpers - Template helper functions
 * @returns {Object} Email subject, html, and text
 */
function generateBookingEmail(
  { bookingEmail, siteName, companyName, emailMethod, bookingData = null },
  { renderHeader, renderFooter, renderInfoBox, renderBadge, renderAlertBox, renderBaseLayout, BASE_STYLES, COLORS }
) {
  const isTestEmail = !bookingData;
  const variant = isTestEmail ? 'success' : 'info';

  // Subject
  const subject = isTestEmail
    ? `📅 Foglalási Értesítési Teszt - ${siteName}`
    : `📅 Foglalás Megerősítés - ${siteName}`;

  // Header content
  const headerTitle = isTestEmail ? '📅 Booking Email Teszt' : '📅 Foglalás Megerősítés';
  const headerSubtitle = isTestEmail
    ? `Foglalási Értesítési Teszt - ${siteName}`
    : `Foglalás: #${bookingData?.id || 'N/A'}`;

  // Main content
  const mainContent = isTestEmail
    ? generateBookingTestContent({ bookingEmail, emailMethod, siteName, renderInfoBox, renderBadge, renderAlertBox, BASE_STYLES })
    : generateBookingConfirmationContent({ bookingData, bookingEmail, renderInfoBox, renderAlertBox, BASE_STYLES, COLORS });

  // Generate full HTML
  const html = renderBaseLayout({
    title: subject,
    headerHtml: renderHeader({ title: headerTitle, subtitle: headerSubtitle, variant }),
    contentHtml: mainContent,
    footerHtml: renderFooter({ siteName, companyName })
  });

  // Text version
  const text = isTestEmail
    ? `Booking Email Teszt

Kedves Kollégák!

Ez egy teszt email a foglalási értesítési rendszer működésének ellenőrzésére.

Rendszer információk:
- Teszt időpontja: ${new Date().toLocaleString('hu-HU')}
- Email cím: ${bookingEmail}
- Célja: Új foglalások és lemondások
- Email módszer: ${emailMethod.toUpperCase()}

✅ Ha ezt az emailt megkapta, a booking email konfiguráció tökéletesen működik!

${siteName} - ${companyName}
`
    : `Foglalás Megerősítés

Kedves ${bookingData?.customerName || 'Vásárló'}!

Köszönjük foglalását! Az alábbi részletekkel rögzítettük rendelését.

Foglalás részletei:
- Foglalás azonosító: #${bookingData?.id}
- Esemény: ${bookingData?.eventName || 'N/A'}
- Dátum: ${bookingData?.eventDate ? new Date(bookingData.eventDate).toLocaleString('hu-HU') : 'N/A'}
- Helyszín: ${bookingData?.venueName || 'N/A'}
- Jegyek száma: ${bookingData?.ticketCount || 0} db
- Végösszeg: ${bookingData?.totalAmount || 0} Ft

Kérdése van? Írjon nekünk: ${bookingEmail}

${siteName} - ${companyName}
`;

  return { subject, html, text };
}

module.exports = {
  generateBookingEmail
};
