require('dotenv').config();
const { CronJob, sequelize } = require('../models');

// Cron schedule constants
const SCHEDULE_EVERY_5_MIN = '*/5 * * * *';

async function seedCronJobs() {
  const jobs = [
    {
      id: 'performer-sync',
      name: 'Performer Sync',
      description: 'Szinkronizálja az előadókat vTiger-ből',
      schedule: '0 6 * * *',
      isActive: true
    },
    {
      id: 'booking-sync',
      name: 'Booking Sync',
      description: 'Foglalásokat szinkronizál vTiger-be',
      schedule: SCHEDULE_EVERY_5_MIN,
      isActive: true
    },
    {
      id: 'event-sync',
      name: 'Event Sync',
      description: 'Események szinkronizálása Vtiger Sales Order modulból',
      schedule: '0 */6 * * *',
      isActive: true
    },
    {
      id: 'daily-maintenance',
      name: 'Daily Maintenance',
      description: 'Napi karbantartási feladatok',
      schedule: '0 2 * * *',
      isActive: true
    },
    {
      id: 'geonames-sync',
      name: 'GeoNames Sync',
      description: 'GeoNames helyek szinkronizálása',
      schedule: '0 3 * * 0#1',
      isActive: true
    },
    {
      id: 'geonames-stats',
      name: 'GeoNames Stats',
      description: 'GeoNames statisztikák generálása',
      schedule: '0 4 1 * *',
      isActive: true
    },
    {
      id: 'daily-backup',
      name: 'Daily Backup',
      description: 'Napi teljes backup készítése',
      schedule: '0 4 * * *',
      isActive: true
    },
    {
      id: 'security-alert-check',
      name: 'Security Alert Check',
      description: 'Biztonsági fenyegetések ellenőrzése és riasztások küldése',
      schedule: '*/15 * * * *',
      isActive: true
    },
    {
      id: 'security-log-cleanup',
      name: 'Security Log Cleanup',
      description: 'Régi biztonsági logok törlése (90 napnál régebbi)',
      schedule: '0 3 * * *',
      isActive: true
    },
    {
      id: 'admin-heartbeat-cleanup',
      name: 'Admin Heartbeat Cleanup',
      description: 'Elavult admin jelenlét adatok törlése',
      schedule: SCHEDULE_EVERY_5_MIN,
      isActive: true
    },
    {
      id: 'chat-session-cleanup',
      name: 'Chat Session Cleanup',
      description: 'Régi chat sessionök soft delete + anonimizálása (30+ nap inaktív)',
      schedule: '0 3 * * *',
      isActive: true
    },
    {
      id: 'blog-scheduled-publish',
      name: 'Blog Scheduled Publish',
      description: 'Időzített blog cikkek automatikus publikálása',
      schedule: SCHEDULE_EVERY_5_MIN,
      isActive: true
    },
    {
      id: 'infrastructure-health-check',
      name: 'Infrastructure Health Check',
      description: 'Infrastruktúra monitoring: Database connection, Disk space',
      schedule: SCHEDULE_EVERY_5_MIN,
      isActive: true
    }
  ];

  for (const job of jobs) {
    await CronJob.upsert(job);
  }
  console.log('Cron jobs seeded.');
  await sequelize.close();
}

seedCronJobs().catch((e) => { console.error(e); process.exit(1); });
