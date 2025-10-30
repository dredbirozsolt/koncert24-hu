module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('string', 'number', 'boolean', 'json', 'encrypted'),
        defaultValue: 'string',
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'general'
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this setting can be accessed without admin rights'
      },
      isRequired: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this setting is required for system operation'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('settings', ['key']);
    await queryInterface.addIndex('settings', ['category']);
    await queryInterface.addIndex('settings', ['isPublic']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('settings');
  }
};
