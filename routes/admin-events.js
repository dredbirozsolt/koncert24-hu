const express = require('express');
const router = express.Router();
const eventSyncService = require('../services/eventSyncService');
const { Event, Performer, Setting } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Konstansok
const SYNC_MONTHS_BEFORE_KEY = 'events.sync_months_before';
const SYNC_MONTHS_AFTER_KEY = 'events.sync_months_after';

// GET /admin/events - Events admin page
router.get('/', async (req, res) => {
  try {
    // Beállítások lekérése
    const syncMonthsBefore = await Setting.get(SYNC_MONTHS_BEFORE_KEY, 1);
    const syncMonthsAfter = await Setting.get(SYNC_MONTHS_AFTER_KEY, 1);

    // Események lekérése
    const events = await Event.findAll({
      include: [{
        model: Performer,
        as: 'performer',
        required: false
      }],
      order: [['performanceDate', 'DESC'], ['performanceTime', 'DESC']],
      limit: 100
    });

    const totalEvents = await Event.count();

    // Jövőbeli események
    const today = new Date().toISOString().split('T')[0];
    const upcomingEvents = await Event.count({
      where: {
        performanceDate: {
          [Op.gte]: today
        }
      }
    });

    res.render('admin/events', {
      layout: 'layouts/admin',
      title: 'Események Kezelése',
      currentPath: req.path,
      events,
      totalEvents,
      upcomingEvents,
      syncMonthsBefore,
      syncMonthsAfter,
      messages: req.session.messages || {}
    });

    // Clear messages after rendering
    req.session.messages = {};
  } catch (error) {
    logger.error({ err: error, service: 'adminEvents', operation: 'loadPage' }, 'Error loading events admin');
    res.status(500).render('error', {
      message: 'Hiba az események betöltése közben',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// POST /admin/events/sync - Manual sync
router.post('/sync', async (req, res) => {
  try {
    let { startDate, endDate } = req.body;

    // Ha nem jönnek dátumok a request-ben, használjuk a beállításokat
    if (!startDate || !endDate) {
      const syncMonthsBefore = await Setting.get(SYNC_MONTHS_BEFORE_KEY, 1);
      const syncMonthsAfter = await Setting.get(SYNC_MONTHS_AFTER_KEY, 1);

      const today = new Date();

      // Kezdő dátum: X hónappal ezelőtt
      const startDateObj = new Date(today);
      startDateObj.setMonth(startDateObj.getMonth() - parseInt(syncMonthsBefore));
      startDate = startDateObj.toISOString().split('T')[0];

      // Vég dátum: Y hónappal előre
      const endDateObj = new Date(today);
      endDateObj.setMonth(endDateObj.getMonth() + parseInt(syncMonthsAfter));
      endDate = endDateObj.toISOString().split('T')[0];
    }

    const result = await eventSyncService.syncEvents({
      startDate,
      endDate
    });

    // Szép, human-readable üzenet
    const message = `Létrehozva: ${result.created || 0}, `
      + `Frissítve: ${result.updated || 0}, Törölve: ${result.deleted || 0}`;

    res.json({
      success: true,
      message,
      ...result
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminEvents', operation: 'sync' }, 'Error syncing events');
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /admin/events/settings - Update settings
router.post('/settings', async (req, res) => {
  try {
    const { syncMonthsBefore, syncMonthsAfter } = req.body;

    if (syncMonthsBefore !== undefined) {
      await Setting.set(
        SYNC_MONTHS_BEFORE_KEY,
        parseInt(syncMonthsBefore),
        'number',
        'events',
        'Események szinkronizálás: hány hónappal visszamenőleg'
      );
    }

    if (syncMonthsAfter !== undefined) {
      await Setting.set(
        SYNC_MONTHS_AFTER_KEY,
        parseInt(syncMonthsAfter),
        'number',
        'events',
        'Események szinkronizálás: hány hónappal előre'
      );
    }

    res.json({
      success: true,
      message: 'Beállítások mentve'
    });
  } catch (error) {
    logger.error({ err: error, service: 'adminEvents', operation: 'saveSettings' }, 'Error saving event settings');
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE /admin/events/:id - Delete event
router.delete('/:id', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Esemény nem található'
      });
    }

    await event.destroy();

    res.json({
      success: true,
      message: 'Esemény törölve'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminEvents', operation: 'deleteEvent', eventId: req.params.id },
      'Error deleting event'
    );
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
