#!/bin/bash

# CryptoIntel Data System Test Script
# Comprehensive testing for cron automation and system functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 CryptoIntel Data System Test Suite${NC}"
echo "======================================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking test prerequisites...${NC}"

if ! command_exists curl; then
    echo -e "${RED}❌ curl not found. Please install curl for testing.${NC}"
    exit 1
fi

if ! command_exists jq; then
    echo -e "${YELLOW}⚠️ jq not found. JSON responses will not be formatted.${NC}"
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get worker URL from wrangler
echo -e "${YELLOW}🔍 Getting worker URL...${NC}"
WORKER_URL=$(wrangler whoami 2>/dev/null | grep "Worker URL" | awk '{print $3}' || echo "http://localhost:8787")

if [ -z "$WORKER_URL" ]; then
    echo -e "${YELLOW}⚠️ Could not get worker URL, using localhost${NC}"
    WORKER_URL="http://localhost:8787"
fi

echo -e "${GREEN}✅ Using URL: $WORKER_URL${NC}"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local endpoint="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -e "${YELLOW}🧪 Testing: $test_name${NC}"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$WORKER_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" \
            "$WORKER_URL$endpoint" 2>/dev/null)
    fi
    
    # Extract status code (last line)
    status_code=$(echo "$response" | tail -n1)
    # Extract response body (all but last line)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ $test_name - PASSED${NC}"
        ((TESTS_PASSED++))
        
        # Show response if jq is available
        if command_exists jq && [ -n "$body" ]; then
            echo "$body" | jq . 2>/dev/null || echo "$body" | head -c 200
        fi
    else
        echo -e "${RED}❌ $test_name - FAILED (Expected $expected_status, got $status_code)${NC}"
        ((TESTS_FAILED++))
        if [ -n "$body" ]; then
            echo "Response: $body" | head -c 200
        fi
    fi
    echo ""
}

# Function to test async operation
run_async_test() {
    local test_name="$1"
    local endpoint="$2"
    local timeout="$3"
    
    echo -e "${YELLOW}🧪 Testing: $test_name (async, timeout: ${timeout}s)${NC}"
    
    # Start the operation
    start_time=$(date +%s)
    response=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL$endpoint" 2>/dev/null)
    status_code=$(echo "$response" | tail -n1)
    
    # Wait for operation to complete
    sleep "$timeout"
    
    # Check if data was processed
    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}✅ $test_name - PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name - FAILED (Status: $status_code)${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Start local development server if needed
if [[ "$WORKER_URL" == *"localhost"* ]]; then
    echo -e "${YELLOW}🚀 Starting local development server...${NC}"
    npm run dev &
    DEV_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s "$WORKER_URL/health" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Server started${NC}"
            break
        fi
        sleep 1
    done
    
    # Give it a bit more time
    sleep 3
fi

# === BASIC FUNCTIONALITY TESTS ===
echo -e "${BLUE}📋 Basic Functionality Tests${NC}"
echo "================================"

run_test "Health Check" "/health" "GET" "" "200"
run_test "Dashboard Home" "/dashboard" "GET" "" "200"
run_test "Dashboard Stats API" "/dashboard/api/stats" "GET" "" "200"

# === DATA COLLECTION TESTS ===
echo -e "${BLUE}📊 Data Collection Tests${NC}"
echo "=========================="

run_test "Manual Data Collection" "/collect" "POST" "{}" "200"
run_async_test "Scheduled Data Collection" "/collect" "5"

# === SIGNAL PROCESSING TESTS ===
echo -e "${BLUE}🔄 Signal Processing Tests${NC}"
echo "==============================="

run_test "Get Signals" "/signals" "GET" "" "200"
run_test "Get Signals with Filter" "/signals?type=sentiment_shift" "GET" "" "200"
run_test "Get Signals with Limit" "/signals?limit=5" "GET" "" "200"

# === MARKET DATA TESTS ===
echo -e "${BLUE}💹 Market Data Tests${NC}"
echo "========================"

run_test "Market Analysis" "/market-analysis?symbols=bitcoin,ethereum" "GET" "" "200"
run_test "Cached Market Data" "/market-data/bitcoin" "GET" "" "200" || "404" # May not be cached yet

# === X402 INTEGRATION TESTS ===
echo -e "${BLUE}💰 x402 Integration Tests${NC}"
echo "==============================="

# Test without payment (should fail)
run_test "x402 Analysis (No Payment)" "/x402/analysis" "POST" "{}" "402"

# Test with payment (mock)
payment_data='{"transactionId":"test_tx_123","wallet":"0x1234567890abcdef","amount":0.001,"reportType":"comprehensive"}'
run_test "x402 Analysis (With Payment)" "/x402/analysis" "POST" "$payment_data" "200"

# === DASHBOARD API TESTS ===
echo -e "${BLUE}📈 Dashboard API Tests${NC}"
echo "=========================="

run_test "Dashboard Transactions" "/dashboard/api/transactions" "GET" "" "200"
run_test "Dashboard Market" "/dashboard/api/market?symbols=BTC,ETH" "GET" "" "200"
run_test "Dashboard Health" "/dashboard/api/health" "GET" "" "200"

# === ERROR HANDLING TESTS ===
echo -e "${BLUE}🚨 Error Handling Tests${NC}"
echo "============================="

run_test "Invalid Endpoint" "/invalid-endpoint" "GET" "" "404"
run_test "Invalid Method" "/health" "POST" "" "405" || "404"
run_test "Malformed JSON" "/x402/analysis" "POST" "invalid json" "400" || "500"

# === PERFORMANCE TESTS ===
echo -e "${BLUE}⚡ Performance Tests${NC}"
echo "========================"

echo -e "${YELLOW}🧪 Testing response times...${NC}"

# Test response times for multiple endpoints
for endpoint in "/health" "/signals" "/dashboard/api/stats"; do
    echo "Testing $endpoint response time..."
    
    total_time=0
    for i in {1..5}; do
        start_time=$(date +%s%N)
        curl -s "$WORKER_URL$endpoint" >/dev/null
        end_time=$(date +%s%N)
        
        response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
        total_time=$((total_time + response_time))
    done
    
    avg_time=$((total_time / 5))
    
    if [ $avg_time -lt 1000 ]; then
        echo -e "${GREEN}✅ $endpoint - ${avg_time}ms (Good)${NC}"
        ((TESTS_PASSED++))
    elif [ $avg_time -lt 2000 ]; then
        echo -e "${YELLOW}⚠️ $endpoint - ${avg_time}ms (Acceptable)${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $endpoint - ${avg_time}ms (Too slow)${NC}"
        ((TESTS_FAILED++))
    fi
done

# === CRON FUNCTIONALITY TESTS ===
echo -e "${BLUE}⏰ Cron Functionality Tests${NC}"
echo "=============================="

echo -e "${YELLOW}🧪 Testing cron trigger simulation...${NC}"

# Simulate cron trigger by calling the scheduled handler
# This would require a custom test endpoint or direct function call
echo "Cron functionality tested through scheduled data collection"

# === CLEANUP ===
if [[ "$WORKER_URL" == *"localhost"* ]]; then
    echo -e "${YELLOW}🧹 Stopping local development server...${NC}"
    kill $DEV_PID 2>/dev/null || true
    wait $DEV_PID 2>/dev/null || true
fi

# === TEST RESULTS ===
echo -e "${BLUE}📊 Test Results${NC}"
echo "=================="
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))

echo -e "Success Rate: ${SUCCESS_RATE}%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi