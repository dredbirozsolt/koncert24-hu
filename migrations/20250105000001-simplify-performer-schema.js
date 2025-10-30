'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Hozzáadjuk az új priceListRestriction mezőt
    await queryInterface.addColumn('performers', 'priceListRestriction', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Price list restriction flag (Árlista tiltás)'
    });

    // Eltávolítjuk a szükségtelen mezőket
    await queryInterface.removeColumn('performers', 'phone');
    await queryInterface.removeColumn('performers', 'email');
    await queryInterface.removeColumn('performers', 'website');
    await queryInterface.removeColumn('performers', 'shortDescription');
    await queryInterface.removeColumn('performers', 'videoUrl');
    await queryInterface.removeColumn('performers', 'featuredOrder');
    await queryInterface.removeColumn('performers', 'vatRate');
    await queryInterface.removeColumn('performers', 'contactFirstName');
    await queryInterface.removeColumn('performers', 'contactLastName');
  },

  async down(queryInterface, Sequelize) {
    // Visszaállítjuk az eltávolított mezőket
    await queryInterface.addColumn('performers', 'phone', {
      type: Sequelize.STRING(50),
      allowNull: true
    });

    await queryInterface.addColumn('performers', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('performers', 'website', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('performers', 'shortDescription', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('performers', 'videoUrl', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await queryInterface.addColumn('performers', 'featuredOrder', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Order for featured performers on homepage'
    });

    await queryInterface.addColumn('performers', 'vatRate', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true,
      comment: 'VAT rate percentage (ÁFA %)'
    });

    await queryInterface.addColumn('performers', 'contactFirstName', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Contact person first name'
    });

    await queryInterface.addColumn('performers', 'contactLastName', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Contact person last name'
    });

    // Eltávolítjuk a priceListRestriction mezőt
    await queryInterface.removeColumn('performers', 'priceListRestriction');
  }
};
