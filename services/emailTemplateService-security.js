/**
 * Email Template Service - Part 2
 * Additional email templates with Design System compliance
 * This file extends emailTemplateService.js
 */

// Constants
const DEFAULT_BASE_URL = 'https://koncert24.hu';

// Lazy load to avoid circular dependency
let COLORS;
let BASE_STYLES;
let renderHeader;
let renderFooter;
let renderInfoBox;
let renderAlertBox;
let renderCodeBlock;
let renderBadge;
let renderBaseLayout;

function loadDependencies() {
  if (!COLORS) {
    const emailTemplateService = require('./emailTemplateService');
    ({
      COLORS,
      BASE_STYLES,
      renderHeader,
      renderFooter,
      renderInfoBox,
      renderAlertBox,
      renderCodeBlock,
      renderBadge,
      renderBaseLayout
    } = emailTemplateService);
  }
}

/**
 * Helper: Generate threats content HTML
 */
function generateThreatsContent(threats) {
  if (!threats || threats.length === 0) {
    return '';
  }

  const threatItems = threats.map((threat) => {
    const lastAttemptDate = threat.lastAttempt
      ? new Date(threat.lastAttempt).toLocaleString('hu-HU')
      : 'N/A';
    const items = [
      `<strong>IP cím:</strong> ${threat.ip || 'N/A'}`,
      `<strong>Kísérletek száma:</strong> ${threat.count || 0}`,
      `<strong>Súlyosság:</strong> ${threat.severity || 'unknown'}`,
      `<strong>Utolsó kísérlet:</strong> ${lastAttemptDate}`
    ];

    if (threat.actions && threat.actions.length > 0) {
      items.push(`<strong>Akciók:</strong> ${threat.actions.join(', ')}`);
    }

    return renderInfoBox({
      title: `🚨 Fenyegetés #${threat.id || 'N/A'}`,
      items
    });
  }).join('');

  return `
    <h3 style="${BASE_STYLES.h3}">🔍 Részletes Információk</h3>
    ${threatItems}
  `;
}

/**
 * Helper: Get priority label in Hungarian
 */
function getPriorityLabel(priority) {
  if (priority === 'critical') {
    return 'Kritikus';
  }
  if (priority === 'high') {
    return 'Magas';
  }
  return 'Közepes';
}

/**
 * Helper: Generate main content HTML for security alert
 */
function generateSecurityAlertMainContent({ event, priority, body, priorityLabel, priorityBadge, threatsContent }) {
  const userAgentDisplay = event.userAgent ? `${event.userAgent.substring(0, 50)}...` : 'N/A';
  const eventTimestamp = event.createdAt
    ? new Date(event.createdAt).toLocaleString('hu-HU')
    : new Date().toLocaleString('hu-HU');

  return `
    <h2 style="${BASE_STYLES.h2}">🚨 Biztonsági Esemény Észlelve</h2>
    
    ${renderAlertBox({
    type: priority === 'critical' ? 'error' : 'warning',
    title: `⚠️ ${priorityLabel} Prioritású Esemény`,
    message: body || 'Biztonsági esemény történt a rendszerben.'
  })}

    ${renderInfoBox({
    title: '📋 Esemény Részletei',
    items: [
      `<strong>Esemény típus:</strong> ${event.eventType || 'N/A'}`,
      `<strong>Esemény ID:</strong> #${event.id || 'N/A'}`,
      `<strong>Időpont:</strong> ${eventTimestamp}`,
      `<strong>Prioritás:</strong> ${priorityBadge}`,
      `<strong>IP cím:</strong> ${event.ip || 'N/A'}`,
      `<strong>User Agent:</strong> ${userAgentDisplay}`
    ]
  })}

    ${threatsContent}

    ${renderAlertBox({
    type: 'info',
    title: '🛠️ Javasolt Intézkedések',
    message: `
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Ellenőrizze a Security Log bejegyzéseket</li>
          <li style="margin: 5px 0;">Tekintse át a gyanús IP címeket</li>
          <li style="margin: 5px 0;">Szükség esetén blokkolja a fenyegetést jelentő IP címet</li>
          <li style="margin: 5px 0;">Jelentse súlyos esetben az illetékes hatóságoknak</li>
        </ul>
      `
  })}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.BASE_URL || DEFAULT_BASE_URL}/admin/security-log"
         style="display: inline-block; background: ${COLORS.primary[600]}; color: white;
                padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        🔍 Security Log Megtekintése
      </a>
    </div>

    <p style="${BASE_STYLES.paragraph}; font-size: 12px; color: ${COLORS.gray[500]};">
      <strong>Megjegyzés:</strong> Maximum 10 biztonsági értesítés/óra küldése megengedett a spam megelőzése érdekében.
    </p>
  `;
}

/**
 * Generate security alert email template
 * @param {Object} params - Security alert parameters
 * @param {Object} params.event - Security event data
 * @param {string} params.priority - Priority level (critical/high/medium)
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body content
 * @param {Array} params.threats - Array of threat details
 * @returns {Object} Email subject, html, and text
 */
function generateSecurityAlertEmail({ event, priority, subject, body, threats = [] }) {
  loadDependencies();

  const priorityColors = {
    critical: 'error',
    high: 'warning',
    medium: 'info'
  };
  const variant = priorityColors[priority] || 'warning';

  // Header content
  const headerTitle = '🛡️ Biztonsági Figyelmeztetés';
  const headerBadgeType = priority === 'critical' ? 'error' : 'warning';
  const headerBadge = renderBadge(priority.toUpperCase(), headerBadgeType);
  const headerSubtitle = `${subject} ${headerBadge}`;

  // Threat details section
  const threatsContent = generateThreatsContent(threats);

  // Determine priority label
  const priorityLabel = getPriorityLabel(priority);

  // Priority badge
  const priorityBadgeType = priority === 'critical' ? 'error' : 'warning';
  const priorityBadge = renderBadge(priority.toUpperCase(), priorityBadgeType);

  // Main content
  const mainContent = generateSecurityAlertMainContent({
    event,
    priority,
    body,
    priorityLabel,
    priorityBadge,
    threatsContent
  });

  // Generate full HTML
  const html = renderBaseLayout({
    title: subject,
    headerHtml: renderHeader({ title: headerTitle, subtitle: headerSubtitle, variant }),
    contentHtml: mainContent,
    footerHtml: renderFooter({
      siteName: 'Koncert24.hu',
      companyName: 'Biztonsági Monitoring Rendszer',
      additionalText: `SecurityLog ID: #${event.id || 'N/A'}`
    })
  });

  // Text version
  const text = `Biztonsági Figyelmeztetés

${subject}

Prioritás: ${priority.toUpperCase()}

Esemény Részletei:
- Esemény típus: ${event.eventType || 'N/A'}
- Esemény ID: #${event.id || 'N/A'}
- Időpont: ${event.createdAt ? new Date(event.createdAt).toLocaleString('hu-HU') : new Date().toLocaleString('hu-HU')}
- IP cím: ${event.ip || 'N/A'}
- User Agent: ${event.userAgent || 'N/A'}

${body || 'Biztonsági esemény történt a rendszerben.'}

Javasolt Intézkedések:
- Ellenőrizze a Security Log bejegyzéseket
- Tekintse át a gyanús IP címeket
- Szükség esetén blokkolja a fenyegetést jelentő IP címet
- Jelentse súlyos esetben az illetékes hatóságoknak

Security Log: ${process.env.BASE_URL || DEFAULT_BASE_URL}/admin/security-log

© ${new Date().getFullYear()} Koncert24.hu - Biztonsági Monitoring Rendszer
SecurityLog ID: #${event.id || 'N/A'}`;

  return { subject, html, text };
}

/**
 * Generate password changed notification email
 * @param {Object} params - Password change parameters
 * @param {Object} params.user - User data
 * @param {string} params.siteName - Site name
 * @param {string} params.companyName - Company name
 * @param {string} params.ipAddress - IP address of password change
 * @param {string} params.userAgent - User agent string
 * @returns {Object} Email subject, html, and text
 */
function generatePasswordChangedEmail({ user, siteName, companyName }) {
  loadDependencies();

  const subject = `🔒 Jelszó Megváltoztatva - ${siteName}`;

  const headerTitle = '🔒 Jelszó Megváltoztatva';
  const headerSubtitle = 'Fiók Biztonsági Értesítés';

  const changeTime = new Date().toLocaleString('hu-HU');

  const mainContent = `
    <h2 style="${BASE_STYLES.h2}">Kedves ${user.name || user.firstName || user.email}!</h2>
    
    <p style="${BASE_STYLES.paragraph}">
      Ez egy biztonsági értesítés arról, hogy a fiókodhoz tartozó jelszót nemrég megváltoztatták.
    </p>

    ${renderAlertBox({
    type: 'success',
    title: '✅ Jelszó Sikeresen Megváltoztatva',
    message: `A jelszó megváltoztatása <strong>${changeTime}</strong> időpontban történt.`
  })}

    ${renderAlertBox({
    type: 'warning',
    title: '⚠️ Nem Te Változtattad Meg?',
    message: `
        Ha <strong>nem te</strong> változtattad meg a jelszót, akkor:
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Azonnal lépj be a fiókodba és változtasd meg a jelszót</li>
          <li style="margin: 5px 0;">Ellenőrizd a legutóbbi bejelentkezéseket</li>
          <li style="margin: 5px 0;">Vedd fel a kapcsolatot az ügyfélszolgálattal</li>
        </ul>
      `
  })}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.BASE_URL || DEFAULT_BASE_URL}/login"
         style="display: inline-block; background: ${COLORS.primary[600]}; color: white;
                padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        🔒 Bejelentkezés
      </a>
    </div>

    ${renderInfoBox({
    title: '🔐 Biztonsági Tippek',
    items: [
      'Használj egyedi, erős jelszót minden fiókodhoz',
      'Ne oszd meg jelszavad másokkal',
      'Engedélyezd a kétfaktoros hitelesítést, ha elérhető',
      'Rendszeresen változtasd meg jelszavad'
    ]
  })}

    <p style="${BASE_STYLES.paragraph}; font-size: 12px; color: ${COLORS.gray[500]};">
      Ha te végezted a változtatást, akkor ezt az emailt nyugodtan figyelmen kívül hagyhatod.
    </p>
  `;

  const html = renderBaseLayout({
    title: subject,
    headerHtml: renderHeader({ title: headerTitle, subtitle: headerSubtitle, variant: 'info' }),
    contentHtml: mainContent,
    footerHtml: renderFooter({ siteName, companyName })
  });

  const text = `Jelszó Megváltoztatva - ${siteName}

Kedves ${user.name || user.firstName || user.email}!

Ez egy biztonsági értesítés arról, hogy a fiókodhoz tartozó jelszót nemrég megváltoztatták.

✅ Jelszó sikeresen megváltoztatva ${changeTime} időpontban.

Ha nem te változtattad meg a jelszót:
- Azonnal lépj be a fiókodba és változtasd meg a jelszót
- Ellenőrizd a legutóbbi bejelentkezéseket
- Vedd fel a kapcsolatot az ügyfélszolgálattal

Bejelentkezés: ${process.env.BASE_URL || DEFAULT_BASE_URL}/login

Biztonsági Tippek:
- Használj egyedi, erős jelszót minden fiókodhoz
- Ne oszd meg jelszavad másokkal
- Engedélyezd a kétfaktoros hitelesítést, ha elérhető
- Rendszeresen változtasd meg jelszavad

© ${new Date().getFullYear()} ${siteName} - ${companyName}`;

  return { subject, html, text };
}

/**
 * Generate email change verification email
 * @param {Object} params - Email change parameters
 * @param {Object} params.user - User data
 * @param {string} params.newEmail - New email address
 * @param {string} params.verificationLink - Verification link
 * @param {string} params.siteName - Site name
 * @param {string} params.companyName - Company name
 * @returns {Object} Email subject, html, and text
 */
function generateEmailChangeVerificationEmail({ user, newEmail, verificationLink, siteName, companyName }) {
  loadDependencies();

  const subject = `📧 Email Cím Megerősítés - ${siteName}`;

  const headerTitle = '📧 Email Cím Megerősítés';
  const headerSubtitle = 'Kérjük, erősítse meg új email címét';

  const mainContent = `
    <h2 style="${BASE_STYLES.h2}">Kedves ${user.firstName || user.email}!</h2>
    
    <p style="${BASE_STYLES.paragraph}">
      Kérést kaptunk az Ön fiókjához tartozó email cím megváltoztatására.
    </p>

    ${renderInfoBox({
    title: '📋 Email Változtatás Részletei',
    items: [
      `<strong>Régi email:</strong> ${user.email}`,
      `<strong>Új email:</strong> ${newEmail}`,
      `<strong>Kérelem ideje:</strong> ${new Date().toLocaleString('hu-HU')}`
    ]
  })}

    ${renderAlertBox({
    type: 'warning',
    title: '⚠️ Fontos - Megerősítés Szükséges',
    message: 'A változtatás véglegesítéséhez kattintson az alábbi gombra az új email cím megerősítéséhez.'
  })}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationLink}"
         style="display: inline-block; background: ${COLORS.primary[600]}; color: white;
                padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        ✅ Email Cím Megerősítése
      </a>
    </div>

    <p style="${BASE_STYLES.paragraph}; font-size: 14px; color: ${COLORS.gray[600]};">
      Ha a gomb nem működik, másolja be ezt a linket a böngészőjébe:
    </p>
    ${renderCodeBlock(verificationLink)}

    ${renderAlertBox({
    type: 'info',
    title: '🔐 Biztonsági Információ',
    message: `
        <ul style="margin: 10px 0 0 20px; padding: 0;">
          <li style="margin: 5px 0;">Ez a megerősítő link <strong>24 órán belül</strong> lejár</li>
          <li style="margin: 5px 0;">
            Ha nem Ön kérte a változtatást, nyugodtan figyelmen kívül hagyhatja ezt az emailt
          </li>
          <li style="margin: 5px 0;">A régi email cím mindaddig aktív marad, amíg az új címet meg nem erősíti</li>
        </ul>
      `
  })}

    <p style="${BASE_STYLES.paragraph}; font-size: 12px; color: ${COLORS.gray[500]};">
      Ha nem Ön kezdeményezte ezt a változtatást, akkor fiókja veszélyben lehet. 
      Kérjük, azonnal lépjen be és változtassa meg jelszavát.
    </p>
  `;

  const html = renderBaseLayout({
    title: subject,
    headerHtml: renderHeader({ title: headerTitle, subtitle: headerSubtitle, variant: 'warning' }),
    contentHtml: mainContent,
    footerHtml: renderFooter({ siteName, companyName })
  });

  const text = `Email Cím Megerősítés - ${siteName}

Kedves ${user.firstName || user.email}!

Kérést kaptunk az Ön fiókjához tartozó email cím megváltoztatására.

Email Változtatás Részletei:
- Régi email: ${user.email}
- Új email: ${newEmail}
- Kérelem ideje: ${new Date().toLocaleString('hu-HU')}

A változtatás véglegesítéséhez kattintson az alábbi linkre:
${verificationLink}

Biztonsági Információ:
- Ez a megerősítő link 24 órán belül lejár
- Ha nem Ön kérte a változtatást, nyugodtan figyelmen kívül hagyhatja ezt az emailt
- A régi email cím mindaddig aktív marad, amíg az új címet meg nem erősíti

© ${new Date().getFullYear()} ${siteName} - ${companyName}`;

  return { subject, html, text };
}

/**
 * Generate general notification email
 * @param {Object} params - Notification parameters
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.variant - Variant type (info/success/warning/error)
 * @param {string} params.siteName - Site name
 * @param {string} params.companyName - Company name
 * @returns {Object} Email subject, html, and text
 */
function generateNotificationEmail({ title, message, variant = 'info', siteName, companyName }) {
  loadDependencies();

  const subject = `📬 ${title} - ${siteName}`;

  const variantIcons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '🚨'
  };
  const icon = variantIcons[variant] || 'ℹ️';

  const headerTitle = `${icon} ${title}`;
  const headerSubtitle = 'Értesítés';

  const mainContent = `
    <h2 style="${BASE_STYLES.h2}">${icon} ${title}</h2>
    
    ${renderAlertBox({
    type: variant,
    title,
    message
  })}

    <p style="${BASE_STYLES.paragraph}">
      Ez egy automatikusan generált értesítés a ${siteName} rendszerből.
    </p>

    <p style="${BASE_STYLES.paragraph}; font-size: 12px; color: ${COLORS.gray[500]};">
      Kérdése van? Írjon nekünk vagy lépjen be a fiókjába további információkért.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.BASE_URL || DEFAULT_BASE_URL}"
         style="display: inline-block; background: ${COLORS.primary[600]}; color: white;
                padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        🏠 Vissza a Főoldalra
      </a>
    </div>
  `;

  const html = renderBaseLayout({
    title: subject,
    headerHtml: renderHeader({ title: headerTitle, subtitle: headerSubtitle, variant }),
    contentHtml: mainContent,
    footerHtml: renderFooter({ siteName, companyName })
  });

  const text = `${title} - ${siteName}

${message}

Ez egy automatikusan generált értesítés a ${siteName} rendszerből.

© ${new Date().getFullYear()} ${siteName} - ${companyName}`;

  return { subject, html, text };
}

module.exports = {
  generateSecurityAlertEmail,
  generatePasswordChangedEmail,
  generateEmailChangeVerificationEmail,
  generateNotificationEmail
};
