/**
 * Quote Model
 * Represents quote requests from potential customers for performer bookings
 */

module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    referenceId: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Format: AJ-YYYY-NNNN'
    },
    performerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'performers',
        key: 'id'
      },
      comment: 'NULL for recommendation quotes without specific performer'
    },
    // Event Details
    eventDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    eventDateFlexible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    eventTime: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    eventLocation: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    eventTypes: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of event types'
    },
    guestCount: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    eventName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    eventCategory: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Budget and Style preferences (for recommendation quotes)
    budget: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Budget in HUF'
    },
    styles: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Array of preferred music/performance styles'
    },
    performerCount: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Number of performers: 1 or multiple'
    },
    // Contact Details
    contactName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Status
    status: {
      type: DataTypes.ENUM('pending', 'contacted', 'confirmed', 'rejected', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false
    }
  }, {
    tableName: 'quotes',
    timestamps: true,
    indexes: [
      {
        fields: ['referenceId']
      },
      {
        fields: ['performerId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  Quote.associate = (models) => {
    Quote.belongsTo(models.Performer, {
      foreignKey: 'performerId',
      as: 'performer'
    });
  };

  return Quote;
};
