#!/usr/bin/env node

/**
 * CSS Optimalizálási Elemző Script
 * Megvizsgálja a CSS bundle-t és javaslatokat ad az optimalizálásra
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '../public/css/dist/bundle.css');

console.log('🔍 CSS Optimalizálási Lehetőségek Elemzése\n');
console.log('='.repeat(60));

// CSS beolvasása
const css = fs.readFileSync(BUNDLE_PATH, 'utf8');
const originalSize = Buffer.byteLength(css, 'utf8');

console.log(`\n📁 Bundle méret: ${(originalSize / 1024).toFixed(2)} KB\n`);

// 1. MEDIA QUERY DUPLIKÁCIÓK
console.log('🖥️  MEDIA QUERY ELEMZÉS');
console.log('-'.repeat(60));

const mediaQueries = css.match(/@media[^{]+\{[^}]*\}/g) || [];
const mqMap = new Map();

mediaQueries.forEach((mq) => {
  const query = mq.match(/@media[^{]+/)[0].trim();
  mqMap.set(query, (mqMap.get(query) || 0) + 1);
});

console.log(`Különböző media query-k: ${mqMap.size}`);
const duplicateMQ = Array.from(mqMap.entries()).filter(([_, count]) => count > 1);
console.log(`Duplikált media query-k: ${duplicateMQ.length}`);

duplicateMQ.slice(0, 5).forEach(([query, count]) => {
  console.log(`  ${count}x: ${query}`);
});

// 2. UTILITY OSZTÁLYOK DUPLIKÁCIÓJA
console.log('\n\n🔧 UTILITY OSZTÁLYOK');
console.log('-'.repeat(60));

const utilities = {
  display: css.match(/display:\s*[^;]+;/gi) || [],
  margin: css.match(/margin(-[a-z]+)?:\s*[^;]+;/gi) || [],
  padding: css.match(/padding(-[a-z]+)?:\s*[^;]+;/gi) || [],
  color: css.match(/color:\s*[^;]+;/gi) || [],
  fontSize: css.match(/font-size:\s*[^;]+;/gi) || []
};

Object.entries(utilities).forEach(([name, props]) => {
  const propMap = new Map();
  props.forEach((prop) => {
    const normalized = prop.trim().toLowerCase();
    propMap.set(normalized, (propMap.get(normalized) || 0) + 1);
  });

  const duplicates = Array.from(propMap.entries()).filter(([_, count]) => count > 5);
  console.log(`\n${name}: ${props.length} előfordulás, ${duplicates.length} gyakori érték`);

  duplicates.slice(0, 3).forEach(([prop, count]) => {
    console.log(`  ${count}x: ${prop}`);
  });
});

// 3. SZÍNEK ELEMZÉSE
console.log('\n\n🎨 SZÍNEK');
console.log('-'.repeat(60));

const colors = css.match(/#[0-9a-fA-F]{3,6}/g) || [];
const rgbColors = css.match(/rgba?\([^)]+\)/g) || [];
const allColors = [...colors, ...rgbColors];

const colorMap = new Map();
allColors.forEach((color) => {
  colorMap.set(color, (colorMap.get(color) || 0) + 1);
});

const hardcodedColors = Array.from(colorMap.entries())
  .filter(([color, _]) => !color.includes('var('))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log(`Különböző színek: ${colorMap.size}`);
console.log('Hardcoded színek (top 10):');
hardcodedColors.forEach(([color, count]) => {
  console.log(`  ${count}x: ${color}`);
});

// 4. FONT MÉRETEK
console.log('\n\n📏 FONT MÉRETEK');
console.log('-'.repeat(60));

const fontSizes = css.match(/font-size:\s*[^;]+;/gi) || [];
const sizeMap = new Map();

fontSizes.forEach((size) => {
  const value = size.match(/:\s*([^;]+)/)[1].trim();
  if (!value.includes('var(')) {
    sizeMap.set(value, (sizeMap.get(value) || 0) + 1);
  }
});

console.log(`Font méret előfordulások: ${fontSizes.length}`);
console.log('Hardcoded méretek (top 10):');
Array.from(sizeMap.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([size, count]) => {
    console.log(`  ${count}x: ${size}`);
  });

// 5. SELECTOR SPECIFICITÁS
console.log('\n\n🎯 SELECTOR KOMPLEXITÁS');
console.log('-'.repeat(60));

const selectors = css.match(/[^}]+\{/g) || [];
const complexSelectors = selectors.filter((s) =>
  (s.match(/\s/g) || []).length > 3
  || s.includes('>')
  || s.includes('+')
  || s.includes('~')
);

console.log(`Összes selector: ${selectors.length}`);
console.log(`Komplex selectorok: ${complexSelectors.length}`);
console.log('Példák:');
complexSelectors.slice(0, 5).forEach((selector) => {
  console.log(`  ${selector.trim().substring(0, 70)}...`);
});

// 6. OPTIMALIZÁLÁSI JAVASLATOK
console.log('\n\n💡 OPTIMALIZÁLÁSI JAVASLATOK');
console.log('='.repeat(60));

const suggestions = [];

if (duplicateMQ.length > 10) {
  suggestions.push({
    priority: 'MAGAS',
    task: 'Media Query Consolidation',
    impact: `${duplicateMQ.length} media query összevonható`,
    savings: '15-20 KB',
    effort: 'Közepes'
  });
}

if (hardcodedColors.length > 20) {
  suggestions.push({
    priority: 'MAGAS',
    task: 'Színek CSS változókba',
    impact: `${hardcodedColors.length} hardcoded szín`,
    savings: '5-10 KB',
    effort: 'Alacsony'
  });
}

if (Array.from(sizeMap.entries()).length > 30) {
  suggestions.push({
    priority: 'KÖZEPES',
    task: 'Font méret standard',
    impact: 'Konzisztensebb méretezés',
    savings: '3-5 KB',
    effort: 'Alacsony'
  });
}

suggestions.push({
  priority: 'KÖZEPES',
  task: 'PostCSS pipeline',
  impact: 'Autoprefixer + PurgeCSS',
  savings: '30-50 KB',
  effort: 'Magas'
});

suggestions.push({
  priority: 'ALACSONY',
  task: 'Critical CSS extraction',
  impact: 'Gyorsabb initial load',
  savings: 'Runtime perf',
  effort: 'Magas'
});

suggestions.forEach((s, i) => {
  console.log(`\n${i + 1}. [${s.priority}] ${s.task}`);
  console.log(`   📊 Hatás: ${s.impact}`);
  console.log(`   💾 Megtakarítás: ${s.savings}`);
  console.log(`   ⏱️  Munka: ${s.effort}`);
});

// 7. ÖSSZEGZÉS
console.log('\n\n📈 ÖSSZEGZÉS');
console.log('='.repeat(60));

const potentialSavings = 50; // KB
const newSize = originalSize / 1024 - potentialSavings;
const percentage = ((potentialSavings / (originalSize / 1024)) * 100).toFixed(1);

console.log(`\nJelenlegi méret: ${(originalSize / 1024).toFixed(2)} KB`);
console.log(`Potenciális megtakarítás: ~${potentialSavings} KB`);
console.log(`Optimalizált méret: ~${newSize.toFixed(2)} KB`);
console.log(`Csökkenés: ${percentage}%`);

console.log('\n✅ Következő lépések:');
console.log('1. PostCSS pipeline beállítása (legnagyobb hatás)');
console.log('2. Media query-k összevonása (gyors win)');
console.log('3. Színek és méretek standardizálása');
console.log('4. PurgeCSS használatlan stílusok eltávolítására');

console.log(`\n${'='.repeat(60)}`);
