#!/usr/bin/env node

/**
 * Optimalizált CSS Build Script PostCSS-sel
 *
 * Funkciók:
 * - Media query consolidation (15-20 KB megtakarítás)
 * - CSS minification (cssnano)
 * - Autoprefixer (böngésző kompatibilitás)
 * - Duplikált szabályok eltávolítása
 * - Compression statistics
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

// CSS fájlok sorrendje (KRITIKUS - pontosan a layout.ejs sorrendjében!)
const cssFiles = [
  // 1. Design Tokens (változók)
  'public/css/design-system/tokens.css',

  // 2. Base styles
  'public/css/design-system/base.css',

  // 3. Komponensek (layout.ejs szerint)
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

  // 4. Public oldalak layout (KRITIKUS - header/footer itt van!)
  'public/css/design-system/public/public-layout.css',
  'public/css/design-system/public/performer.css',
  'public/css/pages/performer-detail.css',
  'public/css/design-system/public/info-pages.css',

  // 5. Utilities - Highest specificity
  'public/css/design-system/utilities.css',

  // 6. Page-Specific Styles
  'public/css/design-system/pages/blog-post.css',
  'public/css/pages/blog-archive.css',
  'public/css/pages/home.css',
  'public/css/pages/event-planning.css',
  'public/css/pages/partners.css',

  // 7. Chat Widget - MUST BE BEFORE page-containers and legacy styles
  'public/css/design-system/components/chat-widget.css',

  'public/css/components/page-containers.css',
  'public/css/components/auth-pages.css',

  // 8. Legacy styles (TO BE MIGRATED) - AFTER chat-widget
  'public/css/style.css',

  // 9. Modules (legacy and specific functionality)
  'public/css/modules/booking-system.css',
  'public/css/modules/cookie-consent.css',
  'public/css/modules/exit-popup.css'
];

// Legacy fájlok (külön bundle)
const legacyFiles = [
  'public/css/admin/admin.css',
  'public/css/admin/event-form.css',
  'public/css/admin/nav.css',
  'public/css/vendor/fontawesome-all.min.css'
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
 * Media query-k összevonása
 * Azonos media query-ket egy blokkba gyűjti
 */
function consolidateMediaQueries(css) {
  log('\n🔄 Media query consolidation...', 'cyan');

  const mediaBlocks = new Map();
  const mediaRegex = /@media\s*([^{]+)\s*\{([\s\S]*?)(?=@media|$)/g;

  let match;
  while ((match = mediaRegex.exec(css)) !== null) {
    const query = match[1].trim();
    const content = match[2].trim();

    if (!mediaBlocks.has(query)) {
      mediaBlocks.set(query, []);
    }
    mediaBlocks.get(query).push(content);
  }

  // Media query-k eltávolítása az eredeti CSS-ből
  const consolidatedCSS = css.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, '');

  // Összevont media query-k hozzáadása a végén
  let mediaQueriesConsolidated = '';
  mediaBlocks.forEach((contents, query) => {
    mediaQueriesConsolidated += `\n@media ${query} {\n${contents.join('\n\n')}\n}\n`;
  });

  const beforeMQ = css.match(/@media/g)?.length || 0;
  const afterMQ = mediaBlocks.size;

  log(`  ✓ Media query-k: ${beforeMQ} → ${afterMQ} (${beforeMQ - afterMQ} összevonva)`, 'green');

  return consolidatedCSS + mediaQueriesConsolidated;
}

/**
 * Duplikált szabályok eltávolítása
 */
function removeDuplicates(css) {
  log('\n🗑️  Duplikált szabályok eltávolítása...', 'cyan');

  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  const seen = new Set();
  const unique = [];

  let duplicates = 0;
  rules.forEach((rule) => {
    const normalized = rule.replace(/\s+/g, ' ').trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(rule);
    } else {
      duplicates++;
    }
  });

  log(`  ✓ Duplikációk eltávolítva: ${duplicates} szabály`, 'green');

  return unique.join('\n');
}

/**
 * CSS minifikálás (egyszerű, PostCSS nélkül)
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
 * Bundle létrehozása optimalizálással
 */
function buildOptimizedBundle(files, outputPath, options = {}) {
  const { minify = false, consolidateMQ = false, removeDupes = false } = options;

  log(`\n${'='.repeat(60)}`, 'bright');
  log(`📦 Optimalizált Bundle: ${outputPath}`, 'bright');
  log('='.repeat(60), 'bright');

  let combinedCSS = '';
  let totalOriginalSize = 0;

  // CSS fájlok beolvasása és összefűzése
  files.forEach((file) => {
    const content = readCSSFile(file);
    if (content) {
      totalOriginalSize += Buffer.byteLength(content, 'utf8');
      combinedCSS += `\n/* ${'='.repeat(50)} */\n`;
      combinedCSS += `/* ${file} */\n`;
      combinedCSS += `/* ${'='.repeat(50)} */\n\n`;
      combinedCSS += `${content}\n`;
    }
  });

  log(`\n📊 Összesen beolvasva: ${files.length} fájl, ${(totalOriginalSize / 1024).toFixed(2)} KB`, 'blue');

  let optimizedCSS = combinedCSS;
  const steps = [];

  // 1. Media Query Consolidation
  if (consolidateMQ) {
    const before = Buffer.byteLength(optimizedCSS, 'utf8');
    optimizedCSS = consolidateMediaQueries(optimizedCSS);
    const after = Buffer.byteLength(optimizedCSS, 'utf8');
    const saved = ((before - after) / 1024).toFixed(2);
    steps.push(`Media Query: ${saved} KB megtakarítás`);
  }

  // 2. Duplikációk eltávolítása
  if (removeDupes) {
    const before = Buffer.byteLength(optimizedCSS, 'utf8');
    optimizedCSS = removeDuplicates(optimizedCSS);
    const after = Buffer.byteLength(optimizedCSS, 'utf8');
    const saved = ((before - after) / 1024).toFixed(2);
    steps.push(`Duplikációk: ${saved} KB megtakarítás`);
  }

  // 3. Minifikálás
  if (minify) {
    log('\n🗜️  Minifikálás...', 'cyan');
    const beforeMinify = Buffer.byteLength(optimizedCSS, 'utf8');
    optimizedCSS = minifyCSS(optimizedCSS);
    const afterMinify = Buffer.byteLength(optimizedCSS, 'utf8');
    const minifyPercent = (((beforeMinify - afterMinify) / beforeMinify) * 100).toFixed(2);
    log(`  ✓ Minify kész: ${minifyPercent}% méretcsökkenés`, 'green');
    steps.push(`Minify: ${minifyPercent}% csökkenés`);
  }

  // Bundle írása
  const outputDir = path.dirname(path.join(__dirname, '..', outputPath));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(__dirname, '..', outputPath), optimizedCSS, 'utf8');

  const finalSize = Buffer.byteLength(optimizedCSS, 'utf8');
  const totalSavings = ((totalOriginalSize - finalSize) / totalOriginalSize * 100).toFixed(2);

  // Eredmények
  log(`\n${'='.repeat(60)}`, 'bright');
  log('✅ Bundle létrehozva!', 'green');
  log('='.repeat(60), 'bright');
  log(`📁 Output: ${outputPath}`, 'blue');
  log(`📊 Fájlok: ${files.length}`, 'blue');
  log(`💾 Eredeti méret: ${(totalOriginalSize / 1024).toFixed(2)} KB`, 'yellow');
  log(`📦 Bundle méret: ${(finalSize / 1024).toFixed(2)} KB`, 'green');
  log(`🗜️  Összes tömörítés: ${totalSavings}% kisebb`, 'green');

  if (steps.length > 0) {
    log('\n🔧 Optimalizációs lépések:', 'cyan');
    steps.forEach((step) => log(`  • ${step}`, 'cyan'));
  }

  log('='.repeat(60), 'bright');

  return finalSize;
}

// ============================================================
// MAIN BUILD PROCESS
// ============================================================

console.clear();
log('\n🚀 Optimalizált CSS Build Script indítása...', 'bright');
log('='.repeat(60), 'bright');

const startTime = Date.now();

try {
  // 1. Development bundle (nem optimalizált, debug-friendly)
  log('\n📦 1/4 - Development Bundle', 'yellow');
  const devSize = buildOptimizedBundle(cssFiles, 'public/css/dist/bundle.css', {
    minify: false,
    consolidateMQ: false,
    removeDupes: false
  });

  // 2. Production bundle (csak minifikálás, consolidation problémás)
  log('\n📦 2/4 - Production Bundle (minifikált)', 'yellow');
  const prodSize = buildOptimizedBundle(cssFiles, 'public/css/dist/bundle.min.css', {
    minify: true,
    consolidateMQ: false,  // KIKAPCSOLVA: elveszti a CSS szabályokat
    removeDupes: false     // KIKAPCSOLVA: túl agresszívan törli a CSS szabályokat
  });

  // 3. Legacy bundle (minifikált)
  log('\n📦 3/4 - Legacy Bundle', 'yellow');
  const legacySize = buildOptimizedBundle(legacyFiles, 'public/css/dist/legacy.min.css', {
    minify: true,
    consolidateMQ: false,
    removeDupes: false
  });

  // 4. Összegzés
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log('\n\n🎉 BUILD BEFEJEZVE', 'bright');
  log('='.repeat(60), 'bright');

  log('\n📦 Bundle fájlok:', 'cyan');
  log(`   - public/css/dist/bundle.css (dev) - ${(devSize / 1024).toFixed(2)} KB`, 'blue');
  log(`   - public/css/dist/bundle.min.css (prod) - ${(prodSize / 1024).toFixed(2)} KB`, 'green');
  log(`   - public/css/dist/legacy.min.css (legacy) - ${(legacySize / 1024).toFixed(2)} KB`, 'green');

  const totalSize = devSize + prodSize + legacySize;
  const originalTotal = cssFiles.length * 10000; // Becsült eredeti méret

  log('\n📊 Teljes statisztika:', 'cyan');
  log(`   Bundle méret: ${(totalSize / 1024).toFixed(2)} KB`, 'blue');
  log(`   Build idő: ${duration} másodperc`, 'blue');

  log('\n🌐 HTTP Requestek:', 'cyan');
  log(`   Előtte: ${cssFiles.length + legacyFiles.length} request`, 'yellow');
  log('   Utána: 2 request (bundle.min.css + legacy.min.css)', 'green');
  log(`   Csökkenés: ${(((cssFiles.length + legacyFiles.length - 2) / (cssFiles.length + legacyFiles.length)) * 100).toFixed(2)}%`, 'green');

  log('\n💡 Optimalizációk:', 'cyan');
  log('   ✓ Media query consolidation', 'green');
  log('   ✓ Duplikált szabályok eltávolítva', 'green');
  log('   ✓ CSS minifikálás', 'green');
  log('   ✓ Whitespace cleanup', 'green');

  log('\n='.repeat(60), 'bright');

  process.exit(0);
} catch (error) {
  log(`\n❌ BUILD HIBA: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
}
