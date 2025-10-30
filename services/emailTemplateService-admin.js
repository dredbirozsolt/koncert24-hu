/**
 * Email Template Service - Admin Email Generators
 * Handles admin and cron error email template generation
 */

/* eslint-disable max-len -- Email templates contain long HTML strings */

/**
 * Generate cron error email template
 * @param {Object} data - Template data
 * @param {Object} helpers - Template helper functions
 * @returns {Object} { subject, html, text }
 */
function generateCronErrorEmail(data, helpers) {
  const {
    renderHeader,
    renderInfoBox,
    renderBadge,
    renderAlertBox,
    renderCodeBlock,
    renderFooter,
    renderBaseLayout,
    COLORS
  } = helpers;

  const {
    cronJobName,
    errorMessage,
    stackTrace,
    additionalData = {},
    timestamp,
    emailMethod,
    siteName,
    companyName = 'DMF Art Média Kft.'
  } = data;

  const subject = `🚨 Cron Job Hiba - ${cronJobName}`;

  // Header
  const headerHtml = renderHeader({
    title: 'Cron Job Hiba',
    subtitle: `${siteName} Rendszer`,
    emoji: '🚨',
    variant: 'error'
  });

  // Info Box
  const infoItems = [
    { label: 'Cron Job', value: cronJobName },
    { label: 'Időpont', value: timestamp },
    { label: 'Email módszer', value: renderBadge({ text: emailMethod.toUpperCase(), variant: 'info' }) }
  ];

  if (additionalData.jobId) {
    infoItems.push({ label: 'Job ID', value: additionalData.jobId });
  }

  if (additionalData.schedule) {
    infoItems.push({ label: 'Ütemezés', value: additionalData.schedule });
  }

  const infoBoxHtml = renderInfoBox({
    title: '📋 Hiba Információk',
    items: infoItems,
    variant: 'info'
  });

  // Error Alert Box
  const errorBoxHtml = renderAlertBox({
    title: '⚠️ Hiba üzenet:',
    message: errorMessage || 'Ismeretlen hiba történt',
    variant: 'error'
  });

  // Stack Trace (if available)
  const stackTraceHtml = stackTrace ? renderCodeBlock({
    title: '🔍 Stack Trace:',
    code: stackTrace,
    variant: 'gray'
  }) : '';

  // Additional Data (if available)
  const additionalDataHtml = Object.keys(additionalData).length > 0 ? renderCodeBlock({
    title: '📊 További Adatok:',
    code: JSON.stringify(additionalData, null, 2),
    variant: 'primary'
  }) : '';

  // Suggestion Box
  const suggestionHtml = `
    <p style="
      margin-top: 30px;
      padding: 15px;
      background: ${COLORS.primary[50]};
      border-radius: 5px;
      border-left: 4px solid ${COLORS.primary[600]};
    ">
      💡 <strong>Javasolt teendő:</strong> Ellenőrizze a rendszer logokat
      és a cron job konfigurációt a hiba okának azonosításához.
    </p>
  `;

  // Content
  const contentHtml = `
    <h2 style="margin-top: 0;">Kedves Adminisztrátor!</h2>
    <p>Az egyik automatikus feladat (cron job) hibára futott a rendszerben.</p>
    ${infoBoxHtml}
    ${errorBoxHtml}
    ${stackTraceHtml}
    ${additionalDataHtml}
    ${suggestionHtml}
  `;

  // Footer
  const footerHtml = renderFooter({ siteName, companyName });

  // HTML Email
  const html = renderBaseLayout({
    title: 'Cron Job Hiba',
    headerHtml,
    contentHtml,
    footerHtml
  });

  // Text Email (fallback)
  const text = `
🚨 CRON JOB HIBA - ${cronJobName}

${siteName} Rendszer

Kedves Adminisztrátor!

Az egyik automatikus feladat (cron job) hibára futott a rendszerben.

📋 Hiba Információk:
- Cron Job: ${cronJobName}
- Időpont: ${timestamp}
- Email módszer: ${emailMethod.toUpperCase()}
${additionalData.jobId ? `- Job ID: ${additionalData.jobId}` : ''}
${additionalData.schedule ? `- Ütemezés: ${additionalData.schedule}` : ''}

⚠️ Hiba üzenet:
${errorMessage || 'Ismeretlen hiba történt'}

${stackTrace ? `🔍 Stack Trace:\n${stackTrace}\n` : ''}
${Object.keys(additionalData).length > 0 ? `📊 További Adatok:\n${JSON.stringify(additionalData, null, 2)}\n` : ''}
💡 Javasolt teendő: Ellenőrizze a rendszer logokat és a cron job konfigurációt a hiba okának azonosításához.

---
© ${new Date().getFullYear()} ${siteName}
Ez egy automatikus értesítés a rendszerből.
  `.trim();

  return { subject, html, text };
}

/**
 * Generate admin test email template
 * @param {Object} data - Template data
 * @param {Object} helpers - Template helper functions
 * @returns {Object} { subject, html, text }
 */
function generateAdminTestEmail(data, helpers) {
  const {
    renderHeader,
    renderInfoBox,
    renderBadge,
    renderFooter,
    renderBaseLayout,
    COLORS
  } = helpers;

  const {
    adminEmail,
    emailMethod,
    timestamp,
    siteName,
    companyName
  } = data;

  const subject = `🔧 Admin Értesítési Teszt - ${siteName}`;

  // Header
  const headerHtml = renderHeader({
    title: 'Admin Email Teszt',
    subtitle: 'Rendszer Értesítési Teszt',
    emoji: '🔧',
    variant: 'info'
  });

  // Info Box
  const infoBoxHtml = renderInfoBox({
    title: '📋 Rendszer Információk',
    items: [
      { label: 'Teszt időpontja', value: timestamp },
      { label: 'Email cím', value: adminEmail },
      { label: 'Célja', value: 'Kritikus hibák és rendszeresemények' },
      {
        label: 'Email módszer',
        value: renderBadge({
          text: emailMethod.toUpperCase(),
          variant: emailMethod.toLowerCase() === 'oauth2' ? 'success' : 'info'
        })
      }
    ],
    variant: 'info'
  });

  // Success message
  const successHtml = `
    <p style="
      padding: 15px;
      background: ${COLORS.success[50]};
      border-radius: 5px;
      border-left: 4px solid ${COLORS.success[600]};
      color: ${COLORS.success[800]};
      margin: 20px 0;
    ">
      ✅ <strong>Ha ezt az emailt megkapta, az admin email konfiguráció tökéletesen működik!</strong>
    </p>
  `;

  // Content
  const contentHtml = `
    <h2 style="margin-top: 0;">Kedves Adminisztrátor!</h2>
    <p>Ez egy teszt email az admin értesítési rendszer működésének ellenőrzésére.</p>
    ${infoBoxHtml}
    ${successHtml}
  `;

  // Footer
  const footerHtml = renderFooter({ siteName: `${siteName} - ${companyName}` });

  // HTML Email
  const html = renderBaseLayout({
    title: 'Admin Email Teszt',
    headerHtml,
    contentHtml,
    footerHtml
  });

  // Text Email (fallback)
  const text = `
Admin Email Teszt

Kedves Adminisztrátor!

Ez egy teszt email az admin értesítési rendszer működésének ellenőrzésére.

Rendszer információk:
- Teszt időpontja: ${timestamp}
- Email cím: ${adminEmail}
- Célja: Kritikus hibák és rendszeresemények
- Email módszer: ${emailMethod.toUpperCase()}

Ha ezt az emailt megkapta, az admin email konfiguráció tökéletesen működik!

© ${new Date().getFullYear()} ${siteName} - ${companyName}
  `.trim();

  return { subject, html, text };
}

module.exports = {
  generateCronErrorEmail,
  generateAdminTestEmail
};
