/**
 * Calendar Integration Utilities
 * Generates .ics files and calendar URLs
 */

/**
 * Generate .ics file content for an event
 * @param {Object} event - Event object
 * @returns {string} .ics file content
 */
function generateICS(event) {
  const startDate = new Date(event.performanceDate);

  // If we have a time, use it; otherwise use 19:00 as default
  if (event.performanceTime) {
    const [hours, minutes] = event.performanceTime.split(':');
    startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
  } else {
    startDate.setHours(19, 0, 0);
  }

  // Event duration: 2 hours default
  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

  // Format dates for .ics (YYYYMMDDTHHmmss)
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  };

  const now = formatDate(new Date());
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  // Build description
  let description = event.subject;
  if (event.performer && event.performer.name) {
    description += `\\nElőadó: ${event.performer.name}`;
  }
  if (event.itemName) {
    description += `\\n${event.itemName}`;
  }

  // Build location
  const location = event.performanceLocation || 'Helyszín nincs megadva';

  // Generate .ics content
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//koncert24.hu//Events//HU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@koncert24.hu`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.subject}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    `LOCATION:${location}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Generate Google Calendar URL
 * @param {Object} event - Event object
 * @returns {string} Google Calendar URL
 */
function generateGoogleCalendarUrl(event) {
  const startDate = new Date(event.performanceDate);

  if (event.performanceTime) {
    const [hours, minutes] = event.performanceTime.split(':');
    startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0);
  } else {
    startDate.setHours(19, 0, 0);
  }

  const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

  // Format for Google Calendar (YYYYMMDDTHHmmssZ)
  const formatGoogleDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;

  let details = event.subject;
  if (event.performer && event.performer.name) {
    details += `\n\nElőadó: ${event.performer.name}`;
  }
  if (event.itemName) {
    details += `\n${event.itemName}`;
  }

  const baseUrl = 'https://www.google.com/calendar/render';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.subject,
    dates,
    details,
    location: event.performanceLocation || '',
    sprop: 'website:koncert24.hu'
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate Outlook Calendar URL (.ics download)
 * Same as .ics generation
 */
function generateOutlookUrl(event) {
  // Outlook uses .ics files
  return `/api/events/${event.id}/calendar.ics`;
}

/**
 * Generate Apple Calendar URL (.ics download)
 * Same as .ics generation
 */
function generateAppleCalendarUrl(event) {
  // Apple Calendar uses .ics files
  return `/api/events/${event.id}/calendar.ics`;
}

module.exports = {
  generateICS,
  generateGoogleCalendarUrl,
  generateOutlookUrl,
  generateAppleCalendarUrl
};
