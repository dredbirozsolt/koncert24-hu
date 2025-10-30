const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Location', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  nameEn: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'name_en'
  },
  countryCode: {
    type: DataTypes.CHAR(2),
    allowNull: false,
    field: 'country_code'
  },
  countryName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'country_name'
  },
  adminLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'admin_level'
  },
  placeType: {
    type: DataTypes.ENUM('city', 'town', 'village', 'hamlet'),
    allowNull: false,
    defaultValue: 'city',
    field: 'place_type'
  },
  population: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true
  },
  osmId: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'osm_id'
  }
}, {
  tableName: 'locations',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['country_code']
    },
    {
      fields: ['place_type']
    },
    {
      fields: ['population']
    },
    {
      fields: ['country_code', 'place_type', 'name']
    }
  ]
});
