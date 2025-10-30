#!/bin/bash

# Madge Orphan Files Cleanup Script
# Dátum: 2025. október 16.
# Leírás: Árva test és demo fájlok törlése a projekt gyökérkönyvtárából

echo "🧹 Madge Orphan Files Cleanup Script"
echo "===================================="
echo ""

# Színek
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Projekt gyökér
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📁 Projekt gyökér: $PROJECT_ROOT"
echo ""

# Biztonsági mentés készítése
BACKUP_DIR="backup/orphan_cleanup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "💾 Biztonsági mentés készítése: $BACKUP_DIR"
echo ""

# Törölhető fájlok listája
ORPHAN_FILES=(
    "cleanup-test-security-events.js"
    "create-test-security-events.js"
    "test-all-emails.js"
    "test-critical-error-alert.js"
    "test-cron-job-config.js"
    "test-database-down-email.js"
    "test-disk-space-alert.js"
    "test-infrastructure-alert-audit.js"
    "test-infrastructure-alerts.js"
    "test-login.js"
    "test-manual-health-check.js"
    "test-password.js"
    "test-security-alerts.js"
)

# Kérdéses fájlok (manuális döntés szükséges)
QUESTIONABLE_FILES=(
    "routes/helpers/blog-helpers.js"
    "scripts/generateDemoDashboardData.js"
    "scripts/test-ai-service.js"
    "scripts/test-role-auth.js"
    "scripts/migrate-exit-popup-keys.js"
    "scripts/add-dynamic-settings.js"
)

# Statisztika
DELETED_COUNT=0
BACKED_UP_COUNT=0
SKIPPED_COUNT=0

echo "🔍 Ellenőrzés és mentés folyamatban..."
echo ""

# Test fájlok törlése (biztonságos)
for file in "${ORPHAN_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}📄 Fájl mentése:${NC} $file"
        
        # Biztonsági mentés
        cp "$file" "$BACKUP_DIR/"
        BACKED_UP_COUNT=$((BACKED_UP_COUNT + 1))
        
        # Törlés
        rm "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
        
        echo -e "${GREEN}   ✅ Törölve${NC}"
    else
        echo -e "${RED}   ⚠️  Nem található: $file${NC}"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 STATISZTIKA"
echo "=============="
echo ""
echo -e "${GREEN}✅ Törölve: $DELETED_COUNT fájl${NC}"
echo -e "${YELLOW}💾 Mentve: $BACKED_UP_COUNT fájl${NC}"
echo -e "${RED}⚠️  Kihagyva: $SKIPPED_COUNT fájl${NC}"
echo ""

# Kérdéses fájlok listája
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 MANUÁLIS DÖNTÉS SZÜKSÉGES"
echo "============================"
echo ""
echo "Az alábbi fájlok potenciálisan árva fájlok, de manuális ellenőrzés szükséges:"
echo ""

for file in "${QUESTIONABLE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${YELLOW}  ❓ $file${NC}"
        
        # Fájl méret és módosítási dátum
        FILE_SIZE=$(du -h "$file" | cut -f1)
        FILE_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1,2)
        
        echo "     Méret: $FILE_SIZE | Utolsó módosítás: $FILE_DATE"
        echo ""
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ CLEANUP KÉSZ!"
echo ""
echo "📍 Biztonsági mentés helye: $BACKUP_DIR"
echo ""
echo "📝 Következő lépések:"
echo "   1. Ellenőrizd a kérdéses fájlokat"
echo "   2. Döntsd el, megtartod vagy törlöd őket"
echo "   3. Ha minden rendben, törölheted a backup mappát"
echo ""
echo "💡 Tipp: Ha vissza szeretnéd állítani a fájlokat:"
echo "   cp $BACKUP_DIR/* ."
echo ""
