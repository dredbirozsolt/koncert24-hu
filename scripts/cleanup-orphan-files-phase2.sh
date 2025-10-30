#!/bin/bash

# Phase 2: Questionable Orphan Files Cleanup
# Dátum: 2025. október 16.

echo "🔍 Phase 2: Kérdéses Árva Fájlok Átvilágítása és Törlése"
echo "========================================================"
echo ""

# Színek
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Projekt gyökér
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Biztonsági mentés
BACKUP_DIR="backup/orphan_cleanup_phase2_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "💾 Biztonsági mentés: $BACKUP_DIR"
echo ""

# Törölhető fájlok listája
FILES_TO_DELETE=(
    "routes/helpers/blog-helpers.js"
    "scripts/generateDemoDashboardData.js"
    "scripts/test-ai-service.js"
    "scripts/test-role-auth.js"
)

# Megtartandó fájlok listája
FILES_TO_KEEP=(
    "scripts/migrate-exit-popup-keys.js"
    "scripts/add-dynamic-settings.js"
)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 TÖRÖLNI JAVASOLTAK (4 fájl)"
echo "=============================="
echo ""
echo -e "${RED}🗑️  routes/helpers/blog-helpers.js${NC}"
echo -e "   ${YELLOW}Indok:${NC} Árva helper fájl - sehol nem használt"
echo ""
echo -e "${RED}🗑️  scripts/generateDemoDashboardData.js${NC}"
echo -e "   ${YELLOW}Indok:${NC} Demo adat generátor - production-ben felesleges"
echo ""
echo -e "${RED}🗑️  scripts/test-ai-service.js${NC}"
echo -e "   ${YELLOW}Indok:${NC} AI service teszt - development tool"
echo ""
echo -e "${RED}🗑️  scripts/test-role-auth.js${NC}"
echo -e "   ${YELLOW}Indok:${NC} Role auth teszt - development tool"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ MEGTARTANDÓK (2 fájl)"
echo "========================"
echo ""
echo -e "${GREEN}✅ scripts/migrate-exit-popup-keys.js${NC}"
echo -e "   ${BLUE}Indok:${NC} Egyszeri migráció - later reference"
echo ""
echo -e "${GREEN}✅ scripts/add-dynamic-settings.js${NC}"
echo -e "   ${BLUE}Indok:${NC} Kapcsolódik migration-höz - dokumentáció"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Folytatod a törlést? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Törlés megszakítva${NC}"
    exit 0
fi

echo ""
echo "🗑️  Törlés folyamatban..."
echo ""

DELETED=0
BACKED_UP=0

for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        # Backup
        mkdir -p "$BACKUP_DIR/$(dirname "$file")"
        cp "$file" "$BACKUP_DIR/$file"
        BACKED_UP=$((BACKED_UP + 1))
        
        # Delete
        rm "$file"
        DELETED=$((DELETED + 1))
        
        echo -e "${GREEN}✅ Törölve:${NC} $file"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 PHASE 2 STATISZTIKA"
echo "======================"
echo ""
echo -e "${GREEN}✅ Törölve: $DELETED fájl${NC}"
echo -e "${YELLOW}💾 Mentve: $BACKED_UP fájl${NC}"
echo ""
echo "📍 Backup helye: $BACKUP_DIR"
echo ""
echo "✅ PHASE 2 KÉSZ!"
echo ""
