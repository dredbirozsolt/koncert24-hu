/**
 * List all VTiger Products custom fields
 */
require('dotenv').config();
const axios = require('axios');

async function listVTigerFields() {
  const baseUrl = process.env.VTIGER_URL;
  const username = process.env.VTIGER_USERNAME;
  const accessKey = process.env.VTIGER_ACCESS_KEY;

  // Get challenge token
  const challengeResponse = await axios.get(`${baseUrl}/webservice.php`, {
    params: {
      operation: 'getchallenge',
      username
    }
  });

  const { token } = challengeResponse.data.result;

  // Generate access key with crypto
  const crypto = require('crypto');
  const generatedKey = crypto.createHash('md5').update(`${token}${accessKey}`).digest('hex');

  // Login
  const loginResponse = await axios.post(`${baseUrl}/webservice.php`, null, {
    params: {
      operation: 'login',
      username,
      accessKey: generatedKey
    }
  });

  if (!loginResponse.data.success) {
    console.error('Login failed:', loginResponse.data);
    process.exit(1);
  }

  const sessionId = loginResponse.data.result.sessionName;

  // Describe Products module
  const describeResponse = await axios.get(`${baseUrl}/webservice.php`, {
    params: {
      operation: 'describe',
      sessionName: sessionId,
      elementType: 'Products'
    }
  });

  const { result } = describeResponse.data;

  // Get all custom fields (cf_)
  const customFields = result.fields.filter((f) => f.name.startsWith('cf_'));

  console.log('📋 Összes Custom Field (cf_) a Products modulban:\n');
  console.log('Mező név'.padEnd(15), '| Label'.padEnd(50), '| Típus');
  console.log('─'.repeat(80));

  customFields.forEach((field) => {
    console.log(
      field.name.padEnd(15),
      '|',
      (field.label || '').padEnd(48),
      '|',
      field.type.name
    );
  });

  console.log('\n\n🔍 Keresés: Technikai feltétel / Útiköltség / Travel / Technical:\n');

  const searchTerms = ['technikai', 'feltetel', 'úti', 'uti', 'költség', 'koltseg', 'travel', 'technical', 'rider', 'requirement', 'számítás', 'szamitas'];
  const matches = customFields.filter((f) => {
    const searchText = (`${f.label} ${f.name}`).toLowerCase();
    return searchTerms.some((term) => searchText.includes(term.toLowerCase()));
  });

  console.log('Találatok:');
  matches.forEach((field) => {
    console.log('✓', field.name, '→', field.label, '(', field.type.name, ')');
  });

  // List all cf_ fields sorted by number
  console.log('\n\n📝 Összes cf_ mező szám szerint rendezve:\n');
  const sorted = customFields.sort((a, b) => {
    const numA = parseInt(a.name.replace('cf_', ''));
    const numB = parseInt(b.name.replace('cf_', ''));
    return numA - numB;
  });

  sorted.forEach((field) => {
    console.log(`${field.name.padEnd(10)} → ${field.label}`);
  });
}

listVTigerFields().catch(console.error);
