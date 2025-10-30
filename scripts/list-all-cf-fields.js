/**
 * List all cf_ fields from a VTiger Product
 */

require('dotenv').config();
const { VTigerService } = require('../services/vtigerService');

async function listAllFields() {
  console.log('🔍 Lekérem egy előadó összes mezőjét...\n');

  const vtigerService = new VTigerService();

  try {
    await vtigerService.loadConfig();
    await vtigerService.authenticate();

    // Get 100 Folk Celsius details (known working ID)
    const productId = '14x132778';
    const product = await vtigerService.makeRequest('retrieve', { id: productId });

    // Find all cf_ fields
    const cfFields = {};
    Object.keys(product).forEach((key) => {
      if (key.startsWith('cf_')) {
        cfFields[key] = product[key];
      }
    });

    // Sort by cf_ number
    const sorted = Object.entries(cfFields).sort((a, b) => {
      const numA = parseInt(a[0].replace('cf_', ''));
      const numB = parseInt(b[0].replace('cf_', ''));
      return numA - numB;
    });

    console.log('📋 Összes cf_ mező (100 Folk Celsius példán):\n');
    console.log('Mező'.padEnd(12), 'Érték');
    console.log('─'.repeat(80));

    sorted.forEach(([key, value]) => {
      const displayValue = value ? String(value).substring(0, 60) : '(üres)';
      console.log(key.padEnd(12), displayValue);
    });

    // Keresés
    console.log('\n\n🔍 Keresés: technikai / úti / travel / rider / költség:\n');

    const keywords = ['technikai', 'feltetel', 'rider', 'úti', 'uti', 'költség', 'koltseg', 'travel', 'számítás', 'szamitas'];

    sorted.forEach(([key, value]) => {
      if (value) {
        const text = String(value).toLowerCase();
        const keyLower = key.toLowerCase();

        if (keywords.some((kw) => text.includes(kw) || keyLower.includes(kw))) {
          console.log(`✓ ${key} → ${value}`);
        }
      }
    });
  } catch (error) {
    console.error('❌ Hiba:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

listAllFields();
