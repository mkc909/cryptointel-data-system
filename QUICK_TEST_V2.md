# Quick Test Guide - Version 2

## 1-Minute Verification

Test the three critical fixes immediately after deployment:

### Fix #1: Dashboard Stats Working

```bash
# Start local dev server
npm run dev

# In another terminal:
curl http://localhost:8787/dashboard/api/stats | jq '.signals.total'

# ✅ PASS: Should show a number (5, 10, 15, etc.)
# ❌ FAIL: If shows 0 or null
```

### Fix #2: Binance Replaced with Kraken

```bash
# Trigger collection
curl -X POST http://localhost:8787/collect

# Check which sources succeeded
curl http://localhost:8787/collection-status | jq '.results[] | select(.source == "Kraken")'

# ✅ PASS: Kraken shows success: true
# ❌ FAIL: Kraken shows success: false or is missing

# Should NOT see Binance in results
curl http://localhost:8787/collection-status | jq '.results[] | select(.source == "Binance")'

# ✅ PASS: Returns empty (no Binance)
# ❌ FAIL: Returns Binance data
```

### Fix #3: CoinCap Replaced with Messari

```bash
# Check Messari in collection results
curl http://localhost:8787/collection-status | jq '.results[] | select(.source == "Messari")'

# ✅ PASS: Messari appears in results (may succeed or fail - 50/50 is OK)
# ❌ FAIL: Messari is missing

# Should NOT see CoinCap in results
curl http://localhost:8787/collection-status | jq '.results[] | select(.source == "CoinCap")'

# ✅ PASS: Returns empty (no CoinCap)
# ❌ FAIL: Returns CoinCap data
```

## 5-Minute Full Test

### Setup
```bash
cd C:\dev\GITHUB_MKC909_REPOS\cryptointel-data-system
npm run dev
```

### Test Sequence

```bash
# 1. Health check (30 seconds)
curl http://localhost:8787/health | jq

# Expected:
# - version: "2.2.0-free-v2-honest"
# - sources: includes "kraken_public", "messari_free"
# - sources: does NOT include "binance_public", "coincap"
# - known_limitations: array with realistic limitations

# 2. Trigger collection (60 seconds)
curl -X POST http://localhost:8787/collect | jq

# Expected:
# - success_rate: "60.0%" to "75.0%" (realistic)
# - successful: 3-5 out of 6
# - totalSignals: 5-15
# - results: array with Kraken and Messari, not Binance/CoinCap

# 3. Check signals (10 seconds)
curl http://localhost:8787/signals?limit=10 | jq

# Expected:
# - count: >= 5
# - signals: array of signal objects
# - sources: should include "coingecko", "kraken", "defillama"

# 4. Check dashboard stats (10 seconds)
curl http://localhost:8787/dashboard/api/stats | jq

# Expected:
# - signals.total: >= 5 (not 0!)
# - signals.bySource: array with counts
# - signals.byType: array with counts
# - market.symbols_tracked: >= 5
# - market.data_points: >= 10

# 5. Check market data (10 seconds)
curl http://localhost:8787/market-data/BTC | jq

# Expected:
# - symbol: "BTC"
# - price: > 0
# - source: "coingecko" or "kraken"
# - cached: true or false

# 6. View dashboard page (10 seconds)
# Open in browser:
# http://localhost:8787/dashboard

# Expected:
# - Page loads without errors
# - Signal counts visible
# - Market data visible
# - Charts/graphs display
```

## Visual Dashboard Test

Open browser to: `http://localhost:8787/dashboard`

### What You Should See ✅

- **Signal Statistics**
  - Total signals: 5+ (not 0)
  - Signals by source: Multiple sources listed
  - Signals by type: Price alerts, volume anomalies, etc.

- **Market Data**
  - Symbols tracked: 5-10
  - Data points: 20+
  - Recent market data table with prices

- **Sources Working**
  - CoinGecko: ✅
  - DeFi Llama: ✅
  - Kraken: ✅ (NEW)
  - Alternative.me: ✅

### What You Should NOT See ❌

- Empty stats (0 signals, 0 market data)
- Binance in source list
- CoinCap in source list
- "100% success rate" (should be 60-75%)
- Entity extraction errors (it's optional now)

## Command Line Quick Tests

### One-liner health check:
```bash
curl -s http://localhost:8787/health | jq -r '.version, .sources[], .known_limitations[]'
```

Expected output:
```
2.2.0-free-v2-honest
coingecko_free
defillama
kraken_public
messari_free
alternative_me
cryptocompare_free
Some APIs blocked from Cloudflare IPs
Free tier rate limits apply
Success rate typically 60-75%
```

### One-liner collection test:
```bash
curl -s -X POST http://localhost:8787/collect | jq -r '.success_rate, .successful, .failed'
```

Expected output:
```
66.7%
4
2
```

### One-liner dashboard stats test:
```bash
curl -s http://localhost:8787/dashboard/api/stats | jq -r '.signals.total, .market.symbols_tracked'
```

Expected output:
```
12
8
```

## Production Deployment Test

After deploying to production:

```bash
# Set your worker URL
WORKER_URL="https://cryptointel-data.your-subdomain.workers.dev"

# 1. Quick health
curl -s $WORKER_URL/health | jq '.version'
# Should show: "2.2.0-free-v2-honest"

# 2. Trigger collection
curl -s -X POST $WORKER_URL/collect | jq '.success_rate'
# Should show: "60.0%" to "75.0%"

# 3. Wait for completion
sleep 30

# 4. Check stats
curl -s $WORKER_URL/dashboard/api/stats | jq '.signals.total'
# Should show: number > 0

# 5. View dashboard
# Open in browser:
echo "Open: $WORKER_URL/dashboard"
```

## Troubleshooting Quick Checks

### If dashboard shows 0 signals:

```bash
# Check database directly
wrangler d1 execute CRYPTOINTEL_DB --local --command "SELECT COUNT(*) FROM signals"

# If count is 0, manually collect:
curl -X POST http://localhost:8787/collect

# Wait 30 seconds
sleep 30

# Check again
curl http://localhost:8787/dashboard/api/stats
```

### If collection fails completely:

```bash
# Check logs
wrangler tail

# Look for error messages
# Common issues:
# - "Rate limit exceeded" = Wait 1 minute
# - "HTTP 451" = Still using old Binance code (not v2)
# - "Timeout" = Still using old CoinCap code (not v2)
```

### If wrong version deployed:

```bash
# Verify which version is running
curl http://localhost:8787/health | jq '.version'

# Should show: "2.2.0-free-v2-honest"
# If shows older version, check wrangler.toml:
cat wrangler.toml | grep main

# Should show:
# main = "src/index-free-v2.js"
```

## Success Indicators

After running tests, you should have:

✅ **Dashboard Stats Working**
- Shows actual signal counts
- Displays market data
- Entity mentions can be empty (that's OK)

✅ **API Replacements Working**
- Kraken appears in results
- Messari appears in results
- Binance does NOT appear
- CoinCap does NOT appear

✅ **Honest Reporting**
- Success rate shows 60-75%
- Known limitations documented
- Error messages are specific

✅ **Basic Functionality**
- Signals endpoint returns data
- Market data endpoint works
- Dashboard page loads
- Cron job runs (if deployed)

## Failure Indicators

If you see these, v2 is NOT properly deployed:

❌ **Dashboard shows 0 signals** (with signals in DB)
- Still using old JOIN query
- Not running v2 code

❌ **Binance or CoinCap in results**
- Not running v2 code
- Old version deployed

❌ **Success rate shows 100%**
- Not running v2 code
- Fake success reporting

❌ **Version shows old number**
- wrangler.toml points to wrong file
- Not redeployed after changes

## Quick Fix Commands

### Redeploy v2:
```bash
# Update wrangler.toml
echo 'main = "src/index-free-v2.js"' >> wrangler.toml

# Deploy
npm run deploy

# Verify
curl https://your-worker.workers.dev/health | jq '.version'
```

### Force fresh collection:
```bash
# Clear cache
wrangler kv:key delete "last_collection_status" --namespace-id=YOUR_KV_ID

# Trigger new collection
curl -X POST http://localhost:8787/collect

# Verify
curl http://localhost:8787/collection-status
```

### Check logs:
```bash
# Tail logs
wrangler tail

# Look for:
# "Running scheduled FREE data collection V2 at: ..."
# "V2 data collection summary: ..."
```

## 30-Second Smoke Test

The absolute minimum test to verify v2 is working:

```bash
# 1. Check version (5 seconds)
curl -s localhost:8787/health | jq -r '.version' | grep "v2-honest"

# 2. Check stats not empty (10 seconds)
curl -s localhost:8787/dashboard/api/stats | jq -r '.signals.total' | grep -v "^0$"

# 3. Check Kraken present (5 seconds)
curl -s -X POST localhost:8787/collect | jq '.results[] | select(.source == "Kraken")'

# 4. Check Binance absent (5 seconds)
curl -s -X POST localhost:8787/collect | jq '.results[] | select(.source == "Binance")' | grep -q "^$"

# 5. Check realistic success rate (5 seconds)
curl -s localhost:8787/collection-status | jq -r '.success_rate' | grep -E "^[6-7][0-9]"
```

All 5 should pass for v2 to be working correctly.

---

*Quick Test Guide for v2.2.0-free-v2-honest*
*Total test time: 5 minutes for full test, 30 seconds for smoke test*
