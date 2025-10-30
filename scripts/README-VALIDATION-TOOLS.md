# 🔍 Admin Validation Tools

## Overview

Ez a könyvtár automatizált validációs eszközöket tartalmaz az admin felület tesztelésére és biztonsági ellenőrzésére.

---

## 📄 `validate-admin-forms.js`

### Cél
Ellenőrzi az összes admin oldalt **nested form** struktúrákra, amelyek CSRF token duplikációt okozhatnak.

---

## 🎨 `validate-admin-css-consistency.js`

### Cél
Ellenőrzi hogy az admin oldalak egységes CSS-t használnak és nem tartalmaznak inline style-okat vagy hardcoded értékeket.

### Használat

```bash
# Futtatás
node scripts/validate-admin-css-consistency.js

# Kimenet logba mentése
node scripts/validate-admin-css-consistency.js 2>&1 | tee css-report.log
```

### Mit ellenőriz?

1. **Inline styles** - `style=""` attribútumok (kivéve layout utilities)
2. **Hardcoded colors** - `#hex`, `rgb()`, `rgba()` értékek
3. **Hardcoded sizes** - `px`, `rem` értékek inline style-okban
4. **Inconsistent classes** - Régi class nevek (pl. `stats-grid` → `stat-card--grid`)
5. **CSS variable usage** - Ellenőrzi hogy használ-e `var(--variable)` értékeket

### Exit Codes

- `0` - ✅ Minden fájl konzisztens CSS-t használ
- `1` - ❌ CSS problémák találva

### Kimenet példa

```
🎨 Admin CSS Consistency Report
════════════════════════════════════════════════════════════════════════════════

📄 blog/index.ejs
   ⚠️  52 issues found
   
   Inline Styles: 22
      Line 107: hardcoded-color
         border-left-color: #10b981;
         💡 Use CSS variables like var(--success-color)
   
   Hardcoded Colors: 28
      Line 43: #1f2937
         💡 Use CSS variable instead

📊 Summary
════════════════════════════════════════════════════════════════════════════════
Total files scanned:  58
Clean files:          7 (12%)
Files with issues:    51
Total issues:         2448

Issues by type:
  hex-color: 1772
  hardcoded-size: 50
  inline-style: 574
```

### Refactoring Guide

Lásd: `CSS_REFACTORING_PLAN.md` a részletes refactoring tervért.

---

### Használat

```bash
# Futtatás
node scripts/validate-admin-forms.js

# Kimenet logba mentése
node scripts/validate-admin-forms.js 2>&1 | tee validation-report.log
```

### Mit ellenőriz?

1. **Nested forms detection** - `<form>` elemek egymásba ágyazása
2. **CSRF token counting** - duplikált `_csrf` mezők
3. **Form structure analysis** - action, method, id attribútumok
4. **Page accessibility** - 200/302/40x válaszok

### Exit Codes

- `0` - ✅ Minden rendben, nincs nested form
- `1` - ❌ Nested form találva VAGY login hiba

### Kimenet példa

```
🔍 Admin Forms Validation Report
════════════════════════════════════════════════════════════════════════════════
🔐 Logging in to admin panel...
✅ Login successful

📄 Checking: /admin/partners/1/edit
   ✅ Status: 200
   📊 Forms found: 2
      1. POST /auth/logout (CSRF: 1)
      2. POST /admin/partners/1 (CSRF: 1)

📊 Summary
════════════════════════════════════════════════════════════════════════════════
Total URLs:           36
Successfully checked: 36
Redirected:           0
Errors:               0

✅ NO NESTED FORMS DETECTED
   All admin pages are clean!
```

---

## 🔧 Konfigurálás

### Login credentials

A script hardcoded credentials-t használ. **Production environment-ben** ezt környezeti változókra kell cserélni:

```javascript
// Jelenlegi (dev only):
const LOGIN_EMAIL = 'zsolt@dmf.hu';
const LOGIN_PASSWORD = 'qaywsx';

// Javasolt (production):
const LOGIN_EMAIL = process.env.ADMIN_EMAIL || 'zsolt@dmf.hu';
const LOGIN_PASSWORD = process.env.ADMIN_PASSWORD || 'qaywsx';
```

### URL lista frissítése

Ha új admin modulok kerülnek be, frissítsd az `ADMIN_URLS` array-t:

```javascript
const ADMIN_URLS = [
  '/admin',
  '/admin/new-module',
  '/admin/new-module/1/edit',
  // ...
];
```

---

## 🚀 CI/CD Integráció

### GitHub Actions példa

```yaml
name: Admin Forms Validation

on:
  pull_request:
    paths:
      - 'views/admin/**'
      - 'routes/admin*.js'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start test server
        run: npm run dev &
        
      - name: Wait for server
        run: sleep 10
      
      - name: Run forms validation
        env:
          ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
        run: node scripts/validate-admin-forms.js
```

---

## 📊 Továbbfejlesztési ötletek

### 1. JSON Report Export

```javascript
// Add to validateAllPages()
const reportFile = 'validation-report.json';
fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
console.log(chalk.green(`\n📄 Report saved: ${reportFile}`));
```

### 2. Email Notification

```javascript
if (results.nestedFormsFound > 0) {
  await sendEmailNotification({
    subject: '🚨 Nested Forms Detected',
    body: `${results.nestedFormsFound} nested forms found`,
    pages: results.pages.filter(p => p.nestedForms > 0)
  });
}
```

### 3. Screenshot Capture

```javascript
const puppeteer = require('puppeteer');

async function captureScreenshot(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}${url}`);
  await page.screenshot({ path: `screenshots/${url.replace(/\//g, '_')}.png` });
  await browser.close();
}
```

### 4. Performance Metrics

```javascript
const startTime = Date.now();
// ... validation logic
const duration = Date.now() - startTime;
console.log(chalk.gray(`\n⏱️  Total time: ${duration}ms`));
```

### 5. Webhook Integration (Slack/Discord)

```javascript
async function sendSlackNotification(results) {
  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: results.nestedFormsFound > 0 
      ? '🚨 Nested forms detected!' 
      : '✅ All admin forms validated'
  });
}
```

---

## 🐛 Known Issues

1. **Rate Limiting**: 100ms delay minden request között (növelhető ha szükséges)
2. **Dynamic IDs**: Hardcoded ID-k (pl. `/admin/blog/3/edit`) - érvényes rekordok kellenek
3. **Redirects**: 302 redirect-ek "success"-ként kerülnek logolásra
4. **Modals**: Rejtett modal formok (display:none) észlelhetők, de nem láthatók

---

## 📚 Related Documentation

- [CSRF Protection](../middleware/advancedSecurity.js)
- [Nested Form Bug Report](../REFACTOR_FINAL_REPORT.md)
- [Admin Routes](../routes/admin*.js)

---

## 🔐 Security Notes

⚠️ **FIGYELEM**: Ez a script production credentials-t tartalmaz!

- **Soha ne** commitold a jelszavakat a repo-ba
- Használj environment variables-t production-ben
- Korlátozd a script futtatási jogokat
- Logold az összes validation attempt-et

---

## 📝 Changelog

### 2025-10-09
- ✅ Initial release
- ✅ Nested forms detection
- ✅ CSRF token counting
- ✅ Login automation
- ✅ 36 admin URLs coverage

---

## 👤 Maintainer

**DMF Development Team**  
Email: zsolt@dmf.hu  
Last updated: 2025. október 9.
