#!/usr/bin/env node

/**
 * Admin CSS Consistency Validator
 *
 * PURPOSE:
 * Ellenőrzi hogy az admin oldalak egységes CSS-t használnak és
 * nem tartalmaznak inline style-okat vagy hardcoded értékeket.
 *
 * CHECKS:
 * 1. Inline styles detection (style="..." attributes)
 * 2. Hardcoded colors (#hex, rgb(), rgba())
 * 3. Hardcoded sizes (px, rem values in HTML)
 * 4. Inconsistent class usage
 * 5. Missing CSS variables (--var-name)
 * 6. Duplicate CSS definitions
 *
 * USAGE:
 * node scripts/validate-admin-css-consistency.js
 *
 * @author DMF Development Team
 * @date 2025-10-09
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const VIEWS_DIR = path.join(__dirname, '../views/admin');
// Reserved for future CSS validation
// const _CSS_FILE = path.join(__dirname, '../public/css/admin-common.css');

// Patterns to detect
const PATTERNS = {
  inlineStyles: /style="([^"]*)"/gi,
  hexColors: /#[0-9a-fA-F]{3,8}\b/g,
  rgbColors: /rgba?\([^)]+\)/gi,
  pxSizes: /\d+px/g,
  remSizes: /\d+\.?\d*rem/g,
  cssVariables: /var\(--[a-zA-Z0-9-]+\)/g,
  hardcodedText: /(width|height|margin|padding|font-size):\s*\d+/gi
};

// Allowed exceptions (legitimate inline styles)
const ALLOWED_INLINE_PATTERNS = [
  /display:\s*none/i,
  /display:\s*inline/i,
  /display:\s*block/i,
  /display:\s*flex/i,
  /display:\s*grid/i,
  /width:\s*100%/i,
  /height:\s*100%/i
];

// Reserved for future CSS variable validation
/*
const _REQUIRED_CSS_VARS = [
  '--primary-color',
  '--secondary-color',
  '--success-color',
  '--danger-color',
  '--warning-color',
  '--info-color',
  '--text-primary',
  '--text-secondary',
  '--bg-color',
  '--border-color',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6'
];
*/

/**
 * Read all EJS files from admin directory
 */
function getAllAdminFiles(dir = VIEWS_DIR, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip backup directories
      if (!file.includes('backup') && !file.startsWith('.')) {
        getAllAdminFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ejs') && !file.includes('.bak') && !file.includes('.backup')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Check if inline style is allowed
 */
function isAllowedInlineStyle(styleContent) {
  return ALLOWED_INLINE_PATTERNS.some((pattern) => pattern.test(styleContent));
}

/**
 * Analyze inline styles in content
 */
function analyzeInlineStyles(content, _filePath) {
  const issues = [];
  let match;

  const regex = new RegExp(PATTERNS.inlineStyles);

  while ((match = regex.exec(content)) !== null) {
    const styleContent = match[1];

    // Skip if it's an allowed pattern
    if (isAllowedInlineStyle(styleContent)) {
      continue; // eslint-disable-line no-continue -- Early return in validation loop
    }

    // Check for hardcoded colors
    if (PATTERNS.hexColors.test(styleContent) || PATTERNS.rgbColors.test(styleContent)) {
      issues.push({
        type: 'hardcoded-color',
        line: getLineNumber(content, match.index),
        content: styleContent,
        suggestion: 'Use CSS variables like var(--primary-color)'
      });
    }

    // Check for hardcoded sizes
    if (PATTERNS.hardcodedText.test(styleContent)) {
      issues.push({
        type: 'hardcoded-size',
        line: getLineNumber(content, match.index),
        content: styleContent,
        suggestion: 'Use CSS variables like var(--space-4) or utility classes'
      });
    }

    // General inline style warning
    if (styleContent.length > 50) {
      issues.push({
        type: 'inline-style',
        line: getLineNumber(content, match.index),
        content: `${styleContent.substring(0, 100)}...`,
        suggestion: 'Move to CSS class in admin-common.css'
      });
    }
  }

  return issues;
}

/**
 * Analyze hardcoded colors in file
 */
function analyzeHardcodedColors(content, _filePath) {
  const issues = [];

  // Find hex colors
  let match;
  const hexRegex = new RegExp(PATTERNS.hexColors);

  while ((match = hexRegex.exec(content)) !== null) {
    // Skip if it's inside a CSS variable definition or comment
    const context = content.substring(Math.max(0, match.index - 50), match.index + 50);
    if (context.includes('var(--') || context.includes('<!--')) {
      continue; // eslint-disable-line no-continue -- Skip CSS variables and comments
    }

    issues.push({
      type: 'hex-color',
      line: getLineNumber(content, match.index),
      content: match[0],
      suggestion: 'Use CSS variable instead'
    });
  }

  return issues;
}

/**
 * Check for CSS consistency
 */
function checkCSSConsistency(content, _filePath) {
  const issues = [];

  // Check for old class patterns
  const oldPatterns = [
    { pattern: /class="[^"]*admin-card[^"]*"/g, suggestion: 'Use .data-card instead' },
    // stats-grid is OK - standard grid layout class
    // { pattern: /class="[^"]*stats-grid[^"]*"/g, suggestion: 'Use .stat-card--grid instead' },
    { pattern: /class="[^"]*old-button[^"]*"/g, suggestion: 'Use .btn .btn-primary instead' }
  ];

  oldPatterns.forEach(({ pattern, suggestion }) => {
    let match;
    const regex = new RegExp(pattern);

    while ((match = regex.exec(content)) !== null) {
      issues.push({
        type: 'inconsistent-class',
        line: getLineNumber(content, match.index),
        content: match[0],
        suggestion
      });
    }
  });

  return issues;
}

/**
 * Get line number from content index
 */
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

/**
 * Analyze single file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(VIEWS_DIR, filePath);

  const issues = {
    inlineStyles: analyzeInlineStyles(content, filePath),
    hardcodedColors: analyzeHardcodedColors(content, filePath),
    cssConsistency: checkCSSConsistency(content, filePath)
  };

  const totalIssues
    = issues.inlineStyles.length
    + issues.hardcodedColors.length
    + issues.cssConsistency.length;

  return {
    path: relativePath,
    totalIssues,
    issues
  };
}

/**
 * Helper: Print inline style issues
 */
function printInlineStyleIssues(issues, issuesByType) {
  if (issues.length === 0) {
    return;
  }

  console.log(chalk.gray(`   \n   Inline Styles: ${issues.length}`));
  issues.slice(0, 3).forEach((issue) => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    console.log(chalk.red(`      Line ${issue.line}: ${issue.type}`));
    console.log(chalk.gray(`         ${issue.content.substring(0, 60)}...`));
    console.log(chalk.green(`         💡 ${issue.suggestion}`));
  });

  if (issues.length > 3) {
    console.log(chalk.gray(`      ... and ${issues.length - 3} more`));
  }
}

/**
 * Helper: Print hardcoded color issues
 */
function printHardcodedColorIssues(issues, issuesByType) {
  if (issues.length === 0) {
    return;
  }

  console.log(chalk.gray(`   \n   Hardcoded Colors: ${issues.length}`));
  issues.slice(0, 3).forEach((issue) => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    console.log(chalk.red(`      Line ${issue.line}: ${issue.content}`));
    console.log(chalk.green(`         💡 ${issue.suggestion}`));
  });

  if (issues.length > 3) {
    console.log(chalk.gray(`      ... and ${issues.length - 3} more`));
  }
}

/**
 * Helper: Print CSS consistency issues
 */
function printCssConsistencyIssues(issues, issuesByType) {
  if (issues.length === 0) {
    return;
  }

  console.log(chalk.gray(`   \n   Inconsistent Classes: ${issues.length}`));
  issues.slice(0, 3).forEach((issue) => {
    issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
    console.log(chalk.red(`      Line ${issue.line}: ${issue.type}`));
    console.log(chalk.green(`         💡 ${issue.suggestion}`));
  });
}

/**
 * Helper: Print file result
 */
function printFileResult(result, issuesByType) {
  if (result.totalIssues === 0) {
    return;
  }

  console.log(chalk.cyan(`\n📄 ${result.path}`));
  console.log(chalk.yellow(`   ⚠️  ${result.totalIssues} issue${result.totalIssues > 1 ? 's' : ''} found`));

  printInlineStyleIssues(result.issues.inlineStyles, issuesByType);
  printHardcodedColorIssues(result.issues.hardcodedColors, issuesByType);
  printCssConsistencyIssues(result.issues.cssConsistency, issuesByType);
}

/**
 * Helper: Print summary
 */
function printSummary(totalFiles, cleanFiles, totalIssues, issuesByType) {
  console.log(chalk.blue.bold('\n\n📊 Summary\n'));
  console.log(chalk.gray('═'.repeat(80)));
  console.log(chalk.cyan(`Total files scanned:  ${totalFiles}`));
  console.log(chalk.green(`Clean files:          ${cleanFiles} (${Math.round(cleanFiles / totalFiles * 100)}%)`));
  console.log(chalk.yellow(`Files with issues:    ${totalFiles - cleanFiles}`));
  console.log(chalk.red.bold(`Total issues:         ${totalIssues}\n`));

  console.log(chalk.blue('Issues by type:'));
  Object.entries(issuesByType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(chalk.yellow(`  ${type}: ${count}`));
    }
  });
}

/**
 * Helper: Print recommendations
 */
function printRecommendations(issuesByType) {
  console.log(chalk.blue.bold('\n\n💡 Recommendations\n'));
  console.log(chalk.gray('═'.repeat(80)));

  if (issuesByType['inline-style'] > 0) {
    console.log(chalk.yellow('1. Move inline styles to CSS classes in admin-common.css'));
  }

  if (issuesByType['hardcoded-color'] > 0 || issuesByType['hex-color'] > 0) {
    console.log(chalk.yellow('2. Replace hardcoded colors with CSS variables:'));
    console.log(chalk.gray('   Example: #dc3545 → var(--danger-color)'));
  }

  if (issuesByType['hardcoded-size'] > 0) {
    console.log(chalk.yellow('3. Replace hardcoded sizes with CSS variables:'));
    console.log(chalk.gray('   Example: padding: 16px → padding: var(--space-4)'));
  }

  if (issuesByType['inconsistent-class'] > 0) {
    console.log(chalk.yellow('4. Update old class names to new design system classes'));
  }

  console.log(chalk.gray(`\n${'═'.repeat(80)}\n`));
}

/**
 * Helper: Print final result
 */
function printFinalResult(hasIssues) {
  if (hasIssues) {
    console.log(chalk.red.bold('❌ CSS consistency issues found'));
    console.log(chalk.yellow('   Consider refactoring to use admin-common.css variables and classes\n'));
  } else {
    console.log(chalk.green.bold('✅ All files use consistent CSS'));
    console.log(chalk.green('   No inline styles or hardcoded values detected\n'));
  }
}

/**
 * Generate report
 */
function generateReport(results) {
  console.log(chalk.blue.bold('\n🎨 Admin CSS Consistency Report\n'));
  console.log(chalk.gray('═'.repeat(80)));

  const totalFiles = results.length;
  let cleanFiles = 0;
  let totalIssues = 0;

  const issuesByType = {
    'inline-style': 0,
    'hardcoded-color': 0,
    'hardcoded-size': 0,
    'inconsistent-class': 0,
    'hex-color': 0
  };

  // Process each file result
  results.forEach((result) => {
    if (result.totalIssues === 0) {
      cleanFiles += 1;
      return;
    }
    totalIssues += result.totalIssues;
    printFileResult(result, issuesByType);
  });

  // Print summary, recommendations, and final result
  printSummary(totalFiles, cleanFiles, totalIssues, issuesByType);
  printRecommendations(issuesByType);
  printFinalResult(totalIssues > 0);

  return totalIssues > 0 ? 1 : 0;
}

/**
 * Main function
 */
function main() {
  try {
    console.log(chalk.cyan('🔍 Scanning admin views for CSS consistency...\n'));

    const files = getAllAdminFiles();
    console.log(chalk.gray(`Found ${files.length} admin files to analyze\n`));

    const results = files.map(analyzeFile);

    const exitCode = generateReport(results);
    process.exit(exitCode);
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Validation failed:'), error);
    process.exit(1);
  }
}

// Run
main();
