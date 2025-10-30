/**
 * Slug Helper Utility
 * URL-barát slug generálás magyar karakterek támogatásával
 */

/**
 * Generál egy URL-barát slug-ot
 * @param {string} text - A szöveg amiből slug-ot készítünk
 * @returns {string} - URL-safe slug
 */
function generateSlug(text) {
  if (!text) {return '';}

  return text
    .toString()
    .toLowerCase()
    .trim()
    // Magyar karakterek cseréje
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó|ö|ő/g, 'o')
    .replace(/ú|ü|ű/g, 'u')
    // Speciális karakterek eltávolítása
    .replace(/[^\w\s-]/g, '')
    // Whitespace -> kötőjel
    .replace(/\s+/g, '-')
    // Többszörös kötőjelek egyszerűsítése
    .replace(/--+/g, '-')
    // Kezdő/záró kötőjelek eltávolítása
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  generateSlug
};
