/**
 * Manual performer sync from vTiger
 */

require('dotenv').config();
const { SyncService } = require('../services/syncService');

async function manualSync() {
  const syncService = new SyncService();

  try {
    console.log('🔄 Starting manual performer sync from vTiger...\n');

    const result = await syncService.syncPerformers(true); // true = manual sync

    if (result.success) {
      console.log('\n✅ Sync completed successfully!');
      console.log('\nStatistics:');
      console.log(`  Created: ${result.stats.created}`);
      console.log(`  Updated: ${result.stats.updated}`);
      console.log(`  Deleted: ${result.stats.deleted}`);
      console.log(`  Unchanged: ${result.stats.unchanged}`);
      console.log(`  Errors: ${result.stats.errors}`);
    } else {
      console.error('\n❌ Sync failed:', result.error);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

manualSync();
