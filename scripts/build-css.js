#!/usr/bin/env node

/**
 * CSS Build Script - Production Bundle Creator
 *
 * Összefogja a design system CSS fájlokat egyetlen optimalizált fájlba
 * Csökkenti a HTTP requestek számát production környezetben
 *
 * Usage:
 *   node scripts/build-css.js
 *   npm run build:css
 */

const fs = require('fs');
const path = require('path');

// Színes console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// CSS fájlok betöltési sorrendben (CRITICAL!)
const cssFiles = [
  // 1. Design Tokens FIRST
  'public/css/design-system/tokens.css',

  // 2. Base & Reset
  'public/css/design-system/base.css',

  // 3. Components
  'public/css/design-system/components/typography.css',
  'public/css/design-system/components/icons.css',
  'public/css/design-system/components/button.css',
  'public/css/design-system/components/card.css',
  'public/css/design-system/components/badge.css',
  'public/css/design-system/components/alert.css',
  'public/css/design-system/components/form.css',
  'public/css/design-system/components/table.css',
  'public/css/design-system/components/modal.css',
  'public/css/design-system/components/code.css',
  'public/css/design-system/components/details.css',
  'public/css/design-system/components/skip-link.css',
  'public/css/design-system/components/loading.css',
  'public/css/design-system/components/breadcrumb.css',
  'public/css/design-system/components/pagination.css',
  'public/css/design-system/components/skeleton.css',
  'public/css/design-system/components/toast.css',
  'public/css/design-system/components/dropdown.css',
  'public/css/design-system/components/tooltip.css',
  'public/css/design-system/components/tabs.css',
  'public/css/design-system/components/accordion.css',
  'public/css/design-system/components/progress-bar.css',
  'public/css/design-system/components/newsletter.css',
  'public/css/design-system/components/author-bio.css',
  'public/css/design-system/components/hero.css',
  'public/css/design-system/components/hero-search.css',
  'public/css/design-system/components/event-card.css',
  'public/css/design-system/components/performer-card.css',
  'public/css/design-system/components/range-slider.css',
  'public/css/design-system/components/chat-widget.css',

  // 4. Layout
  'public/css/design-system/public/public-layout.css',
  'public/css/design-system/public/performer.css',
  'public/css/pages/performer-detail.css',
  'public/css/design-system/public/info-pages.css',

  // 5. Page-Specific
  'public/css/design-system/pages/blog-post.css',
  'public/css/pages/blog-archive.css',
  'public/css/pages/home.css',

  // 6. Component-Specific
  'public/css/components/page-containers.css',
  'public/css/components/auth-pages.css',

  // 7. Utilities (LAST - highest specificity)
  'public/css/design-system/utilities.css',
  'public/css/utilities.css'
];

// Legacy fájlok (külön bundle, később migrálásra)
const legacyFiles = [
  'public/css/style.css',
  'public/css/modules/booking-system.css',
  'public/css/modules/cookie-consent.css',
  'public/css/modules/exit-popup.css'
];

function readCSSFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    log(`⚠️  Fájl nem található: ${filePath}`, 'yellow');
    return null;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    log(`✓ Beolvasva: ${filePath} (${(content.length / 1024).toFixed(2)} KB)`, 'green');
    return {
      path: filePath,
      content,
      size: content.length
    };
  } catch (error) {
    log(`✗ Hiba a beolvasáskor: ${filePath}`, 'red');
    log(`  ${error.message}`, 'red');
    return null;
  }
}

function minifyCSS(css) {
  // Egyszerű minify: whitespace eltávolítás, kommentek eltávolítás
  return css
    // Többsoros kommentek eltávolítása
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // Whitespace normalizálás
    .replace(/\s+/g, ' ')
    // Whitespace eltávolítás speciális karakterek körül
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    // Leading/trailing whitespace
    .trim();
}

function buildBundle(files, outputPath, minify = false) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`📦 Bundle létrehozása: ${outputPath}`, 'cyan');
  log('='.repeat(60), 'cyan');

  let bundleContent = '';
  let totalSize = 0;
  let successCount = 0;

  // Header hozzáadása
  bundleContent += '/**\n';
  bundleContent += ' * koncert24.hu - Production CSS Bundle\n';
  bundleContent += ` * Generated: ${new Date().toISOString()}\n`;
  bundleContent += ` * Files: ${files.length}\n`;
  bundleContent += ' */\n\n';

  // Fájlok összefűzése
  files.forEach((filePath, index) => {
    const fileData = readCSSFile(filePath);

    if (fileData) {
      // Szeparátor hozzáadása
      bundleContent += '\n/* ========================================\n';
      bundleContent += `   ${index + 1}. ${fileData.path}\n`;
      bundleContent += `   Size: ${(fileData.size / 1024).toFixed(2)} KB\n`;
      bundleContent += '   ======================================== */\n\n';

      bundleContent += `${fileData.content}\n`;
      totalSize += fileData.size;
      successCount++;
    }
  });

  // Minify ha kell
  let finalContent = bundleContent;
  let finalSize = bundleContent.length;

  if (minify) {
    log('\n🗜️  Minify...', 'blue');
    finalContent = minifyCSS(bundleContent);
    finalSize = finalContent.length;
    const savings = ((1 - finalSize / bundleContent.length) * 100).toFixed(2);
    log(`✓ Minify kész: ${savings}% méretcsökkenés`, 'green');
  }

  // Fájl írása
  const outputFullPath = path.join(process.cwd(), outputPath);
  const outputDir = path.dirname(outputFullPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFullPath, finalContent, 'utf8');

  // Összegzés
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('✅ Bundle létrehozva!', 'green');
  log('='.repeat(60), 'cyan');
  log(`📁 Output: ${outputPath}`, 'blue');
  log(`📊 Fájlok: ${successCount}/${files.length}`, 'blue');
  log(`💾 Eredeti méret: ${(totalSize / 1024).toFixed(2)} KB`, 'blue');
  log(`📦 Bundle méret: ${(finalSize / 1024).toFixed(2)} KB`, 'green');

  if (minify) {
    const savings = ((1 - finalSize / totalSize) * 100).toFixed(2);
    log(`🗜️  Tömörítés: ${savings}% kisebb`, 'green');
  }

  log(`${'='.repeat(60)}\n`, 'cyan');

  return {
    success: successCount === files.length,
    filesProcessed: successCount,
    totalFiles: files.length,
    originalSize: totalSize,
    bundleSize: finalSize
  };
}

// Main execution
function main() {
  log('\n🚀 CSS Build Script indítása...', 'cyan');
  log(`${'='.repeat(60)}\n`, 'cyan');

  // 1. Design System Bundle (nem minify - development)
  const devResult = buildBundle(
    cssFiles,
    'public/css/dist/bundle.css',
    false
  );

  // 2. Design System Bundle (minify - production)
  const prodResult = buildBundle(
    cssFiles,
    'public/css/dist/bundle.min.css',
    true
  );

  // 3. Legacy Bundle (külön)
  const legacyResult = buildBundle(
    legacyFiles,
    'public/css/dist/legacy.min.css',
    true
  );

  // Végső összegzés
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('🎉 BUILD BEFEJEZVE', 'green');
  log('='.repeat(60), 'cyan');

  const totalOriginal = devResult.originalSize + legacyResult.originalSize;
  const totalBundle = prodResult.bundleSize + legacyResult.bundleSize;
  const totalSavings = ((1 - totalBundle / totalOriginal) * 100).toFixed(2);

  log('\n📦 Bundle fájlok:', 'blue');
  log('   - public/css/dist/bundle.css (dev)', 'blue');
  log('   - public/css/dist/bundle.min.css (prod)', 'blue');
  log('   - public/css/dist/legacy.min.css (legacy)', 'blue');

  log('\n📊 Teljes statisztika:', 'blue');
  log(`   Eredeti méret: ${(totalOriginal / 1024).toFixed(2)} KB`, 'blue');
  log(`   Bundle méret: ${(totalBundle / 1024).toFixed(2)} KB`, 'green');
  log(`   Megtakarítás: ${totalSavings}%`, 'green');

  log('\n🌐 HTTP Requestek:', 'blue');
  log(`   Előtte: ${cssFiles.length + legacyFiles.length} request`, 'yellow');
  log('   Utána: 2 request (bundle.min.css + legacy.min.css)', 'green');
  log(`   Csökkenés: ${((1 - 2 / (cssFiles.length + legacyFiles.length)) * 100).toFixed(2)}%`, 'green');

  log(`\n${'='.repeat(60)}\n`, 'cyan');

  process.exit(devResult.success && prodResult.success && legacyResult.success ? 0 : 1);
}

// Script futtatása
if (require.main === module) {
  main();
}

module.exports = { buildBundle, minifyCSS };
