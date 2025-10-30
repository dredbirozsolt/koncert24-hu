/**
 * Dashboard Statistics Service
 * Központi szolgáltatás az admin dashboard statisztikák gyűjtésére
 */

const { Op } = require('sequelize');
const logger = require('../config/logger');
const { Booking, User, Performer, ChatSession, OfflineMessage, CronJob } = require('../models');
const fs = require('fs').promises;
const path = require('path');

/**
 * Teljes dashboard statisztikák gyűjtése
 */
async function getDashboardStats() {
  const [
    bookingStats,
    userStats,
    performerStats,
    chatAlerts,
    systemHealth
  ] = await Promise.all([
    getBookingStats(),
    getUserStats(),
    getPerformerStats(),
    getChatAlerts(),
    getSystemHealth()
  ]);

  return {
    bookings: bookingStats,
    users: userStats,
    performers: performerStats,
    alerts: chatAlerts,
    system: systemHealth
  };
}

/**
 * 1. ÜZLETI KPI-OK: Foglalási Statisztikák
 */
async function getBookingStats() {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [todayCount, weekCount, monthCount, totalCount, statusBreakdown] = await Promise.all([
      // Mai foglalások
      Booking.count({
        where: { createdAt: { [Op.gte]: today } }
      }),

      // Heti foglalások
      Booking.count({
        where: { createdAt: { [Op.gte]: weekStart } }
      }),

      // Havi foglalások
      Booking.count({
        where: { createdAt: { [Op.gte]: monthStart } }
      }),

      // Összes foglalás
      Booking.count(),

      // Státusz szerinti breakdown
      Booking.findAll({
        attributes: [
          'status',
          [Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      })
    ]);

    // Státusz objektum konverzió
    const statusCounts = {};
    statusBreakdown.forEach((item) => {
      statusCounts[item.status] = parseInt(item.count, 10);
    });

    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      total: totalCount,
      pending: statusCounts.pending || 0,
      confirmed: statusCounts.confirmed || 0,
      completed: statusCounts.completed || 0,
      cancelled: statusCounts.cancelled || 0
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'booking'
    }, 'Error fetching booking stats');
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      total: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0
    };
  }
}

/**
 * 1. ÜZLETI KPI-OK: Felhasználói Metrikák
 */
async function getUserStats() {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const weekStart = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [totalUsers, newToday, newThisWeek, newThisMonth, roleBreakdown] = await Promise.all([
      // Összes user
      User.count(),

      // Mai új regisztrációk
      User.count({
        where: { createdAt: { [Op.gte]: today } }
      }),

      // Heti új regisztrációk
      User.count({
        where: { createdAt: { [Op.gte]: weekStart } }
      }),

      // Havi új regisztrációk
      User.count({
        where: { createdAt: { [Op.gte]: monthStart } }
      }),

      // Szerepkör szerinti breakdown
      User.findAll({
        attributes: [
          'role',
          [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']
        ],
        group: ['role'],
        raw: true
      })
    ]);

    // Role counts objektum
    const roleCounts = {};
    roleBreakdown.forEach((item) => {
      roleCounts[item.role] = parseInt(item.count, 10);
    });

    return {
      total: totalUsers,
      newToday,
      newThisWeek,
      newThisMonth,
      admins: roleCounts.admin || 0,
      sales: roleCounts.sales || 0,
      clients: roleCounts.client || 0,
      performers: roleCounts.performer || 0
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'user'
    }, 'Error fetching user stats');
    return {
      total: 0,
      newToday: 0,
      newThisWeek: 0,
      newThisMonth: 0,
      admins: 0,
      sales: 0,
      clients: 0,
      performers: 0
    };
  }
}

/**
 * 1. ÜZLETI KPI-OK: Előadó Aktivitás
 */
async function getPerformerStats() {
  try {
    const [totalPerformers, activePerformers, topPerformers, categoryBreakdown] = await Promise.all([
      // Összes előadó
      Performer.count(),

      // Aktív státuszú előadók
      Performer.count({
        where: { isActive: true }
      }),

      // Top 5 előadó foglalások szerint
      Booking.findAll({
        attributes: [
          'performerId',
          [Booking.sequelize.fn('COUNT', Booking.sequelize.col('Booking.id')), 'bookingCount']
        ],
        include: [{
          model: Performer,
          as: 'performer',
          attributes: ['id', 'name', 'category']
        }],
        group: ['performerId', 'performer.id'],
        order: [[Booking.sequelize.literal('bookingCount'), 'DESC']],
        limit: 5,
        raw: false
      }),

      // Kategória szerinti breakdown
      Performer.findAll({
        attributes: [
          'category',
          [Performer.sequelize.fn('COUNT', Performer.sequelize.col('id')), 'count']
        ],
        group: ['category'],
        order: [[Performer.sequelize.literal('count'), 'DESC']],
        raw: true
      })
    ]);

    logger.debug({
      service: 'dashboardStats',
      statType: 'performer',
      total: totalPerformers,
      active: activePerformers,
      topPerformersCount: topPerformers.length,
      categoriesCount: categoryBreakdown.length
    }, 'Performer stats results');

    // Top performers formázás
    const formattedTopPerformers = topPerformers.map((booking) => ({
      id: booking.performer?.id || null,
      name: booking.performer?.name || 'Ismeretlen',
      category: booking.performer?.category || '-',
      bookingCount: parseInt(booking.dataValues.bookingCount, 10)
    }));

    return {
      total: totalPerformers,
      active: activePerformers,
      inactive: totalPerformers - activePerformers,
      topPerformers: formattedTopPerformers,
      categories: categoryBreakdown.map((cat) => ({
        name: cat.category || 'Nincs kategória',
        count: parseInt(cat.count, 10)
      }))
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'performer'
    }, 'Error fetching performer stats');
    return {
      total: 0,
      active: 0,
      inactive: 0,
      topPerformers: [],
      categories: []
    };
  }
}

/**
 * 2. KRITIKUS FIGYELMEZTETÉSEK: Chat & Offline Üzenetek
 */
async function getChatAlerts() {
  try {
    const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000));

    const [unansweredChats, urgentOfflineMessages, totalOfflineMessages] = await Promise.all([
      // Válaszra váró chat sessions (aktív vagy eszkalált státuszban)
      ChatSession.count({
        where: {
          status: { [Op.in]: ['active', 'escalated'] }
        }
      }),

      // 48 órán belüli offline üzenetek (sürgős)
      OfflineMessage.count({
        where: {
          status: 'pending',
          createdAt: { [Op.gte]: twoDaysAgo }
        }
      }),

      // Összes függőben lévő offline üzenet
      OfflineMessage.count({
        where: { status: 'pending' }
      })
    ]);

    const result = {
      unansweredChats,
      offlineMessagesUrgent: urgentOfflineMessages,
      offlineMessagesTotal: totalOfflineMessages,
      hasAlerts: unansweredChats > 0 || urgentOfflineMessages > 0
    };

    logger.debug({
      service: 'dashboardStats',
      statType: 'chatAlerts',
      ...result
    }, 'Chat alerts results');

    return result;
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'chatAlerts'
    }, 'Error fetching chat alerts');
    return {
      unansweredChats: 0,
      offlineMessagesUrgent: 0,
      offlineMessagesTotal: 0,
      hasAlerts: false
    };
  }
}

/**
 * 4. RENDSZER ÁLLAPOT: Backup & Cron Jobs
 */
async function getSystemHealth() {
  try {
    const [lastBackup, cronJobsStatus] = await Promise.all([
      getLastBackupTime(),
      getCronJobsStatus()
    ]);

    return {
      lastBackup,
      cronJobs: cronJobsStatus
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'systemHealth'
    }, 'Error fetching system health');
    return {
      lastBackup: null,
      cronJobs: []
    };
  }
}

/**
 * Utolsó backup ideje
 */
async function getLastBackupTime() {
  try {
    const backupDir = path.join(process.cwd(), 'backup');
    const entries = await fs.readdir(backupDir, { withFileTypes: true });

    const backupFolders = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('backup_'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Legújabb először

    if (backupFolders.length === 0) {
      return null;
    }

    const latestBackup = backupFolders[0];
    const backupPath = path.join(backupDir, latestBackup.name);
    const stats = await fs.stat(backupPath);

    return {
      name: latestBackup.name,
      createdAt: stats.mtime,
      hoursAgo: Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60))
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'lastBackup'
    }, 'Error getting last backup time');
    return null;
  }
}

/**
 * Cron Job-ok státusza
 */
async function getCronJobsStatus() {
  try {
    const cronJobs = await CronJob.findAll({
      attributes: [
        'id', 'name', 'schedule', 'isActive', 'lastRunAt',
        'lastStatus', 'lastError', 'createdAt', 'updatedAt'
      ],
      order: [['name', 'ASC']]
    });

    return cronJobs.map((job) => {
      const hoursAgo = job.lastRunAt
        ? Math.floor((Date.now() - new Date(job.lastRunAt).getTime()) / (60 * 60 * 1000))
        : null;

      return {
        id: job.id,
        name: job.name,
        schedule: job.schedule,
        enabled: job.isActive,
        lastRun: job.lastRunAt,
        lastStatus: job.lastStatus || 'never',
        hasError: job.lastStatus === 'error',
        lastError: job.lastError,
        hoursAgo
      };
    });
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'cronJobs'
    }, 'Error fetching cron jobs status');
    return [];
  }
}

/**
 * 5. BUSINESS INTELLIGENCE: 12 hónapos foglalási trend
 */
async function getBookingTrendData(months = 12) {
  try {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const bookings = await Booking.findAll({
      attributes: [
        [Booking.sequelize.fn('DATE_FORMAT', Booking.sequelize.col('createdAt'), '%Y-%m'), 'month'],
        [Booking.sequelize.fn('COUNT', Booking.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: startDate }
      },
      group: [Booking.sequelize.fn('DATE_FORMAT', Booking.sequelize.col('createdAt'), '%Y-%m')],
      order: [[Booking.sequelize.literal('month'), 'ASC']],
      raw: true
    });

    // Hiányzó hónapok feltöltése 0-val
    const labels = [];
    const data = [];

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' });

      labels.push(monthLabel);

      const found = bookings.find((b) => b.month === monthKey);
      data.push(found ? parseInt(found.count, 10) : 0);
    }

    return { labels, data };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'bookingTrend',
      months
    }, 'Error fetching booking trend data');
    return { labels: [], data: [] };
  }
}

/**
 * 5. BUSINESS INTELLIGENCE: Conversion rate (látogatók vs foglalások)
 */
async function getConversionRateData(months = 12) {
  // TODO: Implement after analytics integration
  // Placeholder for now
  try {
    const trendData = await getBookingTrendData(months);

    // Mock visitor data (replace with real analytics later)
    const mockVisitors = trendData.data.map((bookings) => bookings * 50); // 2% conversion rate assumption

    return {
      labels: trendData.labels,
      bookings: trendData.data,
      visitors: mockVisitors,
      conversionRate: trendData.data.map((b, i) => (
        mockVisitors[i] > 0 ? ((b / mockVisitors[i]) * 100).toFixed(2) : 0
      ))
    };
  } catch (error) {
    logger.error({
      err: error,
      service: 'dashboardStats',
      statType: 'conversionRate',
      months
    }, 'Error calculating conversion rate');
    return { labels: [], bookings: [], visitors: [], conversionRate: [] };
  }
}

module.exports = {
  getDashboardStats,
  getBookingStats,
  getUserStats,
  getPerformerStats,
  getChatAlerts,
  getSystemHealth,
  getBookingTrendData,
  getConversionRateData
};
