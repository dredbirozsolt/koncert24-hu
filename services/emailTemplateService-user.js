/**
 * Email Template Service - User Account Emails
 * Template generators for user account management emails
 *
 * @module services/emailTemplateService-user
 */

/* eslint-disable max-len */

/**
 * Generate email change verification emails (both old and new)
 * @param {Object} data - Email data
 * @param {Object} data.user - User object
 * @param {string} data.oldEmailUrl - Verification URL for old email
 * @param {string} data.newEmailUrl - Verification URL for new email
 * @param {string} data.fromName - Site name
 * @returns {Object} { old: {subject, text, html}, new: {subject, text, html} }
 */
function generateEmailChangeVerificationEmail(data) {
  const { user, oldEmailUrl, newEmailUrl, fromName } = data;

  // Email to OLD address (current)
  const oldEmailSubject = `Email cím módosítás megerősítése - ${fromName}`;
  const oldEmailText = `Tisztelt ${user.name}!

Email cím módosítás kérés érkezett a fiókjához.

Új email cím: ${user.pendingEmail}

Biztonsági okokból mindkét email címen meg kell erősítenie a módosítást.

Kérjük, kattintson az alábbi linkre a jelenlegi email címének megerősítéséhez:
${oldEmailUrl}

Ha ezt nem Ön kezdeményezte, azonnal módosítsa jelszavát és lépjen kapcsolatba velünk!

Üdvözlettel,
${fromName}`;

  const oldEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🔒 Email cím módosítás</h1>
        <p style="margin: 5px 0 0 0;">${fromName}</p>
      </div>
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Tisztelt <strong>${user.name}</strong>!</p>
        <p>Email cím módosítás kérés érkezett a fiókjához.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 5px 0;"><strong>Jelenlegi email:</strong> ${user.email}</p>
          <p style="margin: 5px 0;"><strong>Új email:</strong> ${user.pendingEmail}</p>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #92400e;">
            ⚠️ <strong>Fontos:</strong> Biztonsági okokból mindkét email címen meg kell erősítenie a módosítást.
          </p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${oldEmailUrl}" style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Jelenlegi Email Megerősítése
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 15px 0;">
          Ha a gomb nem működik, másold be ezt a linket a böngésződbe:<br>
          <a href="${oldEmailUrl}" style="color: #2563eb; word-break: break-all;">${oldEmailUrl}</a>
        </p>

        <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 5px 0; color: #7f1d1d;">
            🚨 <strong>Biztonsági figyelmeztetés:</strong><br>
            Ha ezt nem Ön kezdeményezte, azonnal módosítsa jelszavát!
          </p>
        </div>

        <p>Üdvözlettel,<br>${fromName} csapata</p>
      </div>
    </div>
  `;

  // Email to NEW address
  const newEmailSubject = `Új email cím megerősítése - ${fromName}`;
  const newEmailText = `Tisztelt ${user.name}!

Ezt az email címet szeretné használni a ${fromName} fiókjához.

Kérjük, kattintson az alábbi linkre az új email cím megerősítéséhez:
${newEmailUrl}

A módosítás csak akkor lép életbe, ha mindkét email címen megerősíti a műveletet.

Üdvözlettel,
${fromName}`;

  const newEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">✉️ Email cím megerősítése</h1>
        <p style="margin: 5px 0 0 0;">${fromName}</p>
      </div>
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Tisztelt <strong>${user.name}</strong>!</p>
        <p>Ezt az email címet szeretné használni a ${fromName} fiókjához.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 5px 0;"><strong>Új email cím:</strong> ${user.pendingEmail}</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${newEmailUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            Új Email Cím Megerősítése
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 15px 0;">
          Ha a gomb nem működik, másold be ezt a linket a böngésződbe:<br>
          <a href="${newEmailUrl}" style="color: #2563eb; word-break: break-all;">${newEmailUrl}</a>
        </p>

        <div style="background-color: #dbeafe; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #1e40af;">
            ℹ️ <strong>Fontos:</strong> A módosítás csak akkor lép életbe, ha mindkét email címen megerősíti a műveletet.
          </p>
        </div>

        <p>Üdvözlettel,<br>${fromName} csapata</p>
      </div>
    </div>
  `;

  return {
    old: {
      subject: oldEmailSubject,
      text: oldEmailText,
      html: oldEmailHtml
    },
    new: {
      subject: newEmailSubject,
      text: newEmailText,
      html: newEmailHtml
    }
  };
}

/**
 * Generate email change confirmation email (after both verifications complete)
 * @param {Object} data - Email data
 * @param {Object} data.user - User object with new email
 * @param {string} data.oldEmail - Old email address
 * @param {string} data.timestamp - Formatted timestamp
 * @param {string} data.fromName - Site name
 * @returns {Object} { old: {subject, text, html}, new: {subject, text, html} }
 */
function generateEmailChangeConfirmationEmail(data) {
  const { user, oldEmail, timestamp, fromName } = data;

  const subject = `Email cím sikeresen módosítva - ${fromName}`;

  // Notification to OLD email
  const oldEmailText = `Tisztelt ${user.name}!

Az email címe sikeresen módosításra került a ${fromName} fiókjához.

Régi email: ${oldEmail}
Új email: ${user.email}
Időpont: ${timestamp}

Mostantól az új email címével jelentkezhet be.

Ha ezt nem Ön végezte, azonnal lépjen kapcsolatba velünk!

Üdvözlettel,
${fromName}`;

  const oldEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">✅ Email cím módosítva</h1>
        <p style="margin: 5px 0 0 0;">${fromName}</p>
      </div>
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Tisztelt <strong>${user.name}</strong>!</p>
        <p>Az email címe sikeresen módosításra került a ${fromName} fiókjához.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #16a34a;">
          <p style="margin: 5px 0;"><strong>Régi email:</strong> ${oldEmail}</p>
          <p style="margin: 5px 0;"><strong>Új email:</strong> ${user.email}</p>
          <p style="margin: 5px 0;"><strong>Időpont:</strong> ${timestamp}</p>
        </div>

        <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #166534;">
            ℹ️ Mostantól az új email címével jelentkezhet be.
          </p>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #92400e;">
            ⚠️ <strong>Biztonsági figyelmeztetés:</strong><br>
            Ha ezt nem Ön végezte, azonnal lépjen kapcsolatba velünk!
          </p>
        </div>

        <p>Üdvözlettel,<br>${fromName} csapata</p>
      </div>
    </div>
  `;

  // Notification to NEW email (confirmation)
  const newEmailText = `Tisztelt ${user.name}!

Az email címe sikeresen módosításra került a ${fromName} fiókjához.

Új email: ${user.email}
Időpont: ${timestamp}

Ez az Ön új bejelentkezési email címe.

Üdvözlettel,
${fromName}`;

  const newEmailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">✅ Email cím módosítva</h1>
        <p style="margin: 5px 0 0 0;">${fromName}</p>
      </div>
      <div style="padding: 20px; background-color: #f8f9fa;">
        <p>Tisztelt <strong>${user.name}</strong>!</p>
        <p>Az email címe sikeresen módosításra került a ${fromName} fiókjához.</p>
        
        <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #16a34a;">
          <p style="margin: 5px 0;"><strong>Új email:</strong> ${user.email}</p>
          <p style="margin: 5px 0;"><strong>Időpont:</strong> ${timestamp}</p>
        </div>

        <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0; color: #166534;">
            ✨ Ez az Ön új bejelentkezési email címe.
          </p>
        </div>

        <p>Üdvözlettel,<br>${fromName} csapata</p>
      </div>
    </div>
  `;

  return {
    old: {
      subject,
      text: oldEmailText,
      html: oldEmailHtml
    },
    new: {
      subject,
      text: newEmailText,
      html: newEmailHtml
    }
  };
}

module.exports = {
  generateEmailChangeVerificationEmail,
  generateEmailChangeConfirmationEmail
};
