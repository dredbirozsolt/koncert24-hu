#!/bin/bash

# Quick Win: Gzip/Brotli Pre-compression
# Használat: ./scripts/compress-css.sh

echo "🗜️  CSS Compression Script"
echo "=========================================="

CSS_DIR="public/css/dist"

# 1. Gzip compression
echo ""
echo "📦 Gzip compression..."
gzip -9 -k -f "${CSS_DIR}/bundle.min.css"
gzip -9 -k -f "${CSS_DIR}/legacy.min.css"

# 2. Brotli compression (ha elérhető)
if command -v brotli &> /dev/null; then
    echo "📦 Brotli compression..."
    brotli -9 -k -f "${CSS_DIR}/bundle.min.css"
    brotli -9 -k -f "${CSS_DIR}/legacy.min.css"
else
    echo "⚠️  Brotli nincs telepítve - telepítsd: brew install brotli"
fi

# 3. Méret összehasonlítás
echo ""
echo "📊 Méret összehasonlítás:"
echo "=========================================="

for file in "${CSS_DIR}"/*.min.css; do
    filename=$(basename "$file")
    original=$(wc -c < "$file" | awk '{print $1/1024 " KB"}')
    
    if [ -f "${file}.gz" ]; then
        gzipped=$(wc -c < "${file}.gz" | awk '{print $1/1024 " KB"}')
        echo "$filename:"
        echo "  Original: $original"
        echo "  Gzipped:  $gzipped"
    fi
    
    if [ -f "${file}.br" ]; then
        brotlied=$(wc -c < "${file}.br" | awk '{print $1/1024 " KB"}')
        echo "  Brotli:   $brotlied"
    fi
    
    echo ""
done

echo "✅ Compression complete!"
echo ""
echo "📝 Következő lépés: Nginx/Apache config:"
echo "   gzip on;"
echo "   gzip_types text/css;"
echo "   gzip_static on;"
