#!/bin/bash

# Quick Smoke Test - Role-Based Authentication
# Tests basic functionality without login

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║          🔥 SMOKE TEST - Role-Based Auth System 🔥           ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

BASE_URL="http://localhost:3000"
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local url=$1
    local expected=$2
    local name=$3
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$status" == "$expected" ]; then
        echo -e "${GREEN}✅${NC} $name (Expected: $expected, Got: $status)"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $name (Expected: $expected, Got: $status)"
        ((FAILED++))
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Testing Unauthenticated Access (should redirect to login)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "$BASE_URL/admin" "302" "GET /admin"
test_endpoint "$BASE_URL/admin/users" "302" "GET /admin/users"
test_endpoint "$BASE_URL/admin/chat" "302" "GET /admin/chat"
test_endpoint "$BASE_URL/admin/sales" "302" "GET /admin/sales"
test_endpoint "$BASE_URL/admin/blog" "302" "GET /admin/blog"
test_endpoint "$BASE_URL/admin/faq" "302" "GET /admin/faq"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Testing Public Routes (should be accessible)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

test_endpoint "$BASE_URL/" "200" "GET / (homepage)"
test_endpoint "$BASE_URL/auth/login" "200" "GET /auth/login"
test_endpoint "$BASE_URL/health" "200" "GET /health (health check)"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                       TEST RESULTS                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "📊 Total: $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✨ ALL TESTS PASSED! ✨${NC}"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Create sales user: mysql < scripts/create-sales-user.sql"
    echo "   2. Login as sales: http://localhost:3000/auth/login"
    echo "   3. Verify redirect to: /admin/sales"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo ""
    echo "⚠️  Check if server is running: npm run dev"
    echo ""
    exit 1
fi
