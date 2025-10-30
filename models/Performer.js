const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Performer = sequelize.define('Performer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  vtigerId: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: true,
    comment: 'vTiger CRM contact ID'
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: 'Dynamic category from vTiger CRM'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  imageUrl: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Performance duration in minutes'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  priceListRestriction: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Price list restriction flag (Árlista tiltás)'
  },
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last sync from vTiger CRM'
  },
  performanceType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Type of performance (élő, élő ének zenei alapra, etc.)'
  },
  travelCost: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Travel cost per km in Ft'
  },
  travelCostCalculation: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Travel cost calculation base (e.g., Budapest)'
  },
  technicalRequirements: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Technical requirements/rider from VTiger (cf_811)'
  },
  style: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Performance styles as array from vTiger (Stílus)'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Performer status from vTiger (Kiemelt, Népszerű, Kedvezményes, Akciós)'
  }
}, {
  tableName: 'performers',
  timestamps: true,
  indexes: [
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['priceListRestriction'] },
    { fields: ['slug'] },
    { fields: ['vtigerId'] }
  ]
});

// Instance methods
Performer.prototype.getCategoryDisplayName = function () {
  // Most már az adatbázisban a szép nevek vannak tárolva
  return this.category || 'Egyéb';
};

Performer.prototype.getCategorySlug = function () {
  if (!this.category) {
    return 'egyeb';
  }

  // Konvertáljuk URL-barát formátumba
  return this.category
    .toLowerCase()
    .replace(/[áä]/g, 'a')
    .replace(/[éë]/g, 'e')
    .replace(/[íî]/g, 'i')
    .replace(/[óöő]/g, 'o')
    .replace(/[úüű]/g, 'u')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// Static method to get category metadata (icon, description)
Performer.getCategoryMetadata = function (categoryKey) {
  const categoryMetadata = {
    pop: {
      icon: '🎤',
      description: 'Pop előadók és zenekarok'
    },
    'elo-koncertek': {
      icon: '🎸',
      description: 'Élő zenei produkciók és koncertek'
    },
    mulatos: {
      icon: '🎺',
      description: 'Hagyományos mulatós zene'
    },
    gyermekmusor: {
      icon: '🎈',
      description: 'Családi programok és gyermekműsorok'
    },
    humorista: {
      icon: '😄',
      description: 'Stand-up és humor'
    },
    'musical-operett': {
      icon: '🎭',
      description: 'Színház és musical'
    },
    kiegeszito: {
      icon: '🎪',
      description: 'Különleges produkciók'
    }
  };

  return categoryMetadata[categoryKey] || {
    icon: '🎵',
    description: 'Egyéb előadás'
  };
};

module.exports = Performer;
