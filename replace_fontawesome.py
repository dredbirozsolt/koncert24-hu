#!/usr/bin/env python3
"""
FontAwesome to Emoji Converter
Automatically replaces all FontAwesome icons with emojis in views files
"""

import os
import re
from pathlib import Path

# FontAwesome → Emoji mapping
ICON_MAP = {
    # Navigation & Actions
    'fa-arrow-left': '←',
    'fa-arrow-right': '→',
    'fa-arrow-up': '↑',
    'fa-arrow-down': '↓',
    'fa-chevron-left': '‹',
    'fa-chevron-right': '›',
    'fa-times': '✖️',
    'fa-times-circle': '❌',
    'fa-check': '✓',
    'fa-check-circle': '✅',
    'fa-plus': '➕',
    'fa-minus': '➖',
    'fa-minus-circle': '➖',
    
    # Common UI
    'fa-save': '💾',
    'fa-edit': '✏️',
    'fa-trash': '🗑️',
    'fa-trash-alt': '🗑️',
    'fa-search': '🔍',
    'fa-filter': '🔍',
    'fa-sync': '🔄',
    'fa-sync-alt': '🔄',
    'fa-refresh': '🔄',
    'fa-redo': '🔄',
    'fa-spinner': '⏳',
    'fa-cog': '⚙️',
    'fa-eye': '👁️',
    'fa-download': '⬇️',
    'fa-upload': '⬆️',
    'fa-file-upload': '📤',
    'fa-play': '▶️',
    'fa-circle': '🔵',
    
    # Info & Status
    'fa-info-circle': 'ℹ️',
    'fa-question-circle': '❓',
    'fa-exclamation-circle': '⚠️',
    'fa-exclamation-triangle': '⚠️',
    'fa-lightbulb': '💡',
    'fa-bell': '🔔',
    
    # Time & Calendar
    'fa-clock': '⏱️',
    'fa-calendar': '📅',
    'fa-calendar-plus': '📅',
    'fa-calendar-alt': '📅',
    'fa-calendar-check': '✅',
    'fa-history': '📜',
    'fa-stopwatch': '⏱️',
    
    # Communication
    'fa-envelope': '✉️',
    'fa-phone': '📞',
    'fa-comments': '💬',
    'fa-comment': '💬',
    'fa-paper-plane': '📤',
    'fa-reply': '↩️',
    'fa-inbox': '📥',
    
    # People & Users
    'fa-user': '👤',
    'fa-users': '👥',
    'fa-user-circle': '👤',
    'fa-user-check': '✅',
    
    # Business & Office
    'fa-building': '🏢',
    'fa-briefcase': '💼',
    'fa-handshake': '🤝',
    'fa-folder': '📁',
    'fa-folder-open': '📂',
    'fa-folder-plus': '📁',
    'fa-file-alt': '📄',
    'fa-file-contract': '📋',
    
    # Tech & Development
    'fa-robot': '🤖',
    'fa-laptop-code': '💻',
    'fa-database': '💾',
    'fa-server': '🖥️',
    'fa-terminal': '💻',
    'fa-code': '💻',
    
    # Security & Protection
    'fa-shield-alt': '🛡️',
    'fa-lock': '🔒',
    'fa-key': '🔑',
    
    # Content & Media
    'fa-image': '🖼️',
    'fa-music': '🎵',
    'fa-microphone': '🎤',
    'fa-video': '🎥',
    'fa-newspaper': '📰',
    
    # Location & Map
    'fa-map-marker-alt': '📍',
    'fa-map-signs': '🗺️',
    'fa-globe': '🌍',
    
    # Social Media
    'fa-facebook': '📘',
    'fa-instagram': '📷',
    'fa-tiktok': '🎵',
    'fa-linkedin': '💼',
    'fa-youtube': '📺',
    'fa-twitter': '🐦',
    'fa-google': '🔍',
    'fa-share-alt': '🔗',
    
    # Other Common
    'fa-list': '📋',
    'fa-list-check': '✅',
    'fa-chart-bar': '📊',
    'fa-chart-line': '📈',
    'fa-toggle-on': '🔛',
    'fa-sitemap': '🗺️',
    'fa-tag': '🏷️',
    'fa-tags': '🏷️',
    'fa-link': '🔗',
    'fa-external-link-alt': '🔗',
    'fa-bolt': '⚡',
    'fa-mobile-alt': '📱',
    'fa-rocket': '🚀',
    'fa-magic': '✨',
    'fa-star': '⭐',
    'fa-broom': '🧹',
    'fa-box-open': '📦',
    'fa-undo': '↩️',
    'fa-flask': '🧪',
    'fa-vial': '🧪',
    'fa-ban': '🚫',
    'fa-sliders-h': '🎚️',
    'fa-exchange-alt': '🔄',
    'fa-plug': '🔌',
    'fa-door-open': '🚪',
    'fa-layer-group': '📚',
    'fa-network-wired': '🌐',
    'fa-signal': '📶',
    'fa-hand-pointer': '👆',
    'fa-ellipsis-h': '⋯',
    'fa-sort': '⇅',
    'fa-sort-numeric-down': '🔢',
    'fa-archive': '📦',
    'fa-guitar': '🎸',
    'fa-home': '🏠',
    'fa-sign-out-alt': '🚪',
    'fa-circle-notch': '⏳',
    'fa-satellite-dish': '📡',
    'fa-book': '📖',
}

def replace_fontawesome_in_file(file_path):
    """Replace FontAwesome icons with emojis in a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes = 0
        
        # Replace each FontAwesome icon
        for fa_class, emoji in ICON_MAP.items():
            # Pattern 1: <i class="fas fa-ICON"></i> (with optional styles and spaces)
            pattern1 = rf'<i\s+class="fa[srb]\s+{re.escape(fa_class)}(?:\s+[^"]*)?"\s*(?:style="[^"]*")?\s*></i>\s*'
            matches = re.findall(pattern1, content)
            if matches:
                content = re.sub(pattern1, f'{emoji} ', content)
                changes += len(matches)
            
            # Pattern 2: <i class="fas fa-ICON ... "></i> with other classes
            pattern2 = rf'<i\s+class="[^"]*fa[srb]\s+{re.escape(fa_class)}[^"]*"\s*(?:style="[^"]*")?\s*></i>\s*'
            matches = re.findall(pattern2, content)
            if matches:
                content = re.sub(pattern2, f'{emoji} ', content)
                changes += len(matches)
        
        # Special case: fa-spin spinner (keep as is or replace with loading emoji)
        content = re.sub(r'<i\s+class="fas\s+fa-spinner\s+fa-spin"[^>]*></i>', '⏳', content)
        
        # Write back if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes
        
        return 0
        
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return 0

def main():
    """Main function to process all view files"""
    print("🚀 FontAwesome to Emoji Converter")
    print("=" * 50)
    
    # Base directory
    base_dir = Path(__file__).parent / 'views'
    
    if not base_dir.exists():
        print(f"❌ Views directory not found: {base_dir}")
        return
    
    # Find all .ejs files
    ejs_files = list(base_dir.rglob('*.ejs'))
    
    # Exclude backup directories
    ejs_files = [f for f in ejs_files if 'backup' not in str(f)]
    
    print(f"📂 Found {len(ejs_files)} EJS files to process\n")
    
    total_changes = 0
    files_modified = 0
    
    for file_path in sorted(ejs_files):
        relative_path = file_path.relative_to(base_dir.parent)
        changes = replace_fontawesome_in_file(file_path)
        
        if changes > 0:
            print(f"✅ {relative_path}: {changes} icons replaced")
            total_changes += changes
            files_modified += 1
    
    print("\n" + "=" * 50)
    print(f"✨ Complete!")
    print(f"📊 Files modified: {files_modified}")
    print(f"🔄 Total icons replaced: {total_changes}")
    print("\n💡 Note: Dynamic icons (variables) need manual review!")
    print("   Example: fa-<%= statusIcon %>")

if __name__ == "__main__":
    main()
