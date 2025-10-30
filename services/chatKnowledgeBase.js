/**
 * Enhanced Knowledge Base for AI Chat Assistant
 * Koncert24.hu - Event & Entertainment Industry
 *
 * This file contains comprehensive knowledge about:
 * - Services offered (DB: Performers)
 * - Pricing structures (DB: Performers prices)
 * - Common questions & answers (DB: FAQ)
 * - Booking process
 * - Event types
 *
 * Design pattern: 100% Database-driven (no hardcoded fallbacks)
 */

const settingsService = require('./settingsService');
const { FaqCategory, FaqItem, Performer } = require('../models');
const logger = require('../config/logger');

/**
 * Load FAQ from database
 * @returns {Promise<string>} Formatted FAQ content
 */
async function loadFaqFromDB() {
  try {
    const faqItems = await FaqItem.findAll({
      where: { isActive: true },
      include: [{
        model: FaqCategory,
        as: 'category',
        where: { isActive: true },
        required: true
      }],
      order: [
        [{ model: FaqCategory, as: 'category' }, 'displayOrder', 'ASC'],
        ['displayOrder', 'ASC']
      ]
    });

    if (faqItems.length === 0) {
      return '(Nincs elérhető FAQ adat az adatbázisban)';
    }

    // Group by category
    const grouped = {};
    faqItems.forEach((item) => {
      const categoryName = item.category.name;
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      grouped[categoryName].push({
        question: item.question,
        answer: item.answer
      });
    });

    // Format output
    let output = '';
    Object.keys(grouped).forEach((categoryName) => {
      output += `\n${categoryName.toUpperCase()}\n${'─'.repeat(50)}\n`;
      grouped[categoryName].forEach((item) => {
        output += `\nQ: ${item.question}\n`;
        output += `A: ${item.answer}\n`;
      });
    });

    logger.debug({ faqCount: faqItems.length }, 'FAQ loaded from database');
    return output;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to load FAQ from database');
    return '(FAQ betöltési hiba)';
  }
}

/**
 * Search for specific performer(s) by name
 * Used for RAG (Retrieval Augmented Generation) when user asks about specific performer
 * @param {string} searchQuery - Performer name to search for
 * @returns {Promise<string|null>} Formatted performer details or null if not found
 */
async function searchPerformerByName(searchQuery) {
  try {
    // Check if Performers RAG is enabled (default: true)
    const { AIBehaviorSetting } = require('../models');
    const settingsByCategory = await AIBehaviorSetting.getAllByCategory();
    const kbContent = settingsByCategory.knowledgeBase || [];
    const usePerformersSetting = kbContent.find((s) => s.settingKey === 'usePerformers');
    const usePerformers = usePerformersSetting ? usePerformersSetting.getParsedValue() : true;

    if (!usePerformers) {
      logger.info({ searchQuery }, 'RAG: Performers search disabled in admin settings');
      return null;
    }

    logger.info({ searchQuery }, 'RAG: searchPerformerByName called');

    const { Op } = require('sequelize');

    // Extract potential performer names from the query
    // Look for capitalized words (performer names are usually capitalized)
    const words = searchQuery.split(/\s+/);
    const capitalizedWords = words.filter((word) => /^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(word));

    // Build search conditions for each potential name part
    const searchConditions = capitalizedWords.map((word) => ({
      name: { [Op.like]: `%${word}%` }
    }));

    if (searchConditions.length === 0) {
      logger.info({ searchQuery }, 'RAG: No capitalized words found in query');
      return null;
    }

    const performers = await Performer.findAll({
      where: {
        isActive: true,
        [Op.or]: searchConditions
      },
      attributes: ['name', 'category', 'price', 'duration', 'performanceType', 'travelCost', 'description'],
      order: [['name', 'ASC']],
      limit: 10 // Max 10 results to prevent token overflow
    });

    logger.info({
      searchQuery,
      capitalizedWords,
      resultCount: performers.length,
      foundNames: performers.map((p) => p.name)
    }, 'RAG: Performer search completed');

    if (performers.length === 0) {
      return null;
    }

    // Format detailed info
    let output = `\n🎤 ELŐADÓ KERESÉS EREDMÉNYE: "${searchQuery}"\n${'═'.repeat(60)}\n\n`;

    performers.forEach((p, idx) => {
      output += `${idx + 1}. ${p.name}\n`;
      output += `   Kategória: ${p.category || 'N/A'}\n`;

      if (p.price) {
        output += `   Ár: ${p.price.toLocaleString('hu-HU')} Ft\n`;
      }

      if (p.duration) {
        output += `   Műsoridő: ${p.duration} perc\n`;
      }

      if (p.performanceType) {
        output += `   Típus: ${p.performanceType}\n`;
      }

      if (p.travelCost) {
        output += `   Utazási költség: ${p.travelCost}\n`;
      }

      if (p.description) {
        output += `   Leírás: ${p.description}\n`;
      }

      output += '\n';
    });

    return output;
  } catch (error) {
    logger.warn({ err: error, searchQuery }, 'Failed to search performer');
    return null;
  }
}

/**
 * Get comprehensive knowledge base for AI context
 * Dynamically builds from database (NO hardcoded fallbacks)
 */
async function getEnhancedKnowledgeBase() {
  const { AIBehaviorSetting } = require('../models');
  const companyName = await settingsService.get('general.site_name') || 'Koncert24.hu';

  // Load settings from database
  const settingsByCategory = await AIBehaviorSetting.getAllByCategory();
  const kbContent = settingsByCategory.knowledgeBase || [];

  // Check if FAQ should be included (default: true)
  const useFaqSetting = kbContent.find((s) => s.settingKey === 'useFaq');
  const useFaq = useFaqSetting ? useFaqSetting.getParsedValue() : true;

  // Load FAQ only if enabled
  const faqFromDB = useFaq ? await loadFaqFromDB() : '(FAQ használat kikapcsolva az admin beállításokban)';

  // Helper to get setting value by key
  const getKBSetting = (key) => {
    const setting = kbContent.find((s) => s.settingKey === key);
    return setting ? setting.getParsedValue() : '';
  };

  return `
═══════════════════════════════════════════════════════════
${companyName.toUpperCase()} TUDÁSBÁZIS - RENDEZVÉNYSZERVEZÉS
═══════════════════════════════════════════════════════════

📋 ALAPINFORMÁCIÓK
------------------
${getKBSetting('companyInfo')}

⚠️ FONTOS: ELŐADÓKRÓL
----------------------
Ha konkrét előadóról kérdeznek (név, ár, műsoridő, stb.):
- NE találj ki semmilyen információt!
- Mondd: "Engedjétek, hogy megkeressem az adatbázisban..."
- A rendszer automatikusan lekérdezi a pontos adatokat

🎪 RENDEZVÉNYTÍPUSOK & SPECIÁLIS IGÉNYEK
-----------------------------------------
${getKBSetting('eventTypes')}

📍 HELYSZÍNEK & UTAZÁS
----------------------
${getKBSetting('travelCosts')}

⏰ IDŐTARTAM & EXTRÁK
---------------------
${getKBSetting('durationExtras')}

💰 FIZETÉSI FELTÉTELEK
----------------------
${getKBSetting('paymentTerms')}

📝 FOGLALÁSI FOLYAMAT LÉPÉSEI
------------------------------
${getKBSetting('bookingProcess')}

🎵 ZENEI STÍLUSOK & REPERTOÁR
------------------------------
${getKBSetting('musicGenres')}

${useFaq ? `🎤 GYAKORI KÉRDÉSEK (Adatbázisból)
═══════════════════════════════════
${faqFromDB}

` : ''}🚨 FONTOS SZABÁLYOK
-------------------
${getKBSetting('importantRules')}

📞 KAPCSOLAT & ELÉRHETŐSÉG
--------------------------
${getKBSetting('contactInfo')}

🎁 AKCIÓK & KEDVEZMÉNYEK
------------------------
${getKBSetting('promotions')}

═══════════════════════════════════════════════════════════
FONTOS: Összetett kérdések, konkrét foglalás, egyedi árajánlat
esetén MINDIG továbbítsd a beszélgetést egy munkatársunknak!
═══════════════════════════════════════════════════════════
`;
}

module.exports = {
  getEnhancedKnowledgeBase,
  searchPerformerByName
};
