const express = require('express');
const router = express.Router();
const { CronJob } = require('../models');
const { requireAdmin } = require('../middleware/auth');
const cronService = require('../services/cronService');
const logger = require('../config/logger');
const { getNextCronTime } = require('../utils/cronPatternMatcher');

// Mount jobs sub-router for manual job execution
const jobsRouter = require('./admin-cron-jobs');
router.use('/', jobsRouter);

/**
 * GET /admin/cron
 * Cron Jobs kezelő oldal
 */
router.get('/', requireAdmin, (req, res) => {
  try {
    res.render('admin/cron-jobs', {
      layout: 'layouts/admin',
      title: 'Ütemezett Feladatok',
      currentPath: req.path,
      csrfToken: res.locals.csrfToken || req.session?.csrfToken || '',
      messages: req.session.messages || {}
    });

    // Clear messages after rendering
    req.session.messages = {};
  } catch (error) {
    logger.error({
      err: error,
      userId: req.session?.userId,
      path: req.path
    }, 'Error loading cron jobs page');

    res.status(500).render('error', {
      message: 'Hiba az ütemezett feladatok oldal betöltése során',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// Helper function to get emoji for cron job
function getCronJobEmoji(jobId) {
  const id = jobId.toLowerCase();
  if (id.includes('performer')) {
    return '🎤';
  }
  if (id.includes('event')) {
    return '🎫';
  }
  if (id.includes('booking')) {
    return '📅';
  }
  if (id.includes('geonames')) {
    return '🌍';
  }
  if (id.includes('backup')) {
    return '💾';
  }
  if (id.includes('maintenance')) {
    return '🧹';
  }
  return '⏰';
}

// Cron státusz lekérdezése
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const jobs = await CronJob.findAll();
    const cronJobs = jobs.map((job) => {
      const nextIso = getNextCronTime(job.schedule);
      let nextRun = null;
      if (nextIso) {
        const d = new Date(nextIso);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        nextRun = `${year}. ${month}. ${day}. ${hour}:${minute}`;
      }

      // Add emoji to name (global, backend-driven)
      const emoji = getCronJobEmoji(job.id);
      const displayName = `${emoji} ${job.name}`;

      return {
        id: job.id,
        name: displayName,
        description: job.description,
        schedule: job.schedule,
        isActive: job.isActive,
        lastRun: null, // Note: Last run tracking not implemented yet - jobs execute via system cron
        nextRun
      };
    });
    res.json({ success: true, cronJobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cron frissítése
router.post('/update', requireAdmin, async (req, res) => {
  try {
    const { id, schedule, isActive } = req.body;
    if (!id || !schedule) {
      return res.status(400).json({ success: false, message: 'Hiányzó adat.' });
    }
    const job = await CronJob.findByPk(id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Feladat nem található.' });
    }
    job.schedule = schedule;
    if (typeof isActive !== 'undefined') { job.isActive = Boolean(isActive); }
    await job.save();

    // Reload cron jobs to apply changes immediately
    const reloadResult = await cronService.reloadCronJobs();

    if (!reloadResult.success) {
      logger.warn({
        service: 'adminCron',
        operation: 'updateCronJob',
        jobId: id,
        reloadError: reloadResult.message
      }, 'Cron job updated but reload failed');
      return res.json({
        success: true,
        message: 'Feladat mentve, de az újratöltés sikertelen volt. Indítsd újra a szervert.'
      });
    }

    res.json({ success: true, message: 'Feladat frissítve és újratöltve.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cron jobs újratöltése (hot reload)
router.post('/reload', requireAdmin, async (req, res) => {
  try {
    const result = await cronService.reloadCronJobs();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Aktív cron job-ok listája
router.get('/active', requireAdmin, (req, res) => {
  try {
    const activeTasks = cronService.getActiveCronTasks();
    res.json({ success: true, activeTasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
