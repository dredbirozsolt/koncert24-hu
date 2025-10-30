/**
 * SEO Helper Functions
 * Meta descriptions, structured data, and SEO utilities
 */

/**
 * Get SEO-optimized meta description for style-filtered pages
 * @param {string} style - Style name (Pop, Rock, Jazz, etc.)
 * @param {number} count - Number of performers
 * @returns {string} Meta description
 */
function getStyleMetaDescription(style, count = 0) {
  const descriptions = {
    Pop: `${count}+ Pop előadó rendezvényére! Modern slágerek, közönség által kedvelt dalok. 
      Esküvő, céges buli, születésnap - garantált jó hangulat! Foglaljon most.`,
    Rock: `${count}+ Rock előadó és zenekar! Lüktető rock zenék, élő gitárok, energikus show. 
      Koncert, fesztivál, céges rendezvény - autentikus rock élmény!`,
    Jazz: `${count}+ Jazz előadó és zenekar! Elegáns jazz hangzás, professzionális muzsikusok. 
      Gála, céges est, éttermi zene - kifinomult hangulat!`,
    Retro: `${count}+ Retro előadó! Nosztalgia slágerek a '60-as, '70-es, '80-as évekből. 
      Szilveszter, céges buli, generációs találkozó - emlékezetes dallamok!`,
    Folk: `${count}+ Folk és népzenei előadó! Magyar népzene, balkán dalok, akusztikus hangzás. 
      Fesztivál, kulturális esemény, hagyományőrző rendezvény!`,
    Blues: `${count}+ Blues zenész rendezvényére! Őszinte, lélekből jövő blues. 
      Klub, bár, koncert - igazi blues feeling!`,
    Funk: `${count}+ Funk zenekar! Groovy ritmusok, táncolható funk. 
      Céges buli, party, fesztivál - ne álljon meg a tánc!`,
    Soul: `${count}+ Soul előadó! Érzelmes soul és R&B zenék. 
      Gála, esküvő, céges est - megható hangulat!`,
    Metal: `${count}+ Metal zenekar! Kemény riffek, energikus show, igazi fém. 
      Koncert, fesztivál, szórakozóhely - headbanging garantálva!`,
    Country: `${count}+ Country zenész! Amerikai és magyar country dalok. 
      Western party, céges rendezvény, fesztivál - cowboy hangulat!`,
    Latino: `${count}+ Latino előadó! Salsa, bachata, latin ritmusok. 
      Party, esküvő, céges buli - forró latin hangulattal!`,
    Électro: `${count}+ Electro és elektronikus zenei előadó! Modern house, techno, EDM. 
      Club event, party, fesztivál - tomboló tánc!`
  };

  return descriptions[style]
    || `${count}+ ${style} stílusú előadó rendezvényére! 
    Professzionális előadók, garantált minőség. 
    Esküvő, céges rendezvény, születésnap - foglaljon most!`;
}

/**
 * Get SEO-optimized meta description for category pages
 * @param {string} category - Category slug
 * @param {number} count - Number of performers
 * @returns {string} Meta description
 */
function getCategoryMetaDescription(category, count = 0) {
  const descriptions = {
    zenekar: `Professzionális zenekarok rendezvényére! ${count}+ élő zenekar. 
      Esküvő, céges rendezvény, buli - megtaláljuk a tökéletes zenekart!`,
    eloenekes: `Élő énekesek és énekesnők! ${count}+ profi előénekes. 
      Esküvő, gála, céges est - válasszon a legjobb előadók közül!`,
    dj: `Profi DJ-k rendezvényére! ${count}+ tapasztalt lemezlovas. 
      Esküvői DJ, party DJ, céges DJ - minden eseményre!`,
    tanczenekkar: `Tánczenekarak! ${count}+ élő zenekar táncolható slágerekkel. 
      Esküvő, szilveszter, céges buli - garantált jó hangulat!`,
    korus: `Kórusok és énekkarok! ${count}+ kórus. 
      Esküvő, ünnepi esemény, koncert - szakértő kórusvezetők!`,
    musorrendezok: `Műsorrendezők és showman-ek! ${count}+ profi konferanszié. 
      Céges rendezvény, gála, esküvő - tökéletes műsorvezetés!`,
    original: `Eredeti előadók és sztárok! ${count}+ ismert művész. 
      Koncert, céges gála, fesztivál - hozza el kedvenc előadóját!`
  };

  return descriptions[category]
    || `Válasszon ${count}+ profi előadó közül! Ingyenes ajánlatkérés, megbízható szolgáltatás.`;
}

/**
 * Get SEO-optimized meta description for performer detail page
 * @param {Object} performer - Performer object
 * @returns {string} Meta description
 */
function getPerformerMetaDescription(performer) {
  const category = performer.getCategoryDisplayName
    ? performer.getCategoryDisplayName() : performer.category;
  const baseDesc = performer.description ? performer.description.substring(0, 120) : '';
  const priceText = performer.price
    ? ` Ár: ${new Intl.NumberFormat('hu-HU').format(performer.price)} Ft-tól.` : '';
  const style = performer.style && performer.style.length > 0
    ? ` Stílus: ${performer.style.join(', ')}.` : '';

  return `${performer.name} - ${category}.${baseDesc ? ` ${baseDesc}` : ''}${style}${priceText} 
    Foglaljon most, ingyenes ajánlatkérés!`.replace(/\s+/g, ' ').trim();
}

/**
 * Get SEO-optimized meta description for main performers page
 * @param {number} count - Total number of performers
 * @returns {string} Meta description
 */
function getMainPerformersMetaDescription(count = 0) {
  return `Válasszon ${count}+ profi előadó közül rendezvényére! 
    Zenekarok, énekesek, DJ-k, műsorrendezők és még sok más. 
    Ingyenes ajánlatkérés, gyors válasz, megbízható szolgáltatás. 
    Esküvő, céges rendezvény, születésnap - megtaláljuk a tökéletes előadót!`
    .replace(/\s+/g, ' ').trim();
}

/**
 * Get SEO-optimized meta description for events page
 * @param {number} count - Total number of events
 * @param {Array} topEvents - Array of upcoming events (max 3)
 * @returns {string} Meta description
 */
function getEventsMetaDescription(count = 0, topEvents = []) {
  if (count === 0) {
    return 'Tekintse meg közelgő rendezvényeinket és koncertjeinket. Fedezze fel élő előadásainkat!';
  }

  const eventText = count === 1 ? 'közelgő esemény' : 'közelgő esemény';

  if (topEvents.length === 0) {
    return `${count} ${eventText}. Fedezze fel élő koncertjeinket és rendezvényeinket!`;
  }

  // Get top 3 performer names (check both 'performer' and 'Performer' for Sequelize)
  const performerNames = topEvents
    .slice(0, 3)
    .map((event) => event.performer?.name || event.Performer?.name)
    .filter(Boolean)
    .join(', ');

  if (performerNames) {
    return `${count} ${eventText}. Következő előadók: ${performerNames}. Fedezze fel előadásainkat!`;
  }

  return `${count} ${eventText}. Fedezze fel élő koncertjeinket és rendezvényeinket!`;
}

/**
 * Get SEO-optimized meta description for partners page
 * @param {number} count - Total number of partners
 * @param {Array} topPartners - Array of featured partners (max 3)
 * @returns {string} Meta description
 */
function getPartnersMetaDescription(count = 0, topPartners = []) {
  if (count === 0) {
    return 'Megbízható partnereink - technikai szolgáltatók, helyszínek, szakmai együttműködők.';
  }

  const partnerText = count === 1 ? 'megbízható partner' : 'megbízható partner';

  if (topPartners.length === 0) {
    return `${count} ${partnerText}. Technikai szolgáltatók, helyszínek és szakmai együttműködők.`;
  }

  // Get top 3 partner names
  const partnerNames = topPartners
    .slice(0, 3)
    .map((partner) => partner.name)
    .filter(Boolean)
    .join(', ');

  if (partnerNames) {
    return `${count} ${partnerText}: ${partnerNames}. Fedezze fel szakmai partnereinket!`;
  }

  return `${count} ${partnerText}. Technikai szolgáltatók, helyszínek és együttműködők.`;
}

/**
 * Generate Schema.org PerformingGroup structured data for performer
 * @param {Object} performer - Performer object
 * @param {string} siteUrl - Base site URL
 * @returns {Object} Schema.org JSON-LD
 */
function generatePerformerSchema(performer, siteUrl) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'PerformingGroup',
    name: performer.name,
    url: `${siteUrl}/eloadok/${performer.slug}`,
    description: performer.description || performer.shortDescription || `${performer.name} - professzionális előadó`
  };

  // Add image if available
  if (performer.imageUrl) {
    schema.image = performer.imageUrl.startsWith('http')
      ? performer.imageUrl
      : `${siteUrl}${performer.imageUrl}`;
  }

  // Add genre/style
  if (performer.style && performer.style.length > 0) {
    schema.genre = performer.style;
  }

  // Add price offer
  if (performer.price) {
    schema.offers = {
      '@type': 'Offer',
      price: performer.price,
      priceCurrency: 'HUF',
      availability: 'https://schema.org/InStock',
      url: `${siteUrl}/foglalas/${performer.id}`
    };
  }

  // Add aggregate rating if available (placeholder for future)
  // schema.aggregateRating = {
  //   '@type': 'AggregateRating',
  //   ratingValue: '4.8',
  //   reviewCount: '127'
  // };

  return schema;
}

/**
 * Generate Schema.org ItemList for performers listing page
 * @param {Array} performers - Array of performer objects
 * @param {string} siteUrl - Base site URL
 * @param {string} listName - Name of the list (e.g., "Pop előadók")
 * @returns {Object} Schema.org JSON-LD
 */
function generatePerformersListSchema(performers, siteUrl, listName = 'Előadók') {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: performers.length,
    itemListElement: performers.slice(0, 12).map((performer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'PerformingGroup',
        name: performer.name,
        url: `${siteUrl}/eloadok/${performer.slug}`,
        image: performer.imageUrl && performer.imageUrl.startsWith('http')
          ? performer.imageUrl
          : performer.imageUrl
            ? `${siteUrl}${performer.imageUrl}`
            : undefined
      }
    }))
  };
}

/**
 * Generate Schema.org BreadcrumbList
 * @param {Array} breadcrumbs - Array of breadcrumb objects [{name, url}]
 * @returns {Object} Schema.org JSON-LD
 */
function generateBreadcrumbSchema(breadcrumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

/**
 * Generate Schema.org ItemList for partners
 * @param {Array} partners - Array of partner objects
 * @param {string} siteUrl - Base site URL
 * @returns {Object} Schema.org JSON-LD
 */
function generatePartnersListSchema(partners, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Partnereink',
    description: 'Megbízható partnereink - technikai szolgáltatók, helyszínek és együttműködők',
    numberOfItems: partners.length,
    itemListElement: partners.map((partner, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Organization',
        name: partner.name,
        url: partner.website || `${siteUrl}/partners/${partner.slug}`,
        description: partner.description || partner.name
      }
    }))
  };
}

module.exports = {
  getStyleMetaDescription,
  getCategoryMetaDescription,
  getPerformerMetaDescription,
  getMainPerformersMetaDescription,
  getEventsMetaDescription,
  getPartnersMetaDescription,
  generatePerformerSchema,
  generatePerformersListSchema,
  generateBreadcrumbSchema,
  generatePartnersListSchema
};
