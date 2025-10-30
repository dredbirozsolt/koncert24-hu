# Képek

Ez a mappa tartalmazza a weboldal statikus képeit.

## Szükséges képek:

1. **logo.svg** - DMF Art Média logó (SVG formátumban)
2. **hero-concert.jpg** - Főoldali hero kép (1200x800px, optimalizált)
3. **og-image.jpg** - Open Graph megosztási kép (1200x630px)
4. **apple-touch-icon.png** - Apple Touch ikon (180x180px)
5. **favicon.ico** - Favicon (32x32px)

## Előadó képek

Az előadók képei a vTiger CRM-ből töltődnek be automatikusan az `imageUrl` mező alapján.
Backup placeholder egy általános profilkép ikon formájában kerül megjelenítésre.

## Képoptimalizálási javaslatok:

- **JPEG**: 85% minőség, progresív
- **PNG**: TinyPNG optimalizálás
- **SVG**: Minifikálás
- **WebP**: Modern böngészőkhöz (opcionális)

## CDN integráció (opcionális):

A képek egy CDN-re (pl. Cloudinary, AWS CloudFront) feltölthetők a jobb teljesítmény érdekében.
