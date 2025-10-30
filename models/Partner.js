'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Partner extends Model {
    static associate(models) {
      // Partner kategória kapcsolat
      Partner.belongsTo(models.PartnerCategory, {
        foreignKey: 'categoryId',
        as: 'category'
      });
    }

    // Aktív partnerek lekérdezése
    static getActivePartners(options = {}) {
      return this.findAll({
        where: { status: 'active' },
        order: [['displayOrder', 'DESC'], ['name', 'ASC']],
        ...options
      });
    }

    // Backlink-kel rendelkezők
    static getPartnersWithBacklink() {
      return this.findAll({
        where: {
          isVerified: true,
          status: 'active',
          backlinkUrl: { [sequelize.Sequelize.Op.not]: null }
        },
        order: [['displayOrder', 'DESC'], ['name', 'ASC']]
      });
    }

    // Kategória szerinti szűrés
    static getByCategory(categoryId) {
      return this.findAll({
        where: { categoryId, status: 'active' },
        include: [{
          model: sequelize.models.PartnerCategory,
          as: 'category'
        }],
        order: [['displayOrder', 'DESC'], ['name', 'ASC']]
      });
    }
  }

  Partner.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A partner neve kötelező' }
      }
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    websiteUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: { msg: 'A weboldal URL kötelező' },
        isUrl: { msg: 'Érvényes URL-t adj meg' }
      }
    },
    backlinkUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'partner_categories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    partnershipType: {
      type: DataTypes.ENUM('reciprocal', 'sponsored', 'organic', 'affiliate'),
      allowNull: false,
      defaultValue: 'organic'
    },
    domainAuthority: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    pageAuthority: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'inactive', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    lastVerified: {
      type: DataTypes.DATE,
      allowNull: true
    },
    contactName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: { msg: 'Érvényes email címet adj meg' }
      }
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    showOnHomepage: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Partner',
    tableName: 'partners',
    timestamps: true,
    underscored: false
  });

  return Partner;
};
