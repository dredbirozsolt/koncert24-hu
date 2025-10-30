'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('client', 'performer'),
        allowNull: false,
        defaultValue: 'client',
        comment: 'client = Megrendelő/szervező, performer = Előadó/manager'
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      emailVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      emailVerificationToken: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      passwordResetToken: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      passwordResetExpires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('users', ['email'], {
      unique: true,
      name: 'users_email_unique'
    });

    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_index'
    });

    await queryInterface.addIndex('users', ['isActive'], {
      name: 'users_isActive_index'
    });

    await queryInterface.addIndex('users', ['emailVerificationToken'], {
      name: 'users_emailVerificationToken_index'
    });

    await queryInterface.addIndex('users', ['passwordResetToken'], {
      name: 'users_passwordResetToken_index'
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('users');
  }
};
