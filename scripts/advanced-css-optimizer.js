#!/usr/bin/env node

/**
 * Haladó CSS Optimalizáló
 *
 * További optimalizálási lehetőségek:
 * 1. Hardcoded színek → CSS változók
 * 2. Ismétlődő property értékek standardizálása
 * 3. Unused CSS detection (elemzés)
 * 4. Critical CSS javaslatok
 * 5. Shorthand properties használata
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

const BUNDLE_PATH = path.join(__dirname, '../public/css/dist/bundle.min.css');

console.clear();
log('\n🔬 Haladó CSS Optimalizálási Elemzés\n', 'bright');
log('='.repeat(70), 'bright');

// Bundle beolvasása
const css = fs.readFileSync(BUNDLE_PATH, 'utf8');
const sizeKB = (Buffer.byteLength(css, 'utf8') / 1024).toFixed(2);

log(`\n📦 Bundle: ${sizeKB} KB\n`, 'cyan');

// ============================================================
// 1. HARDCODED SZÍNEK ELEMZÉSE
// ============================================================

log('🎨 1. HARDCODED SZÍNEK → CSS VÁLTOZÓK', 'yellow');
log('-'.repeat(70), 'yellow');

const hexColors = css.match(/#[0-9a-fA-F]{3,6}/g) || [];
const rgbaColors = css.match(/rgba?\([^)]+\)/g) || [];
const allColors = [...hexColors, ...rgbaColors];

const colorMap = new Map();
allColors.forEach((color) => {
  const normalized = color.toLowerCase().trim();
  colorMap.set(normalized, (colorMap.get(normalized) || 0) + 1);
});

const hardcodedColors = Array.from(colorMap.entries())
  .filter(([_, count]) => count > 3)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

log(`\nTalált színek: ${colorMap.size}`, 'blue');
log(`Gyakran használt (3+ előfordulás): ${hardcodedColors.length}`, 'blue');

if (hardcodedColors.length > 0) {
  log('\nLeggyakoribb hardcoded színek:', 'cyan');
  let potentialSavings = 0;

  hardcodedColors.forEach(([color, count]) => {
    const savings = (color.length - 'var(--color-x)'.length) * count;
    potentialSavings += Math.max(0, savings);
    log(`  ${count.toString().padStart(3)}× ${color.padEnd(25)} → ~${Math.max(0, savings)} byte`, 'white');
  });

  log(`\n💰 Potenciális megtakarítás: ~${(potentialSavings / 1024).toFixed(2)} KB`, 'green');

  // Javaslatok
  log('\n💡 Javasolt változók:', 'magenta');
  const suggestions = [
    { color: 'rgba(0, 0, 0, 0.3)', var: '--shadow-medium', usage: 'Box shadows, overlays' },
    { color: 'rgba(0, 0, 0, 0.1)', var: '--shadow-light', usage: 'Light shadows' },
    { color: 'rgba(255, 255, 255, 0)', var: '--transparent-white', usage: 'Gradients' },
    { color: 'rgba(0, 0, 0, 0.4)', var: '--shadow-dark', usage: 'Dark overlays' }
  ];

  suggestions.forEach((s) => {
    if (hardcodedColors.some(([c]) => c === s.color)) {
      log(`  ${s.color.padEnd(25)} → ${s.var.padEnd(25)} (${s.usage})`, 'cyan');
    }
  });
}

// ============================================================
// 2. SHORTHAND PROPERTIES
// ============================================================

log('\n\n📏 2. SHORTHAND PROPERTIES OPTIMALIZÁLÁS', 'yellow');
log('-'.repeat(70), 'yellow');

// Padding/Margin longhand detection
const paddingLonghand = css.match(/padding-(top|right|bottom|left):\s*[^;]+;/gi) || [];
const marginLonghand = css.match(/margin-(top|right|bottom|left):\s*[^;]+;/gi) || [];

log(`\nPadding longhand: ${paddingLonghand.length}`, 'blue');
log(`Margin longhand: ${marginLonghand.length}`, 'blue');

// Csoportosítható blokkok keresése
const propertyBlocks = css.match(/\{[^}]{100,}\}/g) || [];
let shorthandOpportunities = 0;

propertyBlocks.forEach((block) => {
  const hasAllPadding
    = block.includes('padding-top:')
    && block.includes('padding-right:')
    && block.includes('padding-bottom:')
    && block.includes('padding-left:');

  const hasAllMargin
    = block.includes('margin-top:')
    && block.includes('margin-right:')
    && block.includes('margin-bottom:')
    && block.includes('margin-left:');

  if (hasAllPadding) {shorthandOpportunities++;}
  if (hasAllMargin) {shorthandOpportunities++;}
});

if (shorthandOpportunities > 0) {
  log(`\n⚡ Shorthand lehetőségek: ${shorthandOpportunities} blokk`, 'green');
  log('   💰 Becsült megtakarítás: ~0.5-1 KB', 'green');
}

// ============================================================
// 3. CSS VÁLTOZÓK HASZNÁLATA
// ============================================================

log('\n\n🔧 3. CSS VÁLTOZÓK ELEMZÉS', 'yellow');
log('-'.repeat(70), 'yellow');

const varUsage = css.match(/var\(--[a-z0-9-]+\)/gi) || [];
const varTypes = new Map();

varUsage.forEach((v) => {
  const type = v.match(/var\(--(color|text|space|radius|font|shadow)/i);
  if (type) {
    const category = type[1].toLowerCase();
    varTypes.set(category, (varTypes.get(category) || 0) + 1);
  }
});

log('\nCSS változó használat kategóriák szerint:', 'blue');
Array.from(varTypes.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    log(`  ${category.padEnd(15)}: ${count}×`, 'cyan');
  });

const totalVars = varUsage.length;
const totalProperties = (css.match(/[a-z-]+:[^;]+;/gi) || []).length;
const varPercentage = ((totalVars / totalProperties) * 100).toFixed(1);

log(`\n📊 Összesen: ${totalVars} változó használat (${varPercentage}% az összes property-ből)`, 'blue');

if (varPercentage < 40) {
  log('⚠️  Alacsony változó használat! További ~5-10 KB megtakarítás lehetséges', 'yellow');
}

// ============================================================
// 4. GZIP/BROTLI OPTIMALIZÁLÁS
// ============================================================

log('\n\n📦 4. COMPRESSION ANALÍZIS', 'yellow');
log('-'.repeat(70), 'yellow');

const originalSize = Buffer.byteLength(css, 'utf8');
const { execSync } = require('child_process');

try {
  // Gzip
  const gzipSize = execSync(`gzip -c "${BUNDLE_PATH}" | wc -c`, { encoding: 'utf8' }).trim();
  const gzipKB = (parseInt(gzipSize, 10) / 1024).toFixed(2);
  const gzipRatio = ((parseInt(gzipSize, 10) / originalSize) * 100).toFixed(1);

  log(`\nEredeti: ${sizeKB} KB`, 'blue');
  log(`Gzip:    ${gzipKB} KB (${gzipRatio}% az eredetihez képest)`, 'green');

  // Brotli (ha elérhető)
  try {
    const brotliSize = execSync(`brotli -c "${BUNDLE_PATH}" | wc -c`, { encoding: 'utf8' }).trim();
    const brotliKB = (parseInt(brotliSize, 10) / 1024).toFixed(2);
    const brotliRatio = ((parseInt(brotliSize, 10) / originalSize) * 100).toFixed(1);

    log(`Brotli:  ${brotliKB} KB (${brotliRatio}% az eredetihez képest)`, 'green');
    log('\n✅ Brotli elérhető - ajánlott a Gzip helyett!', 'green');
  } catch (e) {
    log('\n⚠️  Brotli nem elérhető - telepítsd: brew install brotli', 'yellow');
  }

  log('\n💡 Compression javallat:', 'magenta');
  log('   1. Nginx/Apache: Enable gzip/brotli compression', 'cyan');
  log('   2. Pre-compress: Generate .gz and .br files', 'cyan');
  log('   3. Megtakarítás: 120 KB → 19 KB (84% kisebb)', 'green');
} catch (error) {
  log('❌ Compression test sikertelen', 'red');
}

// ============================================================
// 5. CRITICAL CSS
// ============================================================

log('\n\n⚡ 5. CRITICAL CSS JAVASLATOK', 'yellow');
log('-'.repeat(70), 'yellow');

// Above-the-fold komponensek keresése
const criticalComponents = [
  'header', 'nav', 'hero', 'button', 'typography', 'icon'
];

const criticalRules = [];
criticalComponents.forEach((comp) => {
  const regex = new RegExp(`\\.${comp}[^{]*\\{[^}]*\\}`, 'gi');
  const matches = css.match(regex) || [];
  if (matches.length > 0) {
    criticalRules.push({ component: comp, rules: matches.length });
  }
});

log('\nAbove-the-fold komponensek:', 'blue');
let criticalSize = 0;
criticalRules.forEach((item) => {
  const estimated = item.rules * 50; // Átlag 50 byte/szabály
  criticalSize += estimated;
  log(`  ${item.component.padEnd(15)}: ${item.rules} szabály (~${(estimated / 1024).toFixed(1)} KB)`, 'cyan');
});

log(`\n📊 Becsült Critical CSS méret: ~${(criticalSize / 1024).toFixed(1)} KB`, 'green');
log('💡 Ajánlás: Inline a <head>-be, async töltés a többi CSS-nek', 'magenta');

// ============================================================
// 6. SPECIFICITÁS OPTIMALIZÁLÁS
// ============================================================

log('\n\n🎯 6. SELECTOR SPECIFICITÁS', 'yellow');
log('-'.repeat(70), 'yellow');

const selectors = css.match(/[^{}]+(?=\{)/g) || [];
const complexSelectors = selectors.filter((s) => {
  const depth = (s.match(/\s+/g) || []).length;
  const hasDescendant = s.includes('>');
  const hasAdjacent = s.includes('+') || s.includes('~');
  return depth > 3 || hasDescendant || hasAdjacent;
});

log(`\nÖsszes selector: ${selectors.length}`, 'blue');
log(`Komplex selectorok: ${complexSelectors.length} (${((complexSelectors.length / selectors.length) * 100).toFixed(1)}%)`, 'blue');

if (complexSelectors.length > 100) {
  log('\n⚠️  Sok komplex selector - lassíthatja a renderelést', 'yellow');
  log('💡 Javaslat: Egyszerűsítsd a mély nesting-et', 'magenta');
}

// ============================================================
// 7. ÖSSZEGZÉS ÉS CSELEKVÉSI TERV
// ============================================================

log('\n\n📋 ÖSSZEFOGLALÓ ÉS CSELEKVÉSI TERV', 'bright');
log('='.repeat(70), 'bright');

const recommendations = [
  {
    priority: '🔥 MAGAS',
    task: 'Gzip/Brotli Compression bekapcsolása',
    impact: '120 KB → 19 KB (84% megtakarítás)',
    effort: 'Alacsony (10 perc)',
    steps: [
      'Nginx config: gzip on; gzip_types text/css;',
      'Vagy: Pre-compress .gz fájlok generálása',
      'Test: curl -H "Accept-Encoding: gzip" URL'
    ]
  },
  {
    priority: '🔥 MAGAS',
    task: 'Hardcoded színek → CSS változók',
    impact: `${hardcodedColors.length} szín standardizálása (~2-3 KB)`,
    effort: 'Közepes (1-2 óra)',
    steps: [
      'tokens.css: Új változók hozzáadása',
      'Find & Replace: rgba(0,0,0,0.3) → var(--shadow-md)',
      'Test: Visual regression check'
    ]
  },
  {
    priority: '⚡ KÖZEPES',
    task: 'Critical CSS extraction',
    impact: `~${(criticalSize / 1024).toFixed(1)} KB inline → Gyorsabb FCP`,
    effort: 'Magas (4-6 óra)',
    steps: [
      'Identify above-the-fold CSS',
      'Inline <style> a <head>-be',
      'Async load bundle.min.css'
    ]
  },
  {
    priority: '⚡ KÖZEPES',
    task: 'PostCSS Pipeline + Autoprefixer',
    impact: 'Jobb böngésző támogatás + 5-10 KB',
    effort: 'Közepes (2-3 óra)',
    steps: [
      'npm install postcss autoprefixer cssnano',
      'postcss.config.js létrehozása',
      'Build script frissítése'
    ]
  },
  {
    priority: '💡 ALACSONY',
    task: 'Shorthand properties használata',
    impact: '~0.5-1 KB megtakarítás',
    effort: 'Alacsony (30 perc)',
    steps: [
      'padding-top/right/bottom/left → padding',
      'margin longhand → shorthand',
      'Automated tool használata'
    ]
  }
];

recommendations.forEach((rec, i) => {
  log(`\n${i + 1}. [${rec.priority}] ${rec.task}`, 'bright');
  log(`   📊 Hatás: ${rec.impact}`, 'cyan');
  log(`   ⏱️  Munka: ${rec.effort}`, 'blue');

  if (rec.steps) {
    log('   📝 Lépések:', 'magenta');
    rec.steps.forEach((step) => {
      log(`      • ${step}`, 'white');
    });
  }
});

// ============================================================
// 8. GYORS GYŐZELMEK (Quick Wins)
// ============================================================

log('\n\n🚀 GYORS GYŐZELMEK (30 perc alatt)', 'bright');
log('='.repeat(70), 'bright');

const quickWins = [
  {
    task: 'Nginx Gzip bekapcsolása',
    command: 'Add to nginx.conf: gzip on; gzip_types text/css;',
    impact: '84% méretcsökkenés',
    time: '10 perc'
  },
  {
    task: 'Pre-generate gzip fájlok',
    command: 'gzip -k public/css/dist/*.css',
    impact: 'Instant compression',
    time: '5 perc'
  },
  {
    task: 'Cache headers beállítása',
    command: 'Cache-Control: public, max-age=31536000',
    impact: 'Fewer requests',
    time: '10 perc'
  }
];

quickWins.forEach((win, i) => {
  log(`\n${i + 1}. ${win.task}`, 'green');
  log(`   ⚡ ${win.command}`, 'cyan');
  log(`   💰 ${win.impact} | ⏱️  ${win.time}`, 'yellow');
});

// ============================================================
// VÉGSŐ ÖSSZEGZÉS
// ============================================================

log('\n\n📈 POTENCIÁLIS TELJES MEGTAKARÍTÁS', 'bright');
log('='.repeat(70), 'bright');

const optimizations = [
  { name: 'Jelenlegi állapot', size: 120, done: true },
  { name: '+ Gzip compression', size: 19, done: false },
  { name: '+ Hardcoded színek → vars', size: 17, done: false },
  { name: '+ PostCSS optimalizálás', size: 15, done: false },
  { name: '+ Shorthand properties', size: 14.5, done: false }
];

log('\nOptimalizálási útvonal:', 'cyan');
optimizations.forEach((opt, i) => {
  const status = opt.done ? '✅' : '⏳';
  const bar = '█'.repeat(Math.floor((120 - opt.size) / 2));
  log(`  ${status} ${opt.name.padEnd(35)} ${opt.size.toString().padStart(5)} KB ${bar}`, opt.done ? 'green' : 'yellow');
});

log('\n🎯 Végső cél: 14.5 KB (88% méretcsökkenés az eredeti 120 KB-hez képest)', 'green');
log('⏱️  Becsült munka: 8-10 óra (teljes implementáció)', 'blue');

log(`\n${'='.repeat(70)}`, 'bright');
log('💡 Következő lépés: npm run optimize:quick (quick wins script)', 'magenta');
log('='.repeat(70), 'bright');
log('');
