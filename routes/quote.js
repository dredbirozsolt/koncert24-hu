const express = require('express');
const router = express.Router();
const { Performer, Quote, Setting } = require('../models');
const { Sequelize } = require('sequelize');
const quoteEmailService = require('../services/quoteEmailService');
const logger = require('../config/logger');

/**
 * GET /ajanlat (without performer - "Ki ér rá")
 * Step 1: Event Details + Budget + Style
 */
router.get('/', async (req, res) => {
  try {
    const step = parseInt(req.query.step) || 1;

    // Initialize session data if not exists
    if (!req.session.quoteData) {
      req.session.quoteData = {
        performerId: null,
        performerName: null,
        performerSlug: null,
        performerImage: null,
        performerPrice: null
      };
    }

    const basePath = res.locals.basePath || '/';

    // Route to appropriate step
    if (step === 1) {
      // Get min and max performer price for budget slider
      const minPriceResult = await Performer.min('price', {
        where: {
          price: {
            [Sequelize.Op.gt]: 0
          }
        }
      });
      const maxPriceResult = await Performer.max('price');

      const minBudget = Math.floor(minPriceResult || 100000);
      const maxBudget = Math.ceil(maxPriceResult || 10000000);

      return res.render('quote/recommend-step1', {
        title: 'Ajánlatkérés - Esemény részletei',
        quoteData: req.session.quoteData,
        minBudget,
        maxBudget,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    } else if (step === 2) {
      // Redirect to step 1 if step 1 data is missing
      if (!req.session.quoteData.eventDate) {
        return res.redirect('/ajanlat?step=1');
      }

      return res.render('quote/step2', {
        title: 'Ajánlatkérés - Kapcsolattartó',
        performer: null,
        quoteData: req.session.quoteData,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    } else if (step === 3) {
      // Redirect to step 2 if contact data is missing
      if (!req.session.quoteData.contactName || !req.session.quoteData.contactEmail) {
        return res.redirect('/ajanlat?step=2');
      }

      return res.render('quote/step3', {
        title: 'Ajánlatkérés - Összegzés',
        performer: null,
        quoteData: req.session.quoteData,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    }
    return res.redirect('/ajanlat?step=1');
  } catch (error) {
    logger.error({ err: error, service: 'quote', operation: 'getQuote' }, 'Quote GET error');
    res.status(500).send('Hiba történt az ajánlatkérés betöltése során.');
  }
});

/**
 * POST /ajanlat/step/:stepNumber (without performer)
 * Save step data to session
 */
router.post('/step/:stepNumber', async (req, res) => {
  try {
    const { stepNumber } = req.params;
    const step = parseInt(stepNumber);

    if (!req.session.quoteData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    if (step === 1) {
      // Save event details + budget + styles
      let eventTypes = [];
      if (Array.isArray(req.body.eventTypes)) {
        eventTypes = req.body.eventTypes;
      } else if (req.body.eventTypes) {
        eventTypes = [req.body.eventTypes];
      }

      let styles = [];
      if (Array.isArray(req.body.styles)) {
        styles = req.body.styles;
      } else if (req.body.styles) {
        styles = [req.body.styles];
      }

      req.session.quoteData = {
        ...req.session.quoteData,
        eventDate: req.body.eventDate,
        eventDateFlexible: req.body.eventDateFlexible === true || req.body.eventDateFlexible === 'true',
        eventTime: req.body.eventTime,
        eventTimeFlexible: req.body.eventTimeFlexible === true || req.body.eventTimeFlexible === 'true',
        eventLocation: req.body.eventLocation,
        eventType: req.body.eventType,
        eventTypes,
        guestCount: req.body.guestCount,
        eventName: req.body.eventName,
        eventCategory: req.body.eventCategory,
        performerCount: req.body.performerCount,
        budget: req.body.budget,
        styles
      };

      return res.json({
        success: true,
        redirect: '/ajanlat?step=2'
      });
    } else if (step === 2) {
      // Save contact details
      req.session.quoteData = {
        ...req.session.quoteData,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone || '',
        notes: req.body.notes || ''
      };

      return res.json({
        success: true,
        redirect: '/ajanlat?step=3'
      });
    }
    return res.status(400).json({ success: false, message: 'Invalid step' });
  } catch (error) {
    logger.error({ err: error, service: 'quote', operation: 'postQuote' }, 'Quote POST error');
    res.status(500).json({ success: false, message: 'Hiba történt' });
  }
});

/**
 * POST /ajanlat/submit (without performer)
 * Final submission - save to DB and send emails
 */
router.post('/submit', async (req, res) => {
  try {
    if (!req.session.quoteData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    const { quoteData } = req.session;

    // Generate reference number
    const now = new Date();
    const year = now.getFullYear();
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const referenceId = `AJ-${year}-${randomNum}`;

    // Save to database (without performerId)
    const quote = await Quote.create({
      referenceId,
      performerId: null,
      eventDate: quoteData.eventDate || null,
      eventDateFlexible: quoteData.eventDateFlexible || false,
      eventTime: quoteData.eventTime || null,
      eventLocation: quoteData.eventLocation || null,
      eventTypes: quoteData.eventType ? [quoteData.eventType] : null,
      guestCount: null,
      eventName: null,
      eventCategory: null,
      contactName: quoteData.contactName,
      contactEmail: quoteData.contactEmail,
      contactPhone: quoteData.contactPhone || null,
      notes: quoteData.notes || null,
      status: 'pending',
      performerCount: quoteData.performerCount || null,
      budget: quoteData.budget || null,
      styles: quoteData.styles || null
    });

    logger.info({
      service: 'quote',
      operation: 'submit_recommend',
      quoteId: quote.id,
      referenceId
    }, 'Recommendation quote created successfully');

    // Send notification email to booking address (admin)
    const notificationResult = await quoteEmailService.sendQuoteNotificationEmail(
      quoteData,
      null,
      referenceId
    );

    if (!notificationResult.success) {
      logger.warn({
        service: 'quote',
        operation: 'submit_recommend',
        quoteId: quote.id,
        referenceId,
        error: notificationResult.error
      }, 'Failed to send quote notification email to admin');
    }

    // Send confirmation email to user
    const confirmationResult = await quoteEmailService.sendQuoteConfirmationEmail(
      quoteData,
      null,
      referenceId
    );

    if (!confirmationResult.success) {
      logger.warn({
        service: 'quote',
        operation: 'submit_recommend',
        quoteId: quote.id,
        referenceId,
        error: confirmationResult.error
      }, 'Failed to send quote confirmation email to user');
    }

    // Clear session data
    delete req.session.quoteData;

    return res.json({
      success: true,
      referenceId,
      redirect: `/ajanlat/success/${referenceId}`
    });
  } catch (error) {
    logger.error({
      service: 'quote',
      operation: 'submit_recommend',
      error: error.message,
      stack: error.stack
    }, 'Quote submit error');

    res.status(500).json({
      success: false,
      message: 'Hiba történt az ajánlatkérés küldése során'
    });
  }
});

/**
 * GET /ajanlat/:performerSlug
 * Step 1: Event Details
 */
router.get('/:performerSlug', async (req, res) => {
  try {
    const { performerSlug } = req.params;
    const step = parseInt(req.query.step) || 1;

    // Load performer
    const performer = await Performer.findOne({
      where: { slug: performerSlug }
    });

    if (!performer) {
      return res.redirect('/eloadok');
    }

    // Initialize session data if not exists
    if (!req.session.quoteData) {
      req.session.quoteData = {
        performerId: performer.id,
        performerName: performer.name,
        performerSlug: performer.slug,
        performerImage: performer.imageUrl,
        performerPrice: performer.price
      };
    }

    const basePath = res.locals.basePath || '/';

    // Route to appropriate step
    if (step === 1) {
      return res.render('quote/step1', {
        title: `Ajánlatkérés - ${performer.name}`,
        performer,
        quoteData: req.session.quoteData,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    } else if (step === 2) {
      // Redirect to step 1 if step 1 data is missing
      if (!req.session.quoteData.eventDate) {
        return res.redirect(`/ajanlat/${performerSlug}?step=1`);
      }

      return res.render('quote/step2', {
        title: 'Ajánlatkérés - Kapcsolattartó',
        performer,
        quoteData: req.session.quoteData,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    } else if (step === 3) {
      // Redirect to step 2 if contact data is missing
      if (!req.session.quoteData.contactName || !req.session.quoteData.contactEmail) {
        return res.redirect(`/ajanlat/${performerSlug}?step=2`);
      }

      return res.render('quote/step3', {
        title: 'Ajánlatkérés - Összegzés',
        performer,
        quoteData: req.session.quoteData,
        basePath,
        isLoggedIn: Boolean(req.session.user),
        user: req.session.user || null
      });
    }
    return res.redirect(`/ajanlat/${performerSlug}?step=1`);
  } catch (error) {
    logger.error({ err: error, service: 'quote', operation: 'getQuote' }, 'Quote GET error');
    res.status(500).send('Hiba történt az ajánlatkérés betöltése során.');
  }
});

/**
 * POST /ajanlat/:performerSlug/step/:stepNumber
 * Save step data to session
 */
router.post('/:performerSlug/step/:stepNumber', async (req, res) => {
  try {
    const { performerSlug, stepNumber } = req.params;
    const step = parseInt(stepNumber);

    if (!req.session.quoteData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    if (step === 1) {
      // Save event details
      let eventTypes = [];
      if (Array.isArray(req.body.eventTypes)) {
        eventTypes = req.body.eventTypes;
      } else if (req.body.eventTypes) {
        eventTypes = [req.body.eventTypes];
      }

      req.session.quoteData = {
        ...req.session.quoteData,
        eventDate: req.body.eventDate,
        eventDateFlexible: req.body.eventDateFlexible === true || req.body.eventDateFlexible === 'true',
        eventTime: req.body.eventTime,
        eventTimeFlexible: req.body.eventTimeFlexible === true || req.body.eventTimeFlexible === 'true',
        eventLocation: req.body.eventLocation,
        eventType: req.body.eventType,
        eventTypes,
        guestCount: req.body.guestCount,
        eventName: req.body.eventName,
        eventCategory: req.body.eventCategory
      };

      return res.json({
        success: true,
        redirect: `/ajanlat/${performerSlug}?step=2`
      });
    } else if (step === 2) {
      // Save contact details
      req.session.quoteData = {
        ...req.session.quoteData,
        contactName: req.body.contactName,
        contactEmail: req.body.contactEmail,
        contactPhone: req.body.contactPhone || '',
        notes: req.body.notes || ''
      };

      return res.json({
        success: true,
        redirect: `/ajanlat/${performerSlug}?step=3`
      });
    }
    return res.status(400).json({ success: false, message: 'Invalid step' });
  } catch (error) {
    logger.error({ err: error, service: 'quote', operation: 'postQuote' }, 'Quote POST error');
    res.status(500).json({ success: false, message: 'Hiba történt' });
  }
});

/**
 * POST /ajanlat/:performerSlug/submit
 * Final submission - save to DB and send emails
 */
router.post('/:performerSlug/submit', async (req, res) => {
  try {
    const { performerSlug } = req.params;

    if (!req.session.quoteData) {
      return res.status(400).json({ success: false, message: 'Session expired' });
    }

    const { quoteData } = req.session;

    // Load performer
    const performer = await Performer.findOne({
      where: { slug: performerSlug }
    });

    if (!performer) {
      return res.status(404).json({ success: false, message: 'Performer not found' });
    }

    // Generate reference number
    const now = new Date();
    const year = now.getFullYear();
    const randomNum = Math.floor(Math.random() * 9000) + 1000;
    const referenceId = `AJ-${year}-${randomNum}`;

    // Save to database
    const quote = await Quote.create({
      referenceId,
      performerId: performer.id,
      eventDate: quoteData.eventDate || null,
      eventDateFlexible: quoteData.eventDateFlexible || false,
      eventTime: quoteData.eventTime || null,
      eventLocation: quoteData.eventLocation || null,
      eventTypes: quoteData.eventType ? [quoteData.eventType] : null,
      guestCount: null,
      eventName: null,
      eventCategory: null,
      contactName: quoteData.contactName,
      contactEmail: quoteData.contactEmail,
      contactPhone: quoteData.contactPhone || null,
      notes: quoteData.notes || null,
      status: 'pending'
    });

    logger.info({
      service: 'quote',
      operation: 'submit',
      quoteId: quote.id,
      referenceId,
      performerId: performer.id
    }, 'Quote created successfully');

    // Send notification email to booking address (admin)
    const notificationResult = await quoteEmailService.sendQuoteNotificationEmail(
      quoteData,
      performer,
      referenceId
    );

    if (!notificationResult.success) {
      logger.warn({
        service: 'quote',
        operation: 'submit',
        quoteId: quote.id,
        referenceId,
        error: notificationResult.error
      }, 'Failed to send quote notification email to admin');
    }

    // Send confirmation email to user
    const confirmationResult = await quoteEmailService.sendQuoteConfirmationEmail(
      quoteData,
      performer,
      referenceId
    );

    if (!confirmationResult.success) {
      logger.warn({
        service: 'quote',
        operation: 'submit',
        quoteId: quote.id,
        referenceId,
        error: confirmationResult.error
      }, 'Failed to send quote confirmation email to user');
    }

    // Clear session data
    delete req.session.quoteData;

    return res.json({
      success: true,
      referenceId,
      redirect: `/ajanlat/success/${referenceId}`
    });
  } catch (error) {
    logger.error({
      service: 'quote',
      operation: 'submit',
      error: error.message,
      stack: error.stack
    }, 'Quote submit error');

    res.status(500).json({
      success: false,
      message: 'Hiba történt az ajánlatkérés küldése során'
    });
  }
});

/**
 * GET /ajanlat/success/:referenceId
 * Thank you page
 */
router.get('/success/:referenceId', async (req, res) => {
  try {
    const { referenceId } = req.params;
    const basePath = res.locals.basePath || '/';

    // TODO: Load related performers (3 similar ones)
    const relatedPerformers = await Performer.findAll({
      where: {
        status: 'Kiemelt'
      },
      limit: 3,
      order: Sequelize.literal('RAND()')
    });

    // Load contact information from settings
    const contactEmail = await Setting.get('company.email') || 'info@koncert24.hu';
    const contactPhone = await Setting.get('company.phone') || '+36 30 123 4567';

    return res.render('quote/success', {
      title: 'Ajánlatkérés elküldve',
      referenceId,
      relatedPerformers,
      contactEmail,
      contactPhone,
      basePath,
      isLoggedIn: Boolean(req.session.user),
      user: req.session.user || null
    });
  } catch (error) {
    logger.error({ err: error, service: 'quote', operation: 'successPage' }, 'Quote success page error');
    res.status(500).send('Hiba történt');
  }
});

module.exports = router;
