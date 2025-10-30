#!/bin/bash

# Admin Pages Cleanup Script
# Removes all inline styles and <style> blocks from admin pages
# Uses design system classes only

echo "🧹 Admin Pages Cleanup Script"
echo "================================"

# List of admin pages to clean
ADMIN_PAGES=(
    "views/admin/backup.ejs"
    "views/admin/company-settings.ejs"
    "views/admin/cron-jobs.ejs"
    "views/admin/email-settings.ejs"
    "views/admin/events.ejs"
    "views/admin/exit-popup.ejs"
    "views/admin/logs.ejs"
    "views/admin/seo-settings.ejs"
    "views/admin/settings.ejs"
    "views/admin/social-settings.ejs"
    "views/admin/user-form.ejs"
)

# Counter
count=0

for page in "${ADMIN_PAGES[@]}"; do
    if [ -f "$page" ]; then
        echo "📄 Processing: $page"
        
        # Remove all inline style attributes
        sed -i '' 's/ style="[^"]*"//g' "$page"
        
        ((count++))
    else
        echo "⚠️  File not found: $page"
    fi
done

echo "================================"
echo "✅ Cleaned $count admin pages"
echo ""
echo "⚠️  Manual review still needed:"
echo "   - Replace <style> blocks with design system classes"
echo "   - Replace custom grid layouts with .admin-two-col"
echo "   - Replace custom classes with .data-card, .filter-card, etc."
echo "   - Test each page for functionality"
