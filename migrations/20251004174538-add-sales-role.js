'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL: ENUM módosítás - új érték hozzáadása
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('client', 'performer', 'admin', 'sales') 
      NOT NULL DEFAULT 'client' 
      COMMENT 'client = Megrendelő/szervező, performer = Előadó/manager, admin = Adminisztrátor, sales = Értékesítő';
    `);
    
    console.log('✅ Sales role added to users table');
  },

  async down(queryInterface, Sequelize) {
    // Visszaállítás: sales role eltávolítása
    // Először frissítjük a sales usereket admin-ra
    await queryInterface.sequelize.query(`
      UPDATE users SET role = 'admin' WHERE role = 'sales';
    `);
    
    // Aztán eltávolítjuk a sales értéket az ENUM-ból
    await queryInterface.sequelize.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('client', 'performer', 'admin') 
      NOT NULL DEFAULT 'client' 
      COMMENT 'client = Megrendelő/szervező, performer = Előadó/manager, admin = Adminisztrátor';
    `);
    
    console.log('✅ Sales role removed from users table');
  }
};
