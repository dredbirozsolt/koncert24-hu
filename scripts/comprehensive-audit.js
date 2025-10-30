#!/usr/bin/env node

/**
 * Comprehensive Codebase Audit Script
 *
 * Ellenőrzi a teljes kódbázist (nem backup) konzisztencia hibákért:
 * - Régi exitPopup.* kulcsok
 * - camelCase mező nevek (ctaText, ctaLink, stb.)
 * - Nem megfelelő naming convention
 *
 * Használat:
 *   node scripts/comprehensive-audit.js
 */

const fs = require('fs');
const path = require('path');

// Constants
const COMMON_EXCLUDES = ['backup/', 'node_modules/'];
const MIGRATION_SCRIPT = 'scripts/migrate-exit-popup-keys.js';
const ADMIN_EXIT_POPUP = 'routes/admin-exit-popup.js';

// Színek a konzol kimenethez
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Probléma minták keresése
const PROBLEM_PATTERNS = [
  {
    name: 'Régi exitPopup kategória (camelCase)',
    pattern: /['"]exitPopup\./g,
    severity: 'HIGH',
    expected: 'exit_popup.',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT]
  },
  {
    name: 'camelCase mező név: ctaText',
    pattern: /ctaText(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'cta_text',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  },
  {
    name: 'camelCase mező név: ctaLink',
    pattern: /ctaLink(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'cta_link',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  },
  {
    name: 'camelCase mező név: triggerExitIntent',
    pattern: /triggerExitIntent(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'trigger_exit_intent',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  },
  {
    name: 'camelCase mező név: triggerMobileExit',
    pattern: /triggerMobileExit(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'trigger_mobile_exit',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  },
  {
    name: 'camelCase mező név: triggerTimed',
    pattern: /triggerTimed(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'trigger_timed',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  },
  {
    name: 'camelCase mező név: excludedPaths',
    pattern: /excludedPaths(?![a-zA-Z])/g,
    severity: 'HIGH',
    expected: 'excluded_paths',
    exclude: [...COMMON_EXCLUDES, MIGRATION_SCRIPT, ADMIN_EXIT_POPUP]
  }
];

// Fájl típusok ellenőrzése
const FILE_EXTENSIONS = ['.js', '.ejs', '.json'];

function shouldExclude(filePath, excludePatterns) {
  return excludePatterns.some((pattern) => filePath.includes(pattern));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  for (const problemPattern of PROBLEM_PATTERNS) {
    if (shouldExclude(filePath, problemPattern.exclude)) {
      continue; // eslint-disable-line no-continue
    }

    const matches = content.match(problemPattern.pattern);
    if (matches) {
      const lines = content.split('\n');
      const matchedLines = [];

      lines.forEach((line, index) => {
        if (problemPattern.pattern.test(line)) {
          matchedLines.push({
            line: index + 1,
            content: line.trim()
          });
        }
      });

      issues.push({
        pattern: problemPattern.name,
        severity: problemPattern.severity,
        expected: problemPattern.expected,
        matches: matches.length,
        lines: matchedLines
      });
    }

    // Reset regex
    problemPattern.pattern.lastIndex = 0;
  }

  return issues;
}

function scanDirectory(dirPath, results = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'backup' || entry.name === '.git') {
        continue; // eslint-disable-line no-continue
      }
      scanDirectory(fullPath, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (FILE_EXTENSIONS.includes(ext)) {
        const issues = scanFile(fullPath);
        if (issues.length > 0) {
          results.push({
            file: fullPath,
            issues
          });
        }
      }
    }
  }

  return results;
}

function printHeader() {
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}  Comprehensive Codebase Audit${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);
}

function printIssueLines(issue) {
  if (issue.lines.length <= 5) {
    issue.lines.forEach((lineInfo) => {
      console.log(`     ${colors.blue}Sor ${lineInfo.line}:${colors.reset} ${lineInfo.content.substring(0, 80)}`);
    });
  } else {
    console.log(`     Sorok: ${issue.lines.map((l) => l.line).join(', ')}`);
  }
}

function printSingleIssue(issue, stats) {
  stats.totalIssues += issue.matches;
  if (issue.severity === 'HIGH') {
    stats.highSeverity += issue.matches;
  }

  console.log(`   ${colors.red}✗${colors.reset} ${issue.pattern}`);
  console.log(`     Találatok: ${issue.matches}`);
  console.log(`     Súlyosság: ${issue.severity}`);
  console.log(`     Várható: ${colors.green}${issue.expected}${colors.reset}`);

  printIssueLines(issue);
  console.log('');
}

function printSummary(results, stats) {
  console.log(`${colors.cyan}─────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.yellow}📊 ÖSSZEFOGLALÓ:${colors.reset}`);
  console.log(`   Fájlok problémákkal: ${results.length}`);
  console.log(`   Összes probléma: ${stats.totalIssues}`);
  console.log(`   Magas súlyosságú: ${stats.highSeverity}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════════════${colors.reset}\n`);
}

function printResults(results) {
  printHeader();

  if (results.length === 0) {
    console.log(`${colors.green}✅ NINCS PROBLÉMA - A kódbázis teljesen konzisztens!${colors.reset}\n`);
    return;
  }

  console.log(`${colors.red}❌ TALÁLT PROBLÉMÁK: ${results.length} fájl${colors.reset}\n`);

  const stats = { totalIssues: 0, highSeverity: 0 };

  for (const result of results) {
    const relativePath = result.file.replace(process.cwd(), '');
    console.log(`${colors.yellow}📁 ${relativePath}${colors.reset}`);

    for (const issue of result.issues) {
      printSingleIssue(issue, stats);
    }
  }

  printSummary(results, stats);
}

function main() {
  console.clear();

  const rootDir = process.cwd();
  console.log(`${colors.blue}🔍 Scanning: ${rootDir}${colors.reset}\n`);

  const results = scanDirectory(rootDir);
  printResults(results);

  process.exit(results.length === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { scanDirectory, scanFile };
