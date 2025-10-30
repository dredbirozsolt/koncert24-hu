/**
 * Simple script to list VTiger Products fields without DB dependency
 */
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const baseUrl = process.env.VTIGER_URL;
const username = process.env.VTIGER_USERNAME;
const accessKey = process.env.VTIGER_ACCESS_KEY;

async function main() {
  try {
    // 1. Get challenge token
    const challengeRes = await axios.get(`${baseUrl}/webservice.php`, {
      params: { operation: 'getchallenge', username }
    });

    const { token } = challengeRes.data.result;

    // 2. Generate key
    const generatedKey = crypto.createHash('md5').update(token + accessKey).digest('hex');

    // 3. Login
    const loginRes = await axios.post(`${baseUrl}/webservice.php`, null, {
      params: { operation: 'login', username, accessKey: generatedKey }
    });

    if (!loginRes.data.success) {
      console.error('Login sikertelen:', loginRes.data);
      return;
    }

    const { sessionName } = loginRes.data.result;

    // 4. Describe Products
    const describeRes = await axios.get(`${baseUrl}/webservice.php`, {
      params: { operation: 'describe', sessionName, elementType: 'Products' }
    });

    const customFields = describeRes.data.result.fields
      .filter((f) => f.name.startsWith('cf_'))
      .sort((a, b) => {
        const numA = parseInt(a.name.replace('cf_', ''));
        const numB = parseInt(b.name.replace('cf_', ''));
        return numA - numB;
      });

    console.log('📋 Products Custom Fields (cf_):\n');
    console.log('Mező'.padEnd(12), 'Label'.padEnd(50), 'Típus');
    console.log('─'.repeat(80));

    customFields.forEach((f) => {
      console.log(f.name.padEnd(12), f.label.padEnd(50), f.type.name);
    });

    console.log('\n\n🔍 Keresés: technikai / úti / travel / rider:\n');

    const keywords = ['technikai', 'feltetel', 'rider', 'úti', 'uti', 'költség', 'travel', 'számítás'];
    const matches = customFields.filter((f) => {
      const text = `${f.label} ${f.name}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });

    if (matches.length > 0) {
      matches.forEach((f) => {
        console.log(`✓ ${f.name} → ${f.label} (${f.type.name})`);
      });
    } else {
      console.log('Nincs találat a keresési kulcsszavakra.');
    }
  } catch (err) {
    console.error('Hiba:', err.message);
    if (err.response) {
      console.error('Response:', err.response.data);
    }
  }
}

main();
