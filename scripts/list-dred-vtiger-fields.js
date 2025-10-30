/**
 * List all VTiger fields for Dred És Doris
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const axios = require('axios');
const crypto = require('crypto');

async function listDredFields() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'dmf_koncert24',
      password: 'Xaxwyg-8qusbu-cabpyr',
      database: 'dmf_koncert24'
    });

    // Find Dred És Doris
    const [rows] = await connection.execute(
      'SELECT vtigerId, name FROM performers WHERE name LIKE ?',
      ['%Dred%Doris%']
    );

    if (rows.length === 0) {
      console.log('❌ Dred És Doris nem található');
      return;
    }

    const { vtigerId } = rows[0];
    console.log('✓ Dred És Doris megtalálva');
    console.log('  VTiger ID:', vtigerId);
    console.log('\n🔄 VTiger adatok lekérdezése...\n');

    // VTiger authentication
    const baseUrl = process.env.VTIGER_URL;
    const username = process.env.VTIGER_USERNAME;
    const accessKey = process.env.VTIGER_ACCESS_KEY;

    // Get challenge
    const challengeRes = await axios.get(`${baseUrl}/webservice.php`, {
      params: { operation: 'getchallenge', username }
    });

    if (!challengeRes.data.success) {
      console.error('Challenge failed:', challengeRes.data);
      return;
    }

    const { token } = challengeRes.data.result;
    console.log('  Token:', `${token.substring(0, 20)}...`);

    // Login
    const generatedKey = crypto.createHash('md5').update(token + accessKey).digest('hex');
    console.log('  Generated key:', `${generatedKey.substring(0, 20)}...`);

    const loginParams = new URLSearchParams({
      operation: 'login',
      username,
      accessKey: generatedKey
    });

    const loginRes = await axios.post(`${baseUrl}/webservice.php`, loginParams, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!loginRes.data.success) {
      console.error('Login failed:', loginRes.data);
      return;
    }

    const { sessionName } = loginRes.data.result;

    // Retrieve product
    const productRes = await axios.get(`${baseUrl}/webservice.php`, {
      params: { operation: 'retrieve', sessionName, id: vtigerId }
    });
    const product = productRes.data.result;

    // List all cf_ fields
    const cfFields = {};
    Object.keys(product).forEach((key) => {
      if (key.startsWith('cf_')) {
        cfFields[key] = product[key];
      }
    });

    const sorted = Object.entries(cfFields).sort((a, b) => {
      const numA = parseInt(a[0].replace('cf_', ''));
      const numB = parseInt(b[0].replace('cf_', ''));
      return numA - numB;
    });

    console.log('📋 Összes cf_ mező (Dred És Doris):\n');
    console.log('Mező'.padEnd(12), 'Érték');
    console.log('─'.repeat(100));

    sorted.forEach(([key, value]) => {
      const displayValue = value ? String(value).substring(0, 80) : '(üres)';
      console.log(key.padEnd(12), displayValue);
    });

    console.log('\n\n🔍 Keresés: technikai / úti / travel / rider:\n');

    sorted.forEach(([key, value]) => {
      if (value && String(value).length > 0) {
        const text = String(value).toLowerCase();
        const keywords = ['technikai', 'feltetel', 'rider', 'úti', 'uti', 'költség', 'travel'];

        if (keywords.some((kw) => text.includes(kw))) {
          console.log(`✓ ${key} → ${value}`);
        }
      }
    });
  } catch (error) {
    console.error('❌ Hiba:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

listDredFields();
