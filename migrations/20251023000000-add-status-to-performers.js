'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add status column
    await queryInterface.addColumn('performers', 'status', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Performer status from vTiger (Kiemelt, Népszerű, Kedvezményes, Akciós)',
      after: 'style'
    });

    // Migrate existing data from boolean flags to status
    await queryInterface.sequelize.query(`
      UPDATE performers 
      SET status = CASE
        WHEN isFeatured = 1 THEN 'Kiemelt'
        WHEN isPopular = 1 THEN 'Népszerű'
        WHEN hasDiscount = 1 THEN 'Kedvezményes'
        ELSE NULL
      END
    `);

    // Remove old boolean columns
    await queryInterface.removeColumn('performers', 'isFeatured');
    await queryInterface.removeColumn('performers', 'isPopular');
    await queryInterface.removeColumn('performers', 'hasDiscount');
  },

  down: async (queryInterface, Sequelize) => {
    // Restore boolean columns
    await queryInterface.addColumn('performers', 'isFeatured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Featured/highlighted performer (Kiemelt)'
    });

    await queryInterface.addColumn('performers', 'isPopular', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Popular performer (Népszerű)'
    });

    await queryInterface.addColumn('performers', 'hasDiscount', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Has special discount/promotion (Kedvezményes)'
    });

    // Migrate back from status to boolean flags
    await queryInterface.sequelize.query(`
      UPDATE performers 
      SET 
        isFeatured = CASE WHEN status = 'Kiemelt' THEN 1 ELSE 0 END,
        isPopular = CASE WHEN status = 'Népszerű' THEN 1 ELSE 0 END,
        hasDiscount = CASE WHEN status IN ('Kedvezményes', 'Akciós') THEN 1 ELSE 0 END
    `);

    // Remove status column
    await queryInterface.removeColumn('performers', 'status');
  }
};
