'use strict';

module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    vtigerId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Vtiger Sales Order ID'
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Tárgy'
    },
    performanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Előadás dátuma'
    },
    performanceTime: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Előadás időpontja'
    },
    performanceLocation: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Előadás helyszíne'
    },
    itemName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Tétel megnevezése'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Állapot (Jóváhagyott, stb.)'
    },
    performerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Kapcsolódó előadó'
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Előadó képének URL-je (Product modulból)'
    },
    rawData: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Teljes Vtiger adat JSON formátumban'
    }
  }, {
    tableName: 'Events',
    timestamps: true
  });

  Event.associate = function (models) {
    Event.belongsTo(models.Performer, {
      foreignKey: 'performerId',
      as: 'performer'
    });
  };

  return Event;
};
