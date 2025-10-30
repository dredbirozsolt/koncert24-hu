'use strict';

module.exports = {
  up: async (queryInterface) => {
    // Add exit popup settings to Settings table
    await queryInterface.bulkInsert('Settings', [
      {
        key: 'exitPopup.enabled',
        value: 'false',
        type: 'boolean',
        category: 'exit_popup',
        description: 'Enable or disable exit popup',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.title',
        value: 'Ne menj el még!',
        type: 'string',
        category: 'exit_popup',
        description: 'Exit popup title',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.message',
        value: 'Kíváncsi vagy az árakra? Regisztrálj és azonnal láthatod az összes előadó árát!',
        type: 'string',
        category: 'exit_popup',
        description: 'Exit popup message',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.ctaText',
        value: 'Regisztrálok most',
        type: 'string',
        category: 'exit_popup',
        description: 'Exit popup CTA button text',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.ctaLink',
        value: '/auth/register',
        type: 'string',
        category: 'exit_popup',
        description: 'Exit popup CTA button link',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.trigger',
        value: 'exit_intent',
        type: 'string',
        category: 'exit_popup',
        description: 'Exit popup trigger type (deprecated - use triggerExitIntent, triggerMobileExit, triggerTimed)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.triggerExitIntent',
        value: 'true',
        type: 'boolean',
        category: 'exit_popup',
        description: 'Enable exit intent trigger (desktop)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.triggerMobileExit',
        value: 'false',
        type: 'boolean',
        category: 'exit_popup',
        description: 'Enable mobile exit trigger (scroll/back)',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.triggerTimed',
        value: 'false',
        type: 'boolean',
        category: 'exit_popup',
        description: 'Enable timed trigger',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        key: 'exitPopup.delay',
        value: '10',
        type: 'number',
        category: 'exit_popup',
        description: 'Delay in seconds for timed popup',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Settings', {
      category: 'exit_popup'
    }, {});
  }
};
