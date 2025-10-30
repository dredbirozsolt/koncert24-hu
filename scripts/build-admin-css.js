#!/usr/bin/env node

/**
 * Admin CSS Build Script
 * Konszolidálja az admin oldalak CSS fájljait
 */

const fs = require('fs');
const path = require('path');

// Színes console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

// Admin CSS fájlok sorrendje (KRITIKUS!)
const adminCSSFiles = [
  // 1. Design Tokens & Variables
  'public/css/design-system/tokens.css',
  // Note: variables.css removed - integrated into tokens.css

  // 2. Design System Components (SHARED between public & admin)
  'public/css/design-system/components/typography.css',
  'public/css/design-system/components/button.css',
  'public/css/design-system/components/card.css',
  'public/css/design-system/components/badge.css',
  'public/css/design-system/components/alert.css',
  'public/css/design-system/components/table.css',
  'public/css/design-system/components/modal.css',

  // 3. Admin Complete CSS (admin-specific styles)
  'public/css/admin-complete.css',

  // 4. Exit Popup (for preview in admin)
  'public/css/modules/exit-popup.css',

  // 5. Utilities (LAST - highest specificity)
  'public/css/design-system/utilities.css',

  // 6. Form CSS (LAST to override legacy styles)
  'public/css/design-system/components/form.css'
];

/**
 * CSS fájl beolvasása
 */
function readCSSFile(filePath) {
  try {
    const fullPath = path.join(__dirname, '..', filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const sizeKB = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
    log(`  ✓ Beolvasva: ${filePath} (${sizeKB} KB)`, 'green');
    return content;
  } catch (error) {
    log(`  ✗ Hiba: ${filePath} - ${error.message}`, 'red');
    return '';
  }
}

/**
 * CSS minifikálás
 */
function minifyCSS(css) {
  return css
    // Kommentek eltávolítása
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Többszörös whitespace normalizálása
    .replace(/\s+/g, ' ')
    // Whitespace eltávolítása speciális karakterek körül
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Leading/trailing whitespace
    .trim();
}

/**
 * Admin bundle létrehozása
 */
function buildAdminBundle(files, outputPath, minify = false) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`📦 Admin Bundle: ${outputPath}`, 'bright');
  log('='.repeat(60), 'bright');

  let combinedCSS = '';
  let totalOriginalSize = 0;
  let filesRead = 0;

  // Header komment
  combinedCSS += '/**\n';
  combinedCSS += ' * koncert24.hu - Admin CSS Bundle\n';
  combinedCSS += ` * Generated: ${new Date().toISOString()}\n`;
  combinedCSS += ` * Files: ${files.length}\n`;
  combinedCSS += ` * Minified: ${minify}\n`;
  combinedCSS += ' */\n\n';

  // CSS fájlok beolvasása
  files.forEach((file) => {
    const content = readCSSFile(file);
    if (content) {
      totalOriginalSize += Buffer.byteLength(content, 'utf8');
      filesRead++;

      combinedCSS += `\n/* ${'='.repeat(50)} */\n`;
      combinedCSS += `/* ${file} */\n`;
      combinedCSS += `/* ${'='.repeat(50)} */\n\n`;
      combinedCSS += `${content}\n`;
    }
  });

  log(`\n📊 Összesen beolvasva: ${filesRead}/${files.length} fájl, ${(totalOriginalSize / 1024).toFixed(2)} KB`, 'blue');

  // Minifikálás
  let finalCSS = combinedCSS;
  if (minify) {
    log('\n🗜️  Minifikálás...', 'cyan');
    const beforeMinify = Buffer.byteLength(combinedCSS, 'utf8');
    finalCSS = minifyCSS(combinedCSS);
    const afterMinify = Buffer.byteLength(finalCSS, 'utf8');
    const minifyPercent = (((beforeMinify - afterMinify) / beforeMinify) * 100).toFixed(2);
    log(`  ✓ Minify kész: ${minifyPercent}% méretcsökkenés`, 'green');
  }

  // Bundle írása
  const outputDir = path.dirname(path.join(__dirname, '..', outputPath));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(__dirname, '..', outputPath), finalCSS, 'utf8');

  const finalSize = Buffer.byteLength(finalCSS, 'utf8');
  const savings = ((totalOriginalSize - finalSize) / totalOriginalSize * 100).toFixed(2);

  // Eredmények
  log(`\n${'='.repeat(60)}`, 'bright');
  log('✅ Admin Bundle létrehozva!', 'green');
  log('='.repeat(60), 'bright');
  log(`📁 Output: ${outputPath}`, 'blue');
  log(`📊 Fájlok: ${filesRead}/${files.length}`, 'blue');
  log(`💾 Eredeti méret: ${(totalOriginalSize / 1024).toFixed(2)} KB`, 'yellow');
  log(`📦 Bundle méret: ${(finalSize / 1024).toFixed(2)} KB`, 'green');
  log(`🗜️  Tömörítés: ${savings}% kisebb`, 'green');
  log('='.repeat(60), 'bright');

  return finalSize;
}

// ============================================================
// MAIN BUILD PROCESS
// ============================================================

console.clear();
log('\n🚀 Admin CSS Build Script indítása...', 'bright');
log('='.repeat(60), 'bright');

const startTime = Date.now();

try {
  // 1. Development bundle (nem minifikált)
  log('\n📦 1/2 - Admin Development Bundle', 'yellow');
  const devSize = buildAdminBundle(adminCSSFiles, 'public/css/dist/admin-bundle.css', false);

  // 2. Production bundle (minifikált)
  log('\n📦 2/2 - Admin Production Bundle', 'yellow');
  const prodSize = buildAdminBundle(adminCSSFiles, 'public/css/dist/admin-bundle.min.css', true);

  // Összegzés
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log('\n\n🎉 ADMIN BUILD BEFEJEZVE', 'bright');
  log('='.repeat(60), 'bright');

  log('\n📦 Admin Bundle fájlok:', 'cyan');
  log(`   - public/css/dist/admin-bundle.css (dev) - ${(devSize / 1024).toFixed(2)} KB`, 'blue');
  log(`   - public/css/dist/admin-bundle.min.css (prod) - ${(prodSize / 1024).toFixed(2)} KB`, 'green');

  log('\n📊 Statisztika:', 'cyan');
  log(`   Build idő: ${duration} másodperc`, 'blue');
  log(`   CSS fájlok: ${adminCSSFiles.length} → 1 bundle`, 'blue');

  const originalRequests = adminCSSFiles.length;
  const reduction = (((originalRequests - 1) / originalRequests) * 100).toFixed(2);

  log('\n🌐 HTTP Requestek:', 'cyan');
  log(`   Előtte: ${originalRequests} request`, 'yellow');
  log('   Utána: 1 request (admin-bundle.min.css)', 'green');
  log(`   Csökkenés: ${reduction}%`, 'green');

  log('\n='.repeat(60), 'bright');

  process.exit(0);
} catch (error) {
  log(`\n❌ BUILD HIBA: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
}
