const express = require('express');
const router = express.Router();
const { Performer, Booking, Setting } = require('../models');
const bookingEmailService = require('../services/bookingEmailService');
const logger = require('../config/logger');

/**
 * Helper: Render step with common data
 */
function renderStep({ res, step, performer, bookingData, basePath, session }) {
  const stepTitles = {
    step1: `Foglalás - ${performer.name}`,
    step2: 'Foglalás - Kapcsolattartó',
    step3: 'Foglalás - Szerződés adatok',
    step4: 'Foglalás - Kapcsolattartók',
    step5: 'Foglalás - Számlázási adatok',
    step6: 'Foglalás - Összegzés'
  };

  return res.render(`booking/${step}`, {
    title: stepTitles[step],
    performer,
    bookingData,
    basePath,
    isLoggedIn: Boolean(session.user),
    user: session.user || null
  });
}

/**
 * Helper: Validate step data and return redirect URL if invalid
 * Validates that PREVIOUS step data exists before showing current step
 */
function validateStepData(step, bookingData, performerSlug) {
  const validations = {
    1: () => null, // Step 1 has no prerequisites
    2: () => ((!bookingData.eventDate || !bookingData.eventLocation) ? 1 : null),
    3: () => ((!bookingData.contactName || !bookingData.contactEmail) ? 2 : null),
    4: () => ((!bookingData.clientName || !bookingData.taxNumber) ? 3 : null),
    5: () => ((!bookingData.eventDayContactName || !bookingData.techContactName) ? 4 : null),
    6: () => (bookingData.billingEmail ? null : 5)
  };

  const redirectStep = validations[step] && validations[step]();
  return redirectStep ? `/foglalas/${performerSlug}?step=${redirectStep}` : null;
}

/**
 * GET /foglalas/:performerSlug
 * Multi-step booking flow
 */
router.get('/:performerSlug', async (req, res) => {
  try {
    const { performerSlug } = req.params;
    const { step = '1' } = req.query;

    const performer = await Performer.findOne({ where: { slug: performerSlug } });
    if (!performer) {
      return res.redirect('/eloadok');
    }

    if (!req.session.bookingData) {
      req.session.bookingData = {
        performerId: performer.id,
        performerName: performer.name,
        performerSlug: performer.slug,
        performerImage: performer.profile_image,
        performerPrice: performer.price
      };
    }

    const basePath = res.locals.basePath || '/';
    const { bookingData } = req.session;

    const redirectUrl = validateStepData(step, bookingData, performerSlug);
    if (redirectUrl) {
      return res.redirect(redirectUrl);
    }

    const stepMap = { 1: 'step1', 2: 'step2', 3: 'step3', 4: 'step4', 5: 'step5', 6: 'step6' };
    const stepView = stepMap[step];

    if (!stepView) {
      return res.redirect(`/foglalas/${performerSlug}?step=1`);
    }

    return renderStep({ res, step: stepView, performer, bookingData, basePath, session: req.session });
  } catch (error) {
    logger.error({
      service: 'booking',
      operation: 'get',
      error: error.message,
      stack: error.stack
    }, 'Booking GET error');
    res.status(500).send('Hiba történt a foglalás betöltése során.');
  }
});

/**
 * POST /foglalas/:performerSlug (step submissions)
 * Save step data to session and redirect to next step
 */
router.post('/:performerSlug', (req, res) => {
  try {
    const { performerSlug } = req.params;
    const { step } = req.query;

    if (!req.session.bookingData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    // Determine which step data to save
    switch (step) {
      case '2':
        req.session.bookingData = {
          ...req.session.bookingData,
          eventDate: req.body.eventDate,
          eventDateFlexible: req.body.eventDateFlexible === 'on',
          eventTime: req.body.eventTime,
          eventTimeFlexible: req.body.eventTimeFlexible === 'on',
          eventLocation: req.body.eventLocation,
          venueAddress: req.body.venueAddress,
          eventType: req.body.eventType,
          guestCount: req.body.guestCount,
          eventName: req.body.eventName,
          eventCategory: req.body.eventCategory
        };
        return res.redirect(`/foglalas/${performerSlug}?step=2`);

      case '3':
        req.session.bookingData = {
          ...req.session.bookingData,
          contactName: req.body.contactName,
          contactEmail: req.body.contactEmail,
          contactPhone: req.body.contactPhone || ''
        };
        return res.redirect(`/foglalas/${performerSlug}?step=3`);

      case '4':
        req.session.bookingData = {
          ...req.session.bookingData,
          clientName: req.body.clientName,
          clientAddress: req.body.clientAddress,
          taxNumber: req.body.taxNumber,
          registrationNumber: req.body.registrationNumber || '',
          representativeName: req.body.representativeName
        };
        return res.redirect(`/foglalas/${performerSlug}?step=4`);

      case '5':
        // Step 5: just displays step5.ejs (final review), but POST saves step 4 data
        req.session.bookingData = {
          ...req.session.bookingData,
          eventDayContactName: req.body.eventDayContactName,
          eventDayContactPhone: req.body.eventDayContactPhone,
          eventDayContactEmail: req.body.eventDayContactEmail,
          techContactName: req.body.techContactName,
          techContactPhone: req.body.techContactPhone,
          techContactEmail: req.body.techContactEmail
        };
        req.session.save((err) => {
          if (err) {
            logger.error({ err }, 'Session save error');
          }
        });
        return res.redirect(`/foglalas/${performerSlug}?step=5`);

      case '6':
        req.session.bookingData = {
          ...req.session.bookingData,
          billingEmail: req.body.billingEmail,
          notes: req.body.notes || ''
        };
        return res.redirect(`/foglalas/${performerSlug}?step=6`);

      default:
        return res.status(400).json({ success: false, message: 'Invalid step' });
    }
  } catch (error) {
    logger.error({
      service: 'booking',
      operation: 'post',
      error: error.message,
      stack: error.stack
    }, 'Booking POST error');
    res.status(500).send('Hiba történt');
  }
});

/**
 * Helper: Create booking record
 */
async function createBookingRecord(bookingData, performer) {
  // Map Hungarian category names to English ENUM values
  /* eslint-disable quote-props */
  const categoryMap = {
    'magánrendezvény': 'private',
    'céges rendezvény': 'corporate',
    'falunap': 'community',
    'fesztivál': 'festival',
    'városi ünnep': 'community',
    'iskolai rendezvény': 'community',
    'egyéb': 'other'
  };
  /* eslint-enable quote-props */

  return await Booking.create({
    performerId: performer.id,
    // Event information
    eventDate: bookingData.eventDate,
    eventTime: bookingData.eventTime || null,
    eventTimeFlexible: bookingData.eventTimeFlexible || false,
    eventLocation: bookingData.eventLocation,
    eventAddress: bookingData.venueAddress || null,
    eventType: bookingData.eventType,
    expectedGuests: bookingData.guestCount ? parseInt(bookingData.guestCount, 10) : null,
    eventName: bookingData.eventName || null,
    eventCategory: categoryMap[bookingData.eventCategory] || null,
    message: bookingData.notes || null,
    // Contact person (from step 2 - primary contact)
    clientName: bookingData.contactName,
    clientEmail: bookingData.contactEmail,
    clientPhone: bookingData.contactPhone,
    // Client/Company information (from step 3)
    clientCompany: bookingData.clientName,
    companyAddress: bookingData.clientAddress,
    taxNumber: bookingData.taxNumber,
    registrationNumber: bookingData.registrationNumber || null,
    representative: bookingData.representativeName,
    // Event day contact (from step 4)
    onSiteContactName: bookingData.eventDayContactName,
    onSiteContactPhone: bookingData.eventDayContactPhone,
    // Technical contact (from step 4)
    technicalContactName: bookingData.techContactName,
    technicalContactPhone: bookingData.techContactPhone,
    technicalContactEmail: bookingData.techContactEmail,
    // Billing (from step 5)
    invoiceEmail: bookingData.billingEmail,
    // Status
    status: 'pending'
  });
}

/**
 * Helper: Send booking emails (notification + confirmation)
 */
async function sendBookingEmails(bookingData, performer, bookingId) {
  // Send notification to admin
  try {
    await bookingEmailService.sendBookingNotificationEmail(bookingData, performer, bookingId);
  } catch (emailError) {
    logger.warn({
      service: 'booking',
      operation: 'confirm',
      bookingId,
      error: emailError.message
    }, 'Failed to send booking notification email to admin');
  }

  // Send confirmation to customer
  try {
    await bookingEmailService.sendBookingConfirmationEmail(bookingData, performer, bookingId);
  } catch (emailError) {
    logger.warn({
      service: 'booking',
      operation: 'confirm',
      bookingId,
      error: emailError.message
    }, 'Failed to send booking confirmation email to user');
  }
}

/**
 * POST /foglalas/:performerSlug/confirm
 * Final submission - save to DB and send emails
 */
router.post('/:performerSlug/confirm', async (req, res) => {
  try {
    const { performerSlug } = req.params;
    const { bookingData } = req.session;

    if (!bookingData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    if (!req.body.privacyConsent) {
      return res.status(400).json({
        success: false,
        message: 'Az adatkezelési tájékoztató elfogadása kötelező'
      });
    }

    const performer = await Performer.findOne({ where: { slug: performerSlug } });
    if (!performer) {
      return res.status(404).json({ success: false, message: 'Performer not found' });
    }

    const booking = await createBookingRecord(bookingData, performer);

    logger.info({
      service: 'booking',
      operation: 'confirm',
      bookingId: booking.id,
      performerId: performer.id
    }, 'Booking created successfully');

    await sendBookingEmails(bookingData, performer, booking.id);

    delete req.session.bookingData;

    return res.redirect(`/foglalas/success/${booking.id}`);
  } catch (error) {
    logger.error({
      service: 'booking',
      operation: 'confirm',
      error: error.message,
      stack: error.stack
    }, 'Booking confirm error');

    res.status(500).send('Hiba történt a foglalás küldése során');
  }
});

/**
 * GET /foglalas/success/:bookingId
 * Thank you page
 */
router.get('/success/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const basePath = res.locals.basePath || '/';

    const booking = await Booking.findOne({
      where: { id: bookingId },
      include: [{ model: Performer, as: 'performer' }]
    });

    if (!booking) {
      return res.redirect('/');
    }

    const { performer } = booking;

    // Load contact information from settings
    const contactEmail = await Setting.get('company.email') || 'info@koncert24.hu';
    const contactPhone = await Setting.get('company.phone') || '+36 30 123 4567';
    
    return res.render('booking/success', {
      title: 'Foglalás elküldve',
      bookingId: booking.id,
      performer,
      contactEmail,
      contactPhone,
      basePath,
      isLoggedIn: Boolean(req.session.user),
      user: req.session.user || null
    });
  } catch (error) {
    logger.error({
      service: 'booking',
      operation: 'success',
      error: error.message,
      stack: error.stack
    }, 'Booking success page error');
    res.status(500).send('Hiba történt');
  }
});

module.exports = router;
