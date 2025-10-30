/**
 * Check cf_1125 field value for multiple performers
 */

require('dotenv').config();
const { VTigerService } = require('../services/vtigerService');

async function checkStatusFields() {
  const vtigerService = new VTigerService();

  try {
    await vtigerService.loadConfig();
    await vtigerService.authenticate();

    const performerIds = [
      { name: '100 Folk Celsius', id: '14x132778' },
      { name: 'Dred És Doris', id: '14x32500' }
    ];

    console.log('📊 Checking cf_1125 (Előadó státusz) values:\n');

    for (const performer of performerIds) {
      const product = await vtigerService.makeRequest('retrieve', { id: performer.id });
      console.log(`${performer.name}:`);
      console.log(`  cf_1125: "${product.cf_1125 || '(empty)'}"\n`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStatusFields();
