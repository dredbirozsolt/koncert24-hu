/**
 * User Management Routes
 * Admin-only user CRUD operations
 */

const express = require('express');

const logger = require('../config/logger');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { User } = require('../models');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Constants
const LAYOUT_ADMIN = 'layouts/admin';
const USERS_LIST_PATH = '/admin/users';
const USER_NOT_FOUND_MSG = 'Felhasználó nem található';
const VIEW_USER_FORM = 'admin/user-form';
const TITLE_NEW_USER = 'Új Felhasználó';
const TITLE_EDIT_USER = 'Felhasználó Szerkesztése';

/**
 * Helper: Render user form with error
 */
function renderUserFormWithError(res, options) {
  const { title, userData, isEdit, user, errorMsg } = options;
  return res.render(VIEW_USER_FORM, {
    layout: LAYOUT_ADMIN,
    title,
    userData,
    isEdit,
    user,
    messages: { error: errorMsg }
  });
}

/**
 * GET /admin/users
 * List all users with filters
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { role, status, search } = req.query;

    const where = {};

    // Role filter
    if (role && ['client', 'performer', 'admin', 'sales'].includes(role)) {
      where.role = role;
    }

    // Status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // Search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'email', 'phone', 'role', 'isActive', 'emailVerified', 'avatar', 'bio', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    res.render('admin/users', {
      layout: LAYOUT_ADMIN,
      title: 'Felhasználók',
      users,
      filters: { role, status, search },
      user: req.session.user,
      messages: req.session.messages || {}
    });

    // Clear messages
    req.session.messages = {};
  } catch (error) {
    logger.error({ err: error, service: 'adminUsers', operation: 'listUsers' }, 'List users error');
    res.status(500).render('error', {
      title: 'Hiba',
      message: 'Hiba történt a felhasználók betöltése során',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

/**
 * GET /admin/users/new
 * New user form
 */
router.get('/new', requireAdmin, (req, res) => {
  res.render(VIEW_USER_FORM, {
    layout: LAYOUT_ADMIN,
    title: TITLE_NEW_USER,
    userData: {},
    isEdit: false,
    user: req.session.user,
    messages: req.session.messages || {}
  });

  req.session.messages = {};
});

/**
 * POST /admin/users
 * Create new user
 */
router.post('/',
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Név megadása kötelező'),
    body('email').isEmail().withMessage('Érvényes email cím megadása kötelező'),
    body('phone').trim().notEmpty().withMessage('Telefonszám megadása kötelező'),
    body('password').isLength({ min: 6 }).withMessage('Jelszó minimum 6 karakter'),
    body('role').isIn(['client', 'performer', 'admin', 'sales']).withMessage('Érvényes szerepkör megadása kötelező')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.render(VIEW_USER_FORM, {
          layout: LAYOUT_ADMIN,
          title: TITLE_NEW_USER,
          userData: req.body,
          isEdit: false,
          user: req.session.user,
          messages: { error: errors.array()[0].msg }
        });
      }

      const { name, email, phone, password, role, avatar, bio } = req.body;
      const isActive = req.body.isActive === 'on';

      // Check if email exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.render(VIEW_USER_FORM, {
          layout: LAYOUT_ADMIN,
          title: TITLE_NEW_USER,
          userData: req.body,
          isEdit: false,
          user: req.session.user,
          messages: { error: 'Ez az email cím már használatban van' }
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      await User.create({
        name,
        email,
        phone,
        password: hashedPassword,
        role,
        isActive,
        avatar: avatar || null,
        bio: bio || null,
        emailVerified: true // Admin created users are pre-verified
      });

      req.session.messages = { success: 'Felhasználó sikeresen létrehozva' };
      return res.redirect(USERS_LIST_PATH);
    } catch (error) {
      logger.error(
        { err: error, service: 'adminUsers', operation: 'createUser', email: req.body.email },
        'Create user error'
      );
      return res.render(VIEW_USER_FORM, {
        title: TITLE_NEW_USER,
        userData: req.body,
        isEdit: false,
        user: req.session.user,
        messages: { error: 'Hiba történt a felhasználó létrehozása során' }
      });
    }
  }
);

/**
 * GET /admin/users/:id/edit
 * Edit user form
 */
router.get('/:id/edit', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await User.findByPk(id, {
      attributes: ['id', 'name', 'email', 'phone', 'role', 'isActive', 'emailVerified', 'avatar', 'bio']
    });

    if (!userData) {
      req.session.messages = { error: USER_NOT_FOUND_MSG };
      return res.redirect(USERS_LIST_PATH);
    }

    res.render(VIEW_USER_FORM, {
      layout: LAYOUT_ADMIN,
      title: TITLE_EDIT_USER,
      userData,
      isEdit: true,
      user: req.session.user,
      messages: req.session.messages || {}
    });

    req.session.messages = {};
  } catch (error) {
    logger.error({ err: error, service: 'adminUsers', operation: 'getUser', userId: req.params.id }, 'Get user error');
    req.session.messages = { error: 'Hiba történt a felhasználó betöltése során' };
    return res.redirect(USERS_LIST_PATH);
  }
});

/**
 * POST /admin/users/:id
 * Update user
 */
router.post('/:id',
  requireAdmin,
  [
    body('name').trim().notEmpty().withMessage('Név megadása kötelező'),
    body('email').isEmail().withMessage('Érvényes email cím megadása kötelező'),
    body('phone').trim().notEmpty().withMessage('Telefonszám megadása kötelező'),
    body('password').optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage('Jelszó minimum 6 karakter'),
    body('role').isIn(['client', 'performer', 'admin', 'sales']).withMessage('Érvényes szerepkör megadása kötelező')
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const errors = validationResult(req);

      const userData = await User.findByPk(id);

      if (!userData) {
        req.session.messages = { error: USER_NOT_FOUND_MSG };
        return res.redirect(USERS_LIST_PATH);
      }

      if (!errors.isEmpty()) {
        return renderUserFormWithError(res, {
          title: TITLE_EDIT_USER,
          userData: { id, ...req.body },
          isEdit: true,
          user: req.session.user,
          errorMsg: errors.array()[0].msg
        });
      }

      const { name, email, phone, password, role, avatar, bio } = req.body;
      const isActive = req.body.isActive === 'on';

      const emailTaken = await checkEmailTaken(email, userData.email);
      if (emailTaken) {
        return renderUserFormWithError(res, {
          title: TITLE_EDIT_USER,
          userData: { id, ...req.body },
          isEdit: true,
          user: req.session.user,
          errorMsg: 'Ez az email cím már használatban van'
        });
      }

      await updateUserData(userData, { name, email, phone, role, isActive, password, avatar, bio });

      req.session.messages = { success: 'Felhasználó sikeresen frissítve' };
      return res.redirect(USERS_LIST_PATH);
    } catch (error) {
      logger.error(
        { err: error, service: 'adminUsers', operation: 'updateUser', userId: req.params.id },
        'Update user error'
      );
      return renderUserFormWithError(res, {
        title: TITLE_EDIT_USER,
        userData: { id: req.params.id, ...req.body },
        isEdit: true,
        user: req.session.user,
        errorMsg: 'Hiba történt a felhasználó frissítése során'
      });
    }
  }
);

/**
 * Helper: Check if email is taken by another user
 */
async function checkEmailTaken(newEmail, currentEmail) {
  if (newEmail === currentEmail) {
    return false;
  }
  const existingUser = await User.findOne({ where: { email: newEmail } });
  return existingUser !== null;
}

/**
 * Helper: Update user data
 */
async function updateUserData(userData, data) {
  userData.name = data.name;
  userData.email = data.email;
  userData.phone = data.phone;
  userData.role = data.role;
  userData.isActive = data.isActive;

  // Blog author fields
  if (data.avatar !== undefined) {
    userData.avatar = data.avatar || null;
  }
  if (data.bio !== undefined) {
    userData.bio = data.bio || null;
  }

  if (data.password && data.password.trim() !== '') {
    userData.password = await bcrypt.hash(data.password, 12);
  }

  await userData.save();
}

/**
 * POST /admin/users/:id/toggle
 * Toggle user active status
 */
router.post('/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await User.findByPk(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: USER_NOT_FOUND_MSG
      });
    }

    userData.isActive = !userData.isActive;
    await userData.save();

    return res.json({
      success: true,
      message: `Felhasználó ${userData.isActive ? 'aktiválva' : 'deaktiválva'}`,
      isActive: userData.isActive
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminUsers', operation: 'toggleUser', userId: req.params.id },
      'Toggle user error'
    );
    return res.status(500).json({
      success: false,
      message: 'Hiba történt a művelet során'
    });
  }
});

/**
 * POST /admin/users/:id/toggle-active
 * Toggle user active status (AJAX endpoint for edit form)
 */
router.post('/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const userData = await User.findByPk(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: USER_NOT_FOUND_MSG
      });
    }

    userData.isActive = isActive;
    await userData.save();

    return res.json({
      success: true,
      message: `Felhasználó ${isActive ? 'aktiválva' : 'deaktiválva'}`,
      isActive: userData.isActive
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminUsers', operation: 'toggleActive', userId: req.params.id },
      'Toggle active error'
    );
    return res.status(500).json({
      success: false,
      message: 'Hiba történt a mentés során'
    });
  }
});

/**
 * POST /admin/users/:id/delete
 * Delete user
 */
router.post('/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (parseInt(id, 10) === req.session.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Nem törölheted a saját fiókodat'
      });
    }

    const userData = await User.findByPk(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: USER_NOT_FOUND_MSG
      });
    }

    await userData.destroy();

    return res.json({
      success: true,
      message: 'Felhasználó sikeresen törölve'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminUsers', operation: 'deleteUser', userId: req.params.id },
      'Delete user error'
    );
    return res.status(500).json({
      success: false,
      message: 'Hiba történt a törlés során'
    });
  }
});

// Multer configuration for avatar upload
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: avatar-userid-timestamp.ext
    const ext = path.extname(file.originalname);
    const filename = `avatar-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Csak képfájlok engedélyezettek (JPEG, PNG, GIF, WebP)!'));
  }
});

/**
 * Helper: Delete old avatar file
 */
async function deleteOldAvatarFile(oldAvatarPath) {
  if (oldAvatarPath && oldAvatarPath.startsWith('/uploads/avatars/')) {
    const oldAvatarFilePath = path.join(process.cwd(), 'public', oldAvatarPath);
    try {
      await fs.unlink(oldAvatarFilePath);
    } catch (unlinkError) {
      logger.warn(
        { service: 'adminUsers', oldAvatarPath, error: unlinkError.message },
        'Old avatar file deletion failed'
      );
    }
  }
}

/**
 * Helper: Cleanup uploaded file on error
 */
async function cleanupUploadedFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (unlinkError) {
    logger.error(
      { err: unlinkError, service: 'adminUsers', filePath },
      'Failed to delete uploaded file'
    );
  }
}

/**
 * POST /admin/users/:id/upload-avatar
 * Upload user avatar
 */
router.post('/:id/upload-avatar', requireAdmin, avatarUpload.single('userAvatar'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nincs feltöltött fájl'
      });
    }

    const userData = await User.findByPk(id);

    if (!userData) {
      await fs.unlink(req.file.path);
      return res.status(404).json({
        success: false,
        message: USER_NOT_FOUND_MSG
      });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const oldAvatarPath = userData.avatar;

    userData.avatar = avatarPath;
    await userData.save();

    if (oldAvatarPath && oldAvatarPath !== avatarPath) {
      await deleteOldAvatarFile(oldAvatarPath);
    }

    res.json({
      success: true,
      message: 'Avatar sikeresen feltöltve',
      avatarPath
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminUsers', operation: 'uploadAvatar', userId: req.params.id },
      'Avatar upload error'
    );

    if (req.file) {
      await cleanupUploadedFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Avatar feltöltése sikertelen'
    });
  }
});

/**
 * DELETE /admin/users/:id/delete-avatar
 * Delete user avatar
 */
router.delete('/:id/delete-avatar', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await User.findByPk(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: USER_NOT_FOUND_MSG
      });
    }

    if (!userData.avatar) {
      return res.json({
        success: true,
        message: 'Nincs törölhető avatar'
      });
    }

    const avatarFilePath = path.join(process.cwd(), 'public', userData.avatar);

    // Delete the file if it's in the uploads/avatars directory
    if (userData.avatar.startsWith('/uploads/avatars/')) {
      try {
        await fs.unlink(avatarFilePath);
      } catch (unlinkError) {
        logger.warn(
          { service: 'adminUsers', avatarFilePath, error: unlinkError.message },
          'Avatar file deletion failed'
        );
      }
    }

    // Clear the avatar field
    userData.avatar = null;
    await userData.save();

    res.json({
      success: true,
      message: 'Avatar sikeresen törölve'
    });
  } catch (error) {
    logger.error(
      { err: error, service: 'adminUsers', operation: 'deleteAvatar', userId: req.params.id },
      'Avatar deletion error'
    );
    res.status(500).json({
      success: false,
      message: error.message || 'Avatar törlése sikertelen'
    });
  }
});

module.exports = router;

module.exports = router;
