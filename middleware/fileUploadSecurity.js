/**
 * File Upload Security Middleware
 * Enhanced security for file uploads with multiple validation layers
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Allowed MIME types and their corresponding file extensions
 * Double check - both MIME type AND extension must match
 */
const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],

  // Documents (if needed in future)
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
};

/**
 * Maximum file sizes per file type (in bytes)
 */
const MAX_FILE_SIZES = {
  'image/jpeg': 5 * 1024 * 1024,  // 5MB
  'image/png': 5 * 1024 * 1024,   // 5MB
  'image/gif': 2 * 1024 * 1024,   // 2MB
  'image/webp': 5 * 1024 * 1024,  // 5MB
  'image/svg+xml': 512 * 1024,    // 512KB
  'application/pdf': 10 * 1024 * 1024  // 10MB
};

/**
 * Dangerous file extensions that should never be allowed
 */
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.php', '.phtml', '.php3', '.php4', '.php5',
  '.asp', '.aspx', '.jsp', '.jspx', '.cgi', '.pl', '.py', '.rb',
  '.js', '.vbs', '.dll', '.so', '.dylib', '.app', '.deb', '.rpm',
  '.msi', '.dmg', '.pkg', '.bin', '.com', '.pif', '.application',
  '.gadget', '.hta', '.cpl', '.msc', '.jar', '.scr', '.lnk', '.inf'
];

/**
 * Magic bytes for file type detection
 * First few bytes of common file types
 */
const FILE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]] // %PDF
};

/**
 * Generate a cryptographically secure random filename
 * @param {string} originalname - Original filename
 * @returns {string} Secure random filename with original extension
 */
function generateSecureFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${randomName}-${timestamp}${ext}`;
}

/**
 * Validate file extension against MIME type
 * @param {string} filename - Filename to validate
 * @param {string} mimetype - MIME type from multer
 * @returns {boolean} True if valid, false otherwise
 */
function validateFileExtension(filename, mimetype) {
  const ext = path.extname(filename).toLowerCase();

  // Check if extension is dangerous
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Check if MIME type is allowed
  const allowedExtensions = ALLOWED_FILE_TYPES[mimetype];
  if (!allowedExtensions) {
    return false;
  }

  // Check if extension matches MIME type
  return allowedExtensions.includes(ext);
}

/**
 * Validate file size based on MIME type
 * @param {number} size - File size in bytes
 * @param {string} mimetype - MIME type
 * @returns {boolean} True if valid, false otherwise
 */
function validateFileSize(size, mimetype) {
  const maxSize = MAX_FILE_SIZES[mimetype];
  if (!maxSize) {
    return false; // Unknown MIME type
  }
  return size <= maxSize;
}

/**
 * Check file signature (magic bytes) to verify actual file type
 * Prevents file type spoofing via extension/MIME type manipulation
 * @param {string} filepath - Path to uploaded file
 * @param {string} expectedMimetype - Expected MIME type
 * @returns {Promise<boolean>} True if signature matches, false otherwise
 */
async function validateFileSignature(filepath, expectedMimetype) {
  try {
    // Read first 16 bytes of file
    const fileHandle = await fs.open(filepath, 'r');
    const buffer = Buffer.alloc(16);
    await fileHandle.read(buffer, 0, 16, 0);
    await fileHandle.close();

    const signatures = FILE_SIGNATURES[expectedMimetype];
    if (!signatures) {
      // No signature check available for this type
      return true;
    }

    // Check if file starts with any of the allowed signatures
    return signatures.some((signature) => {
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          return false;
        }
      }
      return true;
    });
  } catch (error) {
    logger.error({ err: error, context: 'fileSignatureValidation' }, 'Error validating file signature');
    return false;
  }
}

/**
 * Sanitize filename - remove dangerous characters
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove path traversal attempts
  let safe = path.basename(filename);

  // Remove or replace dangerous characters
  // eslint-disable-next-line no-control-regex
  safe = safe.replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Replace spaces and special chars with underscores
  safe = safe.replace(/[^\w.-]/g, '_');

  // Remove multiple consecutive underscores
  safe = safe.replace(/_+/g, '_');

  // Limit filename length (without extension)
  const ext = path.extname(safe);
  const name = path.basename(safe, ext);
  const maxLength = 100;

  if (name.length > maxLength) {
    return name.substring(0, maxLength) + ext;
  }

  return safe;
}

/**
 * Multer file filter with enhanced security checks
 * @param {Object} allowedMimeTypes - Object mapping MIME types to extensions
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Function} Multer fileFilter function
 */
function createSecureFileFilter(allowedMimeTypes = ALLOWED_FILE_TYPES, _maxSize = 5 * 1024 * 1024) {
  return (req, file, cb) => {
    const filename = file.originalname;
    const { mimetype } = file;

    // Step 1: Validate MIME type is allowed
    if (!allowedMimeTypes[mimetype]) {
      return cb(new Error(`Fájltípus nem engedélyezett: ${mimetype}`));
    }

    // Step 2: Validate extension matches MIME type
    if (!validateFileExtension(filename, mimetype)) {
      return cb(new Error('Fájl kiterjesztés nem egyezik a MIME type-pal'));
    }

    // Step 3: Check for dangerous extensions
    const ext = path.extname(filename).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Veszélyes fájl kiterjesztés: ${ext}`));
    }

    // Step 4: Sanitize filename and store for later use
    file.sanitizedName = sanitizeFilename(filename);

    // All checks passed
    cb(null, true);
  };
}

/**
 * Post-upload validation middleware
 * Validates file signature after upload
 * Use this AFTER multer middleware
 */
async function validateUploadedFile(req, res, next) {
  if (!req.file) {
    return next(); // No file uploaded, skip validation
  }

  try {
    const { path: filepath, mimetype, size } = req.file;

    // Validate file size (double check)
    if (!validateFileSize(size, mimetype)) {
      await fs.unlink(filepath); // Delete invalid file
      return res.status(400).json({
        error: 'A fájl mérete túl nagy a típusához képest'
      });
    }

    // Validate file signature (magic bytes)
    const signatureValid = await validateFileSignature(filepath, mimetype);
    if (!signatureValid) {
      await fs.unlink(filepath); // Delete invalid file
      return res.status(400).json({
        error: 'A fájl tartalma nem egyezik a megadott típussal (file type spoofing detected)'
      });
    }

    next();
  } catch (error) {
    logger.error({ err: error, context: 'fileValidation', file: req.file }, 'Error in file validation');

    // Delete uploaded file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error({ err: unlinkError, filepath: req.file.path }, 'Error deleting invalid file');
      }
    }

    res.status(500).json({
      error: 'Hiba történt a fájl validáció során'
    });
  }
}

/**
 * Middleware to log file uploads for security audit
 */
function logFileUpload(req, res, next) {
  if (req.file) {
    const { originalname, mimetype, size, filename } = req.file;
    const userId = req.session?.userId || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress;

    logger.info({
      event: 'fileUpload',
      user: userId,
      ip,
      originalName: originalname,
      savedAs: filename,
      mimeType: mimetype,
      sizeKB: (size / 1024).toFixed(2)
    }, 'File uploaded');
  }
  next();
}

module.exports = {
  // Main exports
  createSecureFileFilter,
  validateUploadedFile,
  logFileUpload,

  // Utility functions
  generateSecureFilename,
  sanitizeFilename,
  validateFileExtension,
  validateFileSize,
  validateFileSignature,

  // Constants
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
  DANGEROUS_EXTENSIONS,
  FILE_SIGNATURES
};
