#!/bin/bash

# Koncert24.hu Backup Script
# Készít teljes backup-ot a fájlokról és az adatbázisról

set -e  # Kilépés hiba esetén

# Színek a kimeneti üzenetekhez
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Projekt gyökér könyvtár
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Timestamp a backup fájlokhoz
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="$PROJECT_ROOT/backup/backup_$TIMESTAMP"

# .env fájl betöltése
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo -e "${RED}❌ .env fájl nem található!${NC}"
    exit 1
fi

# Funkciók
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Backup könyvtár létrehozása
create_backup_dir() {
    log_info "Backup könyvtár létrehozása: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    log_success "Backup könyvtár létrehozva"
}

# Fájlok backup-ja
backup_files() {
    log_info "Projekt fájlok backup-ja..."
    
    # Kizárt fájlok és könyvtárak listája
    EXCLUDE_FILE="$PROJECT_ROOT/.backup-exclude"
    cat > "$EXCLUDE_FILE" << EOF
node_modules/
backup/
logs/
*.log
.DS_Store
.env.local
.env.production
.vscode/
.idea/
*.tmp
*.temp
coverage/
.nyc_output/
dist/
build/
EOF

    # Fájlok tömörítése
    tar --exclude-from="$EXCLUDE_FILE" \
        -czf "$BACKUP_DIR/files_$TIMESTAMP.tar.gz" \
        -C "$PROJECT_ROOT" \
        .
    
    # Cleanup
    rm "$EXCLUDE_FILE"
    
    log_success "Projekt fájlok mentve: files_$TIMESTAMP.tar.gz"
}

# Adatbázis backup
backup_database() {
    log_info "Adatbázis backup..."
    
    # Ellenőrizzük a MySQL kapcsolatot
    if ! command -v mysqldump &> /dev/null; then
        log_error "mysqldump parancs nem található! Telepítsd a MySQL klienst."
        return 1
    fi
    
    # MySQL kapcsolat tesztelése
    if ! mysql -h"${DB_HOST:-127.0.0.1}" -P"${DB_PORT:-3306}" -u"$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME;" 2>/dev/null; then
        log_error "Nem sikerült csatlakozni az adatbázishoz!"
        log_warning "Host: ${DB_HOST:-127.0.0.1}, Port: ${DB_PORT:-3306}, User: $DB_USER, DB: $DB_NAME"
        return 1
    fi
    
    # Teljes adatbázis dump
    # --skip-add-locks: nem igényel LOCK TABLES jogot
    # --no-tablespaces: nem igényel PROCESS privileged-t
    # --skip-lock-tables: nem zárolja a táblákat (már single-transaction-nel van)
    mysqldump \
        -h"${DB_HOST:-127.0.0.1}" \
        -P"${DB_PORT:-3306}" \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        --single-transaction \
        --no-tablespaces \
        --skip-add-locks \
        --skip-lock-tables \
        --routines \
        --triggers \
        --add-drop-database \
        --add-drop-table \
        --create-options \
        --disable-keys \
        --extended-insert \
        --quick \
        "$DB_NAME" > "$BACKUP_DIR/database_$TIMESTAMP.sql" 2>&1
    
    # SQL fájl tömörítése
    gzip "$BACKUP_DIR/database_$TIMESTAMP.sql"
    
    log_success "Adatbázis mentve: database_$TIMESTAMP.sql.gz"
}

# Környezet információk mentése
backup_environment() {
    log_info "Környezet információk mentése..."
    
    cat > "$BACKUP_DIR/environment_$TIMESTAMP.txt" << EOF
# Koncert24.hu Backup Information
# Időpont: $(date)
# Felhasználó: $(whoami)
# Hostname: $(hostname)
# OS: $(uname -a)

# Node.js verzió
$(node --version 2>/dev/null || echo "Node.js nincs telepítve")

# NPM verzió
$(npm --version 2>/dev/null || echo "NPM nincs telepítve")

# Telepített csomagok
EOF
    
    if [ -f package.json ]; then
        echo "# Package.json dependencies:" >> "$BACKUP_DIR/environment_$TIMESTAMP.txt"
        cat package.json | grep -A 1000 '"dependencies"' | grep -B 1000 '}' >> "$BACKUP_DIR/environment_$TIMESTAMP.txt"
    fi
    
    log_success "Környezet információk mentve: environment_$TIMESTAMP.txt"
}

# Backup metaadatok
create_backup_metadata() {
    log_info "Backup metaadatok létrehozása..."
    
    cat > "$BACKUP_DIR/backup_info.json" << EOF
{
  "backup_timestamp": "$TIMESTAMP",
  "backup_date": "$(date -Iseconds)",
  "project_name": "koncert24.hu",
  "backup_version": "1.0",
  "files": {
    "project_files": "files_$TIMESTAMP.tar.gz",
    "database": "database_$TIMESTAMP.sql.gz",
    "environment": "environment_$TIMESTAMP.txt"
  },
  "checksums": {
    "project_files": "$(md5 -q "$BACKUP_DIR/files_$TIMESTAMP.tar.gz" 2>/dev/null || echo 'N/A')",
    "database": "$(md5 -q "$BACKUP_DIR/database_$TIMESTAMP.sql.gz" 2>/dev/null || echo 'N/A')"
  },
  "size": {
    "project_files": "$(ls -lh "$BACKUP_DIR/files_$TIMESTAMP.tar.gz" | awk '{print $5}' 2>/dev/null || echo 'N/A')",
    "database": "$(ls -lh "$BACKUP_DIR/database_$TIMESTAMP.sql.gz" | awk '{print $5}' 2>/dev/null || echo 'N/A')"
  }
}
EOF
    
    log_success "Backup metaadatok létrehozva: backup_info.json"
}

# Régi backup-ok tisztítása (opcionális)
cleanup_old_backups() {
    log_info "Régi backup-ok ellenőrzése..."
    
    # Beállítások betöltése az adatbázisból
    SETTINGS_JSON=$(node -r dotenv/config "$PROJECT_ROOT/scripts/get-backup-settings.js" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$SETTINGS_JSON" ]; then
        MAX_AGE_DAYS=$(echo "$SETTINGS_JSON" | grep -o '"maxAgeDays":[0-9]*' | cut -d':' -f2)
        MAX_COUNT=$(echo "$SETTINGS_JSON" | grep -o '"maxCount":[0-9]*' | cut -d':' -f2)
        
        # Ha üres, használjuk az alapértelmezett értékeket
        [ -z "$MAX_AGE_DAYS" ] && MAX_AGE_DAYS=30
        [ -z "$MAX_COUNT" ] && MAX_COUNT=30
    else
        # Ha nem sikerült betölteni, használjuk az alapértelmezett értékeket
        log_warning "Nem sikerült betölteni a beállításokat az adatbázisból, alapértelmezett értékek használata"
        MAX_AGE_DAYS=30
        MAX_COUNT=30
    fi
    
    log_info "Beállítások: Max életkor: $MAX_AGE_DAYS nap, Max darabszám: $MAX_COUNT"
    
    # Régebbi backup-ok törlése
    find "$PROJECT_ROOT/backup" -name "backup_*" -type d -mtime +$MAX_AGE_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # Maximum számú backup megtartása
    BACKUP_COUNT=$(find "$PROJECT_ROOT/backup" -name "backup_*" -type d | wc -l | tr -d ' ')
    if [ "$BACKUP_COUNT" -gt "$MAX_COUNT" ]; then
        log_warning "Több mint $MAX_COUNT backup található. Legrégebbiek törlése..."
        find "$PROJECT_ROOT/backup" -name "backup_*" -type d | sort | head -n $((BACKUP_COUNT - MAX_COUNT)) | xargs rm -rf
    fi
    
    log_success "Régi backup-ok tisztítva"
}

# Összefoglaló jelentés
show_summary() {
    echo -e "\n${GREEN}📋 Backup Összefoglaló${NC}"
    echo "=================================="
    echo "📁 Backup könyvtár: $BACKUP_DIR"
    echo "🕐 Időpont: $(date)"
    echo ""
    echo "📦 Mentett fájlok:"
    ls -lh "$BACKUP_DIR" | grep -v "^total" | while read line; do
        echo "   $line"
    done
    
    # Teljes backup méret
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
    echo ""
    echo "💾 Teljes backup méret: $TOTAL_SIZE"
    echo ""
    echo -e "${GREEN}✅ Backup sikeresen elkészült!${NC}"
}

# Hiba kezelés
handle_error() {
    log_error "Hiba történt a backup során!"
    if [ -d "$BACKUP_DIR" ]; then
        log_warning "Részleges backup törlése: $BACKUP_DIR"
        rm -rf "$BACKUP_DIR"
    fi
    exit 1
}

# Fő backup folyamat
main() {
    echo -e "${BLUE}"
    echo "🎭 Koncert24.hu Backup Script"
    echo "============================="
    echo -e "${NC}"
    
    # Hiba esetén cleanup
    trap handle_error ERR
    
    # Backup lépések
    create_backup_dir
    backup_files
    backup_database
    backup_environment
    create_backup_metadata
    cleanup_old_backups
    show_summary
}

# Paraméterek ellenőrzése
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Koncert24.hu Backup Script"
    echo ""
    echo "Használat: ./backup.sh"
    echo ""
    echo "A script teljes backup-ot készít (fájlok + adatbázis + környezet info)."
    echo ""
    echo "Opciók:"
    echo "  -h, --help     Ez a súgó üzenet"
    echo ""
    echo "Példa:"
    echo "  ./backup.sh    # Teljes backup"
    exit 0
fi

# Teljes backup
main
