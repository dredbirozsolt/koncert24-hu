const express = require('express');
const path = require('path');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');
const expressStaticGzip = require('express-static-gzip');

const compression = require('compression');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

// Import all security middleware
const {
  csrfTokenMiddleware,
  xssProtection,
  sqlInjectionProtection,
  noSQLProtection,
  ipReputationCheck,
  suspiciousPatternDetection,
  hppProtection,
  requestSizeLimit,
  additionalSecurityHeaders
} = require('./middleware/advancedSecurity');

// Connection rotation service for prepared statement cache management
const ConnectionRotationService = require('./services/connectionRotationService');

// Auto-detect application root directory
const APP_ROOT = __dirname;

// Load environment variables from detected directory
require('dotenv').config({ path: path.join(APP_ROOT, '.env') });

// Fallback: Load from absolute path if relative path fails (ONLY in production server)
// Commented out for local development
// if (!process.env.DB_HOST) {
//   require('dotenv').config({ path: '/home/dmf/koncert24-hu/.env' });
// }

// Import configurations and services
const logger = require('./config/logger');
const { server: serverConfig } = require('./config/environment');
const { sequelize } = require('./models');
const { injectNavigation } = require('./middleware/navigation');
const {
  normalizeURLs,
  addPerformanceHeaders,
  logSEOMetrics,
  injectSEODefaults,
  injectOrganizationSchema,
  processContentSEO
} = require('./middleware/seo');
const routes = require('./routes');
const { startCronJobs } = require('./services/cronService');
const sitemapService = require('./services/sitemapService');

const app = express();
const PORT = process.env.PORT || serverConfig.port || 3000;

// Auto-detect BASE_PATH from URL structure or environment
const BASE_PATH = (() => {
  // Check if running in a subdirectory (e.g., /var/www/html/koncert24/)
  const envBasePath = serverConfig.basePath;

  if (envBasePath && envBasePath !== '/') {
    return envBasePath.startsWith('/') ? envBasePath : `/${envBasePath}`;
  }

  // Default to root path for standalone deployment
  return '/';
})();

// ⚙️ SETTINGS MIDDLEWARE - MUST BE FIRST to populate res.locals!
app.use(async (req, res, next) => {
  // Initialize res.locals values
  res.locals.siteName = res.locals.siteName || '';
  res.locals.siteDomain = res.locals.siteDomain || '';
  res.locals.siteEmail = res.locals.siteEmail || '';
  res.locals.sitePhone = res.locals.sitePhone || '';
  res.locals.basePath = BASE_PATH;
  res.locals.currentPath = req.path;  // Exit popup exclusion check needs this
  res.locals.currentYear = new Date().getFullYear();
  res.locals.flatSettings = res.locals.flatSettings || {}; // Exit popup settings needs this
  res.locals.isLoggedIn = Boolean(req.session && req.session.userId); // Auth status
  res.locals.user = (req.session && req.session.user) || null; // User object
  res.locals.NODE_ENV = process.env.NODE_ENV || 'development'; // Environment for CSS bundles

  try {
    const settings = await loadSettings();
    Object.assign(res.locals, settings);
  } catch (error) {
    logger.warn('Settings load failed, using fallbacks:', error.message);
  }

  next();
});

// CSP (Content Security Policy) constants
const CSP_SELF = "'self'";
const CSP_UNSAFE_INLINE = "'unsafe-inline'";
const CSP_GOOGLE_TAG_MANAGER = 'https://www.googletagmanager.com';
const CSP_GOOGLE_ANALYTICS = 'https://www.google-analytics.com';
const CSP_GOOGLE = 'https://www.google.com';
const CSP_GSTATIC = 'https://www.gstatic.com';

// Trust proxy - MUST BE BEFORE rate limiting and helmet
// This ensures req.ip correctly identifies the client IP behind reverse proxy/Passenger
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [CSP_SELF, 'http:', 'https:', 'data:', 'blob:', CSP_UNSAFE_INLINE],
      styleSrc: [CSP_SELF, CSP_UNSAFE_INLINE, 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: [CSP_SELF, 'https://fonts.gstatic.com'],
      scriptSrc: [
        CSP_SELF, "'unsafe-eval'", CSP_UNSAFE_INLINE,
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        CSP_GOOGLE_TAG_MANAGER,
        CSP_GOOGLE_ANALYTICS,
        CSP_GOOGLE,
        CSP_GSTATIC
      ],
      scriptSrcAttr: [CSP_UNSAFE_INLINE],
      imgSrc: [
        CSP_SELF, 'data:',
        CSP_GOOGLE_TAG_MANAGER,
        CSP_GOOGLE_ANALYTICS,
        CSP_GOOGLE,
        CSP_GSTATIC,
        'https:'
      ],
      connectSrc: [
        CSP_SELF,
        'https://cdn.jsdelivr.net',
        CSP_GOOGLE_ANALYTICS,
        CSP_GOOGLE_TAG_MANAGER,
        CSP_GOOGLE,
        CSP_GSTATIC
      ],
      frameSrc: [
        CSP_GOOGLE_TAG_MANAGER,
        CSP_GOOGLE
      ]
    }
  }
}));

// Rate limiting - v6.11.2 (Node 16 compatible)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: serverConfig.isProduction ? 500 : 2000,
  message: 'Túl sok kérés érkezett erről az IP címről, kérjük próbálja újra később.',
  standardHeaders: true,
  legacyHeaders: false,
  // Skip for development
  skip: () => serverConfig.isDevelopment
});

app.use(limiter);

// Compression
app.use(compression());

// Cookie Parser (CSRF előtt kell!)
app.use(cookieParser());

// HTTP request logging with smart filtering
const pinoHttp = require('pino-http')({
  logger,
  // Custom serializers for cleaner logs
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Only log query params if they exist
      query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
      // Only log params if they exist
      params: Object.keys(req.params || {}).length > 0 ? req.params : undefined,
      // Simplified headers (only important ones)
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        referer: req.headers.referer,
        'accept-language': req.headers['accept-language']
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort
    }),
    res: (res) => ({
      statusCode: res.statusCode
      // Headers are already serialized by pino - can't call res.getHeader()
    })
  },
  // Custom log level based on status code
  customLogLevel: (req, res, err) => {
    if (err) {
      return 'error';
    }
    if (res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    // Don't log 304 Not Modified responses (cache hits)
    if (res.statusCode === 304) {
      return 'silent';
    }
    // Don't log successful static asset requests
    if (res.statusCode === 200 && req.url.match(/\.(css|js|jpg|jpeg|png|gif|ico|woff|woff2|ttf|svg)$/)) {
      return 'silent';
    }
    return 'info';
  },
  // Reduced success message
  customSuccessMessage: (req, res) => {
    if (res.statusCode === 304) {
      return null; // Don't log message
    }
    return `${req.method} ${req.url}`;
  }
});
app.use(pinoHttp);

// 🛡️ ADVANCED SECURITY MIDDLEWARE 🛡️
// IP Reputation Check (blacklist)
app.use(ipReputationCheck);

// Suspicious Pattern Detection
app.use(suspiciousPatternDetection);

// HTTP Parameter Pollution Protection
app.use(hppProtection);

// Request Size Limit (DoS védelem)
app.use(requestSizeLimit(10)); // 10MB max

// Additional Security Headers
app.use(additionalSecurityHeaders);

// Session configuration
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'Sessions'
});

app.use(session({
  secret: serverConfig.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: serverConfig.isProduction,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: serverConfig.sessionMaxAge
  },
  name: 'koncert24.sid',
  rolling: true,
  proxy: serverConfig.isProduction
}));

// View engine setup
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(APP_ROOT, 'views'));

// 🛡️ Security View Helpers for EJS 🛡️
const { csrfField, csrfMeta, csrfScript, securityHeaders } = require('./middleware/securityHelpers');
app.use((req, res, next) => {
  res.locals.csrfField = csrfField;
  res.locals.csrfMeta = csrfMeta;
  res.locals.csrfScript = csrfScript;
  res.locals.securityHeaders = securityHeaders;
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🛡️ INPUT VALIDATION & SANITIZATION 🛡️
// XSS Protection (HTML/JS injection)
app.use(xssProtection);

// SQL Injection Protection
app.use(sqlInjectionProtection);

// NoSQL Injection Protection (MongoDB operator injection)
app.use(noSQLProtection);

// 🛡️ CSRF Token Generation 🛡️
app.use(csrfTokenMiddleware);

// SEO middleware-ek
app.use(normalizeURLs);           // URL normalizálás (először!)
app.use(addPerformanceHeaders);   // Performance hints
app.use(logSEOMetrics);           // SEO analytics logging

// Static files - BASE_PATH aware with pre-compressed file support
const publicPath = path.join(APP_ROOT, 'public');

// Serve pre-compressed files (Brotli, Gzip) if available
app.use(BASE_PATH, expressStaticGzip(publicPath, {
  enableBrotli: true,
  orderPreference: ['br', 'gz'], // Prefer Brotli over Gzip
  index: false, // Don't try to serve index.html for directory requests
  serveStatic: {
    maxAge: '1y', // Cache static assets for 1 year
    index: false, // Don't serve index files
    setHeaders: (res, filePath) => {
      // CSS and JS files get strong caching
      if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }
}));

// Make BASE_PATH and app info available in templates
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  res.locals.currentPath = req.path;
  res.locals.appRoot = APP_ROOT;
  res.locals.fullUrl = `${req.protocol}://${req.get('host')}${BASE_PATH}`;
  res.locals.relativePath = (urlPath) => {
    // Helper function to create relative paths
    const cleanBasePath = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
    const cleanUrlPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;

    return cleanBasePath + cleanUrlPath;
  };
  next();
});

// Helper function to load settings
async function loadSettings() {
  const settingsService = require('./services/settingsService');
  const siteName = await settingsService.get('general.site_name');
  const siteDomain = await settingsService.get('general.domain');
  const companyName = await settingsService.get('company.name');
  const companyPhone = await settingsService.get('company.phone');
  const companyEmail = await settingsService.get('company.email');

  // Make all settings available as flatSettings (for GTM, etc.)
  const grouped = await settingsService.getAllGrouped();
  const flatSettings = {};
  for (const category in grouped) {
    for (const setting of grouped[category]) {
      flatSettings[setting.key] = setting.value;
    }
  }

  return { siteName, siteDomain, companyName, companyPhone, companyEmail, flatSettings };
}

// 🧪 DEBUG TEST ROUTE - Check if settings middleware ran
app.get('/test-settings', (req, res) => {
  res.json({
    message: 'Settings middleware test',
    siteDomain: res.locals.siteDomain,
    siteName: res.locals.siteName,
    allLocals: Object.keys(res.locals)
  });
});

// Inject navigation categories
// Set up global template variables
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  res.locals.currentPath = req.path;
  next();
});

// Navigation middleware
app.use(injectNavigation);

// SEO middleware-ek (navigation után)
app.use(injectSEODefaults);       // SEO alapértelmezések
app.use(injectOrganizationSchema); // Organization schema
app.use(processContentSEO);       // Content feldolgozás

// User locals middleware (role-based access for templates)
const { setupUserLocals } = require('./middleware/auth');
app.use(setupUserLocals);

// 🛡️ CSRF Protection on sensitive routes 🛡️
const { applyCsrfProtection, csrfErrorHandler } = require('./middleware/csrfProtectedRoutes');
app.use(applyCsrfProtection);

// Routes
app.use(BASE_PATH, routes);
app.use(`${BASE_PATH}api/email`, require('./routes/api'));
app.use(`${BASE_PATH}api/chat`, require('./routes/api-chat'));
app.use(`${BASE_PATH}ajanlat`, require('./routes/quote'));
app.use(`${BASE_PATH}foglalas`, require('./routes/booking'));

// 🛡️ CSRF Error Handler 🛡️
app.use(csrfErrorHandler);

// Error handling middleware
app.use((err, req, res, _next) => {
  logger.error(
    {
      err,
      service: 'server',
      operation: 'globalErrorHandler',
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    },
    'Unhandled application error'
  );

  // JSON response for AJAX requests
  const isAjax = req.xhr
    || req.headers['content-type']?.includes('application/json')
    || req.headers.accept?.includes('application/json');

  if (isAjax) {
    return res.status(500).json({
      success: false,
      message: 'Váratlan hiba történt. Kérjük, próbálja újra később.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // HTML response for regular requests
  res.status(500).render('error', {
    title: 'Hiba történt',
    message: 'Váratlan hiba történt. Kérjük, próbálja újra később.',
    statusCode: 500,
    basePath: BASE_PATH,
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Az oldal nem található',
    message: 'A keresett oldal nem található.',
    statusCode: 404,
    basePath: BASE_PATH,
    error: {}
  });
});

// ============================================
// INFRASTRUCTURE ALERT SYSTEM - Process Error Handlers
// ============================================
const infrastructureAlertService = require('./services/infrastructureAlertService');

// Uncaught exceptions - CRITICAL
process.on('uncaughtException', async (err) => {
  logger.fatal({
    err,
    service: 'server',
    operation: 'uncaughtException',
    stack: err.stack
  }, 'Uncaught exception - app will exit');

  try {
    // Send critical error alert
    await infrastructureAlertService.alertCriticalError(err, 'UNCAUGHT_EXCEPTION');
  } catch (alertError) {
    logger.error({ err: alertError }, 'Failed to send uncaught exception alert');
  }

  // Exit process (PM2 will restart)
  process.exit(1);
});

// Unhandled promise rejections - CRITICAL
process.on('unhandledRejection', async (reason, promise) => {
  logger.fatal({
    reason,
    promise,
    service: 'server',
    operation: 'unhandledRejection'
  }, 'Unhandled promise rejection');

  try {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    await infrastructureAlertService.alertCriticalError(error, 'UNHANDLED_REJECTION');
  } catch (alertError) {
    logger.error({ err: alertError }, 'Failed to send unhandled rejection alert');
  }

  // Don't exit immediately for promise rejections (give PM2 a chance)
  // but log and alert
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info({
    service: 'server',
    operation: 'shutdown',
    signal: 'SIGTERM'
  }, 'SIGTERM received, shutting down gracefully');
  if (global.httpServer) {
    global.httpServer.close(() => {
      logger.info({
        service: 'server',
        operation: 'shutdown',
        status: 'closed'
      }, 'HTTP server closed');
    });
  }
});

process.on('SIGINT', () => {
  logger.info({
    service: 'server',
    operation: 'shutdown',
    signal: 'SIGINT'
  }, 'SIGINT received, shutting down gracefully');

  // Graceful shutdown - ez normális leállítás, nem hiba
  process.exit(0);
});

// Start server
/**
 * Start the Express server with database connection and middleware setup
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info({
      service: 'server',
      operation: 'startup',
      component: 'database'
    }, 'Database connection established successfully');

    // Sync session store
    await sessionStore.sync();
    logger.info({
      service: 'server',
      operation: 'startup',
      component: 'sessionStore'
    }, 'Session store synchronized');

    // Start cron jobs
    startCronJobs();
    logger.info({
      service: 'server',
      operation: 'startup',
      component: 'cronJobs'
    }, 'Cron jobs started');

    // Start connection rotation service (1 óránként)
    const connectionRotation = new ConnectionRotationService(sequelize, 3600000);
    connectionRotation.start();
    logger.info({
      service: 'server',
      operation: 'startup',
      component: 'connectionRotation'
    }, 'Connection rotation service started (interval: 1 hour)');

    // Generate initial sitemap
    try {
      await sitemapService.generateSitemap();
      logger.info({
        service: 'server',
        operation: 'startup',
        component: 'sitemap'
      }, 'Initial sitemap generated');

      // Schedule automatic sitemap generation
      await sitemapService.scheduleSitemapGeneration();
      logger.info({
        service: 'server',
        operation: 'startup',
        component: 'sitemapScheduler'
      }, 'Sitemap auto-generation scheduled');
    } catch (error) {
      logger.error('Sitemap initialization failed:', error);
    }

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info({
        service: 'server',
        operation: 'startup',
        port: PORT,
        basePath: BASE_PATH,
        environment: serverConfig.nodeEnv
      }, 'Server started successfully');
    });

    // Store server reference for graceful shutdown
    global.httpServer = server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

// Start server only if this file is run directly (not required as module)
if (require.main === module) {
  startServer().catch((_error) => {
    logger.error('Server startup failed:', _error);
    process.exit(1);
  });
} else if (process.env.NODE_ENV === 'production') {
  // Passenger compatibility: Auto-start in production environment
  // Passenger may not set require.main correctly, so we check for production
  setTimeout(() => {
    if (!global.httpServer) {
      startServer().catch((_error) => {
        logger.error('Passenger server startup failed:', _error);
        process.exit(1);
      });
    }
  }, 100);
}

module.exports = app;
