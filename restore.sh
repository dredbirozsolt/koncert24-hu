#!/bin/bash

# Koncert24.hu Restore Script
# Visszaállítja a backup-ot

set -e

# Színek
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

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

# Elérhető backup-ok listázása
list_backups() {
    echo -e "${BLUE}📋 Elérhető backup-ok:${NC}"
    echo "========================"
    
    if [ ! -d "$PROJECT_ROOT/backup" ]; then
        log_error "Nincs backup könyvtár!"
        exit 1
    fi
    
    BACKUP_DIRS=$(find "$PROJECT_ROOT/backup" -name "backup_*" -type d | sort -r)
    
    if [ -z "$BACKUP_DIRS" ]; then
        log_error "Nincs elérhető backup!"
        exit 1
    fi
    
    echo "$BACKUP_DIRS" | while read backup_dir; do
        backup_name=$(basename "$backup_dir")
        timestamp=$(echo "$backup_name" | sed 's/backup_//')
        formatted_date=$(echo "$timestamp" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
        
        echo "📦 $backup_name ($formatted_date)"
        
        if [ -f "$backup_dir/backup_info.json" ]; then
            echo "   └─ Fájlok: $(ls -1 "$backup_dir" | grep -v backup_info.json | wc -l | tr -d ' ') db"
            if [ -f "$backup_dir/database_${timestamp}.sql.gz" ]; then
                db_size=$(ls -lh "$backup_dir/database_${timestamp}.sql.gz" | awk '{print $5}')
                echo "   └─ Adatbázis: $db_size"
            fi
            if [ -f "$backup_dir/files_${timestamp}.tar.gz" ]; then
                files_size=$(ls -lh "$backup_dir/files_${timestamp}.tar.gz" | awk '{print $5}')
                echo "   └─ Projekt fájlok: $files_size"
            fi
        fi
        echo ""
    done
}

# Adatbázis visszaállítása
restore_database() {
    local backup_dir="$1"
    local timestamp="$2"
    
    log_info "Adatbázis visszaállítása..."
    
    # .env betöltése
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
    else
        log_error ".env fájl nem található!"
        return 1
    fi
    
    local db_file="$backup_dir/database_${timestamp}.sql.gz"
    
    if [ ! -f "$db_file" ]; then
        log_error "Adatbázis backup fájl nem található: $db_file"
        return 1
    fi
    
    # Biztonsági kérdés
    echo -e "${YELLOW}⚠️  FIGYELEM: Ez törli a jelenlegi adatbázist!${NC}"
    read -p "Folytatod? (igen/nem): " confirm
    if [ "$confirm" != "igen" ]; then
        log_warning "Művelet megszakítva."
        return 1
    fi
    
    # Adatbázis visszaállítása
    gunzip -c "$db_file" | mysql \
        -h"${DB_HOST:-127.0.0.1}" \
        -P"${DB_PORT:-3306}" \
        -u"$DB_USER" \
        -p"$DB_PASSWORD" \
        "$DB_NAME"
    
    log_success "Adatbázis visszaállítva"
}

# Fájlok visszaállítása
restore_files() {
    local backup_dir="$1"
    local timestamp="$2"
    
    log_info "Projekt fájlok visszaállítása..."
    
    local files_backup="$backup_dir/files_${timestamp}.tar.gz"
    
    if [ ! -f "$files_backup" ]; then
        log_error "Fájlok backup nem található: $files_backup"
        return 1
    fi
    
    # Biztonsági kérdés
    echo -e "${YELLOW}⚠️  FIGYELEM: Ez felülírja a jelenlegi fájlokat!${NC}"
    read -p "Folytatod? (igen/nem): " confirm
    if [ "$confirm" != "igen" ]; then
        log_warning "Művelet megszakítva."
        return 1
    fi
    
    # Biztonság: backup könyvtár kizárása
    mkdir -p /tmp/koncert24_restore_backup
    cp -r backup /tmp/koncert24_restore_backup/ 2>/dev/null || true
    
    # Fájlok visszaállítása
    tar -xzf "$files_backup" -C "$PROJECT_ROOT"
    
    # Backup könyvtár visszaállítása
    cp -r /tmp/koncert24_restore_backup/backup . 2>/dev/null || true
    rm -rf /tmp/koncert24_restore_backup
    
    log_success "Projekt fájlok visszaállítva"
}

# Backup információk megjelenítése
show_backup_info() {
    local backup_dir="$1"
    
    if [ -f "$backup_dir/backup_info.json" ]; then
        log_info "Backup információk:"
        cat "$backup_dir/backup_info.json" | python3 -m json.tool 2>/dev/null || cat "$backup_dir/backup_info.json"
    fi
    
    if [ -f "$backup_dir/environment_"*".txt" ]; then
        echo ""
        log_info "Környezet információk:"
        head -20 "$backup_dir/environment_"*".txt"
    fi
}

# Fő restore folyamat
main() {
    echo -e "${BLUE}"
    echo "🔄 Koncert24.hu Restore Script"
    echo "=============================="
    echo -e "${NC}"
    
    # Backup lista megjelenítése
    list_backups
    
    # Backup kiválasztása
    echo -e "${YELLOW}Melyik backup-ot szeretnéd visszaállítani?${NC}"
    read -p "Add meg a backup nevét (pl: backup_20250904_123456): " backup_name
    
    if [ -z "$backup_name" ]; then
        log_error "Nincs backup név megadva!"
        exit 1
    fi
    
    backup_dir="$PROJECT_ROOT/backup/$backup_name"
    
    if [ ! -d "$backup_dir" ]; then
        log_error "A megadott backup nem létezik: $backup_dir"
        exit 1
    fi
    
    # Timestamp kinyerése
    timestamp=$(echo "$backup_name" | sed 's/backup_//')
    
    # Backup információk
    show_backup_info "$backup_dir"
    
    echo ""
    echo -e "${YELLOW}Mit szeretnél visszaállítani?${NC}"
    echo "1) Mindent (fájlok + adatbázis)"
    echo "2) Csak adatbázis"
    echo "3) Csak fájlok"
    echo "4) Mégse"
    
    read -p "Választás (1-4): " choice
    
    case $choice in
        1)
            restore_files "$backup_dir" "$timestamp"
            restore_database "$backup_dir" "$timestamp"
            log_success "Teljes visszaállítás kész!"
            ;;
        2)
            restore_database "$backup_dir" "$timestamp"
            ;;
        3)
            restore_files "$backup_dir" "$timestamp"
            ;;
        4)
            log_warning "Művelet megszakítva."
            exit 0
            ;;
        *)
            log_error "Érvénytelen választás!"
            exit 1
            ;;
    esac
    
    echo ""
    log_success "Visszaállítás befejezve!"
    echo -e "${YELLOW}💡 Ne felejtsd el újraindítani a fejlesztői szervert!${NC}"
}

# Súgó
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Koncert24.hu Restore Script"
    echo ""
    echo "Használat: ./restore.sh [opciók]"
    echo ""
    echo "Opciók:"
    echo "  -h, --help     Ez a súgó üzenet"
    echo "  --list         Backup-ok listázása"
    echo ""
    echo "Interaktív módban futtatd paraméterek nélkül: ./restore.sh"
    exit 0
fi

# Lista mód
if [ "$1" = "--list" ]; then
    list_backups
    exit 0
fi

# Fő folyamat
main
