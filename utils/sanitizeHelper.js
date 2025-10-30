/**
 * Sanitize Helper Utilities
 *
 * mongoSanitize middleware replaces dots (.) with underscores (_) for NoSQL injection protection.
 * This helper provides utilities to safely handle this conversion while maintaining security.
 */

/**
 * Normalizes keys that were sanitized by mongoSanitize
 * Converts underscore back to dot between category and key
 * Handles multi-word categories (like exit_popup, booking_system)
 *
 * @param {Object} obj - Object with sanitized keys
 * @returns {Object} Object with normalized keys
 *
 * @example
 * // Input from mongoSanitize: { general_site_name: "value", exit_popup_enabled: "true" }
 * // Output: { "general.site_name": "value", "exit_popup.enabled": "true" }
 */
function normalizeSettingsKeys(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Known categories that contain underscores (add new ones here as needed)
  // NOTE: Only add categories that are ACTIVELY USED in frontend form field names!
  // Currently unused: 'booking_system' (no form uses it), 'elastic_email' (section removed)
  const multiWordCategories = [
    'exit_popup',         // ✅ ACTIVE: views/admin/exit-popup.ejs uses exit_popup.enabled, exit_popup.trigger_*
    'offline_messages'    // ✅ ACTIVE: views/admin/chat/settings.ejs uses offline_messages.retention_days
    // 'booking_system',  // ⚠️ RESERVED: Not currently used in any frontend form
    // 'elastic_email',   // ❌ REMOVED: Section removed from views/admin/settings.ejs
  ];

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    let normalizedKey = key;

    // Check if key starts with a known multi-word category
    let matched = false;
    for (const category of multiWordCategories) {
      if (key.startsWith(`${category}_`)) {
        // Replace underscore after the category with a dot
        normalizedKey = key.replace(`${category}_`, `${category}.`);
        matched = true;
        break;
      }
    }

    // If no multi-word category matched, use simple replacement (first underscore becomes dot)
    if (!matched && key.includes('_')) {
      normalizedKey = key.replace(/_/, '.');
    }

    normalized[normalizedKey] = value;
  }

  return normalized;
}/**
 * Normalizes nested object keys recursively
 * Useful for complex form data with nested structures
 *
 * @param {Object} obj - Object with potentially nested sanitized keys
 * @returns {Object} Object with normalized keys at all levels
 */
function normalizeNestedKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = key.replace(/_/, '.');

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[normalizedKey] = normalizeNestedKeys(value);
    } else {
      normalized[normalizedKey] = value;
    }
  }

  return normalized;
}

/**
 * Creates a middleware that normalizes request body keys
 * Use this after mongoSanitize for routes that need dot notation in keys
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.nested - Whether to normalize nested objects (default: false)
 * @returns {Function} Express middleware function
 *
 * @example
 * router.post('/settings', normalizeRequestKeys(), async (req, res) => {
 *   // req.body now has normalized keys
 * });
 */
function normalizeRequestKeys(options = {}) {
  const { nested = false } = options;

  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = nested ? normalizeNestedKeys(req.body) : normalizeSettingsKeys(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = nested ? normalizeNestedKeys(req.query) : normalizeSettingsKeys(req.query);
    }

    next();
  };
}

/**
 * Sanitizes a single key (converts dot to underscore)
 * Use this when you need to match sanitized keys from the client
 *
 * @param {string} key - Key to sanitize
 * @returns {string} Sanitized key
 *
 * @example
 * const dbKey = "general.site_name";
 * const sanitizedKey = sanitizeKey(dbKey); // "general_site_name"
 */
function sanitizeKey(key) {
  return key.replace(/\./g, '_');
}

/**
 * Normalizes a single key (converts first underscore to dot)
 *
 * @param {string} key - Sanitized key
 * @returns {string} Normalized key
 *
 * @example
 * const sanitizedKey = "general_site_name";
 * const normalizedKey = normalizeKey(sanitizedKey); // "general.site_name"
 */
function normalizeKey(key) {
  return key.replace(/_/, '.');
}

/**
 * Checks if a key looks like it was sanitized
 *
 * @param {string} key - Key to check
 * @returns {boolean} True if key appears to be sanitized
 */
function isSanitizedKey(key) {
  return typeof key === 'string' && key.includes('_') && !key.includes('.');
}

/**
 * Batch normalizes an array of keys
 *
 * @param {string[]} keys - Array of sanitized keys
 * @returns {string[]} Array of normalized keys
 */
function normalizeKeys(keys) {
  return keys.map(normalizeKey);
}

module.exports = {
  normalizeSettingsKeys,
  normalizeNestedKeys,
  normalizeRequestKeys,
  sanitizeKey,
  normalizeKey,
  isSanitizedKey,
  normalizeKeys
};
