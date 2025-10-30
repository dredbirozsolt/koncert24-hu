'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add all missing form fields to bookings table
    await queryInterface.addColumn('bookings', 'eventAddress', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'Event specific address'
    });

    await queryInterface.addColumn('bookings', 'eventName', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Event name/title'
    });

    await queryInterface.addColumn('bookings', 'eventCategory', {
      type: Sequelize.ENUM(
        'wedding',
        'corporate',
        'birthday',
        'festival',
        'private',
        'other',
        'outdoor_free',
        'outdoor_paid',
        'indoor_free',
        'indoor_paid',
        'private_personal',
        'private_corporate'
      ),
      allowNull: true,
      comment: 'Event category from form'
    });

    await queryInterface.addColumn('bookings', 'companyAddress', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Company headquarters address'
    });

    await queryInterface.addColumn('bookings', 'taxNumber', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Tax number / Tax ID'
    });

    await queryInterface.addColumn('bookings', 'registrationNumber', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Company registration number'
    });

    await queryInterface.addColumn('bookings', 'representative', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Company representative name'
    });

    await queryInterface.addColumn('bookings', 'onSiteContactName', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'On-site contact person name'
    });

    await queryInterface.addColumn('bookings', 'onSiteContactPhone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'On-site contact person phone'
    });

    await queryInterface.addColumn('bookings', 'technicalContactName', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Technical contact person name'
    });

    await queryInterface.addColumn('bookings', 'technicalContactPhone', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Technical contact person phone'
    });

    await queryInterface.addColumn('bookings', 'technicalContactEmail', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Technical contact person email'
    });

    await queryInterface.addColumn('bookings', 'invoiceEmail', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Invoice email address'
    });
  },

  async down(queryInterface, _Sequelize) {
    // Remove all added columns
    const columnsToRemove = [
      'eventAddress',
      'eventName',
      'eventCategory',
      'companyAddress',
      'taxNumber',
      'registrationNumber',
      'representative',
      'onSiteContactName',
      'onSiteContactPhone',
      'technicalContactName',
      'technicalContactPhone',
      'technicalContactEmail',
      'invoiceEmail'
    ];

    for (const column of columnsToRemove) {
      await queryInterface.removeColumn('bookings', column);
    }
  }
};
