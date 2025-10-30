const express = require('express');
const router = express.Router();
const { Event, Performer, Setting } = require('../models');
const logger = require('../config/logger');
const { generateICS } = require('../utils/calendar');
const { getEventsMetaDescription } = require('../utils/seo-helpers');

// Helper: Get event date range based on settings
async function getEventDateRange() {
  try {
    const monthsBefore = await Setting.findOne({ where: { key: 'events.sync_months_before' } });
    const monthsAfter = await Setting.findOne({ where: { key: 'events.sync_months_after' } });

    const before = monthsBefore ? parseInt(monthsBefore.value, 10) : 1;
    const after = monthsAfter ? parseInt(monthsAfter.value, 10) : 6;

    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - before);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + after);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  } catch (error) {
    logger.error({ err: error }, 'Error getting event date range from settings');
    // Fallback to default values
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 6);
    return { startDate, endDate };
  }
}


// Helper: Calculate end date/time for event (3 hours after start)
function calculateEndDateTime(performanceDate, performanceTime) {
  if (!performanceTime) {
    return null;
  }

  const [hours, minutes] = performanceTime.split(':');
  const endHours = (parseInt(hours, 10) + 3) % 24;
  const endTime = `${String(endHours).padStart(2, '0')}:${minutes}:00`;
  return `${performanceDate}T${endTime}`;
}

// Helper: Parse location to extract postal code and locality
function parseLocation(performanceLocation) {
  const locationParts = performanceLocation.split(',');
  const firstPart = locationParts[0].trim();
  const postalCodeMatch = firstPart.match(/^(\d{4})\s+(.+)$/);

  return {
    fullLocation: performanceLocation,
    locality: postalCodeMatch ? postalCodeMatch[2] : firstPart,
    postalCode: postalCodeMatch ? postalCodeMatch[1] : null,
    streetAddress: locationParts.length > 1 ? locationParts.slice(1).join(',').trim() : null
  };
}

// Helper: Build location schema for event
function buildLocationSchema(performanceLocation) {
  if (!performanceLocation) {
    return null;
  }

  const location = parseLocation(performanceLocation);
  const schema = {
    '@type': 'Place',
    name: location.fullLocation,
    address: {
      '@type': 'PostalAddress',
      addressLocality: location.locality,
      addressCountry: 'HU'
    }
  };

  if (location.postalCode) {
    schema.address.postalCode = location.postalCode;
  }

  if (location.streetAddress) {
    schema.address.streetAddress = location.streetAddress;
  }

  return schema;
}

// Helper: Build performer schema for event
function buildPerformerSchema(performer, siteDomain) {
  if (!performer) {
    return null;
  }

  const schema = {
    '@type': 'PerformingGroup',
    name: performer.name,
    url: `${siteDomain}/eloadok/${performer.slug || performer.id}`
  };

  if (performer.imageUrl) {
    schema.image = performer.imageUrl;
  }

  return schema;
}

// Helper: Get event images (from event or performer)
function getEventImages(event) {
  const images = [];

  if (event.imageUrl) {
    images.push(event.imageUrl);
  } else if (event.performer && event.performer.imageUrl) {
    images.push(event.performer.imageUrl);
  }

  if (images.length === 0) {
    return null;
  }

  return images.length === 1 ? images[0] : images;
}

// Helper: Build event description
function buildEventDescription(event) {
  if (event.itemName) {
    return `${event.itemName} előadás: ${event.subject}`;
  }
  if (event.performer) {
    return `${event.performer.name} koncert - ${event.subject}`;
  }
  return event.subject;
}

// Helper: Build structured data for single event
/**
 * Helper: Build event dates
 */
function buildEventDates(event) {
  const dates = {};

  if (event.performanceDate) {
    let startDate = event.performanceDate;
    if (event.performanceTime) {
      startDate = `${event.performanceDate}T${event.performanceTime}`;
    }
    dates.startDate = startDate;

    const endDate = calculateEndDateTime(event.performanceDate, event.performanceTime);
    if (endDate) {
      dates.endDate = endDate;
    }
  }

  return dates;
}

/**
 * Helper: Build event offers
 */
function buildEventOffers(event, siteDomain) {
  return {
    '@type': 'Offer',
    url: `${siteDomain}/foglalas?performerId=${event.performerId || ''}`,
    availability: 'https://schema.org/InStock',
    validFrom: event.performanceDate
  };
}

/**
 * Build structured data for a single event
 */
function buildEventStructuredData(event, index, siteDomain) {
  const eventData = {
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'Event',
      name: event.subject,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'
    }
  };

  const dates = buildEventDates(event);
  Object.assign(eventData.item, dates);

  const locationSchema = buildLocationSchema(event.performanceLocation);
  if (locationSchema) {
    eventData.item.location = locationSchema;
  }

  const performerSchema = buildPerformerSchema(event.performer, siteDomain);
  if (performerSchema) {
    eventData.item.performer = performerSchema;
  }

  const images = getEventImages(event);
  if (images) {
    eventData.item.image = images;
  }

  eventData.item.description = buildEventDescription(event);
  eventData.item.offers = buildEventOffers(event, siteDomain);

  return eventData;
}

// GET /esemenyek - Public events page
router.get('/', async (req, res) => {
  try {
    const INITIAL_LOAD = 12; // First page load

    // Get date range from settings
    const { startDate, endDate } = await getEventDateRange();

    // Get only first 12 events for initial page load
    const events = await Event.findAll({
      where: {
        status: 'Approved',
        performanceDate: {
          [require('sequelize').Op.gte]: startDate,
          [require('sequelize').Op.lte]: endDate
        }
      },
      include: [{
        model: Performer,
        as: 'performer',
        required: false
      }],
      order: [['performanceDate', 'ASC'], ['performanceTime', 'ASC']],
      limit: INITIAL_LOAD
    });

    // Schema.org structured data for events
    const siteDomain = process.env.SITE_DOMAIN || 'http://localhost:3000';
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Események',
      description: 'Tekintse meg rendezvényeinket és koncertjeinket',
      numberOfItems: events.length,
      itemListElement: events.map((event, index) => buildEventStructuredData(event, index, siteDomain))
    };

    // Generate dynamic meta description
    const metaDescription = getEventsMetaDescription(events.length, events);

    res.render('events/index', {
      title: 'Események',
      pageDescription: metaDescription,
      events,
      structuredData
    });
  } catch (error) {
    logger.error({ err: error, service: 'events', operation: 'list' }, 'Error loading events page');

    res.status(500).render('error', {
      statusCode: 500,
      title: 'Hiba történt',
      message: 'Hiba az események betöltése közben'
    });
  }
});

// API: Get events with pagination
router.get('/api/events', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const offset = (page - 1) * limit;

    // Get filters from query
    const { search, filter } = req.query;

    // Build where clause
    const where = {
      status: 'Approved' // Only approved events
    };

    // Get date range from settings
    const { startDate, endDate } = await getEventDateRange();

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === 'today') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.performanceDate = {
        [require('sequelize').Op.gte]: today,
        [require('sequelize').Op.lt]: tomorrow
      };
    } else if (filter === 'week') {
      // Aktuális hét (hétfő-vasárnap)
      const currentDay = now.getDay(); // 0 = vasárnap, 1 = hétfő, ...
      const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay; // Ha vasárnap, akkor -6, különben 1 - nap
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysToMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7); // Hétfőtől +7 nap = következő hétfő
      where.performanceDate = {
        [require('sequelize').Op.gte]: weekStart,
        [require('sequelize').Op.lt]: weekEnd
      };
    } else if (filter === 'month') {
      // Aktuális hónap (1-31 vagy hány nap van)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Következő hónap 1. napja
      where.performanceDate = {
        [require('sequelize').Op.gte]: monthStart,
        [require('sequelize').Op.lt]: monthEnd
      };
    } else {
      // Default: use settings-based date range
      where.performanceDate = {
        [require('sequelize').Op.gte]: startDate,
        [require('sequelize').Op.lte]: endDate
      };
    }

    // Search filter
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { subject: { [Op.like]: `%${search}%` } },
        { itemName: { [Op.like]: `%${search}%` } },
        { performanceLocation: { [Op.like]: `%${search}%` } }
      ];
    }

    // Get total count
    const totalCount = await Event.count({ where });

    // Get events
    const events = await Event.findAll({
      where,
      include: [
        {
          model: Performer,
          as: 'performer',
          attributes: ['id', 'name', 'slug', 'imageUrl']
        }
      ],
      order: [['performanceDate', 'ASC']],
      limit,
      offset
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    res.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore
      }
    });
  } catch (error) {
    logger.error({ err: error, service: 'events', operation: 'api-list' }, 'Error loading events API');
    res.status(500).json({
      success: false,
      error: 'Hiba az események betöltése közben'
    });
  }
});

// API: Download .ics calendar file for an event
router.get('/:id/calendar.ics', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      include: [{ model: Performer, as: 'performer' }]
    });

    if (!event) {
      return res.status(404).send('Esemény nem található');
    }

    const icsContent = generateICS(event);
    const filename = `esemeny-${event.id}-${event.subject.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (error) {
    logger.error({ err: error, eventId: req.params.id }, 'Error generating calendar file');
    res.status(500).send('Hiba a naptár fájl létrehozása közben');
  }
});

module.exports = router;
