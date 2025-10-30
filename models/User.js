const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [6, 20]
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('client', 'performer', 'admin', 'sales'),
    allowNull: false,
    defaultValue: 'client',
    comment: 'client = Megrendelő/szervező, performer = Előadó/manager, admin = Adminisztrátor, sales = Értékesítő'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetToken: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  pendingEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'New email address pending verification'
  },
  oldEmailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Token for verifying old email during email change'
  },
  newEmailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Token for verifying new email during email change'
  },
  emailChangeVerifiedOld: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Old email verified during change process'
  },
  emailChangeVerifiedNew: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'New email verified during change process'
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of failed login attempts'
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Account locked until this time'
  },
  lastLoginAttempt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Timestamp of last login attempt'
  },
  // Password reset rate limiting fields
  passwordResetAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of password reset attempts in the current window'
  },
  passwordResetWindowStart: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Start time of password reset rate limit window'
  },
  // Blog author fields
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Avatar image URL for blog author'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Author biography for blog posts'
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  },
  indexes: [
    { fields: ['email'], unique: true },
    { fields: ['role'] },
    { fields: ['isActive'] },
    { fields: ['emailVerificationToken'] },
    { fields: ['passwordResetToken'] }
  ]
});

// Instance methods
User.prototype.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.getRoleDisplayName = function () {
  const roleNames = {
    client: 'Megrendelő, szervező',
    performer: 'Előadó, manager',
    admin: 'Adminisztrátor',
    sales: 'Értékesítő'
  };
  return roleNames[this.role] || this.role;
};

User.prototype.isAdmin = function () {
  return this.role === 'admin';
};

User.prototype.isSales = function () {
  return this.role === 'sales';
};

User.prototype.canAccessAdminPanel = function () {
  return this.role === 'admin' || this.role === 'sales';
};

User.prototype.canManageUsers = function () {
  return this.role === 'admin';
};

User.prototype.canViewAllChats = function () {
  return this.role === 'admin' || this.role === 'sales';
};

User.prototype.canViewPrices = function () {
  return this.isActive && this.emailVerified;
};

// Account lockout methods
User.prototype.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

User.prototype.incrementLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < new Date()) {
    return await this.update({
      loginAttempts: 1,
      lockUntil: null,
      lastLoginAttempt: new Date()
    });
  }

  // Increment attempts
  const updates = {
    loginAttempts: this.loginAttempts + 1,
    lastLoginAttempt: new Date()
  };

  // Lock account after 5 failed attempts (30 minutes lock)
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

  if (this.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
    updates.lockUntil = new Date(Date.now() + LOCK_TIME);
  }

  return await this.update(updates);
};

User.prototype.resetLoginAttempts = async function () {
  return await this.update({
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAttempt: null
  });
};

User.prototype.updateLastLogin = async function () {
  return await this.update({
    lastLoginAt: new Date()
  });
};

// Password reset rate limiting methods
User.prototype.canRequestPasswordReset = function () {
  const MAX_RESET_ATTEMPTS = 3;
  const RESET_WINDOW = 60 * 60 * 1000; // 1 hour

  if (!this.passwordResetWindowStart) {
    return true;
  }

  const windowExpired = new Date() - new Date(this.passwordResetWindowStart) > RESET_WINDOW;

  if (windowExpired) {
    return true;
  }

  return this.passwordResetAttempts < MAX_RESET_ATTEMPTS;
};

User.prototype.incrementPasswordResetAttempts = async function () {
  const RESET_WINDOW = 60 * 60 * 1000; // 1 hour
  const now = new Date();

  // Start new window if no window exists or window expired
  if (!this.passwordResetWindowStart
      || (now - new Date(this.passwordResetWindowStart) > RESET_WINDOW)) {
    return await this.update({
      passwordResetAttempts: 1,
      passwordResetWindowStart: now
    });
  }

  // Increment attempts in current window
  return await this.update({
    passwordResetAttempts: this.passwordResetAttempts + 1
  });
};

User.prototype.resetPasswordResetAttempts = async function () {
  return await this.update({
    passwordResetAttempts: 0,
    passwordResetWindowStart: null
  });
};

User.prototype.toSafeJSON = function () {
  const values = Object.assign({}, this.get());
  delete values.password;
  delete values.emailVerificationToken;
  delete values.passwordResetToken;
  return values;
};

// Class methods
User.findByEmail = function (email) {
  return this.findOne({
    where: {
      email: email.toLowerCase(),
      isActive: true
    }
  });
};

User.generateVerificationToken = function () {
  return require('crypto').randomBytes(32).toString('hex');
};

module.exports = User;
