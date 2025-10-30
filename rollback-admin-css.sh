#!/bin/bash

# =================================================================
# ADMIN CSS CONSOLIDATION ROLLBACK SCRIPT
# =================================================================
# Created: 2025.10.19
# Backup location: backups/admin-consolidation-20251019_091135/
# =================================================================

set -e  # Exit on error

BACKUP_DIR="backups/admin-consolidation-20251019_091135"
PROJECT_ROOT="/Users/birozsolt/Downloads/koncert24.hu"

echo "🔄 Starting rollback from $BACKUP_DIR..."
echo ""

# Check if backup exists
if [ ! -d "$PROJECT_ROOT/$BACKUP_DIR" ]; then
    echo "❌ ERROR: Backup directory not found!"
    echo "   Looking for: $PROJECT_ROOT/$BACKUP_DIR"
    exit 1
fi

echo "✅ Backup directory found"
echo ""

# Restore files
echo "📂 Restoring files..."

echo "  → admin.css"
cp "$PROJECT_ROOT/$BACKUP_DIR/admin.css" "$PROJECT_ROOT/public/css/admin.css"

echo "  → admin-common.css"
cp "$PROJECT_ROOT/$BACKUP_DIR/admin-common.css" "$PROJECT_ROOT/public/css/modules/admin-common.css"

echo "  → admin-layout.css"
cp "$PROJECT_ROOT/$BACKUP_DIR/admin-layout.css" "$PROJECT_ROOT/public/css/design-system/admin/admin-layout.css"

echo "  → admin.ejs"
cp "$PROJECT_ROOT/$BACKUP_DIR/admin.ejs" "$PROJECT_ROOT/views/layouts/admin.ejs"

echo "  → admin-chat.css"
cp "$PROJECT_ROOT/$BACKUP_DIR/admin-chat.css" "$PROJECT_ROOT/public/css/modules/admin-chat.css"

echo ""
echo "✅ All files restored successfully!"
echo ""

# Remove admin-complete.css if it exists
if [ -f "$PROJECT_ROOT/public/css/admin-complete.css" ]; then
    echo "🗑️  Removing admin-complete.css..."
    rm "$PROJECT_ROOT/public/css/admin-complete.css"
    echo "✅ admin-complete.css removed"
else
    echo "ℹ️  admin-complete.css not found (nothing to remove)"
fi

echo ""
echo "✅ ROLLBACK COMPLETE!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart the server: npm run dev"
echo "   2. Clear browser cache: Ctrl+Shift+R"
echo "   3. Test admin pages: http://localhost:3000/admin"
echo ""
echo "🔍 If issues persist:"
echo "   - Check browser console for errors"
echo "   - Check Network tab for 404s"
echo "   - Compare current files with backup"
echo ""
