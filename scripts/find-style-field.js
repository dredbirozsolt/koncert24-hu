/**
 * Script to find the style field name in vTiger for product PRO224
 */

require('dotenv').config();

const { VTigerService } = require('../services/vtigerService');
const logger = require('../config/logger');

async function findStyleField() {
  const vtigerService = new VTigerService();

  try {
    console.log('🔍 Connecting to vTiger...');
    await vtigerService.authenticate();

    console.log('🔍 Searching for product with code PRO224...');

    // Query to find product by product_no
    const query = "SELECT * FROM Products WHERE product_no='PRO224' LIMIT 1;";
    const result = await vtigerService.query(query);

    if (!result || result.length === 0) {
      console.log('❌ Product PRO224 not found');
      return;
    }

    const product = result[0];
    console.log('\n✅ Product PRO224 found!');
    console.log('Product ID:', product.id);
    console.log('Product Name:', product.productname);

    // Find all cf_ fields
    console.log('\n📋 All custom fields (cf_):');
    const cfFields = Object.keys(product).filter((key) => key.startsWith('cf_'));

    cfFields.forEach((field) => {
      const value = product[field];
      if (value && value.trim() !== '') {
        console.log(`  ${field}: ${value}`);
      }
    });

    // Look for fields that might contain "style" or similar
    console.log('\n🎨 Fields that might be "style":');
    cfFields.forEach((field) => {
      const value = product[field];
      if (value && typeof value === 'string' && value.trim() !== '') {
        // Check if the value looks like a style (e.g., contains common style-related words)
        const styleKeywords = ['pop', 'rock', 'jazz', 'klassz', 'zenés', 'stand-up', 'musical', 'operett', 'táncz'];
        const lowerValue = value.toLowerCase();

        if (styleKeywords.some((keyword) => lowerValue.includes(keyword))) {
          console.log(`  ⭐ ${field}: "${value}" (might be style field)`);
        }
      }
    });

    console.log('\n💡 Full product data for reference:');
    console.log(JSON.stringify(product, null, 2));
  } catch (error) {
    logger.error('Error finding style field:', error);
    console.error('❌ Error:', error.message);
  }
}

findStyleField().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
