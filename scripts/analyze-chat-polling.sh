#!/bin/bash
# Chat Polling Analyzer - Ellenőrzi a chat polling intervallumokat

echo "🔍 Chat Polling Analyzer"
echo "========================"
echo ""

# Find the latest log file
LATEST_LOG=$(ls -t logs/app-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "❌ Nincs log fájl!"
    exit 1
fi

echo "📄 Elemzett log: $LATEST_LOG"
echo ""

# Extract chat/session requests with timestamps
echo "⏰ Chat polling kérések időbélyegekkel:"
echo "---------------------------------------"

grep "chat/session" "$LATEST_LOG" 2>/dev/null | \
    jq -r '"\(.time) | \(.req.method) \(.req.url | split("/") | last)"' 2>/dev/null | \
    tail -20

echo ""
echo "📊 Időkülönbségek (másodpercben):"
echo "--------------------------------"

# Calculate intervals between requests
grep "chat/session" "$LATEST_LOG" 2>/dev/null | \
    jq -r '.time' 2>/dev/null | \
    awk '{
        if (prev != "") {
            cmd = "date -j -f \"%Y-%m-%dT%H:%M:%S\" \"" substr(prev,1,19) "\" +%s 2>/dev/null || date -d \"" prev "\" +%s"
            cmd | getline prev_ts
            close(cmd)
            
            cmd = "date -j -f \"%Y-%m-%dT%H:%M:%S\" \"" substr($0,1,19) "\" +%s 2>/dev/null || date -d \"" $0 "\" +%s"
            cmd | getline curr_ts
            close(cmd)
            
            diff = curr_ts - prev_ts
            if (diff > 0) {
                printf "%s  →  %s  =  %d másodperc\n", prev, $0, diff
            }
        }
        prev = $0
    }'

echo ""
echo "📈 Statisztika:"
echo "--------------"

TOTAL=$(grep -c "chat/session" "$LATEST_LOG" 2>/dev/null)
echo "Összes chat kérés: $TOTAL"

if [ $TOTAL -gt 1 ]; then
    echo ""
    echo "💡 Adaptív polling értékelés:"
    echo "  3s  = Aktív chat (új üzenetek)"
    echo "  5s  = Kezdeti állapot"
    echo " 10s  = 15mp csend után"
    echo " 30s  = 1 perc csend után"
fi
