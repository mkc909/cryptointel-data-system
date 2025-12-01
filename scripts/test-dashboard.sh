#!/bin/bash

# CryptoIntel Enhanced Dashboard Test Script
# Tests all dashboard endpoints and functionality

BASE_URL="${1:-http://localhost:8787}"
ERRORS=0

echo "==================================="
echo "CryptoIntel Dashboard Test Suite"
echo "==================================="
echo "Testing against: $BASE_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_status="${3:-200}"

    echo -n "Testing $name... "

    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Test JSON response
test_json_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_field="$3"

    echo -n "Testing $name... "

    response=$(curl -s "$BASE_URL$endpoint")

    if echo "$response" | grep -q "\"$expected_field\""; then
        echo -e "${GREEN}✓ PASS${NC} (contains '$expected_field')"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (missing '$expected_field')"
        echo "Response: $response"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

echo "1. Testing Dashboard HTML Endpoints"
echo "-----------------------------------"
test_endpoint "Enhanced Dashboard" "/enhanced-dashboard" 200
test_endpoint "Standard Dashboard" "/dashboard" 200
test_endpoint "Intelligence Dashboard" "/intelligence" 200
echo ""

echo "2. Testing Enhanced Dashboard API Endpoints"
echo "-------------------------------------------"
test_json_endpoint "Stats API" "/enhanced-dashboard/api/stats" "signals"
test_json_endpoint "Signals API" "/enhanced-dashboard/api/signals" "signals"
test_json_endpoint "Market API" "/enhanced-dashboard/api/market" "marketData"
test_json_endpoint "Transactions API" "/enhanced-dashboard/api/transactions" "transactions"
test_json_endpoint "Entities API" "/enhanced-dashboard/api/entities" "entities"
echo ""

echo "3. Testing Signal Filtering"
echo "---------------------------"
test_json_endpoint "Filter by type" "/enhanced-dashboard/api/signals?type=sentiment_shift" "signals"
test_json_endpoint "Filter by confidence" "/enhanced-dashboard/api/signals?minConfidence=0.5" "signals"
test_json_endpoint "Limit results" "/enhanced-dashboard/api/signals?limit=10" "count"
echo ""

echo "4. Testing Market Data with Parameters"
echo "--------------------------------------"
test_json_endpoint "Custom symbols" "/enhanced-dashboard/api/market?symbols=BTC,ETH" "marketData"
test_json_endpoint "Time range 24h" "/enhanced-dashboard/api/market?range=24h" "timeRange"
echo ""

echo "5. Testing Entity Tracking"
echo "-------------------------"
test_json_endpoint "Entity list" "/enhanced-dashboard/api/entities?limit=10" "entities"
test_json_endpoint "Filter by type" "/enhanced-dashboard/api/entities?type=token" "entities"
echo ""

echo "6. Testing Core System Endpoints"
echo "--------------------------------"
test_endpoint "Health Check" "/health" 200
test_json_endpoint "Market Analysis" "/market-analysis?symbols=bitcoin" "data"
echo ""

echo "7. Testing Error Handling"
echo "------------------------"
test_endpoint "Invalid endpoint" "/enhanced-dashboard/api/invalid" 404
echo ""

# Performance tests
echo "8. Performance Tests"
echo "-------------------"

test_performance() {
    local name="$1"
    local endpoint="$2"

    echo -n "Testing $name response time... "

    start_time=$(date +%s%3N)
    curl -s "$BASE_URL$endpoint" > /dev/null
    end_time=$(date +%s%3N)

    duration=$((end_time - start_time))

    if [ "$duration" -lt 1000 ]; then
        echo -e "${GREEN}✓ FAST${NC} (${duration}ms)"
    elif [ "$duration" -lt 2000 ]; then
        echo -e "${YELLOW}○ OK${NC} (${duration}ms)"
    else
        echo -e "${RED}✗ SLOW${NC} (${duration}ms)"
        ERRORS=$((ERRORS + 1))
    fi
}

test_performance "Stats API" "/enhanced-dashboard/api/stats"
test_performance "Signals API" "/enhanced-dashboard/api/signals?limit=20"
test_performance "Market API" "/enhanced-dashboard/api/market"
echo ""

# Summary
echo "==================================="
echo "Test Summary"
echo "==================================="

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$ERRORS test(s) failed${NC}"
    exit 1
fi
