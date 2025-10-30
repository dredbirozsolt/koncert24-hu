#!/usr/bin/env node

// Constants for duplicate strings
const CSRF_INPUT_NAME = '_csrf';
const HEADER_SET_COOKIE = 'set-cookie';

/**
 * Admin Forms Nested Form Validator
 *
 * PURPOSE:
 * Ellenőrzi az összes admin oldalt nested form struktúrákra,
 * amelyek CSRF token duplikációt okozhatnak.
 *
 * BACKGROUND:
 * 2025-10-09: Nested form bug okozott 403 CSRF errort a partners form-nál.
 * A nested <form> elemek miatt a req.body._csrf array lett string helyett,
 * ami elbuktatta a CSRF validációt. Ez a script megelőzi a jövőbeli eseteket.
 *
 * USAGE:
 * node scripts/validate-admin-forms.js
 *
 * EXIT CODES:
 * 0 - Success, no nested forms detected
 * 1 - Nested forms found OR login failed
 *
 * FEATURES:
 * - Automated login with session management
 * - 36 admin URLs comprehensive coverage
 * - Nested form detection with cheerio HTML parsing
 * - CSRF token counting per form
 * - Colored terminal output with statistics
 *
 * TODO:
 * - Add JSON report export
 * - Integrate with CI/CD pipeline
 * - Add screenshot capture for failed pages
 * - Replace hardcoded credentials with env vars
 *
 * @author DMF Development Team
 * @date 2025-10-09
 * @version 1.0.0
 */

const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');

const BASE_URL = 'http://localhost:3000';

// Login credentials
const LOGIN_EMAIL = 'zsolt@dmf.hu';
const LOGIN_PASSWORD = 'qaywsx';

// Store session cookie
let sessionCookie = '';

/**
 * Login to admin panel and get session cookie
 */
async function login() {
  try {
    console.log(chalk.cyan('🔐 Logging in to admin panel...'));

    // First, get the login page to get CSRF token
    const loginPageResponse = await axios.get(`${BASE_URL}/auth/login`);
    const $ = cheerio.load(loginPageResponse.data);
    const csrfToken = $(`input[name="${CSRF_INPUT_NAME}"]`).val();

    // Extract cookies from response
    const cookies = loginPageResponse.headers[HEADER_SET_COOKIE];
    const sessionCookieFromLogin = cookies ? cookies.map((cookie) => cookie.split(';')[0]).join('; ') : '';

    // Now login with credentials
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
      [CSRF_INPUT_NAME]: csrfToken
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookieFromLogin
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    // Extract session cookie after login
    const loginCookies = loginResponse.headers[HEADER_SET_COOKIE];
    const cookieString = loginCookies ? loginCookies.map((cookie) => cookie.split(';')[0]).join('; ') : '';
    sessionCookie = cookieString || sessionCookieFromLogin;

    console.log(chalk.green('✅ Login successful\n'));
    return true;
  } catch (error) {
    if (error.response && error.response.status === 302) {
      // Redirect means successful login
      const loginCookies = error.response.headers[HEADER_SET_COOKIE];
      sessionCookie = loginCookies ? loginCookies.map((cookie) => cookie.split(';')[0]).join('; ') : sessionCookie;
      console.log(chalk.green('✅ Login successful (redirected)\n'));
      return true;
    }

    console.error(chalk.red('❌ Login failed:'), error.message);
    return false;
  }
}

// Admin URLs listája
const ADMIN_URLS = [
  '/admin',

  '/admin/blog',
  '/admin/blog/new',
  '/admin/blog/3/edit',
  '/admin/blog/categories',
  '/admin/blog/categories/new',
  '/admin/blog/categories/1/edit',

  '/admin/chat',
  '/admin/chat/settings',
  '/admin/chat/offline-messages',

  '/admin/partners',
  '/admin/partners/new',
  '/admin/partners/1/edit',
  '/admin/partners/categories',
  '/admin/partners/categories/new',
  '/admin/partners/categories/1/edit',

  '/admin/social',
  '/admin/events',
  '/admin/company',

  '/admin/faq',
  '/admin/faq/items/new',
  '/admin/faq/items/1/edit',
  '/admin/faq/categories/new',
  '/admin/faq/categories/1/edit',

  '/admin/users',
  '/admin/users/new',
  '/admin/users/8/edit',

  '/admin/seo',
  '/admin/settings',
  '/admin/exit-popup',
  '/admin/email',
  '/admin/integrations',
  '/admin/logs',
  '/admin/backup',
  '/admin/cron',
  '/admin/security-log'
];

/**
 * Fetch HTML content with session
 */
async function fetchPage(url) {
  try {
    const response = await axios.get(`${BASE_URL}${url}`, {
      headers: {
        Cookie: sessionCookie
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    return {
      url,
      status: response.status,
      html: response.data
    };
  } catch (error) {
    if (error.response && error.response.status === 302) {
      return {
        url,
        status: 302,
        redirect: error.response.headers.location,
        html: null
      };
    }

    return {
      url,
      status: error.response?.status || 'ERROR',
      error: error.message,
      html: null
    };
  }
}

/**
 * Detect nested forms in HTML
 */
function detectNestedForms(html) {
  const $ = cheerio.load(html);
  const nestedForms = [];

  // Find all forms
  $('form').each((i, outerForm) => {
    const $outerForm = $(outerForm);
    const outerAction = $outerForm.attr('action') || 'no-action';
    const outerMethod = $outerForm.attr('method') || 'GET';

    // Check if there are nested forms inside
    $outerForm.find('form').each((j, innerForm) => {
      const $innerForm = $(innerForm);
      const innerAction = $innerForm.attr('action') || 'no-action';
      const innerMethod = $innerForm.attr('method') || 'GET';

      nestedForms.push({
        outer: {
          action: outerAction,
          method: outerMethod,
          html: `${$outerForm.html().substring(0, 200)}...`
        },
        inner: {
          action: innerAction,
          method: innerMethod,
          html: `${$innerForm.html().substring(0, 200)}...`
        }
      });
    });
  });

  return nestedForms;
}

/**
 * Count forms and CSRF tokens
 */
function analyzeFormsAndTokens(html) {
  const $ = cheerio.load(html);

  const forms = [];
  $('form').each((i, form) => {
    const $form = $(form);
    const action = $form.attr('action') || 'no-action';
    const method = $form.attr('method') || 'GET';
    const id = $form.attr('id') || 'no-id';
    const csrfTokens = $form.find(`input[name="${CSRF_INPUT_NAME}"]`).length;

    forms.push({
      id,
      action,
      method,
      csrfTokens
    });
  });

  return forms;
}

/**
 * Main validation function
 */
// eslint-disable-next-line max-statements -- Script needs many validation steps
async function validateAllPages() {
  console.log(chalk.blue.bold('\n🔍 Admin Forms Validation Report\n'));
  console.log(chalk.gray('═'.repeat(80)));

  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error(chalk.red.bold('\n❌ Cannot proceed without login'));
    process.exit(1);
  }

  const results = {
    total: ADMIN_URLS.length,
    success: 0,
    redirected: 0,
    errors: 0,
    nestedFormsFound: 0,
    pages: []
  };

  for (const url of ADMIN_URLS) {
    console.log(chalk.cyan(`\n📄 Checking: ${url}`));

    const page = await fetchPage(url);

    if (page.status === 302) {
      console.log(chalk.yellow(`   ⚠️  Redirected to: ${page.redirect}`));
      results.redirected += 1;
      results.pages.push({
        url,
        status: 'REDIRECT',
        redirect: page.redirect
      });
      continue; // eslint-disable-line no-continue -- Early return pattern in loop
    }

    if (page.error || !page.html) {
      console.log(chalk.red(`   ❌ Error: ${page.error || 'No HTML'}`));
      results.errors += 1;
      results.pages.push({
        url,
        status: 'ERROR',
        error: page.error
      });
      continue; // eslint-disable-line no-continue -- Early return pattern in loop
    }

    // Analyze forms
    const forms = analyzeFormsAndTokens(page.html);
    const nestedForms = detectNestedForms(page.html);

    console.log(chalk.green(`   ✅ Status: ${page.status}`));
    console.log(chalk.gray(`   📊 Forms found: ${forms.length}`));

    if (forms.length > 0) {
      forms.forEach((form, idx) => {
        console.log(chalk.gray(`      ${idx + 1}. ${form.method} ${form.action} (CSRF: ${form.csrfTokens})`));
      });
    }

    if (nestedForms.length > 0) {
      console.log(chalk.red.bold(`   🚨 NESTED FORMS DETECTED: ${nestedForms.length}`));
      nestedForms.forEach((nested, _idx) => {
        console.log(chalk.red(`      Outer: ${nested.outer.method} ${nested.outer.action}`));
        console.log(chalk.red(`      Inner: ${nested.inner.method} ${nested.inner.action}`));
      });
      results.nestedFormsFound += nestedForms.length;
    }

    results.success += 1;
    results.pages.push({
      url,
      status: 'SUCCESS',
      forms: forms.length,
      nestedForms: nestedForms.length,
      details: forms
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log(chalk.blue.bold('\n\n📊 Summary\n'));
  console.log(chalk.gray('═'.repeat(80)));
  console.log(chalk.cyan(`Total URLs:           ${results.total}`));
  console.log(chalk.green(`Successfully checked: ${results.success}`));
  console.log(chalk.yellow(`Redirected:           ${results.redirected}`));
  console.log(chalk.red(`Errors:               ${results.errors}`));

  if (results.nestedFormsFound > 0) {
    console.log(chalk.red.bold(`\n🚨 NESTED FORMS:      ${results.nestedFormsFound}`));
    console.log(chalk.red('   Action required: Fix nested forms to prevent CSRF issues!'));
  } else {
    console.log(chalk.green.bold('\n✅ NO NESTED FORMS DETECTED'));
    console.log(chalk.green('   All admin pages are clean!'));
  }

  console.log(chalk.gray(`\n${'═'.repeat(80)}\n`));

  // Exit with error if nested forms found
  process.exit(results.nestedFormsFound > 0 ? 1 : 0);
}

// Run validation
validateAllPages().catch((error) => {
  console.error(chalk.red.bold('\n❌ Validation failed:'), error);
  process.exit(1);
});
