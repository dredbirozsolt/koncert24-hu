// Authentication middleware functions

// Constants
const LOGIN_PATH = '/auth/login';
const ACCESS_DENIED_TITLE = 'Hozzáférés megtagadva';
const ACCESS_DENIED_MESSAGE = 'Nincs jogosultságod ehhez a funkcióhoz';

const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect(LOGIN_PATH);
};

const requireNoAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  next();
};

// Role-based authorization middleware
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;

    // Return JSON for AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({
        success: false,
        message: 'Bejelentkezés szükséges'
      });
    }

    return res.redirect(LOGIN_PATH);
  }

  if (req.session.user.role !== 'admin') {
    // Return JSON for AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        success: false,
        message: ACCESS_DENIED_MESSAGE
      });
    }

    return res.status(403).render('error', {
      title: ACCESS_DENIED_TITLE,
      message: ACCESS_DENIED_MESSAGE,
      statusCode: 403
    });
  }

  next();
};

const requireAdminOrSales = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;

    // Return JSON for AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(401).json({
        success: false,
        message: 'Bejelentkezés szükséges'
      });
    }

    return res.redirect(LOGIN_PATH);
  }

  const { role } = req.session.user;
  if (role !== 'admin' && role !== 'sales') {
    // Return JSON for AJAX requests
    if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
      return res.status(403).json({
        success: false,
        message: ACCESS_DENIED_MESSAGE
      });
    }

    return res.status(403).render('error', {
      title: ACCESS_DENIED_TITLE,
      message: ACCESS_DENIED_MESSAGE,
      statusCode: 403
    });
  }

  next();
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect(LOGIN_PATH);
  }

  if (!allowedRoles.includes(req.session.user.role)) {
    return res.status(403).render('error', {
      title: ACCESS_DENIED_TITLE,
      message: ACCESS_DENIED_MESSAGE,
      statusCode: 403
    });
  }

  next();
};

// Make user available in templates
const setupUserLocals = (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isLoggedIn = Boolean(req.session.user);

  // Role-based helpers
  if (req.session.user) {
    res.locals.isAdmin = req.session.user.role === 'admin';
    res.locals.isSales = req.session.user.role === 'sales';
    res.locals.isPerformer = req.session.user.role === 'performer';
    res.locals.isClient = req.session.user.role === 'client';
    res.locals.canAccessAdminPanel = ['admin', 'sales'].includes(req.session.user.role);
  } else {
    res.locals.isAdmin = false;
    res.locals.isSales = false;
    res.locals.isPerformer = false;
    res.locals.isClient = false;
    res.locals.canAccessAdminPanel = false;
  }

  next();
};

module.exports = {
  requireAuth,
  requireNoAuth,
  requireAdmin,
  requireAdminOrSales,
  requireRole,
  setupUserLocals
};
