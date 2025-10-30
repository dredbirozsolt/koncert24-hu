/**
 * Script to find the vTiger custom field for "Előadó státusz"
 * Looking for the field in 100 Folk Celsius (14x132778)
 */

require('dotenv').config();
const { VTigerService } = require('../services/vtigerService');

async function findStatusField() {
  console.log('🔍 Searching for Előadó státusz field in vTiger...\n');

  const vtigerService = new VTigerService();

  try {
    await vtigerService.loadConfig();
    await vtigerService.authenticate();

    // Get 100 Folk Celsius details
    const productId = '14x132778';
    const product = await vtigerService.makeRequest('retrieve', { id: productId });

    console.log('📦 100 Folk Celsius Product Data:\n');

    // Find all cf_ fields
    const cfFields = {};
    Object.keys(product).forEach((key) => {
      if (key.startsWith('cf_')) {
        cfFields[key] = product[key];
      }
    });

    console.log('🔧 All Custom Fields (cf_):');
    console.log(JSON.stringify(cfFields, null, 2));

    // Look for fields with "Kiemelt" or status-related values
    console.log('\n🎯 Potential Status Fields:');
    Object.entries(cfFields).forEach(([key, value]) => {
      if (value && (
        value.toLowerCase().includes('kiemelt')
        || value.toLowerCase().includes('népszerű')
        || value.toLowerCase().includes('kedvezményes')
        || value.toLowerCase().includes('akciós')
      )) {
        console.log(`  ✓ ${key}: ${value}`);
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

findStatusField();
