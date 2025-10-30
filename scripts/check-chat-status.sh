#!/bin/bash

# Chat Settings Checker - Böngésző alapú ellenőrzés
# Admin bejelentkezéssel

echo "═══════════════════════════════════════════════════"
echo "  🔍 Chat Beállítások Ellenőrzése"
echo "═══════════════════════════════════════════════════"
echo ""

SERVER_URL="${1:-http://localhost:3000}"
ADMIN_EMAIL="zsolt@dmf.hu"
ADMIN_PASSWORD="qaywsx"

# 1. Login és session cookie megszerzése
echo "1️⃣  Admin bejelentkezés..."
LOGIN_RESPONSE=$(curl -s -c /tmp/chat_cookies.txt -b /tmp/chat_cookies.txt \
  -X POST "$SERVER_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$ADMIN_EMAIL&password=$ADMIN_PASSWORD" \
  2>/dev/null)

# Check if login was successful
if echo "$LOGIN_RESPONSE" | grep -q "error\|Error"; then
    echo "   ❌ Bejelentkezés sikertelen"
    echo ""
    echo "Kérlek, lépj be manuálisan:"
    echo "   1. Nyisd meg: $SERVER_URL/auth/login"
    echo "   2. Email: $ADMIN_EMAIL"
    echo "   3. Jelszó: [a megadott jelszó]"
    echo "   4. Menj: $SERVER_URL/admin/chat/settings"
    exit 1
else
    echo "   ✅ Bejelentkezés sikeres"
fi

echo ""

# 2. Chat settings lekérése
echo "2️⃣  Chat beállítások lekérdezése..."
SETTINGS_PAGE=$(curl -s -b /tmp/chat_cookies.txt "$SERVER_URL/admin/chat/settings" 2>/dev/null)

echo ""
echo "═══════════════════════════════════════════════════"
echo "  📊 CHAT BEÁLLÍTÁSOK ÁLLAPOTA"
echo "═══════════════════════════════════════════════════"
echo ""

# Check AI Enabled
if echo "$SETTINGS_PAGE" | grep -q 'id="aiEnabled".*checked'; then
    echo "  🤖 AI Asszisztens:          ✅ ENGEDÉLYEZVE"
else
    echo "  🤖 AI Asszisztens:          ❌ LETILTVA"
fi

# Check Admin Chat Enabled
if echo "$SETTINGS_PAGE" | grep -q 'id="adminChatEnabled".*checked'; then
    echo "  👤 Admin Chat:              ✅ ENGEDÉLYEZVE"
else
    echo "  👤 Admin Chat:              ❌ LETILTVA"
fi

# Check OpenAI API Key
if echo "$SETTINGS_PAGE" | grep -q 'id="openaiApiKey".*value="sk-'; then
    echo "  🔑 OpenAI API Key:          ✅ BEÁLLÍTVA"
elif echo "$SETTINGS_PAGE" | grep -q 'id="openaiApiKey"'; then
    echo "  🔑 OpenAI API Key:          ❌ NINCS BEÁLLÍTVA"
else
    echo "  🔑 OpenAI API Key:          ❓ MEZŐ NEM TALÁLHATÓ"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  🎯 KÖVETKEZTETÉS"
echo "═══════════════════════════════════════════════════"
echo ""

# Determine status
AI_ENABLED=$(echo "$SETTINGS_PAGE" | grep -q 'id="aiEnabled".*checked' && echo "yes" || echo "no")
ADMIN_ENABLED=$(echo "$SETTINGS_PAGE" | grep -q 'id="adminChatEnabled".*checked' && echo "yes" || echo "no")
API_KEY_SET=$(echo "$SETTINGS_PAGE" | grep -q 'id="openaiApiKey".*value="sk-' && echo "yes" || echo "no")

if [ "$AI_ENABLED" = "no" ] && [ "$ADMIN_ENABLED" = "no" ]; then
    echo "  ⚠️  OFFLINE MÓD - Egyik szolgáltatás sem elérhető!"
    echo ""
    echo "  Ezért látod ezt az üzenetet:"
    echo "  'Jelenleg nincs elérhető ügyintéző. Kérjük, hagyja"
    echo "   üzenetét, és hamarosan válaszolunk!'"
    echo ""
    echo "  📋 MEGOLDÁS:"
    echo "     1. Nyisd meg: $SERVER_URL/admin/chat/settings"
    echo "     2. Kapcsold BE valamelyiket:"
    echo "        • 🤖 AI Asszisztens (OpenAI GPT-4)"
    echo "        • 👤 Admin Chat (emberi ügyintéző)"
    echo ""
elif [ "$AI_ENABLED" = "yes" ] && [ "$API_KEY_SET" = "no" ]; then
    echo "  ⚠️  AI ENABLED de API KEY HIÁNYZIK!"
    echo ""
    echo "  Az AI engedélyezve van, de nincs API kulcs → OFFLINE mód"
    echo ""
    echo "  📋 MEGOLDÁS:"
    echo "     1. Nyisd meg: $SERVER_URL/admin/chat/settings"
    echo "     2. Add meg az OpenAI API kulcsot"
    echo "     VAGY"
    echo "     3. Kapcsold be az Admin Chat szolgáltatást"
    echo ""
elif [ "$AI_ENABLED" = "yes" ] && [ "$API_KEY_SET" = "yes" ]; then
    echo "  ✅ AI MÓD AKTÍV"
    echo ""
    echo "  A chat AI módban működik (GPT-4 válaszol)"
    echo ""
elif [ "$ADMIN_ENABLED" = "yes" ]; then
    echo "  ✅ ADMIN CHAT MÓD"
    echo ""
    echo "  Admin chat engedélyezve, de ellenőrizni kell:"
    echo "     • Van-e online admin a dashboardon?"
    echo "     • $SERVER_URL/admin/chat"
    echo ""
fi

echo "═══════════════════════════════════════════════════"
echo ""
echo "📝 Részletes beállítások itt:"
echo "   $SERVER_URL/admin/chat/settings"
echo ""

# Cleanup
rm -f /tmp/chat_cookies.txt

exit 0
