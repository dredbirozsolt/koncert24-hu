'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Partner kategóriák tábla létrehozása
    await queryInterface.createTable('partner_categories', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      slug: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      icon: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Font Awesome icon class'
      },
      color: {
        type: Sequelize.STRING(7),
        allowNull: true,
        comment: 'Kategória szín hex kódban'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      metaTitle: {
        type: Sequelize.STRING(70),
        allowNull: true
      },
      metaDescription: {
        type: Sequelize.STRING(165),
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 2. Alapértelmezett kategóriák létrehozása (régi ENUM értékek alapján)
    await queryInterface.bulkInsert('partner_categories', [
      {
        name: 'Szolgáltató',
        slug: 'szolgaltato',
        description: 'Szolgáltató partnerek (rendezvényszervezés, marketing, stb.)',
        icon: 'fa-briefcase',
        color: '#667eea',
        displayOrder: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Helyszín',
        slug: 'helyszin',
        description: 'Rendezvényhelyszínek és venue-k',
        icon: 'fa-map-marker-alt',
        color: '#f093fb',
        displayOrder: 2,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Média',
        slug: 'media',
        description: 'Média partnerek (újságok, rádiók, online platformok)',
        icon: 'fa-newspaper',
        color: '#4facfe',
        displayOrder: 3,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Zeneipar',
        slug: 'zeneipar',
        description: 'Zeneipar szereplők (lemezkiadók, menedzsmentek)',
        icon: 'fa-music',
        color: '#43e97b',
        displayOrder: 4,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Technológia',
        slug: 'technologia',
        description: 'Technológiai partnerek (jegyrendszer, szoftver)',
        icon: 'fa-laptop-code',
        color: '#fa709a',
        displayOrder: 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Egyéb',
        slug: 'egyeb',
        description: 'Egyéb partnerek',
        icon: 'fa-star',
        color: '#feca57',
        displayOrder: 6,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    // 3. CategoryId mező hozzáadása a partners táblához
    await queryInterface.addColumn('partners', 'categoryId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'partner_categories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 4. Meglévő partnerek kategória értékeinek átmásolása
    // (ENUM string értékeket categoryId-vé alakítjuk)
    const categories = await queryInterface.sequelize.query(
      'SELECT id, slug FROM partner_categories',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const cat of categories) {
      await queryInterface.sequelize.query(
        `UPDATE partners SET categoryId = :categoryId WHERE category = :slug`,
        {
          replacements: { categoryId: cat.id, slug: cat.slug },
          type: Sequelize.QueryTypes.UPDATE
        }
      );
    }

    // 5. Régi category ENUM mező törlése
    await queryInterface.removeColumn('partners', 'category');
  },

  async down(queryInterface, Sequelize) {
    // 1. Category ENUM mező visszaállítása
    await queryInterface.addColumn('partners', 'category', {
      type: Sequelize.ENUM('szolgaltato', 'helyszin', 'media', 'zeneipar', 'technologia', 'egyeb'),
      allowNull: false,
      defaultValue: 'egyeb'
    });

    // 2. CategoryId értékek visszamásolása category-ba
    const categories = await queryInterface.sequelize.query(
      'SELECT id, slug FROM partner_categories',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const cat of categories) {
      await queryInterface.sequelize.query(
        `UPDATE partners SET category = :slug WHERE categoryId = :categoryId`,
        {
          replacements: { slug: cat.slug, categoryId: cat.id },
          type: Sequelize.QueryTypes.UPDATE
        }
      );
    }

    // 3. CategoryId mező törlése
    await queryInterface.removeColumn('partners', 'categoryId');

    // 4. Partner kategóriák tábla törlése
    await queryInterface.dropTable('partner_categories');
  }
};
