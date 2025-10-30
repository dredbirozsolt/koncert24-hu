/**
 * AI Chat Behavior Rules - Viselkedési szabályok és irányelvek
 * Koncert24.hu
 *
 * Ez a modul tartalmazza az AI asszisztens viselkedési szabályait,
 * amelyek NEM publikusak, csak az AI számára láthatóak.
 *
 * Design pattern: 100% Database-driven configuration
 * Betölti a beállításokat az AIBehaviorSettings táblából.
 * Nincs hardcoded fallback - ha nincs DB, nincs AI.
 */

const logger = require('../config/logger');

/**
 * Viselkedési szabályok lekérése az adatbázisból
 * @returns {Promise<Object>} Behavior rules from database (flat structure by category)
 */
async function getBehaviorRules() {
  const { AIBehaviorSetting } = require('../models');
  const dbSettings = await AIBehaviorSetting.getAllByCategory();

  // Convert array of settings to key-value pairs per category
  const formatted = {};
  Object.keys(dbSettings).forEach((category) => {
    formatted[category] = {};
    dbSettings[category].forEach((setting) => {
      formatted[category][setting.settingKey] = setting.getParsedValue();
    });
  });

  logger.debug({ categoriesLoaded: Object.keys(formatted) }, 'AI behavior rules loaded from DB');
  return formatted;
}

/**
 * Viselkedési szabályok formázása AI számára
 * @returns {Promise<string>} Formatted behavior rules for AI prompt
 */
async function formatBehaviorRulesForAI() {
  const rules = await getBehaviorRules();

  // Helper function to safely get DB values
  const get = (category, key, fallback = '') => rules[category]?.[key] ?? fallback;

  return `
🎯 AI ASSZISZTENS VISELKEDÉSI SZABÁLYOK
════════════════════════════════════════

SZEMÉLYISÉGED:
- Hangnem: ${get('personality', 'tone')}
- Nyelv: ${get('personality', 'language')}
- Stílus: ${get('personality', 'formalityLevel')}
- Emoji használat: ${get('personality', 'emojiUsage') ? 'Igen, mértékkel' : 'Nem'}
- Humor: ${get('personality', 'humor')}

ESZKALÁCIÓS SZABÁLYOK:
━━━━━━━━━━━━━━━━━━━━
AZONNAL TOVÁBBÍTS, ha hallod:
${(get('escalation', 'autoEscalateKeywords', []) || []).map((k) => `  • "${k}"`).join('\n')}

NE TOVÁBBÍTS, ha csak:
${(get('escalation', 'dontEscalateFor', []) || []).map((k) => `  • ${k}`).join('\n')}

Eszkalációs üzenet: "${get('escalation', 'escalationMessage')}"

TILTOTT TÉMÁK:
━━━━━━━━━━━━━━━━━━━━
${(get('prohibited', 'topics', []) || []).map((t) => `  ❌ ${t}`).join('\n')}

TILTOTT VISELKEDÉSEK:
${(get('prohibited', 'behaviors', []) || []).map((b) => `  ⛔ ${b}`).join('\n')}

SOHA NE MONDD:
${(get('prohibited', 'phrases', []) || []).map((p) => `  🚫 "${p}"`).join('\n')}

VÁLASZ STÍLUS:
━━━━━━━━━━━━━━━━━━━━
⚠️ FONTOS: ${get('responseStyle', 'brevityRule', 'RÖVID, LÉNYEGRETÖRŐ válaszok! Max 3-4 mondat!')}

Hossz: ${get('responseStyle', 'maxLength')}
Formázás:
  • Bullet point használat: ${get('responseStyle', 'useBulletPoints') ? 'Igen' : 'Nem'}
  • Vastag szöveg kiemelés: ${get('responseStyle', 'useBold') ? 'Igen' : 'Nem'}

SPECIÁLIS HELYZETEK:
━━━━━━━━━━━━━━━━━━━━
Ha az ügyfél DÜHÖS:
  → ${get('specialCases', 'angryCustomerApproach')}
  → Automatikus eszkaláció: ${get('specialCases', 'angryAutoEscalate') ? 'IGEN' : 'NEM'}

Ha TECHNIKAI kérdés:
  → ${get('specialCases', 'technicalComplexApproach')}

Árajánlat kérés:
  → ${get('specialCases', 'priceQuoteApproach')}
  → **${get('specialCases', 'priceQuoteGuidance', 'Ha van áradat a kontextusban (RAG), oszd meg azonnal!')}**

Versenytárs említése:
  → ${get('specialCases', 'competitorApproach')}

ADATVÉDELEM & GDPR:
━━━━━━━━━━━━━━━━━━━━
  🔒 ${get('privacy', 'personalDataHandling')}
  🔒 ${get('privacy', 'sensitiveDataRule')}

ÉRTÉKESÍTÉSI IRÁNYELVEK:
━━━━━━━━━━━━━━━━━━━━
Upselling: ${get('salesGuidelines', 'upsellingAllowed') ? '✅ Megengedett' : '❌ Tiltott'}
  → ${get('salesGuidelines', 'upsellingApproach')}

Cross-selling: ${get('salesGuidelines', 'crossSellingAllowed') ? '✅ Megengedett' : '❌ Tiltott'}

Kedvezmények:
  ✅ Említhető: ${get('salesGuidelines', 'discountMention')}
  ❌ Ne ajánlj: ${get('salesGuidelines', 'discountDontOffer')}

════════════════════════════════════════
🎯 FONTOS: Ezek a szabályok BELSŐ irányelvek.
Az ügyfél NEM látja őket, csak te.
Tartsd be minden válaszodban!
════════════════════════════════════════
`;
}

/**
 * Eszkalációs kulcsszavak ellenőrzése
 * @param {string} message - User message to check
 * @returns {Promise<boolean>} True if message should be escalated
 */
async function shouldAutoEscalate(message) {
  const rules = await getBehaviorRules();
  const lowerMessage = message.toLowerCase();

  const keywords = rules.escalation?.autoEscalateKeywords || [];

  return keywords.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase())
  );
}

/**
 * Tiltott témák ellenőrzése
 * @param {string} message - User message to check
 * @returns {Promise<Array|null>} Array of found prohibited topics or null
 */
async function containsProhibitedTopic(message) {
  const rules = await getBehaviorRules();
  const lowerMessage = message.toLowerCase();

  const topics = rules.prohibited?.topics || [];

  const foundTopics = topics.filter((topic) =>
    lowerMessage.includes(topic.toLowerCase())
  );

  return foundTopics.length > 0 ? foundTopics : null;
}

module.exports = {
  getBehaviorRules,
  formatBehaviorRulesForAI,
  shouldAutoEscalate,
  containsProhibitedTopic
};
