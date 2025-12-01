#!/bin/bash
# Performance Optimization Verification Script
# Tests that all indexes were created and are being used correctly

set -e

echo "==========================================="
echo "Performance Optimization Verification"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for tests
PASSED=0
FAILED=0

# Function to run test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"

    echo -n "Testing: $test_name... "

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAILED++))
        return 1
    fi
}

echo "1. Checking Index Creation"
echo "-------------------------------------------"

# Test 1: Check total index count
run_test "Total index count (should be 58+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'\" --json | jq -r '.[0].results[0].count'" \
    "[5-9][0-9]"

# Test 2: Check signals table indexes
run_test "Signals table advanced indexes (should be 7+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND tbl_name='signals' AND name LIKE 'idx_signals_%'\" --json | jq -r '.[0].results[0].count'" \
    "[7-9]"

# Test 3: Check market_data table indexes
run_test "Market data table advanced indexes (should be 4+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND tbl_name='market_data' AND name LIKE 'idx_market_data_%'\" --json | jq -r '.[0].results[0].count'" \
    "[4-6]"

# Test 4: Check entity_mentions table indexes
run_test "Entity mentions table advanced indexes (should be 5+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND tbl_name='entity_mentions' AND name LIKE 'idx_entity_mentions_%'\" --json | jq -r '.[0].results[0].count'" \
    "[5-7]"

# Test 5: Check transactions table indexes
run_test "Transactions table advanced indexes (should be 5+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND tbl_name='transactions' AND name LIKE 'idx_transactions_%'\" --json | jq -r '.[0].results[0].count'" \
    "[5-7]"

# Test 6: Check DEX table indexes
run_test "DEX tables advanced indexes (should be 15+)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND (tbl_name='dex_pairs' OR tbl_name='dex_signals' OR tbl_name='dex_trades') AND name LIKE 'idx_dex_%'\" --json | jq -r '.[0].results[0].count'" \
    "1[5-9]"

echo ""
echo "2. Checking Archival Tables"
echo "-------------------------------------------"

# Test 7: Check archive tables exist
run_test "Archive tables created (should be 5)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name LIKE 'archived_%'\" --json | jq -r '.[0].results[0].count'" \
    "5"

# Test 8: Check unified views exist
run_test "Unified views created (should be 3)" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"SELECT COUNT(*) as count FROM sqlite_master WHERE type='view' AND name LIKE 'all_%'\" --json | jq -r '.[0].results[0].count'" \
    "3"

echo ""
echo "3. Checking Query Plan Optimization"
echo "-------------------------------------------"

# Test 9: Check signal query uses index
run_test "Signal entity query uses index" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"EXPLAIN QUERY PLAN SELECT * FROM signals WHERE entity = 'bitcoin' AND timestamp > strftime('%s', 'now', '-7 days') ORDER BY timestamp DESC LIMIT 50\"" \
    "idx_signals_entity_timestamp"

# Test 10: Check market data query uses index
run_test "Market data symbol query uses index" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"EXPLAIN QUERY PLAN SELECT * FROM market_data WHERE symbol = 'BTC' AND timestamp > strftime('%s', 'now', '-7 days') ORDER BY timestamp DESC\"" \
    "idx_market_data_symbol_timestamp"

# Test 11: Check transaction revenue query uses index
run_test "Transaction revenue query uses index" \
    "wrangler d1 execute CRYPTOINTEL_DB --command=\"EXPLAIN QUERY PLAN SELECT tool_id, SUM(amount) FROM transactions WHERE status = 'confirmed' GROUP BY tool_id\"" \
    "idx_transactions_status_tool"

echo ""
echo "4. Performance Benchmarks"
echo "-------------------------------------------"

# Test 12: Simple signal query performance
echo -n "Testing: Signal query performance... "
start=$(date +%s%N)
wrangler d1 execute CRYPTOINTEL_DB --command="SELECT * FROM signals WHERE entity = 'bitcoin' LIMIT 50" --json > /dev/null 2>&1
end=$(date +%s%N)
elapsed=$((($end - $start) / 1000000)) # Convert to milliseconds

if [ $elapsed -lt 100 ]; then
    echo -e "${GREEN}PASS${NC} (${elapsed}ms < 100ms target)"
    ((PASSED++))
else
    echo -e "${YELLOW}SLOW${NC} (${elapsed}ms > 100ms target)"
fi

# Test 13: Market data aggregation performance
echo -n "Testing: Market data aggregation performance... "
start=$(date +%s%N)
wrangler d1 execute CRYPTOINTEL_DB --command="SELECT symbol, AVG(price) FROM market_data GROUP BY symbol LIMIT 10" --json > /dev/null 2>&1
end=$(date +%s%N)
elapsed=$((($end - $start) / 1000000))

if [ $elapsed -lt 150 ]; then
    echo -e "${GREEN}PASS${NC} (${elapsed}ms < 150ms target)"
    ((PASSED++))
else
    echo -e "${YELLOW}SLOW${NC} (${elapsed}ms > 150ms target)"
fi

echo ""
echo "5. Database Health Check"
echo "-------------------------------------------"

# Test 14: Check database size
echo -n "Checking database size... "
size=$(wrangler d1 execute CRYPTOINTEL_DB --command="SELECT page_count * page_size / 1024 / 1024 as size_mb FROM pragma_page_count(), pragma_page_size()" --json 2>/dev/null | jq -r '.[0].results[0].size_mb' 2>/dev/null || echo "0")
echo "${size} MB"

# Test 15: Check table row counts
echo "Table row counts:"
wrangler d1 execute CRYPTOINTEL_DB --command="
  SELECT 'signals' as table_name, COUNT(*) as row_count FROM signals
  UNION SELECT 'market_data', COUNT(*) FROM market_data
  UNION SELECT 'entity_mentions', COUNT(*) FROM entity_mentions
  UNION SELECT 'transactions', COUNT(*) FROM transactions
  UNION SELECT 'dex_pairs', COUNT(*) FROM dex_pairs
" --json 2>/dev/null | jq -r '.[0].results[] | "  \(.table_name): \(.row_count)"' 2>/dev/null || echo "  Unable to fetch row counts"

echo ""
echo "==========================================="
echo "Results Summary"
echo "==========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All performance optimizations verified successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Monitor query performance in production"
    echo "2. Set up archival cron job (see migrations/002_archival_strategy.sql)"
    echo "3. Review docs/query-optimization.md for best practices"
    exit 0
else
    echo -e "${RED}✗ Some optimizations failed verification${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Ensure migrations were applied: npm run db:migrate"
    echo "2. Run ANALYZE: wrangler d1 execute CRYPTOINTEL_DB --command='ANALYZE'"
    echo "3. Check logs: wrangler tail"
    echo "4. Review docs/query-optimization.md"
    exit 1
fi
